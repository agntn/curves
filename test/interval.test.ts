import { describe, expect, it } from "vite-plus/test";
import {
  defineCurve,
  discreteLogInInterval,
  listPoints,
  MAX_INTERVAL_TABLE,
  multiplyPoint,
  type CurvePoint,
  type IntervalLogOptions,
  type WeierstrassCurve,
} from "../src/index.ts";
import { curveVectors } from "./fixtures/vectors.ts";

const { paar, secp256k1 } = curveVectors;
const paarCurve = defineCurve(paar);
const secp = defineCurve(secp256k1);
const { far } = secp256k1;
const farPoint = { x: far.x, y: far.y };
const [paarX, paarY] = paar.multiples[0] ?? [];
if (paarX === undefined || paarY === undefined) throw new Error("Missing the Paar base point");
const base = { x: paarX, y: paarY };

/* The same point, with null for infinity. */
function samePoint(left: CurvePoint, right: CurvePoint): boolean {
  if (left === null || right === null) return left === right;
  return left.x === right.x && left.y === right.y;
}

/* The smallest k the options ask for, by multiplying the base by each one in turn. */
function trialLog(curve: WeierstrassCurve, options: IntervalLogOptions): bigint | undefined {
  const { residue = 0n, modulus = 1n } = options;
  for (let k = options.lo; k <= options.hi; k += 1n) {
    const kept = (k - residue) % modulus === 0n;
    if (kept && samePoint(multiplyPoint(curve, options.base, k), options.target)) return k;
  }
  return undefined;
}

