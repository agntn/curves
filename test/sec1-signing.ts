import { sha1 } from "@agntn/hashes/sha1";
import { sha224, sha256, sha384, sha512 } from "@agntn/hashes/sha2";
import { describe, expect, it } from "vite-plus/test";
import type {
  NonceHash,
  RecoverOptions,
  Signature,
  SignOptions,
  VerifyOptions,
} from "../src/p256.ts";
import { nonces } from "../src/core/rfc6979.ts";

/* What the suite calls on one curve's subpath. */
export interface SigningCurve {
  readonly name: string;
  readonly order: bigint;
  /* The hash sign keys its nonce with when none is named. */
  readonly fallback: NonceHash;
  readonly secret: string;
  /* The key of secret, uncompressed as the vectors print it. */
  readonly publicKey: string;
  readonly vectors: readonly {
    readonly hash: NonceHash;
    readonly message: string;
    readonly k?: string;
    readonly signature: string;
  }[];
  readonly sign: (secret: string, options: SignOptions) => Signature;
  readonly signingNonce: (secret: string, options: SignOptions) => string;
  readonly multiplyGenerator: (scalar: string) => string;
  readonly verify: (signature: string, options: VerifyOptions) => boolean;
  readonly recoverPublicKey: (signature: string, options: RecoverOptions) => string;
}

const HASHES = { sha1, sha224, sha256, sha384, sha512 } as const;

/* The digest of a message as hex, by the hash's name. */
function digestOf(hash: NonceHash, message: string): string {
  return Buffer.from(HASHES[hash](Buffer.from(message))).toString("hex");
}

/* The signature with s at most n / 2, the form sign returns. */
function lowS(curve: SigningCurve, signature: string): string {
  const half = signature.length / 2;
  const s = BigInt(`0x${signature.slice(half)}`);
  const low = s > curve.order >> 1n ? curve.order - s : s;
  return `${signature.slice(0, half)}${low.toString(16).padStart(half, "0")}`;
}

/* A number as hex of a fixed width. */
function hex(value: bigint, digits: number): string {
  return value.toString(16).padStart(digits, "0");
}

/* The inverse mod a prime order, by Fermat. */
function inverse(value: bigint, order: bigint): bigint {
  let [result, base, exponent] = [1n, value % order, order - 2n];
  for (; exponent > 0n; exponent >>= 1n) {
    if (exponent & 1n) result = (result * base) % order;
    base = (base * base) % order;
  }
  return result;
}

/* e of SEC 1: the leftmost bits of a digest, as many as the order has. */
function e(curve: SigningCurve, digest: string): bigint {
  const extra = digest.length * 4 - curve.order.toString(2).length;
  const whole = BigInt(`0x${digest}`);
  return extra > 0 ? whole >> BigInt(extra) : whole;
}

