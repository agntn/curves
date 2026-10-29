/**
 * secp256k1 from SEC 2 v2, section 2.4.1: y^2 = x^3 + 7 over the prime field of p, cofactor 1.
 * Points travel as SEC1 hex (SEC 1 v2, sections 2.3.3 and 2.3.4) and multiply in Jacobian
 * coordinates, so a product costs one inversion instead of one per step. ECDSA verification and
 * public key recovery follow SEC 1 v2, sections 4.1.4 and 4.1.6. Nothing here runs in constant
 * time. The messages are the ones @agntn/keys threw: keys re-exports these functions, and its
 * tests read the words.
 */

import { requireOptions } from "./arguments.ts";
import type { AffinePoint } from "./arithmetic.ts";
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
type Affine = AffinePoint;

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
export function liftY(x: bigint, odd: boolean): bigint | undefined {
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
 * Add a finite affine point to a Jacobian one, cheaper than `add` since the right Z is 1.
 * @param left - Any point
 * @param right - A finite point
 * @returns {Jacobian} The sum
 */
function addAffine(left: Jacobian, right: Affine): Jacobian {
  if (left.z === 0n) return toJacobian(right);
  const zz = (left.z * left.z) % P;
  const h = mod(right.x * zz - left.x, P);
  const r = mod(right.y * left.z * zz - left.y, P);
  if (h === 0n) return r === 0n ? double(left) : ZERO;
  const hh = (h * h) % P;
  const hhh = (hh * h) % P;
  const v = (left.x * hh) % P;
  const sumX = mod(r * r - hhh - 2n * v, P);
  return { x: sumX, y: mod(r * (v - sumX) - left.y * hhh, P), z: (left.z * h) % P };
}

/**
 * Bring many Jacobian points to x and y with one inversion, Montgomery's trick.
 * @param points - Finite points
 * @returns {Affine[]} The same points, in order
 */
function toAffineAll(points: readonly Jacobian[]): Affine[] {
  let product = 1n;
  const steps = points.map((point) => {
    const before = product;
    product = (product * point.z) % P;
    return { point, before };
  });
  let inverse = invert(product, P);
  return steps
    .toReversed()
    .map(({ point, before }) => {
      const zInverse = (inverse * before) % P;
      inverse = (inverse * point.z) % P;
      const square = (zInverse * zInverse) % P;
      return { x: (point.x * square) % P, y: (point.y * square * zInverse) % P };
    })
    .toReversed();
}

/** Entry j of row i is (j + 1) times 16^(63 - i) times G, so hex digit i picks entry digit - 1. */
let generatorTable: readonly (readonly Affine[])[] | undefined;

function buildGeneratorTable(): readonly (readonly Affine[])[] {
  const points: Jacobian[] = [];
  let base = toJacobian(G);
  for (let row = 0; row < 64; row++) {
    let multiple = base;
    for (let digit = 1; digit < 16; digit++) {
      points.push(multiple);
      multiple = add(multiple, base);
    }
    base = multiple;
  }
  const affine = toAffineAll(points);
  return Array.from({ length: 64 }, (_, row) => affine.slice(row * 15, row * 15 + 15)).toReversed();
}

/**
 * Multiply G with one table lookup per nonzero hex digit and not a single doubling.
 * @param scalar - Zero to n minus 1
 * @returns {Jacobian} The product
 */
function multiplyBase(scalar: bigint): Jacobian {
  generatorTable ??= buildGeneratorTable();
  const digits = scalar.toString(16).padStart(64, "0");
  let result = ZERO;
  for (const [row, multiples] of generatorTable.entries()) {
    const point = multiples[Number.parseInt(digits.charAt(row), 16) - 1];
    if (point !== undefined) result = addAffine(result, point);
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
  return encodePoint(multiplyBase(decodeScalar(scalar, "Scalar", 1n)), options);
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

/** The largest s a low-S signature may carry, as BIP 62 and BIP 146 count it. */
const HALF_N = N >> 1n;

const SIGNATURE = /^[0-9a-f]{128}$/iu;
const DIGEST = /^(?:[0-9a-f]{2}){1,64}$/iu;

/** What {@link verify} checks a signature against. */
export interface VerifyOptions {
  /** The message digest as hex, 1 to 64 bytes. Past 32 bytes only the leftmost 256 bits count. */
  readonly digest: string;
  /** The signer's key, compressed or uncompressed SEC1 hex. */
  readonly publicKey: string;
  /** Refuse s above n / 2, as BIP 62 and BIP 146 do. Default: false, SEC 1 takes either. */
  readonly lowS?: boolean;
}

/** What {@link recoverPublicKey} needs besides the signature, and how to write the key. */
export interface RecoverOptions extends PointEncodingOptions {
  /** The message digest as hex, 1 to 64 bytes, read as {@link verify} reads it. */
  readonly digest: string;
  /** 0 to 3: bit 0 is the parity of y of R, bit 1 says the x of R is r + n. */
  readonly recovery: number;
}

/** r and s as the signature carries them, before any range check. */
interface SignatureParts {
  readonly r: bigint;
  readonly s: bigint;
}

/**
 * Read a compact signature: r, then s, 32 bytes each, big-endian.
 * @param value - The caller's value
 * @returns {SignatureParts} r and s, not yet checked against n
 * @throws {RangeError} When the value is no 128 hex digits
 */
function readSignature(value: unknown): SignatureParts {
  if (typeof value !== "string" || !SIGNATURE.test(value)) {
    throw new RangeError("Signature must be 128 hex digits without 0x, r then s");
  }
  return { r: BigInt(`0x${value.slice(0, 64)}`), s: BigInt(`0x${value.slice(64)}`) };
}

/**
 * Turn a digest into e as SEC 1 v2 section 4.1.4 step 3 does: its leftmost 256 bits, n's length.
 * @param value - Hex without 0x, 1 to 64 bytes
 * @returns {bigint} e, not reduced mod n
 * @throws {RangeError} When the value is no hex of whole bytes, or longer than 64
 */
function readDigest(value: unknown): bigint {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    throw new RangeError("Digest must be hex without 0x, 1 to 64 bytes");
  }
  const extra = value.length * 4 - 256;
  const e = BigInt(`0x${value}`);
  return extra > 0 ? e >> BigInt(extra) : e;
}

function isScalar(value: bigint): boolean {
  return value > 0n && value < N;
}

/**
 * a times G plus b times a point, the sum ECDSA and BIP340 verification and recovery end on.
 * @param a - Zero to n minus 1
 * @param b - Zero to n minus 1
 * @param point - A finite point
 * @returns {Affine | undefined} The sum, undefined for the point at infinity
 */
export function combine(a: bigint, b: bigint, point: Affine): Affine | undefined {
  return toAffine(add(multiplyBase(a), multiply(toJacobian(point), b)));
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
  const { r, s } = readSignature(signature);
  requireOptions(options, "verify(signature, { digest, publicKey })");
  const e = readDigest(options.digest);
  const key = decodePoint(options.publicKey);
  const lowS = options.lowS ?? false;
  if (typeof lowS !== "boolean") throw new TypeError("lowS must be a boolean");
  if (!isScalar(r) || !isScalar(s) || (lowS && s > HALF_N)) return false;
  const inverse = invert(s, N);
  const commitment = combine(mod(e * inverse, N), (r * inverse) % N, key);
  return commitment !== undefined && commitment.x % N === r;
}

/**
 * Rebuild R from r and the recovery id, SEC 1 v2 section 4.1.6 steps 1.1 to 1.3.
 * @param r - From 1 to n minus 1
 * @param recovery - From 0 to 3
 * @returns {Affine} The point R the signer committed to
 * @throws {RangeError} When no point has that x
 */
function liftCommitment(r: bigint, recovery: number): Affine {
  const x = recovery >= 2 ? r + N : r;
  const y = x < P ? liftY(x, recovery % 2 === 1) : undefined;
  if (y === undefined) {
    const named = recovery >= 2 ? "r + n" : "r";
    throw new RangeError(`No point of secp256k1 has x = ${named}, so recovery ${recovery} fails`);
  }
  return { x, y };
}

/**
 * Read a recovery id.
 * @param value - The caller's value
 * @returns {number} From 0 to 3
 * @throws {RangeError} When the value is no integer from 0 to 3
 */
function readRecovery(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 3) {
    throw new RangeError("Recovery must be an integer from 0 to 3");
  }
  return value;
}

/**
 * Recover the key behind an ECDSA signature, SEC 1 v2 section 4.1.6. Compare it with yours.
 * @param signature - 128 hex digits, r then s
 * @param options - The digest, the recovery id and the output encoding, compressed by default
 * @returns {string} The public key as SEC1 hex, one the signature verifies under whatever it is
 * @throws {RangeError} When an argument is malformed, r or s is out of range, or R does not exist
 */
export function recoverPublicKey(signature: string, options: RecoverOptions): string {
  const { r, s } = readSignature(signature);
  requireOptions(options, "recoverPublicKey(signature, { digest, recovery })");
  const e = readDigest(options.digest);
  const recovery = readRecovery(options.recovery);
  const compressed = compression(options);
  if (!isScalar(r) || !isScalar(s)) {
    throw new RangeError("r and s must both be from 1 to the curve order minus 1");
  }
  const inverse = invert(r, N);
  const commitment = liftCommitment(r, recovery);
  const key = combine(mod(-e * inverse, N), (s * inverse) % N, commitment);
  if (key === undefined) {
    throw new RangeError("This signature recovers the point at infinity, which is no public key");
  }
  return encodeAffine(key, compressed);
}
