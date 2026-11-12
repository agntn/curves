import { describe, expect, it } from "vite-plus/test";
import { invert, jacobi, mod, power, squareRoot, squareRootMod } from "../src/index.ts";

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
