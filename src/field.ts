/** Modular arithmetic under the curves, checked at the door for scripts that need it bare. */

import {
  invert as invertCore,
  isPrime,
  jacobi as jacobiCore,
  mergeCongruences,
  mod as modCore,
  power as powerCore,
  solveLinear,
  squareRoot as squareRootCore,
  squareRootMod as squareRootModCore,
} from "./core/field.ts";
import type { Congruence } from "./core/field.ts";

export { isPrime } from "./core/field.ts";
export type { Congruence } from "./core/field.ts";

/** The modulus `power` reduces by. */
export interface PowerOptions {
  readonly modulus: bigint;
}

/** The modulus `linearCongruence` solves under. */
export interface LinearCongruenceOptions {
  readonly modulus: bigint;
}

/** One class standing in for `count` classes mod the original modulus. */
export interface LinearCongruenceSolution extends Congruence {
  readonly count: bigint;
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
 * Read `{ modulus }`, and show that shape when it's missing.
 * @param options - What the caller passed
 * @param name - The function, for the message
 * @returns {bigint} The checked modulus
 */
function readModulus(options: Readonly<{ modulus: bigint }>, name: string): bigint {
  if (typeof options !== "object" || options === null) {
    throw new TypeError(`${name} takes the modulus as { modulus }`);
  }
  checkModulus(options.modulus);
  return options.modulus;
}

/**
 * Check one congruence of a system.
 * @param congruence - What the caller passed
 * @returns {Congruence} A fresh copy, read once
 */
function readCongruence(congruence: Congruence): Congruence {
  if (typeof congruence !== "object" || congruence === null || Array.isArray(congruence)) {
    throw new TypeError("crt takes each congruence as { residue, modulus }");
  }
  const { residue, modulus } = congruence;
  checkBigint(residue, "The residue");
  checkModulus(modulus);
  return { residue, modulus };
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
  const modulus = readModulus(options, "power");
  if (exponent < 0n) throw new RangeError("The exponent must be 0 or more");
  return modCore(powerCore(base, exponent, modulus), modulus);
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

/**
 * Solve a system by the Chinese remainder theorem, coprime moduli or not.
 * @param congruences - Any iterable of `{ residue, modulus }`, a modulus of 1 or more each
 * @returns {Congruence | undefined} The class mod the lcm, or undefined when two disagree
 * @throws {RangeError} When a modulus is below 1
 */
export function crt(congruences: Iterable<Congruence>): Congruence | undefined {
  if (
    typeof congruences !== "object" ||
    congruences === null ||
    !(Symbol.iterator in congruences)
  ) {
    throw new TypeError("crt takes an iterable of { residue, modulus }");
  }
  let system: Congruence | undefined = { residue: 0n, modulus: 1n };
  for (const congruence of Array.from(congruences, readCongruence)) {
    system = mergeCongruences(system, congruence);
    if (system === undefined) return undefined;
  }
  return system;
}

/**
 * Solve coefficient * x = value mod modulus, without listing every class.
 * @param coefficient - Any integer
 * @param value - Any integer
 * @param options - The modulus, 1 or more
 * @returns {LinearCongruenceSolution | undefined} One class and its count, or undefined
 * @throws {RangeError} When the modulus is below 1
 */
export function linearCongruence(
  coefficient: bigint,
  value: bigint,
  options: LinearCongruenceOptions,
): LinearCongruenceSolution | undefined {
  checkBigint(coefficient, "The coefficient");
  checkBigint(value, "The value");
  const modulus = readModulus(options, "linearCongruence");
  const solution = solveLinear(coefficient, value, modulus);
  return solution && { ...solution, count: modulus / solution.modulus };
}
