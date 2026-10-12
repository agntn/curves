/**
 * edwards25519, -x^2 + y^2 = 1 + d x^2 y^2 over the field of p = 2^255 - 19 (RFC 7748, section
 * 4.1), with the group law in extended coordinates (RFC 8032, section 5.1.4). ristretto255 and
 * ed25519 both stand on it and differ only in how a point travels. Nothing here runs in constant
 * time.
 */

import { invert, mod, power } from "./field.ts";

export const P = (1n << 255n) - 19n;
export const L = (1n << 252n) + 27742317777372353535851937790883648493n;
export const D = mod(-121665n * invert(121666n, P), P);
export const SQRT_M1 = power(2n, (P - 1n) / 4n, P);

/** The base point of RFC 8032, section 5.1, the one RFC 9496 takes over. */
export const G = Object.freeze({
  x: 15112221349535400772501151409588531511454012693041857206046113283949847762202n,
  y: 46316835694926478169428394003475163141307993866256225615783033603165251855960n,
});

/** (X, Y, Z, T) stands for x = X / Z, y = Y / Z, with T = XY / Z. */
export interface Extended {
  readonly x: bigint;
  readonly y: bigint;
  readonly z: bigint;
  readonly t: bigint;
}

/** The identity, (0, 1). */
export const IDENTITY: Extended = { x: 0n, y: 1n, z: 1n, t: 0n };

/** The base point in extended coordinates. */
export const BASE: Extended = { x: G.x, y: G.y, z: 1n, t: mod(G.x * G.y, P) };

/**
 * Reduce mod p.
 * @param value - Any integer
 * @returns {bigint} From 0 to p minus 1
 */
export function fe(value: bigint): bigint {
  return mod(value, P);
}

/**
 * The sign of a field element in RFC 9496: whether its canonical form is odd.
 * @param value - From 0 to p minus 1
 * @returns {boolean} True for a negative element
 */
export function isNegative(value: bigint): boolean {
  return (value & 1n) === 1n;
}

/**
 * The absolute value of RFC 9496, section 4.1: the element or its negation, whichever is even.
 * @param value - From 0 to p minus 1
 * @returns {bigint} The non-negative one
 */
export function absolute(value: bigint): bigint {
  return isNegative(value) ? fe(-value) : value;
}

/**
 * SQRT_RATIO_M1 of RFC 9496, section 4.2.
 * @param u - Numerator
 * @param v - Denominator
 * @returns {{ square: boolean; root: bigint }} Whether u / v is a square, and the non-negative
 * root of u / v when it is, or of SQRT_M1 * u / v when it isn't
 */
export function sqrtRatioM1(u: bigint, v: bigint): { square: boolean; root: bigint } {
  const v3 = fe(v * v * v);
  const v7 = fe(v3 * v3 * v);
  let r = fe(u * v3 * power(fe(u * v7), (P - 5n) / 8n, P));
  const check = fe(v * r * r);
  const correctSign = check === fe(u);
  const flippedSign = check === fe(-u);
  const flippedSignI = check === fe(-u * SQRT_M1);
  if (flippedSign || flippedSignI) r = fe(r * SQRT_M1);
  return { square: correctSign || flippedSign, root: absolute(r) };
}

/**
 * Add two points: add-2008-hwcd-3 for a = -1, which also doubles.
 * @param left - Any point
 * @param right - Any point
 * @returns {Extended} The sum
 */
export function add(left: Extended, right: Extended): Extended {
  const a = fe((left.y - left.x) * (right.y - right.x));
  const b = fe((left.y + left.x) * (right.y + right.x));
  const c = fe(2n * D * left.t * right.t);
  const d = fe(2n * left.z * right.z);
  const e = b - a;
  const f = d - c;
  const g = d + c;
  const h = b + a;
  return { x: fe(e * f), y: fe(g * h), z: fe(f * g), t: fe(e * h) };
}

/**
 * Double a point: dbl-2008-hwcd for a = -1.
 * @param point - Any point
 * @returns {Extended} Twice the point
 */
function double(point: Extended): Extended {
  const a = fe(point.x * point.x);
  const b = fe(point.y * point.y);
  const c = fe(2n * point.z * point.z);
  const e = fe((point.x + point.y) * (point.x + point.y) - a - b);
  const g = b - a;
  const f = g - c;
  const h = -a - b;
  return { x: fe(e * f), y: fe(g * h), z: fe(f * g), t: fe(e * h) };
}

/**
 * Negate a point: -(x, y) = (-x, y) on a twisted Edwards curve.
 * @param point - Any point
 * @returns {Extended} The negation
 */
export function negate(point: Extended): Extended {
  return { x: fe(-point.x), y: point.y, z: point.z, t: fe(-point.t) };
}

/**
 * Multiply by double and add from the top bit down.
 * @param point - Any point
 * @param scalar - Zero or more
 * @returns {Extended} The product
 */
export function multiply(point: Extended, scalar: bigint): Extended {
  let result = IDENTITY;
  for (const bit of scalar.toString(2)) {
    result = double(result);
    if (bit === "1") result = add(result, point);
  }
  return result;
}

/**
 * Check a scalar for the public arithmetic.
 * @param value - The caller's scalar
 * @param range - The refusal, in the words of the caller's group
 * @returns {bigint} The scalar
 * @throws {RangeError} When it is no bigint from 0 to l minus 1
 */
export function decodeScalar(value: unknown, range: string): bigint {
  if (typeof value !== "bigint" || value < 0n || value >= L) throw new RangeError(range);
  return value;
}
