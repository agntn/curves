import { keccak256 } from "@agntn/hashes/keccak";
import { sha512 } from "@agntn/hashes/sha2";
import { describe, expect, it } from "vite-plus/test";
import { bytesToHex, concatBytes, hexToBytes } from "../src/core/bytes.ts";
import {
  addPoints,
  ed25519,
  INVALID_POINT,
  isIdentity,
  isTorsionFree,
  isValidPoint,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  reduceScalar,
  subtractPoints,
} from "../src/ed25519.ts";
import { invalidEncodings, monero, orderEight, rfc8032Keys } from "./fixtures/ed25519.ts";

const identity = `01${"0".repeat(62)}`;
const base = "58".padEnd(64, "6");
const scalarRange = "Scalar must be a bigint from 0 to l, the order of the base point, minus 1";

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
