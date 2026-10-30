import { sha512 } from "@agntn/hashes/sha2";
import { describe, expect, it } from "vite-plus/test";
import { bytesToNumberLE } from "../src/core/bytes.ts";
import {
  add,
  BASE,
  fe,
  IDENTITY,
  L,
  multiply,
  multiplyBase,
  P,
  SQRT_M1,
  type Extended,
} from "../src/core/edwards25519.ts";
import { medians } from "./timing.ts";

/* The double and add that multiply replaced. Slow, and every bit shows in its time, but right. */
function doubleAndAdd(point: Extended, scalar: bigint): Extended {
  let result = IDENTITY;
  for (const bit of scalar.toString(2)) {
    result = add(result, result);
    if (bit === "1") result = add(result, point);
  }
  return result;
}

/* Whether two extended points are the same point, whatever their Z. */
function same(a: Extended, b: Extended): boolean {
  return fe(a.x * b.z) === fe(b.x * a.z) && fe(a.y * b.z) === fe(b.y * a.z);
}

const ones = ((1n << 256n) - 1n) / 15n;
const hashed = Array.from({ length: 12 }, (_, index) =>
  bytesToNumberLE(sha512(new Uint8Array([index])).slice(0, 32)),
);
const scalars = [
  0n,
  1n,
  2n,
  15n,
  16n,
  17n,
  255n,
  256n,
  ones - 1n,
  ones,
  ones + 1n,
  1n << 252n,
  L - 1n,
  L,
  L + 1n,
  8n * L - 1n,
  8n * L,
  (1n << 256n) - 1n,
  (1n << 300n) + 5n,
  ...hashed,
];

const some = doubleAndAdd(BASE, 0x5eedn);
const orderTwo: Extended = { x: 0n, y: P - 1n, z: 1n, t: 0n };
const orderFour: Extended = { x: SQRT_M1, y: 0n, z: 1n, t: 0n };
const points: readonly (readonly [string, Extended])[] = [
  ["the base point", BASE],
  ["another point", some],
  ["a point of order 2", orderTwo],
  ["a point with an order 4 part", add(some, orderFour)],
];

describe("edwards25519 multiplication", () => {
  it.each(points)("multiplies %s like double and add", (_, point) => {
    for (const scalar of scalars)
      expect(same(multiply(point, scalar), doubleAndAdd(point, scalar))).toBe(true);
  });

  it("multiplies the base point from its table like double and add", () => {
    for (const scalar of scalars)
      expect(same(multiplyBase(scalar), doubleAndAdd(BASE, scalar))).toBe(true);
  });

  it("takes about as long for 1 as for l - 1", () => {
    for (const run of [
      (scalar: bigint) => multiplyBase(scalar),
      (scalar: bigint) => multiply(some, scalar),
    ]) {
      const [one, top] = medians(
        () => run(1n),
        () => run(L - 1n),
      );
      expect(one / top).toBeGreaterThan(0.75);
      expect(one / top).toBeLessThan(1.33);
    }
  });
});
