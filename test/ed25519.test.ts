import { keccak256 } from "@agntn/hashes/keccak";
import { sha512 } from "@agntn/hashes/sha2";
import { describe, expect, it } from "vite-plus/test";
import { bytesToHex, concatBytes, hexToBytes } from "../src/core/bytes.ts";
import {
  addPoints,
  ed25519,
  getPublicKey,
  INVALID_POINT,
  isIdentity,
  isTorsionFree,
  isValidPoint,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  reduceScalar,
  sign,
  subtractPoints,
  verify,
} from "../src/ed25519.ts";
import {
  invalidEncodings,
  monero,
  nobleSignatures,
  orderEight,
  rfc8032Keys,
  rfc8032Signatures,
  speccheck,
  unreducedR,
} from "./fixtures/ed25519.ts";
import wycheproof from "./fixtures/wycheproof-ed25519.json" with { type: "json" };

const identity = `01${"0".repeat(62)}`;
const base = "58".padEnd(64, "6");
const scalarRange = "Scalar must be a bigint from 0 to l, the order of the base point, minus 1";

/* Wycheproof tcId 151: an R of y = 1 with the sign bit set on x = 0, which only ZIP 215 decodes. */
const SIGNED_ZERO = 151;

/**
 * Hash a secret and clamp the low half, as RFC 8032, section 5.1.5, makes the secret scalar.
 * @param secret - 64 hex digits
 * @returns {string} The clamped 32 bytes as hex
 */
function clamp(secret: string): string {
  const half = sha512(hexToBytes(secret) ?? new Uint8Array()).slice(0, 32);
  half[0] = (half[0] ?? 0) & 248;
  half[31] = ((half[31] ?? 0) & 127) | 64;
  return bytesToHex(half);
}

describe("ed25519", () => {
  it("encodes the base point and the identity as RFC 8032 does", () => {
    expect(multiplyGenerator(1n)).toBe(base);
    expect(multiplyGenerator(0n)).toBe(identity);
    expect(multiplyGenerator(ed25519.l - 1n)).toBe(negatePoint(base));
    expect(addPoints(multiplyGenerator(ed25519.l - 1n), base)).toBe(identity);
  });

  it("gives the public keys of RFC 8032 from their clamped secrets", () => {
    for (const [secret, publicKey] of rfc8032Keys) {
      expect(multiplyGenerator(reduceScalar(clamp(secret)))).toBe(publicKey);
    }
  });

  it("builds a Monero subaddress: D = B + mG, C = aD", () => {
    const indices = "0100000001000000";
    const tag = new TextEncoder().encode("SubAddr\0");
    const hash = keccak256(concatBytes(tag, hexToBytes(monero.viewSecret + indices) ?? []));
    const m = reduceScalar(bytesToHex(hash));
    const subSpend = addPoints(monero.spend, multiplyGenerator(m));
    expect(subSpend).toBe(monero.subSpend);
    expect(multiplyPoint(subSpend, reduceScalar(monero.viewSecret))).toBe(monero.subView);
    expect(subtractPoints(subSpend, multiplyGenerator(m))).toBe(monero.spend);
  });

  it("tells the identity and points of small order apart, as check_address does", () => {
    expect(isIdentity(identity)).toBe(true);
    expect(isTorsionFree(identity)).toBe(true);
    for (const key of [monero.spend, monero.view, monero.subSpend, monero.subView]) {
      expect(isIdentity(key)).toBe(false);
      expect(isTorsionFree(key)).toBe(true);
    }
    expect(isValidPoint(orderEight)).toBe(true);
    expect(isTorsionFree(orderEight)).toBe(false);
    expect(isTorsionFree(addPoints(base, orderEight))).toBe(false);
    expect(multiplyPoint(orderEight, 8n)).toBe(identity);
    expect(multiplyPoint(orderEight, 4n)).not.toBe(identity);
  });

  it("refuses non-canonical encodings and anything that isn't 32 bytes of hex", () => {
    for (const encoding of invalidEncodings) {
      expect(isValidPoint(encoding)).toBe(false);
      expect(() => negatePoint(encoding)).toThrow(INVALID_POINT);
      expect(() => isTorsionFree(encoding)).toThrow(INVALID_POINT);
    }
    expect(isValidPoint(1 as unknown as string)).toBe(false);
  });

  it("reduces 32 and 64 bytes mod l, little-endian", () => {
    const l = "edd3f55c1a631258d69cf7a2def9de1400000000000000000000000000000010";
    expect(reduceScalar(l)).toBe(0n);
    expect(reduceScalar(`ee${l.slice(2)}`)).toBe(1n);
    expect(reduceScalar(`${l}${"0".repeat(64)}`)).toBe(0n);
    expect(reduceScalar("f".repeat(64))).toBe((2n ** 256n - 1n) % ed25519.l);
    for (const text of ["", "00", "0".repeat(66), "g".repeat(64), 7 as unknown as string]) {
      expect(() => reduceScalar(text)).toThrow("Scalar to reduce must be 32 or 64 bytes of hex");
    }
  });

  it("takes scalars as bigints below l only", () => {
    for (const scalar of [-1n, ed25519.l, 1 as unknown as bigint, "01" as unknown as bigint]) {
      expect(() => multiplyGenerator(scalar)).toThrow(scalarRange);
      expect(() => multiplyPoint(base, scalar)).toThrow(scalarRange);
    }
  });
});

