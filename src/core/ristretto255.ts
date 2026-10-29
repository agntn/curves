/**
 * ristretto255 from RFC 9496: the prime order group of order l built over edwards25519. Points
 * travel as the 32-byte ristretto255 encoding, which hides the cofactor 8 of the curve.
 * Multiplying takes the same steps for every scalar, the way edwards25519 does.
 */

import { bytesToHex, hexToBytes, bytesToNumberLE, numberToBytesLE } from "./bytes.ts";
import {
  D,
  G,
  L,
  P,
  SQRT_M1,
  absolute,
  add,
  decodeScalar,
  fe,
  isNegative,
  multiply,
  multiplyBase,
  negate,
  sqrtRatioM1,
  type Extended,
} from "./edwards25519.ts";

const INVSQRT_A_MINUS_D =
  54469307008909316920995813868745141605393597292927456921205312896311721017578n;

/** The domain parameters: p, d, the group order l and the edwards25519 base point. */
export const ristretto255 = Object.freeze({ p: P, d: D, l: L, g: G });

/** The one refusal for text that isn't the canonical encoding of a ristretto255 point. */
export const INVALID_POINT = "Invalid ristretto255 point";

const SCALAR_RANGE = "Scalar must be a bigint from 0 to the group order minus 1";

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
  return encodePoint(multiply(decodePoint(point), decodeScalar(scalar, SCALAR_RANGE)));
}

/**
 * Multiply the base point by a scalar.
 * @param scalar - A bigint from 0 to l minus 1
 * @returns {string} The product, encoded
 */
export function multiplyGenerator(scalar: bigint): string {
  return encodePoint(multiplyBase(decodeScalar(scalar, SCALAR_RANGE)));
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
