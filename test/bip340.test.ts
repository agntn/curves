import { readFileSync } from "node:fs";
import { sha256 } from "@agntn/hashes/sha2";
import { describe, expect, it } from "vite-plus/test";
import { getPublicKey, sign, verify } from "../src/bip340.ts";
import { nobleEdges, nobleSignatures, tampered } from "./fixtures/bip340.ts";

/* One row of the BIP's test-vectors.csv, bips commit 200f9b2. */
interface Vector {
  readonly index: string;
  readonly secret: string;
  readonly publicKey: string;
  readonly random: string;
  readonly message: string;
  readonly signature: string;
  readonly valid: boolean;
  readonly comment: string;
}

const vectors: readonly Vector[] = readFileSync(
  new URL("fixtures/bip340-vectors.csv", import.meta.url),
  "utf8",
)
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [index = "", secret = "", publicKey = "", random = "", message = "", ...rest] =
      line.split(",");
    const [signature = "", result, ...comment] = rest;
    return {
      index,
      secret,
      publicKey,
      random,
      message,
      signature,
      valid: result === "TRUE",
      comment: comment.join(","),
    };
  });

/* The vector at an index, so a test names the case it leans on. */
function vector(index: string): Vector {
  const found = vectors.find((row) => row.index === index);
  if (found === undefined) throw new Error(`test-vectors.csv lost vector ${index}`);
  return found;
}

describe("BIP340 verify", () => {
  it("answers every vector of the BIP's test-vectors.csv, in upper and lower case", () => {
    for (const { index, publicKey, message, signature, valid, comment } of vectors) {
      expect(verify(signature, { message, publicKey }), `vector ${index}: ${comment}`).toBe(valid);
      const lower = { message: message.toLowerCase(), publicKey: publicKey.toLowerCase() };
      expect(verify(signature.toLowerCase(), lower), `vector ${index}`).toBe(valid);
    }
    expect(vectors).toHaveLength(19);
  });

  it("agrees with @noble/curves 2.4.0 on its signatures and on three it refused", () => {
    for (const { message, signature, publicKey, valid } of [...nobleSignatures, ...tampered]) {
      expect(verify(signature, { message, publicKey }), message).toBe(valid);
    }
    expect(nobleSignatures.map(({ message }) => message.length / 2)).toEqual([
      32, 32, 0, 1, 64, 200,
    ]);
  });

  it("fails a key no point has, r from p up and s from n up, instead of throwing", () => {
    for (const index of ["5", "14", "12", "13"]) {
      const { publicKey, message, signature, comment } = vector(index);
      expect(verify(signature, { message, publicKey }), comment).toBe(false);
    }
  });

  it("refuses arguments in another shape, in the caller's words", () => {
    const { publicKey, message, signature } = vector("1");
    for (const malformed of [signature.slice(2), `0x${signature.slice(2)}`, null, 7]) {
      expect(() => {
        Reflect.apply(verify, undefined, [malformed, { message, publicKey }]);
      }).toThrow("Signature must be 128 hex digits without 0x, r then s");
    }
    for (const malformed of ["0", "0x00", "zz", null, 7]) {
      expect(() => {
        Reflect.apply(verify, undefined, [signature, { message: malformed, publicKey }]);
      }).toThrow("Message must be hex without 0x");
    }
    for (const malformed of [`02${publicKey}`, `0x${publicKey.slice(2)}`, publicKey.slice(2)]) {
      expect(() => verify(signature, { message, publicKey: malformed })).toThrow(
        "Public key must be 64 hex digits without 0x",
      );
    }
    for (const options of [undefined, null, message]) {
      expect(() => {
        Reflect.apply(verify, undefined, [signature, options]);
      }).toThrow("Call it as verify(signature, { message, publicKey })");
    }
    const nobleShape = [signature, Buffer.from(message, "hex"), Buffer.from(publicKey, "hex")];
    expect(() => {
      Reflect.apply(verify, undefined, nobleShape);
    }).toThrow("Message must be hex without 0x");
  });
});

/* SHA-256 of a label as hex, the recipe behind the secrets and aux_rand of the noble fixture. */
function hashed(label: string): string {
  return Buffer.from(sha256(Buffer.from(label))).toString("hex");
}

describe("BIP340 sign", () => {
  it("signs every vector of test-vectors.csv that has a secret, to the byte", () => {
    const signing = vectors.filter(({ secret }) => secret !== "");
    for (const { index, secret, publicKey, random, message, signature } of signing) {
      const lower = signature.toLowerCase();
      expect(sign(secret, { message, random }), `vector ${index}`).toBe(lower);
      expect(getPublicKey(secret), `vector ${index}`).toBe(publicKey.toLowerCase());
    }
    expect(signing.map(({ index }) => index)).toEqual(["0", "1", "2", "3", "15", "16", "17", "18"]);
  });

  it("signs what @noble/curves 2.4.0 signed, a key with odd y included", () => {
    for (const [index, { message, signature, publicKey }] of nobleSignatures.entries()) {
      const secret = hashed(`agntn/curves bip340 key ${index}`);
      const random = hashed(`agntn/curves bip340 aux ${index}`);
      expect(sign(secret, { message, random }), message).toBe(signature);
      expect(getPublicKey(secret)).toBe(publicKey);
    }
    for (const { secret, message, signature, publicKey } of nobleEdges) {
      expect(sign(secret, { message, random: "00".repeat(32) })).toBe(signature);
      expect(getPublicKey(secret)).toBe(publicKey);
    }
  });

  it("draws fresh aux_rand when none is given, so each signature is new and still verifies", () => {
    const { secret, publicKey, message } = vector("1");
    const signatures = [sign(secret, { message }), sign(secret, { message })];
    expect(signatures[0]).not.toBe(signatures[1]);
    for (const signature of signatures) {
      expect(verify(signature, { message, publicKey })).toBe(true);
    }
  });

  it("refuses arguments in another shape, in the caller's words", () => {
    const { secret, message } = vector("1");
    const order = "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141";
    for (const malformed of ["00".repeat(32), order, "f".repeat(64), secret.slice(2), 1n, null]) {
      expect(() => {
        Reflect.apply(sign, undefined, [malformed, { message }]);
      }).toThrow("Secret must be 64 hex digits without 0x, from 1 to the curve order minus 1");
      expect(() => {
        Reflect.apply(getPublicKey, undefined, [malformed]);
      }).toThrow("Secret must be 64 hex digits without 0x");
    }
    for (const malformed of ["0", "0x00", "zz", null]) {
      expect(() => {
        Reflect.apply(sign, undefined, [secret, { message: malformed }]);
      }).toThrow("Message must be hex without 0x");
    }
    for (const random of ["00", "0x" + "00".repeat(31), "", 0]) {
      expect(() => {
        Reflect.apply(sign, undefined, [secret, { message, random }]);
      }).toThrow("Random must be 64 hex digits without 0x, the aux_rand of BIP340");
    }
    for (const options of [undefined, null, message]) {
      expect(() => {
        Reflect.apply(sign, undefined, [secret, options]);
      }).toThrow("Call it as sign(secret, { message })");
    }
    const nobleShape = [Buffer.from(message, "hex"), Buffer.from(secret, "hex")];
    expect(() => {
      Reflect.apply(sign, undefined, nobleShape);
    }).toThrow("Secret must be 64 hex digits without 0x");
  });
});
