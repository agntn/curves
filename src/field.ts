/** Modular arithmetic under the curves, checked at the door for scripts that need it bare. */

import {
  invert as invertCore,
  isPrime,
  jacobi as jacobiCore,
  mod as modCore,
  power as powerCore,
  squareRoot as squareRootCore,
  squareRootMod as squareRootModCore,
} from "./core/field.ts";

export { isPrime } from "./core/field.ts";

/** The modulus `power` reduces by. */
export interface PowerOptions {
  readonly modulus: bigint;
}

/**
 * Refuse anything but a bigint, since a Number above 2^53 has already lost digits.
 * @param value - What the caller passed
 * @param name - The argument, for the message
 */
function checkBigint(value: unknown, name: string): asserts value is bigint {
  if (typeof value !== "bigint") throw new TypeError(`${name} must be a bigint`);
}

/**
 * Check a modulus: a bigint of 1 or more.
 * @param modulus - What the caller passed
 */
function checkModulus(modulus: unknown): asserts modulus is bigint {
  checkBigint(modulus, "The modulus");
  if (modulus < 1n) throw new RangeError("The modulus must be 1 or more");
}

/**
 * Reduce a value into 0 to modulus minus 1, negative values included.
 * @param value - Any integer
 * @param modulus - 1 or more
 * @returns {bigint} The value mod modulus
 * @throws {RangeError} When the modulus is below 1
 */
export function mod(value: bigint, modulus: bigint): bigint {
  checkBigint(value, "The value");
  checkModulus(modulus);
  return modCore(value, modulus);
}

/**
 * Raise a base to a power mod a modulus, by square and multiply.
 * @param base - Any integer
 * @param exponent - 0 or more
 * @param options - The modulus, 1 or more
 * @returns {bigint} base to the exponent, mod modulus
 * @throws {RangeError} When the exponent is negative or the modulus is below 1
 */
export function power(base: bigint, exponent: bigint, options: PowerOptions): bigint {
  checkBigint(base, "The base");
  checkBigint(exponent, "The exponent");
  if (typeof options !== "object" || options === null) {
    throw new TypeError("power takes the modulus as { modulus }");
  }
  checkModulus(options.modulus);
  if (exponent < 0n) throw new RangeError("The exponent must be 0 or more");
  return modCore(powerCore(base, exponent, options.modulus), options.modulus);
}

/**
 * Invert a value mod any modulus it shares no factor with.
 * @param value - Any integer coprime to the modulus
 * @param modulus - 1 or more, prime or not
 * @returns {bigint} The x in 0 to modulus minus 1 with value * x = 1 mod modulus
 * @throws {RangeError} When the modulus is below 1, or the value shares a factor with it
 */
export function invert(value: bigint, modulus: bigint): bigint {
  checkBigint(value, "The value");
  checkModulus(modulus);
  return modulus === 1n ? 0n : invertCore(value, modulus);
}

/**
 * The integer square root, rounded down.
 * @param value - 0 or more
 * @returns {bigint} The largest root whose square does not pass the value
 * @throws {RangeError} When the value is negative
 */
export function squareRoot(value: bigint): bigint {
  checkBigint(value, "The value");
  if (value < 0n) throw new RangeError("The value must be 0 or more");
  return squareRootCore(value);
}

/**
 * The Jacobi symbol over an odd modulus. Over a composite one, a 1 doesn't make a square.
 * @param value - Any integer
 * @param modulus - An odd number of 1 or more
 * @returns {number} 1, -1, or 0 when they share a factor
 * @throws {RangeError} When the modulus is even or below 1
 */
export function jacobi(value: bigint, modulus: bigint): number {
  checkBigint(value, "The value");
  checkModulus(modulus);
  if ((modulus & 1n) === 0n) throw new RangeError("The modulus must be odd");
  return jacobiCore(value, modulus);
}

/**
 * A square root mod a prime by Tonelli-Shanks. Baillie-PSW vets the prime: no known liar, no proof.
 * @param value - Any integer
 * @param prime - A prime, 2 included
 * @returns {bigint | undefined} The smaller root, undefined when the value is no square mod prime
 * @throws {RangeError} When the modulus is not a prime
 */
export function squareRootMod(value: bigint, prime: bigint): bigint | undefined {
  checkBigint(value, "The value");
  checkBigint(prime, "The prime");
  if (!isPrime(prime)) throw new RangeError("The modulus must be a prime");
  return prime === 2n ? modCore(value, 2n) : squareRootModCore(value, prime);
}
