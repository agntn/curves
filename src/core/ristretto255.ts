/**
 * ristretto255 from RFC 9496: the prime order group of order l built over edwards25519,
 * -x^2 + y^2 = 1 + d x^2 y^2 over the field of p = 2^255 - 19 (RFC 7748, section 4.1). Points
 * live in extended coordinates (RFC 8032, section 5.1.4) and travel as the 32-byte ristretto255
 * encoding, which hides the cofactor 8 of the curve. Nothing here runs in constant time.
 */

import { invert, mod, power } from "./field.ts";
import { bytesToHex, hexToBytes, bytesToNumberLE, numberToBytesLE } from "./bytes.ts";

const P = (1n << 255n) - 19n;
const L = (1n << 252n) + 27742317777372353535851937790883648493n;
const D = mod(-121665n * invert(121666n, P), P);
const SQRT_M1 = power(2n, (P - 1n) / 4n, P);
const INVSQRT_A_MINUS_D =
  54469307008909316920995813868745141605393597292927456921205312896311721017578n;

/** The domain parameters: p, d, the group order l and the edwards25519 base point. */
export const ristretto255 = Object.freeze({
  p: P,
  d: D,
  l: L,
  g: Object.freeze({
    x: 15112221349535400772501151409588531511454012693041857206046113283949847762202n,
    y: 46316835694926478169428394003475163141307993866256225615783033603165251855960n,
  }),
});

/** The one refusal for text that isn't the canonical encoding of a ristretto255 point. */
export const INVALID_POINT = "Invalid ristretto255 point";

/** (X, Y, Z, T) stands for x = X / Z, y = Y / Z, with T = XY / Z. */
export interface Extended {
  readonly x: bigint;
  readonly y: bigint;
  readonly z: bigint;
  readonly t: bigint;
}

/** The identity, which ristretto255 encodes as 32 zero bytes. */
export const IDENTITY: Extended = { x: 0n, y: 1n, z: 1n, t: 0n };

/** The base point of RFC 9496, section 4.4: the edwards25519 base point. */
export const BASE: Extended = {
  x: ristretto255.g.x,
  y: ristretto255.g.y,
  z: 1n,
  t: mod(ristretto255.g.x * ristretto255.g.y, P),
};

const SCALAR_RANGE = "Scalar must be a bigint from 0 to the group order minus 1";

/**
 * Reduce mod p.
 * @param value - Any integer
 * @returns {bigint} From 0 to p minus 1
 */
function fe(value: bigint): bigint {
  return mod(value, P);
}

/**
 * The sign of a field element in RFC 9496: whether its canonical form is odd.
 * @param value - From 0 to p minus 1
 * @returns {boolean} True for a negative element
 */
function isNegative(value: bigint): boolean {
  return (value & 1n) === 1n;
}

/**
 * The absolute value of RFC 9496, section 4.1: the element or its negation, whichever is even.
 * @param value - From 0 to p minus 1
 * @returns {bigint} The non-negative one
 */
function absolute(value: bigint): bigint {
  return isNegative(value) ? fe(-value) : value;
}

/**
 * SQRT_RATIO_M1 of RFC 9496, section 4.2.
 * @param u - Numerator
 * @param v - Denominator
 * @returns {{ square: boolean; root: bigint }} Whether u / v is a square, and the non-negative
 * root of u / v when it is, or of SQRT_M1 * u / v when it isn't
 */
