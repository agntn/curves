/**
 * secp256k1 from SEC 2 v2, section 2.4.1: y^2 = x^3 + 7 over the prime field of p, cofactor 1.
 * The points, the scalars and ECDSA run on the SEC 1 code in `sec1.ts`, with the a = 0 formulas.
 * The messages are the ones @agntn/keys threw: keys re-exports these functions, and its tests
 * read the words.
 */

import type { AffinePoint } from "./arithmetic.ts";
import * as sec1 from "./sec1.ts";
import {
  zeroAFormulas,
  sec1Curve,
  type LiftedPoints,
  type PointEncodingOptions,
  type RecoverOptions,
  type Scalar,
  type Signature,
  type SignOptions,
  type VerifyOptions,
} from "./sec1.ts";

export type {
  LiftedPoints,
  PointEncodingOptions,
  RecoverOptions,
  Scalar,
  Signature,
  SignOptions,
  VerifyOptions,
} from "./sec1.ts";

/** The domain parameters: the curve, its generator and the order of the generator. */
export const secp256k1 = Object.freeze({
  a: 0n,
  b: 7n,
  p: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn,
  n: 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n,
  h: 1n,
  g: Object.freeze({
    x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
    y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
  }),
});

/** The one refusal for text that isn't a SEC1 point of the curve. */
export const INVALID_POINT = "Invalid SEC1 secp256k1 public key";

const curve = /* @__PURE__ */ sec1Curve(secp256k1, { name: "secp256k1", formulas: zeroAFormulas });

/**
 * The y with the asked parity above x, if any point has this x.
 * @param x - From 0 to p minus 1
 * @param odd - Whether y should be odd
 * @returns {bigint | undefined} y, or undefined when x^3 + 7 is no square
 */
export function liftY(x: bigint, odd: boolean): bigint | undefined {
  return sec1.liftY(curve, x, odd);
}

/**
 * Add two points, as in a split key vanity address.
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
 * Subtract point b from point a, as when checking the offset between two known keys.
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
 * Multiply a point by a scalar.
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
 * Secret times G as x and y, through the same comb and Z^(p - 2) as {@link multiplyGenerator}.
 * @param secret - From 1 to n minus 1
 * @returns {AffinePoint} The point
 */
export function publicPoint(secret: bigint): AffinePoint {
  return sec1.publicPoint(curve, secret);
}

/**
 * Add two scalars mod the curve order.
 * @param a - From 0 to the curve order minus 1
 * @param b - From 0 to the curve order minus 1
 * @returns {string} The sum as 64 hex digits
 */
export function addScalars(a: Scalar, b: Scalar): string {
  return sec1.addScalars(curve, [a, b]);
}

/**
 * Subtract scalar b from scalar a mod the curve order.
 * @param a - From 0 to the curve order minus 1
 * @param b - From 0 to the curve order minus 1
 * @returns {string} The difference as 64 hex digits
 */
export function subtractScalars(a: Scalar, b: Scalar): string {
  return sec1.subtractScalars(curve, [a, b]);
}

/**
 * Multiply two scalars mod the curve order.
 * @param a - From 0 to the curve order minus 1
 * @param b - From 0 to the curve order minus 1
 * @returns {string} The product as 64 hex digits
 */
export function multiplyScalars(a: Scalar, b: Scalar): string {
  return sec1.multiplyScalars(curve, [a, b]);
}

/**
 * Invert a scalar mod the curve order.
 * @param scalar - From 1 to the curve order minus 1, since zero has no inverse
 * @returns {string} The inverse as 64 hex digits
 */
export function invertScalar(scalar: Scalar): string {
  return sec1.invertScalar(curve, scalar);
}

/**
 * Find both points above an x coordinate. An x-only BIP340 key is the even one.
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
 * a times G plus b times a point, the sum ECDSA and BIP340 verification and recovery end on.
 * Both scalars are public there, so G comes from the faster table and Euclid inverts Z.
 * @param a - Zero to n minus 1, never a secret
 * @param b - Zero to n minus 1
 * @param point - A finite point
 * @returns {AffinePoint | undefined} The sum, undefined for the point at infinity
 */
export function combine(a: bigint, b: bigint, point: AffinePoint): AffinePoint | undefined {
  return sec1.combine(curve, { a, b, point });
}

/**
 * ECDSA by SEC 1 v2 section 4.1.3, k from RFC 6979, low s. kG takes the same steps for any k, the
 * math mod n doesn't promise that.
 * @param secret - The private key, from 1 to the curve order minus 1
 * @param options - The digest
 * @returns {Signature} The signature as r then s, and its recovery id
 * @throws {RangeError} When the secret or the digest is no hex or out of range
 * @throws {TypeError} When options is not an object
 */
export function sign(secret: Scalar, options: SignOptions): Signature {
  return sec1.sign(curve, secret, options);
}

/**
 * Verify an ECDSA signature over a digest, SEC 1 v2 section 4.1.4.
 * @param signature - 128 hex digits, r then s
 * @param options - The digest, the public key and the low-S rule
 * @returns {boolean} Whether the key signed the digest, false for r or s outside 1 to n minus 1 too
 * @throws {RangeError} When the signature or the digest is no hex of its length
 * @throws {Error} When the public key is no SEC1 point of the curve
 */
export function verify(signature: string, options: VerifyOptions): boolean {
  return sec1.verify(curve, signature, options);
}

/**
 * Recover the key behind an ECDSA signature, SEC 1 v2 section 4.1.6. Compare it with yours.
 * @param signature - 128 hex digits, r then s
 * @param options - The digest, the recovery id and the output encoding, compressed by default
 * @returns {string} The public key as SEC1 hex, one the signature verifies under whatever it is
 * @throws {RangeError} When an argument is malformed, r or s is out of range, or R does not exist
 */
export function recoverPublicKey(signature: string, options: RecoverOptions): string {
  return sec1.recoverPublicKey(curve, signature, options);
}
