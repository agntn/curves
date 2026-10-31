/**
 * brainpoolP384r1 in RFC 5639, section 3.6: y^2 = x^3 + ax + b over the prime field of p, cofactor
 * 1, with a and b derived from a seed instead of picked for speed. OpenPGP (RFC 9580) and TLS
 * (RFC 7027) both list it. Points and ECDSA verification run on the SEC 1 code in `sec1.ts` with
 * the formulas for any a, as on brainpoolP256r1, only at 48 bytes a number.
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
export const brainpoolP384r1 = Object.freeze({
  a: 0x7bc382c63d8c150c3c72080ace05afa0c2bea28e4fb22787139165efba91f90f8aa5814a503ad4eb04a8c7dd22ce2826n,
  b: 0x04a8c7dd22ce28268b39b55416f0447c2fb77de107dcd2a62e880ea53eeb62d57cb4390295dbc9943ab78696fa504c11n,
  p: 0x8cb91e82a3386d280f5d6f7e50e641df152f7109ed5456b412b1da197fb71123acd3a729901d1a71874700133107ec53n,
  n: 0x8cb91e82a3386d280f5d6f7e50e641df152f7109ed5456b31f166e6cac0425a7cf3ab6af6b7fc3103b883202e9046565n,
  h: 1n,
  g: Object.freeze({
    x: 0x1d1c64f068cf45ffa2a63a81b7c13f6b8847a3e77ef14fe3db7fcafe0cbd10e8e826e03436d646aaef87b2e247d4af1en,
    y: 0x8abe1d7520f9c2a45cb1eb8e95cfd55262b70b29feec5864e19c054ff99129280e4646217791811142820341263c5315n,
  }),
});

/** The one refusal for text that isn't a SEC1 point of the curve. */
export const INVALID_POINT = "Invalid SEC1 brainpoolP384r1 public key";

const curve = /* @__PURE__ */ sec1Curve(brainpoolP384r1, {
  name: "brainpoolP384r1",
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
 * Verify an ECDSA signature over a digest, SEC 1 v2 section 4.1.4. Hash the message first, and a
 * longer digest than 48 bytes counts by its leftmost 384 bits. A DER signature, or the two MPIs of
 * an OpenPGP one, needs unpacking into r and s.
 * @param signature - 192 hex digits, r then s
 * @param options - The digest, the public key and the low-S rule
 * @returns {boolean} Whether the key signed the digest, false for r or s outside 1 to n minus 1 too
 * @throws {RangeError} When the signature or the digest is no hex of its length
 * @throws {Error} When the public key is no SEC1 point of the curve
 */
export function verify(signature: string, options: VerifyOptions): boolean {
  return sec1.verify(curve, signature, options);
}
