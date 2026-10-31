/**
 * brainpoolP256r1 in RFC 5639, section 3.4: y^2 = x^3 + ax + b over the prime field of p, cofactor
 * 1, with a and b derived from a seed instead of picked for speed. OpenPGP (RFC 9580) and TLS
 * (RFC 7027) both list it. Points and ECDSA verification run on the SEC 1 code in `sec1.ts`, with
 * the formulas for any a, since this a is neither 0 nor -3.
 */

import * as sec1 from "./sec1.ts";
import {
  anyAFormulas,
  sec1Curve,
  type LiftedPoints,
  type PointEncodingOptions,
  type Scalar,
  type VerifyOptions,
} from "./sec1.ts";

export type { LiftedPoints, PointEncodingOptions, Scalar, VerifyOptions } from "./sec1.ts";

/** The domain parameters: the curve, its generator and the order of the generator. */
export const brainpoolP256r1 = Object.freeze({
  a: 0x7d5a0975fc2c3057eef67530417affe7fb8055c126dc5c6ce94a4b44f330b5d9n,
  b: 0x26dc5c6ce94a4b44f330b5d9bbd77cbf958416295cf7e1ce6bccdc18ff8c07b6n,
  p: 0xa9fb57dba1eea9bc3e660a909d838d726e3bf623d52620282013481d1f6e5377n,
  n: 0xa9fb57dba1eea9bc3e660a909d838d718c397aa3b561a6f7901e0e82974856a7n,
  h: 1n,
  g: Object.freeze({
    x: 0x8bd2aeb9cb7e57cb2c4b482ffc81b7afb9de27e1e3bd23c23a4453bd9ace3262n,
    y: 0x547ef835c3dac4fd97f8461a14611dc9c27745132ded8e545c1d54c72f046997n,
  }),
});

/** The one refusal for text that isn't a SEC1 point of the curve. */
export const INVALID_POINT = "Invalid SEC1 brainpoolP256r1 public key";

const curve = /* @__PURE__ */ sec1Curve(brainpoolP256r1, {
  name: "brainpoolP256r1",
  formulas: anyAFormulas,
});

/**
 * Add two points.
 * @param a - SEC1 hex, compressed or uncompressed
 * @param b - SEC1 hex, compressed or uncompressed
 * @param options - Output encoding; compressed by default
 * @returns {string} The sum as SEC1 hex
 * @throws {RangeError} When b is the negation of a, since the sum is the point at infinity
 */
export function addPoints(a: string, b: string, options: PointEncodingOptions = {}): string {
  return sec1.addPoints(curve, a, b, options);
}

/**
 * Subtract point b from point a.
 * @param a - SEC1 hex, compressed or uncompressed
 * @param b - SEC1 hex, compressed or uncompressed
 * @param options - Output encoding; compressed by default
 * @returns {string} The difference as SEC1 hex
 * @throws {RangeError} When a equals b, since the difference is the point at infinity
 */
export function subtractPoints(a: string, b: string, options: PointEncodingOptions = {}): string {
  return sec1.subtractPoints(curve, a, b, options);
}

/**
 * Negate a point: same x, the other y.
 * @param point - SEC1 hex, compressed or uncompressed
 * @param options - Output encoding; compressed by default
 * @returns {string} The negated point as SEC1 hex
 */
export function negatePoint(point: string, options: PointEncodingOptions = {}): string {
  return sec1.negatePoint(curve, point, options);
}

/**
 * Multiply a point by a scalar, in the same steps for every scalar.
 * @param point - SEC1 hex, compressed or uncompressed
 * @param scalar - From 1 to the curve order minus 1
 * @param options - Output encoding; compressed by default
 * @returns {string} The product as SEC1 hex
 */
export function multiplyPoint(
  point: string,
  scalar: Scalar,
  options: PointEncodingOptions = {},
): string {
  return sec1.multiplyPoint(curve, point, scalar, options);
}

/**
 * Multiply the generator by a scalar, which for a private key is its public key.
 * @param scalar - From 1 to the curve order minus 1
 * @param options - Output encoding; compressed by default
 * @returns {string} The product as SEC1 hex
 */
export function multiplyGenerator(scalar: Scalar, options: PointEncodingOptions = {}): string {
  return sec1.multiplyGenerator(curve, scalar, options);
}

/**
 * Find both points above an x coordinate.
 * @param x - 64 hex digits without 0x
 * @param options - Output encoding; compressed by default
 * @returns {LiftedPoints} The even and odd point as SEC1 hex
 * @throws {RangeError} When x is not 64 hex digits, or no point of the curve has it
 */
export function liftX(x: string, options: PointEncodingOptions = {}): LiftedPoints {
  return sec1.liftX(curve, x, options);
}

/**
 * Check that a SEC1 point lies on the curve.
 * @param point - Compressed or uncompressed SEC1 hex
 * @returns {boolean} False for a point off the curve, or a compressed x that no point has
 * @throws {Error} When the value is not SEC1 hex at all, since there is no point to check
 */
export function isOnCurve(point: string): boolean {
  return sec1.isOnCurve(curve, point);
}

/**
 * Write a point in the other SEC1 encoding, or check and lowercase it in the same one.
 * @param point - Compressed or uncompressed SEC1 hex
 * @param options - Output encoding; compressed by default
 * @returns {string} The same point as SEC1 hex
 * @throws {Error} When the value is not a SEC1 point of the curve
 */
export function convertPoint(point: string, options: PointEncodingOptions = {}): string {
  return sec1.convertPoint(curve, point, options);
}

/**
 * Verify an ECDSA signature over a digest, SEC 1 v2 section 4.1.4. Hash the message first; a DER
 * signature, or the two MPIs of an OpenPGP one, needs unpacking into r and s.
 * @param signature - 128 hex digits, r then s
 * @param options - The digest, the public key and the low-S rule
 * @returns {boolean} Whether the key signed the digest, false for r or s outside 1 to n minus 1 too
 * @throws {RangeError} When the signature or the digest is no hex of its length
 * @throws {Error} When the public key is no SEC1 point of the curve
 */
export function verify(signature: string, options: VerifyOptions): boolean {
  return sec1.verify(curve, signature, options);
}
