import { describe, expect, it } from "vite-plus/test";
import { bytesToHex, bytesToNumberLE, hexToBytes, numberToBytesLE } from "../src/core/bytes.ts";
import { isPrime } from "../src/core/field.ts";
import { ed448, verify } from "../src/ed448.ts";
import { opensslSignatures, rfc8032Signatures } from "./fixtures/ed448.ts";
import wycheproof from "./fixtures/wycheproof-ed448.json" with { type: "json" };

/* The identity encoded as RFC 8032 writes it: y = 1, sign bit clear. */
const IDENTITY = bytesToHex(numberToBytesLE(1n, 57));

/* An R, an S of zero and the identity as key: the equation holds for every message and context. */
const TRIVIAL = { signature: `${IDENTITY}${"0".repeat(114)}`, publicKey: IDENTITY };

/* A number as the 57 little-endian bytes of an Ed448 encoding. */
function encodeNumber(value: bigint): string {
  return bytesToHex(numberToBytesLE(value, 57));
}

/* The same signature with l added to S, which a check without the range would still pass. */
function addOrder(signature: string): string {
  const s = bytesToNumberLE(hexToBytes(signature.slice(114)) ?? []);
  return `${signature.slice(0, 114)}${encodeNumber(s + ed448.l)}`;
}

describe("Ed448 domain", () => {
  it("puts the base point on x^2 + y^2 = 1 + d x^2 y^2, with l prime", () => {
    const { p, d, l, g } = ed448;
    const xx = (g.x * g.x) % p;
    const yy = (g.y * g.y) % p;
    expect((xx + yy) % p).toBe((1n + ((d * xx) % p) * yy) % p);
    expect(p).toBe(2n ** 448n - 2n ** 224n - 1n);
    expect(d).toBe(p - 39081n);
    expect(isPrime(p)).toBe(true);
    expect(isPrime(l)).toBe(true);
    expect(ed448.h).toBe(4n);
  });
});

describe("Ed448 verify", () => {
  it("verifies the nine signatures of RFC 8032, section 7.4, and nothing next to them", () => {
    for (const { name, publicKey, message, context, signature } of rfc8032Signatures) {
      expect(verify(signature, { message, publicKey, context }), name).toBe(true);
      const upper = { message: message.toUpperCase(), publicKey: publicKey.toUpperCase(), context };
      expect(verify(signature.toUpperCase(), upper), name).toBe(true);
      expect(verify(signature, { message: `${message}00`, publicKey, context }), name).toBe(false);
      const other = context === "" ? "00" : "";
      expect(verify(signature, { message, publicKey, context: other }), name).toBe(false);
    }
    expect(rfc8032Signatures.map(({ message }) => message.length / 2)).toEqual([
      0, 1, 1, 11, 12, 13, 64, 256, 1023,
    ]);
  });

  it("agrees with OpenSSL 3.6.5 across the SHAKE256 block and contexts up to 255 bytes", () => {
    for (const [index, { publicKey, message, context, signature }] of opensslSignatures.entries()) {
      expect(verify(signature, { message, publicKey, context }), `case ${index}`).toBe(true);
      const other = context === "" ? "00" : context.slice(2);
      expect(verify(signature, { message, publicKey, context: other }), `case ${index}`).toBe(
        false,
      );
    }
    expect(opensslSignatures.map(({ context }) => context.length / 2)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 1, 57, 255,
    ]);
  });

  it("answers every Wycheproof vector", () => {
    let count = 0;
    for (const { publicKey, tests } of wycheproof.groups) {
      for (const { tcId, msg: message, sig, result } of tests) {
        if (sig.length === 228) {
          expect(verify(sig, { message, publicKey }), `tcId ${tcId}`).toBe(result === "valid");
        } else {
          expect(result, `tcId ${tcId}`).toBe("invalid");
          expect(() => verify(sig, { message, publicKey }), `tcId ${tcId}`).toThrow(RangeError);
        }
        count++;
      }
    }
    expect(count).toBe(87);
  });

  it("takes an empty context as no context at all", () => {
    const [blank] = rfc8032Signatures;
    if (blank === undefined) throw new Error("The RFC 8032 fixture lost the blank test");
    const { publicKey, message, signature } = blank;
    expect(verify(signature, { message, publicKey })).toBe(true);
    expect(verify(signature, { message, publicKey, context: "" })).toBe(true);
  });

  it("refuses an S from l up, which would pass the equation all the same", () => {
    for (const { publicKey, message, context, signature } of rfc8032Signatures) {
      expect(verify(addOrder(signature), { message, publicKey, context })).toBe(false);
    }
  });

  it("checks the cofactored equation: a key of order 2 passes for odd k too", () => {
    const publicKey = encodeNumber(ed448.p - 1n);
    /* k is even for the empty message and odd for 00, so only 4kA hides the key there. */
    for (const message of ["", "00"]) {
      expect(verify(TRIVIAL.signature, { message, publicKey }), message).toBe(true);
    }
  });

  it("decodes only canonical points, small order ones included", () => {
    expect(verify(TRIVIAL.signature, { message: "", publicKey: TRIVIAL.publicKey })).toBe(true);
    const aliases = [
      encodeNumber(ed448.p + 1n),
      encodeNumber(1n | (1n << 455n)),
      encodeNumber(1n | (1n << 448n)),
    ];
    for (const alias of aliases) {
      const asKey = { message: "", publicKey: alias };
      expect(verify(TRIVIAL.signature, asKey), alias).toBe(false);
      const asR = `${alias}${"0".repeat(114)}`;
      expect(verify(asR, { message: "", publicKey: TRIVIAL.publicKey }), alias).toBe(false);
    }
  });

  it("refuses arguments of the wrong shape with a message for the caller", () => {
    const [blank] = rfc8032Signatures;
    if (blank === undefined) throw new Error("The RFC 8032 fixture lost the blank test");
    const { publicKey, signature } = blank;
    expect(() => verify(signature.slice(2), { message: "", publicKey })).toThrow(
      "Signature must be 228 hex digits without 0x, R then S",
    );
    expect(() => verify(signature, { message: "", publicKey: publicKey.slice(2) })).toThrow(
      "Public key must be 114 hex digits without 0x",
    );
    expect(() => verify(signature, { message: "0", publicKey })).toThrow(
      "Message must be hex without 0x",
    );
    for (const context of ["0", "zz", "00".repeat(256), 1 as unknown as string]) {
      expect(() => verify(signature, { message: "", publicKey, context })).toThrow(
        "Context must be hex without 0x, at most 255 bytes",
      );
    }
    expect(() =>
      verify(signature, "" as unknown as { message: string; publicKey: string }),
    ).toThrow(TypeError);
  });
});
