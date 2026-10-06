/**
 * secp256k1 from SEC 2 v2, section 2.4.1: y^2 = x^3 + 7 over the prime field of p, cofactor 1.
 * Points travel as SEC1 hex (SEC 1 v2, sections 2.3.3 and 2.3.4) and multiply in Jacobian
 * coordinates, so a product costs one inversion instead of one per step. Nothing here runs in
 * constant time.
 */

import { invert, mod, power } from "./field.ts";

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

const { p: P, n: N, b: B, g: G } = secp256k1;

/** p is 3 mod 4, so a square root of a square r is r^((p + 1) / 4). */
const ROOT_EXPONENT = (P + 1n) / 4n;

/** The one refusal for text that isn't a SEC1 point of the curve. */
export const INVALID_POINT = "Invalid SEC1 secp256k1 public key";

const INFINITY = "The result is the point at infinity, which is no public key, as with P minus P";

const SEC1 = /^(?:0[23][0-9a-f]{64}|04[0-9a-f]{128})$/iu;
const SCALAR = /^[0-9a-f]{1,64}$/iu;
const X_ONLY = /^[0-9a-f]{64}$/iu;

/** A scalar as hex without 0x, up to 64 digits, or as a bigint. */
export type Scalar = string | bigint;

/** SEC1 output encoding; this does not change the point. */
export interface PointEncodingOptions {
  readonly compressed?: boolean;
}

/** The two points above one x coordinate, as SEC1 hex. */
export interface LiftedPoints {
  /** Even y, the point a BIP340 x-only key stands for. */
  readonly even: string;
  readonly odd: string;
}

/** A finite point with both coordinates from 0 to p minus 1. */
interface Affine {
  readonly x: bigint;
  readonly y: bigint;
}

/** (X, Y, Z) stands for (X / Z^2, Y / Z^3); Z = 0 is the point at infinity. */
interface Jacobian {
  readonly x: bigint;
  readonly y: bigint;
  readonly z: bigint;
}

const ZERO: Jacobian = { x: 1n, y: 1n, z: 0n };

/**
 * The right side of the curve equation.
 * @param x - From 0 to p minus 1
 * @returns {bigint} x^3 + 7 mod p
 */
function rightSide(x: bigint): bigint {
  return mod(x * x * x + B, P);
}

/**
 * The y with the asked parity above x, if any point has this x.
 * @param x - From 0 to p minus 1
 * @param odd - Whether y should be odd
 * @returns {bigint | undefined} y, or undefined when x^3 + 7 is no square
 */
function liftY(x: bigint, odd: boolean): bigint | undefined {
  const square = rightSide(x);
  const root = power(square, ROOT_EXPONENT, P);
  if ((root * root) % P !== square) return undefined;
  return ((root & 1n) === 1n) === odd ? root : mod(-root, P);
}

/**
 * Read SEC1 hex into a point of the curve.
 * @param text - Compressed or uncompressed SEC1 hex without 0x
 * @returns {Affine} The point
 * @throws {Error} When the text is not SEC1 hex, a coordinate reaches p, or the point is off the curve
 */
function decodePoint(text: unknown): Affine {
  if (typeof text !== "string" || !SEC1.test(text)) throw new Error(INVALID_POINT);
  const x = BigInt(`0x${text.slice(2, 66)}`);
  if (x >= P) throw new Error(INVALID_POINT);
  const prefix = text.slice(0, 2);
  if (prefix === "04") {
    const y = BigInt(`0x${text.slice(66)}`);
    if (y >= P || (y * y) % P !== rightSide(x)) throw new Error(INVALID_POINT);
    return { x, y };
  }
  const y = liftY(x, prefix === "03");
  if (y === undefined) throw new Error(INVALID_POINT);
  return { x, y };
}

/**
 * Write a point as SEC1 hex.
 * @param point - A finite point
 * @param compressed - 33 bytes with the parity of y, or 65 with both coordinates
 * @returns {string} Lowercase SEC1 hex
 */
function encodeAffine(point: Affine, compressed: boolean): string {
  const x = point.x.toString(16).padStart(64, "0");
  if (!compressed) return `04${x}${point.y.toString(16).padStart(64, "0")}`;
  return `${(point.y & 1n) === 1n ? "03" : "02"}${x}`;
}

/**
 * Read the output encoding.
 * @param options - The caller's options
 * @returns {boolean} Whether to compress, true by default
 */
function compression(options: PointEncodingOptions): boolean {
  const { compressed = true } = options;
  if (typeof compressed !== "boolean") throw new TypeError("Compressed must be a boolean");
  return compressed;
}

