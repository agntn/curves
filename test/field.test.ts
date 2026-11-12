import { describe, expect, it } from "vite-plus/test";
import {
  crt,
  invert,
  jacobi,
  linearCongruence,
  mod,
  power,
  squareRoot,
  squareRootMod,
} from "../src/index.ts";
import type { Congruence } from "../src/index.ts";

/** 2^61 - 1, a Mersenne prime past the reach of Number. */
const MERSENNE_61 = (1n << 61n) - 1n;
/** The secp256k1 field prime. */
const SECP256K1_P = 2n ** 256n - 2n ** 32n - 977n;

/* Every nonzero square mod a small modulus, found by squaring each residue, as the oracle. */
function squaresMod(p: bigint): Set<bigint> {
  const squares = new Set<bigint>();
  for (let x = 1n; x < p; x += 1n) squares.add((x * x) % p);
  return squares;
}

describe("mod", () => {
  it("brings negative values into 0 to modulus minus 1", () => {
    expect(mod(-5n, 3n)).toBe(1n);
    expect(mod(-(2n ** 70n), 10n)).toBe(6n);
    expect(mod(12n, 1n)).toBe(0n);
  });

  it("refuses a modulus below 1 and a Number", () => {
    expect(() => mod(-5n, -3n)).toThrow(new RangeError("The modulus must be 1 or more"));
    expect(() => mod(5n, 0n)).toThrow(RangeError);
    expect(() => {
      Reflect.apply(mod, undefined, [5, 3n]);
    }).toThrow(new TypeError("The value must be a bigint"));
  });
});

describe("power", () => {
  it("agrees with Fermat on a prime past 2^53", () => {
    expect(power(3n, MERSENNE_61 - 1n, { modulus: MERSENNE_61 })).toBe(1n);
    expect(power(-2n, 5n, { modulus: 7n })).toBe(3n);
  });

  it("gives 0 mod 1, even for the empty product", () => {
    expect(power(5n, 0n, { modulus: 1n })).toBe(0n);
    expect(power(5n, 0n, { modulus: 7n })).toBe(1n);
  });

  it("refuses a negative exponent and a modulus passed bare", () => {
    expect(() => power(2n, -1n, { modulus: 7n })).toThrow(
      new RangeError("The exponent must be 0 or more"),
    );
    expect(() => {
      Reflect.apply(power, undefined, [2n, 3n, 7n]);
    }).toThrow(new TypeError("power takes the modulus as { modulus }"));
  });
});

describe("invert", () => {
  it("inverts mod a composite when the gcd is 1", () => {
    expect(invert(3n, 10n)).toBe(7n);
    expect(invert(-3n, 10n)).toBe(3n);
    const inverse = invert(7n, 2n ** 64n);
    expect((7n * inverse) % 2n ** 64n).toBe(1n);
    expect(invert(5n, 1n)).toBe(0n);
  });

  it("names the factor a value shares with the modulus", () => {
    expect(() => invert(4n, 10n)).toThrow(
      new RangeError("No inverse exists mod 10: the value shares the factor 2 with it"),
    );
    expect(() => invert(0n, 7n)).toThrow("shares the factor 7");
    expect(() => invert(3n, -10n)).toThrow(new RangeError("The modulus must be 1 or more"));
  });
});

describe("squareRoot", () => {
  it("rounds down past 2^53", () => {
    expect(squareRoot(0n)).toBe(0n);
    expect(squareRoot(15n)).toBe(3n);
    expect(squareRoot(2n ** 200n)).toBe(2n ** 100n);
    expect(squareRoot(2n ** 200n - 1n)).toBe(2n ** 100n - 1n);
  });

  it("refuses a negative value", () => {
    expect(() => squareRoot(-1n)).toThrow(new RangeError("The value must be 0 or more"));
  });
});

describe("jacobi", () => {
  it("matches the squares of every small prime", () => {
    for (const p of [3n, 5n, 7n, 11n, 13n, 23n]) {
      const squares = squaresMod(p);
      for (let a = -p; a < 2n * p; a += 1n) {
        const rest = ((a % p) + p) % p;
        const expected = rest === 0n ? 0 : squares.has(rest) ? 1 : -1;
        expect(jacobi(a, p)).toBe(expected);
      }
    }
  });

  it("gives 1 over a composite for a value that is no square", () => {
    expect(squaresMod(15n).has(2n)).toBe(false);
    expect(jacobi(2n, 15n)).toBe(1);
    expect(jacobi(6n, 15n)).toBe(0);
    expect(jacobi(7n, 1n)).toBe(1);
  });

  it("refuses an even modulus", () => {
    expect(() => jacobi(3n, 8n)).toThrow(new RangeError("The modulus must be odd"));
    expect(() => jacobi(3n, -7n)).toThrow(RangeError);
  });
});