function sqrtRatioM1(u: bigint, v: bigint): { square: boolean; root: bigint } {
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
 * Equality of RFC 9496, section 4.3.3, blind to the cofactor as the encoding is.
 * @param left - Any point
 * @param right - Any point
 * @returns {boolean} Whether both encode the same
 */
export function equals(left: Extended, right: Extended): boolean {
  return (
    fe(left.x * right.y) === fe(left.y * right.x) || fe(left.y * right.y) === fe(left.x * right.x)
  );
}

/**
 * DECODE of RFC 9496, section 4.3.1.
 * @param bytes - 32 bytes
 * @returns {Extended | undefined} The point, or undefined for a non-canonical encoding
 */
export function decode(bytes: ArrayLike<number>): Extended | undefined {
  const s = bytesToNumberLE(bytes);
  if (bytes.length !== 32 || s >= P || isNegative(s)) return undefined;
  const ss = fe(s * s);
  const u1 = fe(1n - ss);
  const u2 = fe(1n + ss);
  const u2Squared = fe(u2 * u2);
  const v = fe(-D * u1 * u1 - u2Squared);
  const { square, root: invsqrt } = sqrtRatioM1(1n, fe(v * u2Squared));
  const denX = fe(invsqrt * u2);
  const denY = fe(invsqrt * denX * v);
  const x = absolute(fe(2n * s * denX));
  const y = fe(u1 * denY);
  const t = fe(x * y);
  if (!square || isNegative(t) || y === 0n) return undefined;
  return { x, y, z: 1n, t };
}

/**
 * ENCODE of RFC 9496, section 4.3.2.
 * @param point - Any point
 * @returns {Uint8Array} 32 bytes
 */
export function encode(point: Extended): Uint8Array {
  const u1 = fe((point.z + point.y) * (point.z - point.y));
  const u2 = fe(point.x * point.y);
  const { root: invsqrt } = sqrtRatioM1(1n, fe(u1 * u2 * u2));
  const den1 = fe(invsqrt * u1);
  const den2 = fe(invsqrt * u2);
  const zInv = fe(den1 * den2 * point.t);
  const rotate = isNegative(fe(point.t * zInv));
  const x = rotate ? fe(point.y * SQRT_M1) : point.x;
  const y = rotate ? fe(point.x * SQRT_M1) : point.y;
  const denInv = rotate ? fe(den1 * INVSQRT_A_MINUS_D) : den2;
  const yFinal = isNegative(fe(x * zInv)) ? fe(-y) : y;
  return numberToBytesLE(absolute(fe(denInv * (point.z - yFinal))), 32);
}

/**
 * Read hex into a point.
 * @param text - 64 hex digits without 0x
 * @returns {Extended} The point
 * @throws {Error} When the text is not a canonical ristretto255 encoding
 */
export function decodePoint(text: unknown): Extended {
  const bytes = typeof text === "string" ? hexToBytes(text, 32) : undefined;
  const point = bytes === undefined ? undefined : decode(bytes);
  if (point === undefined) throw new Error(INVALID_POINT);
  return point;
}

/**
 * Write a point as hex.
 * @param point - Any point
 * @returns {string} 64 lowercase hex digits
 */
export function encodePoint(point: Extended): string {
  return bytesToHex(encode(point));
}

/**
 * Check a scalar for the public arithmetic.
 * @param value - The caller's scalar
 * @returns {bigint} The scalar
 * @throws {RangeError} When it is no bigint from 0 to l minus 1
 */
function decodeScalar(value: unknown): bigint {
  if (typeof value !== "bigint" || value < 0n || value >= L) throw new RangeError(SCALAR_RANGE);
  return value;
}

/**
 * Add two points.
 * @param a - 64 hex digits, a canonical encoding
 * @param b - 64 hex digits, a canonical encoding
 * @returns {string} The sum, encoded
 */
export function addPoints(a: string, b: string): string {
  return encodePoint(add(decodePoint(a), decodePoint(b)));
}

/**
 * Subtract point b from point a.
 * @param a - 64 hex digits, a canonical encoding
 * @param b - 64 hex digits, a canonical encoding
 * @returns {string} The difference, encoded
 */
export function subtractPoints(a: string, b: string): string {
  return encodePoint(add(decodePoint(a), negate(decodePoint(b))));
}

/**
 * Negate a point.
 * @param point - 64 hex digits, a canonical encoding
 * @returns {string} The negation, encoded
 */
export function negatePoint(point: string): string {
  return encodePoint(negate(decodePoint(point)));
}

/**
 * Multiply a point by a scalar.
 * @param point - 64 hex digits, a canonical encoding
 * @param scalar - A bigint from 0 to l minus 1
 * @returns {string} The product, encoded
 */
export function multiplyPoint(point: string, scalar: bigint): string {
  return encodePoint(multiply(decodePoint(point), decodeScalar(scalar)));
}

/**
 * Multiply the base point by a scalar.
 * @param scalar - A bigint from 0 to l minus 1
 * @returns {string} The product, encoded
 */
export function multiplyGenerator(scalar: bigint): string {
  return encodePoint(multiply(BASE, decodeScalar(scalar)));
}

/**
 * Check that hex is the canonical encoding of a ristretto255 point.
 * @param point - 64 hex digits without 0x
 * @returns {boolean} False for anything else, the identity's 32 zero bytes being a point
 */
export function isValidPoint(point: string): boolean {
  try {
    decodePoint(point);
    return true;
  } catch {
    return false;
  }
}