describe("Ed25519 verify", () => {
  const [first] = rfc8032Signatures;
  if (first === undefined) throw new Error("The RFC 8032 fixture lost test 1");

  it("verifies the five signatures of RFC 8032, section 7.1, under both rules", () => {
    for (const { name, publicKey, message, signature } of rfc8032Signatures) {
      for (const zip215 of [true, false]) {
        expect(verify(signature, { message, publicKey, zip215 }), `TEST ${name}`).toBe(true);
        const upper = { message: message.toUpperCase(), publicKey: publicKey.toUpperCase() };
        expect(verify(signature.toUpperCase(), { ...upper, zip215 }), `TEST ${name}`).toBe(true);
        const other = { message: `${message}00`, publicKey, zip215 };
        expect(verify(signature, other), `TEST ${name}`).toBe(false);
      }
    }
    expect(rfc8032Signatures.map(({ message }) => message.length / 2)).toEqual([0, 1, 2, 1023, 64]);
  });

  it("answers every Wycheproof vector, acceptable ones by the rules in force", () => {
    let count = 0;
    for (const { publicKey, tests } of wycheproof.groups) {
      for (const { tcId, msg: message, sig, result, flags } of tests) {
        const strict =
          result === "valid" || (result === "acceptable" && !flags.includes("SmallOrderPublicKey"));
        const zip215 = result !== "invalid" || tcId === SIGNED_ZERO;
        if (sig.length === 128) {
          expect(verify(sig, { message, publicKey }), `tcId ${tcId}`).toBe(zip215);
          expect(verify(sig, { message, publicKey, zip215: false }), `tcId ${tcId}`).toBe(strict);
        } else {
          expect(result, `tcId ${tcId}`).toBe("invalid");
          expect(() => verify(sig, { message, publicKey }), `tcId ${tcId}`).toThrow(RangeError);
        }
        count++;
      }
    }
    expect(count).toBe(210);
  });

  it("agrees with @noble/curves 2.4.0 on the twelve speccheck cases, under both rules", () => {
    for (const [index, { publicKey, message, signature, zip215, strict }] of speccheck.entries()) {
      expect(verify(signature, { message, publicKey }), `case ${index}`).toBe(zip215);
      expect(verify(signature, { message, publicKey, zip215: false }), `case ${index}`).toBe(
        strict,
      );
    }
    expect(speccheck.map(({ zip215 }) => zip215)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
    expect(speccheck.map(({ strict }) => strict)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("reads a y from p up mod p under ZIP 215, and hashes R as it was written", () => {
    const { publicKey, message, signature } = unreducedR;
    expect(verify(signature, { message, publicKey })).toBe(true);
    expect(verify(signature, { message, publicKey, zip215: false })).toBe(false);
  });

  it("fails an R or a key that doesn't decode, and an S from l up, instead of throwing", () => {
    const { publicKey, message, signature } = first;
    for (const encoding of invalidEncodings.filter(
      (text) => text.length === 64 && !text.startsWith("zz"),
    )) {
      for (const zip215 of [true, false]) {
        expect(verify(signature, { message, publicKey: encoding, zip215 }), encoding).toBe(false);
        const r = `${encoding}${signature.slice(64)}`;
        expect(verify(r, { message, publicKey, zip215 }), encoding).toBe(false);
      }
    }
    const l = "edd3f55c1a631258d69cf7a2def9de1400000000000000000000000000000010";
    expect(verify(`${signature.slice(0, 64)}${l}`, { message, publicKey })).toBe(false);
  });

  it("refuses arguments in another shape, in the caller's words", () => {
    const { publicKey, message, signature } = first;
    for (const malformed of [signature.slice(2), `0x${signature.slice(2)}`, null, 7]) {
      expect(() => {
        Reflect.apply(verify, undefined, [malformed, { message, publicKey }]);
      }).toThrow("Signature must be 128 hex digits without 0x, R then S");
    }
    for (const malformed of ["0", "0x00", "zz", null, 7]) {
      expect(() => {
        Reflect.apply(verify, undefined, [signature, { message: malformed, publicKey }]);
      }).toThrow("Message must be hex without 0x");
    }
    for (const malformed of [`00${publicKey}`, `0x${publicKey.slice(2)}`, publicKey.slice(2)]) {
      expect(() => verify(signature, { message, publicKey: malformed })).toThrow(
        "Public key must be 64 hex digits without 0x",
      );
    }
    for (const zip215 of ["false", 0, null]) {
      expect(() => {
        Reflect.apply(verify, undefined, [signature, { message, publicKey, zip215 }]);
      }).toThrow("zip215 must be a boolean");
    }
    for (const options of [undefined, null, message]) {
      expect(() => {
        Reflect.apply(verify, undefined, [signature, options]);
      }).toThrow("Call it as verify(signature, { message, publicKey })");
    }
    const nobleShape = [Buffer.from(signature, "hex"), Buffer.from(message, "hex"), publicKey];
    expect(() => {
      Reflect.apply(verify, undefined, nobleShape);
    }).toThrow("Signature must be 128 hex digits without 0x, R then S");
  });
});

describe("Ed25519 sign", () => {
  const [keys] = rfc8032Keys;
  if (keys === undefined) throw new Error("The RFC 8032 fixture lost test 1");
  const [secret, publicKey] = keys;
  const secretLength = "Secret must be 64 hex digits without 0x, the 32 bytes RFC 8032 hashes";

  it("signs the five tests of RFC 8032, section 7.1, byte for byte", () => {
    for (const [index, { name, message, signature }] of rfc8032Signatures.entries()) {
      const [testSecret, testKey] = rfc8032Keys[index] ?? ["", ""];
      expect(getPublicKey(testSecret), `TEST ${name}`).toBe(testKey);
      expect(rfc8032Signatures[index]?.publicKey, `TEST ${name}`).toBe(testKey);
      expect(sign(testSecret, { message }), `TEST ${name}`).toBe(signature);
      const upper = { message: message.toUpperCase() };
      expect(sign(testSecret.toUpperCase(), upper), `TEST ${name}`).toBe(signature);
    }
    expect(rfc8032Keys).toHaveLength(5);
  });

  it("agrees with @noble/curves 2.4.0 on six signatures its own verify takes", () => {
    for (const [index, row] of nobleSignatures.entries()) {
      expect(getPublicKey(row.secret), `signature ${index}`).toBe(row.publicKey);
      expect(sign(row.secret, { message: row.message }), `signature ${index}`).toBe(row.signature);
      const { message } = row;
      for (const zip215 of [true, false]) {
        const options = { message, publicKey: row.publicKey, zip215 };
        expect(verify(row.signature, options), `signature ${index}`).toBe(true);
      }
    }
    expect(nobleSignatures.map(({ message }) => message.length / 2)).toEqual([
      32, 32, 0, 1, 64, 200,
    ]);
  });

  it("refuses arguments in another shape, without the secret in the message", () => {
    const message = "";
    for (const malformed of [secret.slice(2), `0x${secret.slice(2)}`, `${secret}${publicKey}`]) {
      expect(() => sign(malformed, { message })).toThrow(new RangeError(secretLength));
      expect(() => getPublicKey(malformed)).toThrow(new RangeError(secretLength));
    }
    for (const malformed of [null, 7, hexToBytes(secret)]) {
      expect(() => {
        Reflect.apply(sign, undefined, [malformed, { message }]);
      }).toThrow(secretLength);
      expect(() => {
        Reflect.apply(getPublicKey, undefined, [malformed]);
      }).toThrow(secretLength);
    }
    for (const malformed of ["0", "0x00", "zz", null, 7]) {
      expect(() => {
        Reflect.apply(sign, undefined, [secret, { message: malformed }]);
      }).toThrow("Message must be hex without 0x");
    }
    for (const options of [undefined, null, "00"]) {
      expect(() => {
        Reflect.apply(sign, undefined, [secret, options]);
      }).toThrow("Call it as sign(secret, { message })");
    }
    const digest = "ab".repeat(32);
    expect(() => {
      Reflect.apply(sign, undefined, [digest, secret]);
    }).toThrow("Call it as sign(secret, { message })");
    expect(() => {
      Reflect.apply(sign, undefined, [Buffer.from(digest, "hex"), Buffer.from(secret, "hex")]);
    }).toThrow(secretLength);
  });
});
