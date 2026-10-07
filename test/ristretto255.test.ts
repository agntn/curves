import { describe, expect, it } from "vite-plus/test";
import {
  addPoints,
  INVALID_POINT,
  isValidPoint,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  ristretto255,
  subtractPoints,
} from "../src/ristretto255.ts";
import { generatorMultiples, invalidEncodings } from "./fixtures/sr25519.ts";

const identity = "0".repeat(64);
const [, base = "", twice = ""] = generatorMultiples;
const scalarRange = "Scalar must be a bigint from 0 to the group order minus 1";

describe("ristretto255", () => {
  it("encodes the multiples of the generator as RFC 9496 lists them", () => {
    generatorMultiples.forEach((encoding, index) => {
      expect(multiplyGenerator(BigInt(index))).toBe(encoding);
      expect(multiplyPoint(base, BigInt(index))).toBe(encoding);
    });
  });

  it("adds its way through the same list", () => {
    let sum = identity;
    for (const encoding of generatorMultiples) {
      expect(sum).toBe(encoding);
      sum = addPoints(sum, base);
    }
  });

  it("subtracts and negates back to the list", () => {
    expect(subtractPoints(twice, base)).toBe(base);
    expect(subtractPoints(base, base)).toBe(identity);
    expect(addPoints(base, negatePoint(base))).toBe(identity);
    expect(negatePoint(identity)).toBe(identity);
  });

  it("wraps around at the group order", () => {
    expect(multiplyGenerator(ristretto255.l - 1n)).toBe(negatePoint(base));
    expect(addPoints(multiplyGenerator(ristretto255.l - 1n), base)).toBe(identity);
  });

  it("refuses every invalid encoding of RFC 9496", () => {
    for (const encoding of invalidEncodings) {
      expect(isValidPoint(encoding), encoding).toBe(false);
      expect(() => negatePoint(encoding), encoding).toThrow(INVALID_POINT);
    }
  });

  it("reads hex in either case and writes lowercase", () => {
    expect(isValidPoint(base.toUpperCase())).toBe(true);
    expect(negatePoint(negatePoint(base.toUpperCase()))).toBe(base);
  });

  it("refuses text that is no 32-byte hex", () => {
    for (const text of ["", base.slice(2), `${base}00`, `0x${base.slice(2)}`, "zz".repeat(32)]) {
      expect(isValidPoint(text), text).toBe(false);
    }
    expect(() => addPoints(base, 7 as unknown as string)).toThrow(INVALID_POINT);
  });

  it("takes scalars from 0 to the order minus 1, as bigints", () => {
    for (const scalar of [-1n, ristretto255.l, 1 as unknown as bigint, "01" as unknown as bigint]) {
      expect(() => multiplyGenerator(scalar)).toThrow(scalarRange);
      expect(() => multiplyPoint(base, scalar)).toThrow(scalarRange);
    }
  });
});
