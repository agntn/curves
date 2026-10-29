/**
 * ed25519 points as RFC 8032 writes them: edwards25519 with its cofactor 8 in plain sight, so a
 * point of small order decodes like any other and only `isTorsionFree` tells them apart. Monero
 * keys live here. Multiplying takes the same steps for every scalar, the way edwards25519 does.
 * Signatures pass by the cofactored equation of RFC 8032, under ZIP 215's rules or strict ones.
 */

import { sha512 } from "@agntn/hashes/sha2";
import { readHex, requireOptions } from "./arguments.ts";
import { bytesToHex, bytesToNumberLE, concatBytes, hexToBytes, numberToBytesLE } from "./bytes.ts";
import {
  D,
  G,
  L,
  P,
  add,
  clearCofactor,
  decodeScalar,
  fe,
  multiply,
  multiplyBase,
  negate,
  sqrtRatioM1,
  type Extended,
} from "./edwards25519.ts";
import { mod, power } from "./field.ts";

/** The domain parameters: p, d, the base point order l, the cofactor h and the base point. */
export const ed25519 = Object.freeze({ p: P, d: D, l: L, h: 8n, g: G });

/** The one refusal for text that isn't the canonical encoding of an ed25519 point. */
export const INVALID_POINT = "Invalid ed25519 point";

const SCALAR_RANGE = "Scalar must be a bigint from 0 to l, the order of the base point, minus 1";

const REDUCE_LENGTH = "Scalar to reduce must be 32 or 64 bytes of hex";

const Y_MASK = (1n << 255n) - 1n;

/**
 * Decoding of RFC 8032, section 5.1.3: y little-endian, the sign of x in the top bit.
 * @param bytes - 32 bytes
 * @param zip215 - Whether to also take the two encodings ZIP 215 lets through: y from p up, read
 * mod p, and the sign bit set on x = 0
 * @returns {Extended | undefined} The point, or undefined for a y with no x, and without zip215
 * for those two encodings too
 */
function decode(bytes: ArrayLike<number>, zip215: boolean): Extended | undefined {
  const value = bytesToNumberLE(bytes);
  const encoded = value & Y_MASK;
  const odd = value >> 255n === 1n;
  if (bytes.length !== 32 || (encoded >= P && !zip215)) return undefined;
  const y = fe(encoded);
  const yy = fe(y * y);
  const { square, root } = sqrtRatioM1(fe(yy - 1n), fe(D * yy + 1n));
  if (!square || (root === 0n && odd && !zip215)) return undefined;
  const x = odd ? fe(-root) : root;
  return { x, y, z: 1n, t: fe(x * y) };
}

/**
 * Encoding of RFC 8032, section 5.1.2. Z^(p - 2) inverts Z, since Euclid's step count leaks it.
 * @param point - Any point
 * @returns {Uint8Array} 32 bytes
 */
function encode(point: Extended): Uint8Array {
  const zInverse = power(point.z, P - 2n, P);
  const x = fe(point.x * zInverse);
  const y = fe(point.y * zInverse);
  return numberToBytesLE(y | ((x & 1n) << 255n), 32);
}

/**
 * Whether a point is (0, 1), whatever its Z.
 * @param point - Any point
 * @returns {boolean} True for the identity
 */
function isNeutral(point: Extended): boolean {
  return fe(point.x) === 0n && fe(point.y - point.z) === 0n;
}

/**
 * Read hex into a point.
 * @param text - 64 hex digits without 0x
 * @returns {Extended} The point
 * @throws {Error} When the text is not a canonical ed25519 encoding
 */
function decodePoint(text: unknown): Extended {
  const bytes = typeof text === "string" ? hexToBytes(text, 32) : undefined;
  const point = bytes === undefined ? undefined : decode(bytes, false);
  if (point === undefined) throw new Error(INVALID_POINT);
  return point;
}

/**
 * Write a point as hex.
 * @param point - Any point
 * @returns {string} 64 lowercase hex digits
 */
function encodePoint(point: Extended): string {
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
 * Check that hex is the canonical encoding of an ed25519 point, of any order.
 * @param point - 64 hex digits without 0x
 * @returns {boolean} False for anything else
 */
export function isValidPoint(point: string): boolean {
  try {
    decodePoint(point);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check for the identity, encoded as 01 and 31 zero bytes.
 * @param point - 64 hex digits, a canonical encoding
 * @returns {boolean} True for the identity
 */
export function isIdentity(point: string): boolean {
  return isNeutral(decodePoint(point));
}

/**
 * Check that l times the point is the identity, which Monero's `check_address` wants of a key.
 * @param point - 64 hex digits, a canonical encoding
 * @returns {boolean} False for a point with a part of order 2, 4 or 8, true for the identity
 */
export function isTorsionFree(point: string): boolean {
  return isNeutral(multiply(decodePoint(point), L));
}

/**
 * Read little-endian bytes mod l, as Monero's `sc_reduce32` and `sc_reduce` do.
 * @param text - 64 or 128 hex digits without 0x
 * @returns {bigint} From 0 to l minus 1
 * @throws {RangeError} When the text is no hex of 32 or 64 bytes
 */
export function reduceScalar(text: string): bigint {
  const bytes = typeof text === "string" ? hexToBytes(text) : undefined;
  if (bytes?.length !== 32 && bytes?.length !== 64) throw new RangeError(REDUCE_LENGTH);
  return mod(bytesToNumberLE(bytes), L);
}

/** What {@link verify} checks a signature against, and by which rules. */
export interface VerifyOptions {
  /** The signed bytes as hex, any length, empty too. */
  readonly message: string;
  /** The signer's key, 64 hex digits. */
  readonly publicKey: string;
  /** ZIP 215's rules, the default. False wants both encodings canonical and no small order key. */
  readonly zip215?: boolean;
}

/**
 * Read zip215, true when missing.
 * @param value - The caller's value
 * @returns {boolean} Whether ZIP 215's rules apply
 * @throws {TypeError} When the value is no boolean
 */
function readZip215(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== "boolean") throw new TypeError("zip215 must be a boolean");
  return value;
}

/**
 * Verify plain Ed25519 by RFC 8032, section 5.1.7, without Ed25519ctx or Ed25519ph: 8SB = 8R + 8kA.
 * @param signature - 128 hex digits, R then S
 * @param options - The message, the key and the rules
 * @returns {boolean} Whether the key signed the message, false too for an R or a key that doesn't
 * decode, an S at or above l, and a key of small order unless zip215 holds
 * @throws {RangeError} When the signature, the message or the key is no hex of its length
 * @throws {TypeError} When options is not an object, or zip215 no boolean
 */
export function verify(signature: string, options: VerifyOptions): boolean {
  const bytes = readHex(signature, 64, "Signature must be 128 hex digits without 0x, R then S");
  requireOptions(options, "verify(signature, { message, publicKey })");
  const message = readHex(options.message, undefined, "Message must be hex without 0x");
  const key = readHex(options.publicKey, 32, "Public key must be 64 hex digits without 0x");
  const zip215 = readZip215(options.zip215);
  const encodedR = bytes.subarray(0, 32);
  const s = bytesToNumberLE(bytes.subarray(32));
  const a = decode(key, zip215);
  const r = decode(encodedR, zip215);
  if (a === undefined || r === undefined || s >= L) return false;
  if (!zip215 && isNeutral(clearCofactor(a))) return false;
  const k = mod(bytesToNumberLE(sha512(concatBytes(encodedR, key, message))), L);
  const difference = add(add(r, multiply(a, k)), negate(multiplyBase(s)));
  return isNeutral(clearCofactor(difference));
}