function toJacobian(point: Affine): Jacobian {
  return { x: point.x, y: point.y, z: 1n };
}

/**
 * Bring a Jacobian point back to x and y.
 * @param point - Any point
 * @returns {Affine | undefined} The point, undefined for infinity
 */
function toAffine(point: Jacobian): Affine | undefined {
  if (point.z === 0n) return undefined;
  const inverse = invert(point.z, P);
  const square = (inverse * inverse) % P;
  return { x: (point.x * square) % P, y: (point.y * square * inverse) % P };
}

/**
 * Double a point: dbl-2009-l from the Explicit-Formulas Database, for a = 0.
 * @param point - Any point
 * @returns {Jacobian} Twice the point
 */
function double(point: Jacobian): Jacobian {
  if (point.z === 0n || point.y === 0n) return ZERO;
  const { x, y, z } = point;
  const xx = (x * x) % P;
  const yy = (y * y) % P;
  const yyyy = (yy * yy) % P;
  const d = mod(2n * ((x + yy) ** 2n - xx - yyyy), P);
  const e = (3n * xx) % P;
  const sumX = mod(e * e - 2n * d, P);
  return { x: sumX, y: mod(e * (d - sumX) - 8n * yyyy, P), z: (2n * y * z) % P };
}

/**
 * Add two points in Jacobian coordinates.
 * @param left - Any point
 * @param right - Any point
 * @returns {Jacobian} The sum
 */
function add(left: Jacobian, right: Jacobian): Jacobian {
  if (left.z === 0n) return right;
  if (right.z === 0n) return left;
  const leftZZ = (left.z * left.z) % P;
  const rightZZ = (right.z * right.z) % P;
  const u1 = (left.x * rightZZ) % P;
  const u2 = (right.x * leftZZ) % P;
  const s1 = (left.y * right.z * rightZZ) % P;
  const s2 = (right.y * left.z * leftZZ) % P;
  const h = mod(u2 - u1, P);
  const r = mod(s2 - s1, P);
  if (h === 0n) return r === 0n ? double(left) : ZERO;
  const hh = (h * h) % P;
  const hhh = (hh * h) % P;
  const v = (u1 * hh) % P;
  const sumX = mod(r * r - hhh - 2n * v, P);
  return { x: sumX, y: mod(r * (v - sumX) - s1 * hhh, P), z: (left.z * right.z * h) % P };
}

function negate(point: Jacobian): Jacobian {
  return { x: point.x, y: mod(-point.y, P), z: point.z };
}

/**
 * Multiply by double and add from the top bit down.
 * @param point - Any point
 * @param scalar - Zero or more
 * @returns {Jacobian} The product
 */
function multiply(point: Jacobian, scalar: bigint): Jacobian {
  let result = ZERO;
  for (const bit of scalar.toString(2)) {
    result = double(result);
    if (bit === "1") result = add(result, point);
  }
  return result;
}

/**
 * Encode a result, refusing the point at infinity, which SEC1 public keys have no form for.
 * @param point - Any point
 * @param options - Output encoding
 * @returns {string} SEC1 hex
 */
function encodePoint(point: Jacobian, options: PointEncodingOptions): string {
  const compressed = compression(options);
  const affine = toAffine(point);
  if (affine === undefined) throw new RangeError(INFINITY);
  return encodeAffine(affine, compressed);
}

/**
 * Read a scalar and check it against the range the operation allows.
 * @param value - Hex without 0x, up to 64 digits, or a bigint
 * @param name - What the error calls the value
 * @param minimum - 0 for scalar arithmetic, 1 where zero would give the point at infinity
 * @returns {bigint} The scalar
 * @throws {RangeError} When the value is not hex or a bigint, or falls outside minimum to n minus 1
 */
function decodeScalar(value: unknown, name: string, minimum: 0n | 1n): bigint {
  let scalar: bigint | undefined;
  if (typeof value === "bigint") scalar = value;
  else if (typeof value === "string" && SCALAR.test(value)) scalar = BigInt(`0x${value}`);
  if (scalar === undefined || scalar < minimum || scalar >= N) {
    throw new RangeError(
      `${name} must be hex without 0x or a bigint, from ${minimum} to the curve order minus 1`,
    );
  }
  return scalar;
}

function encodeScalar(scalar: bigint): string {
  return scalar.toString(16).padStart(64, "0");
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
  return encodePoint(add(toJacobian(decodePoint(a)), toJacobian(decodePoint(b))), options);
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
  return encodePoint(add(toJacobian(decodePoint(a)), negate(toJacobian(decodePoint(b)))), options);
}