describe("squareRootMod", () => {
  it("returns undefined for a non-residue and the smaller root otherwise", () => {
    expect(squareRootMod(3n, 7n)).toBeUndefined();
    expect(squareRootMod(2n, 7n)).toBe(3n);
    const square = (2n ** 200n + 12_345n) ** 2n % SECP256K1_P;
    const root = squareRootMod(square, SECP256K1_P);
    expect(root === undefined ? undefined : (root * root) % SECP256K1_P).toBe(square);
  });

  it("takes the prime 2", () => {
    expect(squareRootMod(0n, 2n)).toBe(0n);
    expect(squareRootMod(1n, 2n)).toBe(1n);
    expect(squareRootMod(-1n, 2n)).toBe(1n);
  });

  it("refuses a composite instead of looping on it", () => {
    for (const value of [2n, 4n]) {
      expect(() => squareRootMod(value, 15n)).toThrow(
        new RangeError("The modulus must be a prime"),
      );
    }
    expect(() => squareRootMod(1n, 1n)).toThrow(RangeError);
  });
});

/** 2^89 - 1, the next Mersenne prime, so a system's lcm passes 2^128. */
const MERSENNE_89 = (1n << 89n) - 1n;

/* The smallest positive multiple of both, found by counting up, as the oracle for the lcm. */
function leastMultiple(m: bigint, n: bigint): bigint {
  let multiple = m;
  while (multiple % n !== 0n) multiple += m;
  return multiple;
}

/* Every x from 0 to modulus minus 1 with coefficient * x = value, found by trying each one. */
function linearSolutions(coefficient: bigint, value: bigint, modulus: bigint): bigint[] {
  const solutions: bigint[] = [];
  for (let x = 0n; x < modulus; x += 1n) {
    if (mod(coefficient * x - value, modulus) === 0n) solutions.push(x);
  }
  return solutions;
}

/* The smallest x below the lcm that sits in both classes, found by trying each one. */
function smallestCommon(left: Congruence, right: Congruence): bigint | undefined {
  for (let x = 0n; x < leastMultiple(left.modulus, right.modulus); x += 1n) {
    if (
      mod(x - left.residue, left.modulus) === 0n &&
      mod(x - right.residue, right.modulus) === 0n
    ) {
      return x;
    }
  }
  return undefined;
}