describe("discreteLogInInterval", () => {
  it("finds every scalar of the Paar curve in its own period and in shifted ones", () => {
    for (const [index, [x, y]] of paar.multiples.entries()) {
      const target = { x, y };
      const scalar = BigInt(index + 1);
      expect(discreteLogInInterval(paarCurve, { base, target, lo: 0n, hi: 18n })).toBe(scalar);
      expect(discreteLogInInterval(paarCurve, { base, target, lo: 19n, hi: 37n })).toBe(
        scalar + 19n,
      );
      expect(discreteLogInInterval(paarCurve, { base, target, lo: -19n, hi: -1n })).toBe(
        scalar - 19n,
      );
      expect(discreteLogInInterval(paarCurve, { base, target, lo: scalar, hi: scalar })).toBe(
        scalar,
      );
      expect(
        discreteLogInInterval(paarCurve, { base, target, lo: scalar + 1n, hi: scalar + 18n }),
      ).toBeUndefined();
    }
    expect(discreteLogInInterval(paarCurve, { base, target: null, lo: -5n, hi: 40n })).toBe(0n);
    expect(discreteLogInInterval(paarCurve, { base, target: null, lo: 1n, hi: 40n })).toBe(19n);
  });

  it("answers the smallest k of a residue class, and nothing for a class the interval misses", () => {
    const target = { x: 16n, y: 4n };
    const between = { base, target, lo: 0n, hi: 200n };
    expect(discreteLogInInterval(paarCurve, between)).toBe(13n);
    expect(discreteLogInInterval(paarCurve, { ...between, residue: 0n, modulus: 2n })).toBe(32n);
    expect(discreteLogInInterval(paarCurve, { ...between, residue: -3n, modulus: 5n })).toBe(32n);
    expect(discreteLogInInterval(paarCurve, { ...between, residue: 14n, modulus: 19n })).toBe(
      undefined,
    );
    expect(discreteLogInInterval(paarCurve, { ...between, residue: 13n, modulus: 38n })).toBe(13n);
    expect(discreteLogInInterval(paarCurve, { ...between, residue: 32n, modulus: 38n })).toBe(32n);
    expect(
      discreteLogInInterval(paarCurve, {
        base,
        target,
        lo: 14n,
        hi: 20n,
        residue: 13n,
        modulus: 19n,
      }),
    ).toBeUndefined();
  });

  it("agrees with trying every k on small curves, infinity and repeated periods included", () => {
    const intervals = [
      [0n, 0n],
      [-7n, 9n],
      [3n, 60n],
      [-90n, -40n],
    ] as const;
    const classes = [{}, { residue: 2n, modulus: 3n }, { residue: -1n, modulus: 19n }];
    let found = 0;
    for (const curve of [paarCurve, defineCurve({ a: 0n, b: 1n, p: 7n })]) {
      const points = [null, ...listPoints(curve)];
      for (const [one, target, [lo, hi], kept] of points.flatMap((left) =>
        points.flatMap((right) =>
          intervals.flatMap((interval) =>
            classes.map((each) => [left, right, interval, each] as const),
          ),
        ),
      )) {
        const options = { base: one, target, lo, hi, ...kept };
        const expected = trialLog(curve, options);
        if (expected !== undefined) found += 1;
        expect(discreteLogInInterval(curve, options)).toBe(expected);
      }
    }
    expect(found).toBeGreaterThan(1000);
  });

  it("answers undefined for a target of order 2 outside a base subgroup of order 3", () => {
    const curve = defineCurve({ a: 0n, b: 1n, p: 7n });
    const three = { x: 0n, y: 1n };
    const two = { x: 6n, y: 0n };
    expect(multiplyPoint(curve, three, 3n)).toBeNull();
    expect(multiplyPoint(curve, two, 2n)).toBeNull();
    expect(discreteLogInInterval(curve, { base: three, target: two, lo: -50n, hi: 50n })).toBe(
      undefined,
    );
    expect(discreteLogInInterval(curve, { base: two, target: two, lo: 4n, hi: 9n })).toBe(5n);
  });

  it("stops tabulating once the base has run through its multiples", () => {
    const curve = defineCurve({ a: 0n, b: 1n, p: 7n });
    const window = { base: { x: 0n, y: 1n }, lo: 0n, hi: 2n ** 40n - 1n };
    const started = performance.now();
    expect(discreteLogInInterval(curve, { ...window, target: { x: 6n, y: 0n } })).toBeUndefined();
    expect(discreteLogInInterval(curve, { ...window, target: { x: 0n, y: 6n } })).toBe(2n);
    expect(performance.now() - started).toBeLessThan(250);
  });

  it("finds 2^200 + 123456789 on secp256k1, where the order of G is out of reach", () => {
    const lo = 2n ** 200n;
    const window = { base: secp256k1.g, target: farPoint, lo, hi: lo + 2n ** 30n - 1n };
    expect(discreteLogInInterval(secp, window)).toBe(far.scalar);
    expect(discreteLogInInterval(secp, { ...window, lo: far.scalar })).toBe(far.scalar);
    expect(discreteLogInInterval(secp, { ...window, hi: far.scalar })).toBe(far.scalar);
    expect(discreteLogInInterval(secp, { ...window, lo: far.scalar + 1n })).toBeUndefined();
    expect(discreteLogInInterval(secp, { ...window, hi: far.scalar - 1n })).toBeUndefined();
    const negated = { x: far.x, y: secp256k1.p - far.y };
    expect(
      discreteLogInInterval(secp, { ...window, target: negated, lo: -window.hi, hi: -lo }),
    ).toBe(-far.scalar);
  });

  it("searches a window of 2^40 scalars on secp256k1, whole or thinned to a residue class", () => {
    const lo = 2n ** 200n;
    const window = { base: secp256k1.g, target: farPoint, lo, hi: lo + 2n ** 40n - 1n };
    const residue = far.scalar % 1021n;
    expect(discreteLogInInterval(secp, { ...window, residue, modulus: 1021n })).toBe(far.scalar);
    expect(
      discreteLogInInterval(secp, { ...window, residue: residue + 1n, modulus: 1021n }),
    ).toBeUndefined();
    expect(discreteLogInInterval(secp, window)).toBe(far.scalar);
  }, 120_000);

  it("refuses an interval the table cannot cover before it builds anything", () => {
    const window = { base: secp256k1.g, target: farPoint, lo: 0n, hi: 2n ** 40n };
    expect(() => discreteLogInInterval(secp, window)).toThrow(
      new RangeError(
        "The interval holds 1099511627777 scalars to try, and a table of 1048576 points covers 1099511627776; narrow it or split it",
      ),
    );
    expect(() => discreteLogInInterval(secp, { ...window, hi: 100n, tableLimit: 10 })).toThrow(
      "The interval holds 101 scalars to try, and a table of 10 points covers 100",
    );
    expect(discreteLogInInterval(secp, { ...window, hi: 99n, tableLimit: 10 })).toBeUndefined();
    expect(
      discreteLogInInterval(secp, { ...window, residue: 5n, modulus: 2n ** 20n, tableLimit: 1024 }),
    ).toBeUndefined();
    const empty = { ...window, hi: 4n, residue: 5n, modulus: 10n };
    for (const tableLimit of [0, 1.5, -1, Number.NaN, MAX_INTERVAL_TABLE + 1, "8"]) {
      for (const options of [window, empty]) {
        expect(() =>
          discreteLogInInterval(secp, { ...options, tableLimit } as unknown as IntervalLogOptions),
        ).toThrow(new RangeError("tableLimit must be an integer from 1 to 1048576"));
      }
    }
  });

  it("refuses bounds, classes and points that make no search", () => {
    const target = { x: 16n, y: 4n };
    const between = { base, target, lo: 0n, hi: 18n };
    const refusal = (options: unknown): (() => unknown) => {
      return () => discreteLogInInterval(paarCurve, options as IntervalLogOptions);
    };
    expect(refusal({ ...between, lo: 19n })).toThrow(new RangeError("lo must not pass hi"));
    expect(refusal({ ...between, lo: 0 })).toThrow(new TypeError("lo must be a bigint"));
    expect(refusal({ ...between, hi: "18" })).toThrow(new TypeError("hi must be a bigint"));
    expect(refusal({ base, target, lo: 0n })).toThrow(new TypeError("hi must be a bigint"));
    expect(refusal({ ...between, residue: 1n })).toThrow(
      new TypeError("residue and modulus come together"),
    );
    expect(refusal({ ...between, modulus: 3n })).toThrow(
      new TypeError("residue and modulus come together"),
    );
    expect(refusal({ ...between, residue: 1n, modulus: 0n })).toThrow(
      new RangeError("modulus must be 1 or more"),
    );
    expect(refusal({ ...between, residue: 1, modulus: 3n })).toThrow(
      new TypeError("residue must be a bigint"),
    );
    expect(refusal({ ...between, residue: 1n, modulus: null })).toThrow(
      new TypeError("modulus must be a bigint"),
    );
    expect(refusal({ target, lo: 0n, hi: 18n })).toThrow(
      new TypeError("The base is missing; null stands for infinity"),
    );
    expect(refusal({ base, lo: 0n, hi: 18n })).toThrow(
      new TypeError("The target is missing; null stands for infinity"),
    );
    expect(refusal({ ...between, target: { x: 16n, y: 5n } })).toThrow(
      "The target is not on the curve",
    );
    expect(refusal({ ...between, base: "5,1" })).toThrow("The base is not on the curve");
    for (const options of [undefined, null, 5n, "0..18"]) {
      expect(refusal(options)).toThrow(
        new TypeError("discreteLogInInterval takes { base, target, lo, hi }"),
      );
    }
    expect(() =>
      discreteLogInInterval({ a: 1n, b: 1n, p: 15n }, { ...between, base: null, target: null }),
    ).toThrow("p must be a prime above 3");
  });
});
