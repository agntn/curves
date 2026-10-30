/**
 * NIST P-256, secp256r1 in SEC 2 v2, section 2.4.2: y^2 = x^3 - 3x + b over the prime field of p,
 * cofactor 1. The curve under WebAuthn passkeys, ES256 tokens and TLS. Points and ECDSA
 * verification run on the SEC 1 code in `sec1.ts`, with the a = -3 formulas.
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
export const p256 = Object.freeze({
  a: 0xffffffff00000001000000000000000000000000fffffffffffffffffffffffcn,
  b: 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn,
  p: 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn,
  n: 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n,
  h: 1n,
  g: Object.freeze({
    x: 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n,
    y: 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n,
  }),
});

/** The one refusal for text that isn't a SEC1 point of the curve. */
export const INVALID_POINT = "Invalid SEC1 P-256 public key";

const curve = /* @__PURE__ */ sec1Curve(p256, { name: "P-256", formulas: minusThreeAFormulas });

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
 * Verify an ECDSA signature over a digest, SEC 1 v2 section 4.1.4. ES256 and WebAuthn hash with
 * SHA-256 first; a DER signature needs unpacking into r and s.
 * @param signature - 128 hex digits, r then s
 * @param options - The digest, the public key and the low-S rule
 * @returns {boolean} Whether the key signed the digest, false for r or s outside 1 to n minus 1 too
 * @throws {RangeError} When the signature or the digest is no hex of its length
 * @throws {Error} When the public key is no SEC1 point of the curve
 */
export function verify(signature: string, options: VerifyOptions): boolean {
  return sec1.verify(curve, signature, options);
}