describe("crt", () => {
  it("solves the vectors of issue 92", () => {
    expect(
      crt([
        { residue: 3n, modulus: 10n },
        { residue: 7n, modulus: 12n },
      ]),
    ).toEqual({ residue: 43n, modulus: 60n });
    expect(
      crt([
        { residue: 0n, modulus: 2n },
        { residue: 2n, modulus: 4n },
      ]),
    ).toEqual({ residue: 2n, modulus: 4n });
    expect(
      crt([
        { residue: 1n, modulus: 4n },
        { residue: 2n, modulus: 6n },
      ]),
    ).toBeUndefined();
  });

  it("agrees with a search over every pair of moduli up to 12", () => {
    for (let m = 1n; m <= 12n; m += 1n) {
      for (let n = 1n; n <= 12n; n += 1n) {
        for (let a = -1n; a <= m; a += 1n) {
          for (let b = -1n; b <= n; b += 1n) {
            const left = { residue: a, modulus: m };
            const right = { residue: b, modulus: n };
            const x = smallestCommon(left, right);
            const expected =
              x === undefined ? undefined : { residue: x, modulus: leastMultiple(m, n) };
            expect(crt([left, right]), `${a} mod ${m}, ${b} mod ${n}`).toEqual(expected);
          }
        }
      }
    }
  });

  it("gives every integer for no congruences, and one class for one", () => {
    expect(crt([])).toEqual({ residue: 0n, modulus: 1n });
    expect(crt([{ residue: -3n, modulus: 7n }])).toEqual({ residue: 4n, modulus: 7n });
    expect(crt([{ residue: 5n, modulus: 1n }])).toEqual({ residue: 0n, modulus: 1n });
  });

  it("folds three moduli past 2^128 and feeds its answer back in", () => {
    const x = 2n ** 150n + 12_345n;
    const moduli = [MERSENNE_61, MERSENNE_89, 6n * 2n ** 64n, 10n * 2n ** 64n];
    const system = crt(moduli.map((modulus) => ({ residue: x % modulus, modulus })));
    const lcm = MERSENNE_61 * MERSENNE_89 * 30n * 2n ** 64n;
    expect(system).toEqual({ residue: x % lcm, modulus: lcm });
    expect(system && crt([system, { residue: 1n, modulus: 4n }])).toEqual({
      residue: x % lcm,
      modulus: lcm,
    });
    expect(system && crt([system, { residue: 0n, modulus: 4n }])).toBeUndefined();
  });

  it("reads any iterable once", () => {
    function* system(): Generator<Congruence> {
      yield { residue: 2n, modulus: 3n };
      yield { residue: 3n, modulus: 5n };
      yield { residue: 2n, modulus: 7n };
    }
    expect(crt(system())).toEqual({ residue: 23n, modulus: 105n });
  });

  it("refuses a bad modulus, a pair and a lone object, even after a disagreement", () => {
    expect(() => crt([{ residue: 1n, modulus: 0n }])).toThrow(
      new RangeError("The modulus must be 1 or more"),
    );
    expect(() =>
      crt([
        { residue: 1n, modulus: 4n },
        { residue: 2n, modulus: 6n },
        { residue: 0n, modulus: -5n },
      ]),
    ).toThrow(RangeError);
    expect(() => {
      Reflect.apply(crt, undefined, [[[3n, 10n]]]);
    }).toThrow(new TypeError("crt takes each congruence as { residue, modulus }"));
    expect(() => {
      Reflect.apply(crt, undefined, [[{ residue: 3, modulus: 10n }]]);
    }).toThrow(new TypeError("The residue must be a bigint"));
    for (const notIterable of [{ residue: 3n, modulus: 10n }, "3", undefined]) {
      expect(() => {
        Reflect.apply(crt, undefined, [notIterable]);
      }).toThrow(new TypeError("crt takes an iterable of { residue, modulus }"));
    }
  });
});

describe("linearCongruence", () => {
  it("solves the vector of issue 92", () => {
    expect(linearCongruence(6n, 4n, { modulus: 10n })).toEqual({
      residue: 4n,
      modulus: 5n,
      count: 2n,
    });
  });

  it("agrees with a search over every modulus up to 30", () => {
    for (let modulus = 1n; modulus <= 30n; modulus += 1n) {
      for (let a = -modulus; a <= modulus; a += 1n) {
        for (let b = -modulus; b <= modulus; b += 1n) {
          const [first, second] = linearSolutions(a, b, modulus);
          const count = BigInt(linearSolutions(a, b, modulus).length);
          const expected =
            first === undefined
              ? undefined
              : { residue: first, modulus: second === undefined ? modulus : second - first, count };
          expect(linearCongruence(a, b, { modulus }), `${a}x = ${b} mod ${modulus}`).toEqual(
            expected,
          );
        }
      }
    }
  });

  it("keeps a count past 2^53 instead of listing every class", () => {
    const modulus = 2n ** 64n * MERSENNE_61;
    const solution = linearCongruence(2n ** 64n * 3n, 2n ** 64n * 5n, { modulus });
    expect(solution).toEqual({
      residue: mod(5n * invert(3n, MERSENNE_61), MERSENNE_61),
      modulus: MERSENNE_61,
      count: 2n ** 64n,
    });
    expect(linearCongruence(0n, 0n, { modulus })).toEqual({
      residue: 0n,
      modulus: 1n,
      count: modulus,
    });
    expect(linearCongruence(0n, 1n, { modulus })).toBeUndefined();
  });

  it("refuses a bad modulus, a bare one and a Number", () => {
    expect(() => linearCongruence(2n, 1n, { modulus: 0n })).toThrow(
      new RangeError("The modulus must be 1 or more"),
    );
    expect(() => {
      Reflect.apply(linearCongruence, undefined, [6n, 4n, 10n]);
    }).toThrow(new TypeError("linearCongruence takes the modulus as { modulus }"));
    expect(() => {
      Reflect.apply(linearCongruence, undefined, [6, 4n, { modulus: 10n }]);
    }).toThrow(new TypeError("The coefficient must be a bigint"));
  });
});
