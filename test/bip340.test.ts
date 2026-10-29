import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { verify } from "../src/bip340.ts";
import { nobleSignatures, tampered } from "./fixtures/bip340.ts";

/* One row of the BIP's test-vectors.csv, bips commit 200f9b2: the columns verify reads. */
interface Vector {
  readonly index: string;
  readonly publicKey: string;
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
    const [index = "", , publicKey = "", , message = "", signature = "", result, ...comment] =
      line.split(",");
    return {
      index,
      publicKey,
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