/* RFC 6979 signing on one SEC 1 curve, checked against signatures another signer printed. */
export function describeSigning(curve: SigningCurve): void {
  const { name, secret, publicKey, vectors } = curve;

  describe(`${name} ECDSA signing`, () => {
    it("signs every vector with its own hash under the HMAC, and recovers the key", () => {
      expect(vectors).toHaveLength(10);
      for (const { hash, message, signature } of vectors) {
        const digest = digestOf(hash, message);
        const signed = curve.sign(secret, { digest, hash });
        expect(signed.signature, `${hash} ${message}`).toBe(lowS(curve, signature));
        expect(curve.verify(signature, { digest, publicKey })).toBe(true);
        expect(curve.verify(signed.signature, { digest, publicKey, lowS: true })).toBe(true);
        const recovery = { digest, recovery: signed.recovery, compressed: false };
        expect(curve.recoverPublicKey(signed.signature, recovery)).toBe(publicKey);
      }
    });

    const drawn = vectors.filter((vector) => vector.k !== undefined);
    if (drawn.length > 0)
      it("draws the k the vectors print", () => {
        expect(drawn).toHaveLength(10);
        const d = BigInt(`0x${secret}`);
        for (const { hash, message, k } of drawn) {
          const digest = Buffer.from(digestOf(hash, message), "hex");
          const first = nonces(curve.order, { secret: d, digest, hash }).next().value;
          expect(first.toString(16).padStart(k?.length ?? 0, "0"), `${hash} ${message}`).toBe(k);
          expect(curve.signingNonce(secret, { digest: digestOf(hash, message), hash })).toBe(k);
        }
      });

    it("hands back the k behind every vector's r and s, never n minus k for a high s", () => {
      const d = BigInt(`0x${secret}`);
      const half = publicKey.length / 2 - 1;
      let high = 0;
      for (const { hash, message, signature } of vectors) {
        const digest = digestOf(hash, message);
        const nonce = curve.signingNonce(secret, { digest, hash });
        expect(nonce).toMatch(new RegExp(`^[0-9a-f]{${half}}$`));
        const r = BigInt(`0x${curve.multiplyGenerator(nonce).slice(2)}`) % curve.order;
        const s =
          (inverse(BigInt(`0x${nonce}`), curve.order) * (e(curve, digest) + r * d)) % curve.order;
        expect(`${hex(r, half)}${hex(s, half)}`, `${hash} ${message}`).toBe(signature);
        if (s > curve.order >> 1n) high++;
      }
      expect(high).toBeGreaterThan(0);
    });

    it("draws the nonce by the curve's own hash unless another is named, the same every time", () => {
      const digest = digestOf(curve.fallback, "sample");
      const named = curve.signingNonce(secret, { digest, hash: curve.fallback });
      expect(curve.signingNonce(secret, { digest })).toBe(named);
      expect(curve.signingNonce(secret, { digest: digest.toUpperCase() })).toBe(named);
      const other = curve.fallback === "sha1" ? "sha256" : "sha1";
      expect(curve.signingNonce(secret, { digest, hash: other })).not.toBe(named);
    });

    it("refuses for a nonce what sign refuses, and names its own call", () => {
      const digest = digestOf("sha256", "sample");
      expect(() => {
        Reflect.apply(curve.signingNonce, undefined, [secret, { digest, hash: "md5" }]);
      }).toThrow("Hash must be one of sha1, sha224, sha256, sha384, sha512");
      for (const malformed of ["0", curve.order.toString(16), "0x01", "", null]) {
        expect(() => {
          Reflect.apply(curve.signingNonce, undefined, [malformed, { digest }]);
        }, String(malformed)).toThrow(
          "Secret must be hex without 0x or a bigint, from 1 to the curve order minus 1",
        );
      }
      for (const malformed of ["", "0", "0x00", "00".repeat(65), null]) {
        expect(() => {
          Reflect.apply(curve.signingNonce, undefined, [secret, { digest: malformed }]);
        }, String(malformed)).toThrow("Digest must be hex without 0x, 1 to 64 bytes");
      }
      for (const options of [undefined, null, digest]) {
        expect(() => {
          Reflect.apply(curve.signingNonce, undefined, [secret, options]);
        }).toThrow("Call it as signingNonce(secret, { digest })");
      }
    });

    it(`keys the nonce with ${curve.fallback} when no hash is named`, () => {
      for (const { hash, message, signature } of vectors.filter((v) => v.hash === curve.fallback)) {
        const digest = digestOf(hash, message);
        expect(curve.sign(secret, { digest }).signature).toBe(lowS(curve, signature));
      }
      const digest = digestOf("sha1", "sample");
      const other = vectors.find((v) => v.hash === "sha1" && v.message === "sample");
      expect(curve.sign(secret, { digest }).signature).not.toBe(
        lowS(curve, other?.signature ?? ""),
      );
    });

    it("refuses a hash it doesn't know, a secret out of range and options in another shape", () => {
      const digest = digestOf("sha256", "sample");
      for (const hash of ["md5", "SHA256", "sha3-256", "", 256, null]) {
        expect(() => {
          Reflect.apply(curve.sign, undefined, [secret, { digest, hash }]);
        }, String(hash)).toThrow("Hash must be one of sha1, sha224, sha256, sha384, sha512");
      }
      expect(() => curve.sign("0", { digest })).toThrow(
        "Secret must be hex without 0x or a bigint, from 1 to the curve order minus 1",
      );
      expect(() => curve.sign(curve.order.toString(16), { digest })).toThrow(RangeError);
      expect(() => curve.sign(secret, { digest: "0x00" })).toThrow(
        "Digest must be hex without 0x, 1 to 64 bytes",
      );
      expect(() => {
        Reflect.apply(curve.sign, undefined, [secret, digest]);
      }).toThrow("Call it as sign(secret, { digest })");
    });
  });
}
