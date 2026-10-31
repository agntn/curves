/**
 * NIST P-384, secp384r1 in SEC 2 v2, section 2.5.1: y^2 = x^3 - 3x + b over the prime field of p,
 * cofactor 1. The curve of ES384 tokens, CNSA suites and certificates that want more than P-256.
 * Points and ECDSA verification run on the same SEC 1 code in `sec1.ts` as P-256, with the same
 * a = -3 formulas, only at 48 bytes a number.
 */

import * as sec1 from "./sec1.ts";
import {
  minusThreeAFormulas,
  sec1Curve,
  type LiftedPoints,
  type PointEncodingOptions,
  type Scalar,
  type VerifyOptions,
} from "./sec1.ts";

export type { LiftedPoints, PointEncodingOptions, Scalar, VerifyOptions } from "./sec1.ts";

/** The domain parameters: the curve, its generator and the order of the generator. */
export const p384 = Object.freeze({
  a: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000fffffffcn,
  b: 0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aefn,
  p: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffffn,
  n: 0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973n,
  h: 1n,
  g: Object.freeze({
    x: 0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7n,
    y: 0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5fn,
  }),
});

/** The one refusal for text that isn't a SEC1 point of the curve. */
export const INVALID_POINT = "Invalid SEC1 P-384 public key";

const curve = /* @__PURE__ */ sec1Curve(p384, { name: "P-384", formulas: minusThreeAFormulas });

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
 * @param x - 96 hex digits without 0x
 * @param options - Output encoding; compressed by default
 * @returns {LiftedPoints} The even and odd point as SEC1 hex
 * @throws {RangeError} When x is not 96 hex digits, or no point of the curve has it
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
 * Verify an ECDSA signature over a digest, SEC 1 v2 section 4.1.4. ES384 hashes with SHA-384
 * first, and a longer digest counts by its leftmost 384 bits. A DER signature needs unpacking
 * into r and s.
 * @param signature - 192 hex digits, r then s
 * @param options - The digest, the public key and the low-S rule
 * @returns {boolean} Whether the key signed the digest, false for r or s outside 1 to n minus 1 too
 * @throws {RangeError} When the signature or the digest is no hex of its length
 * @throws {Error} When the public key is no SEC1 point of the curve
 */
export function verify(signature: string, options: VerifyOptions): boolean {
  return sec1.verify(curve, signature, options);
}