/**
 * Negate a point: same x, the other y.
 * @param point - SEC1 hex, compressed or uncompressed
 * @param options - Output encoding; compressed by default
 * @returns {string} The negated point as SEC1 hex
 */
export function negatePoint(point: string, options: PointEncodingOptions = {}): string {
  return encodePoint(negate(toJacobian(decodePoint(point))), options);
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
  const decoded = decodePoint(point);
  return encodePoint(multiply(toJacobian(decoded), decodeScalar(scalar, "Scalar", 1n)), options);
}

/**
 * Multiply the generator by a scalar, which for a private key is its public key.
 * @param scalar - From 1 to the curve order minus 1
 * @param options - Output encoding; compressed by default
 * @returns {string} The product as SEC1 hex
 */
export function multiplyGenerator(scalar: Scalar, options: PointEncodingOptions = {}): string {
  return encodePoint(multiply(toJacobian(G), decodeScalar(scalar, "Scalar", 1n)), options);
}

/**
 * Add two scalars mod the curve order.
 * @param a - From 0 to the curve order minus 1
 * @param b - From 0 to the curve order minus 1
 * @returns {string} The sum as 64 hex digits
 */
export function addScalars(a: Scalar, b: Scalar): string {
  return encodeScalar(mod(decodeScalar(a, "Scalar a", 0n) + decodeScalar(b, "Scalar b", 0n), N));
}

/**
 * Subtract scalar b from scalar a mod the curve order.
 * @param a - From 0 to the curve order minus 1
 * @param b - From 0 to the curve order minus 1
 * @returns {string} The difference as 64 hex digits
 */
export function subtractScalars(a: Scalar, b: Scalar): string {
  return encodeScalar(mod(decodeScalar(a, "Scalar a", 0n) - decodeScalar(b, "Scalar b", 0n), N));
}

/**
 * Multiply two scalars mod the curve order.
 * @param a - From 0 to the curve order minus 1
 * @param b - From 0 to the curve order minus 1
 * @returns {string} The product as 64 hex digits
 */
export function multiplyScalars(a: Scalar, b: Scalar): string {
  return encodeScalar(mod(decodeScalar(a, "Scalar a", 0n) * decodeScalar(b, "Scalar b", 0n), N));
}

/**
 * Invert a scalar mod the curve order.
 * @param scalar - From 1 to the curve order minus 1, since zero has no inverse
 * @returns {string} The inverse as 64 hex digits
 */
export function invertScalar(scalar: Scalar): string {
  return encodeScalar(invert(decodeScalar(scalar, "Scalar", 1n), N));
}

/**
 * Find both points above an x coordinate. An x-only BIP340 key is the even one.
 * @param x - 64 hex digits without 0x
 * @param options - Output encoding; compressed by default
 * @returns {LiftedPoints} The even and odd point as SEC1 hex
 * @throws {RangeError} When x is not 64 hex digits, or no point of the curve has it
 */
export function liftX(x: string, options: PointEncodingOptions = {}): LiftedPoints {
  if (typeof x !== "string" || !X_ONLY.test(x)) {
    throw new RangeError("x must be 64 hex digits without 0x");
  }
  const compressed = compression(options);
  const value = BigInt(`0x${x}`);
  const y = value < P ? liftY(value, false) : undefined;
  if (y === undefined) throw new RangeError("No point of secp256k1 has this x");
  return {
    even: encodeAffine({ x: value, y }, compressed),
    odd: encodeAffine({ x: value, y: mod(-y, P) }, compressed),
  };
}

/**
 * Check that a SEC1 point lies on the curve.
 * @param point - Compressed or uncompressed SEC1 hex
 * @returns {boolean} False for a point off the curve, or a compressed x that no point has
 * @throws {Error} When the value is not SEC1 hex at all, since there is no point to check
 */
export function isOnCurve(point: string): boolean {
  if (typeof point !== "string" || !SEC1.test(point)) throw new Error(INVALID_POINT);
  try {
    decodePoint(point);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write a point in the other SEC1 encoding, or check and lowercase it in the same one.
 * @param point - Compressed or uncompressed SEC1 hex
 * @param options - Output encoding; compressed by default
 * @returns {string} The same point as SEC1 hex
 * @throws {Error} When the value is not a SEC1 point of the curve
 */
export function convertPoint(point: string, options: PointEncodingOptions = {}): string {
  const compressed = compression(options);
  return encodeAffine(decodePoint(point), compressed);
}
