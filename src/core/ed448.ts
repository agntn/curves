/**
 * Ed448 as RFC 8032, section 5.2, verifies it: edwards448, x^2 + y^2 = 1 + d x^2 y^2 over the field
 * of p = 2^448 - 2^224 - 1, with cofactor 4 and SHAKE256 for the hash. Only verification lives
 * here. Its scalars are public, so the multiply walks the bits and doesn't hide them.
 */

import { readHex, requireOptions } from "./arguments.ts";
import { bytesToNumberLE, concatBytes } from "./bytes.ts";
import { mod, power } from "./field.ts";
import { shake256 } from "./keccak.ts";

const P = (1n << 448n) - (1n << 224n) - 1n;

const D = P - 39081n;

const L = (1n << 446n) - 13818066809895115352007386748515426880336692474882178609894547503885n;

/** The base point of RFC 8032, section 5.2, which RFC 7748 calls (X(P), Y(P)) on edwards448. */
const G = Object.freeze({
  x: 224580040295924300187604334099896036246789641632564134246125461686950415467406032909029192869357953282578032075146446173674602635247710n,
  y: 298819210078481492676017930443930673437544040154080242095928241372331506189835876003536878655418784733982303233503462500531545062832660n,
});

/** The domain parameters: p, d, the base point order l, the cofactor h and the base point. */
export const ed448 = Object.freeze({ p: P, d: D, l: L, h: 4n, g: G });

/** Bits 0 to 454 of an encoding: y, with the sign bit of x cleared. */
const Y_MASK = (1n << 455n) - 1n;

/** "SigEd448", the prefix of dom4 in RFC 8032, section 2. */
const DOM4_PREFIX = Uint8Array.from([0x53, 0x69, 0x67, 0x45, 0x64, 0x34, 0x34, 0x38]);

const CONTEXT_LENGTH = "Context must be hex without 0x, at most 255 bytes";

/** (X, Y, Z) stands for x = X / Z, y = Y / Z, the coordinates of RFC 8032, section 5.2.4. */
interface Projective {
  readonly x: bigint;
  readonly y: bigint;
  readonly z: bigint;
}

const IDENTITY: Projective = { x: 0n, y: 1n, z: 1n };

const BASE: Projective = { x: G.x, y: G.y, z: 1n };

/**
 * Reduce mod p.
 * @param value - Any integer
 * @returns {bigint} From 0 to p minus 1
 */
function fe(value: bigint): bigint {
  return mod(value, P);
}

/**
 * Add two points. The formulas of RFC 8032, section 5.2.4, are complete since d is no square.
 * @param left - Any point
 * @param right - Any point
 * @returns {Projective} The sum
 */
function add(left: Projective, right: Projective): Projective {
  const a = fe(left.z * right.z);
  const b = fe(a * a);
  const c = fe(left.x * right.x);
  const d = fe(left.y * right.y);
  const e = fe(D * c * d);
  const f = fe(b - e);
  const g = fe(b + e);
  const h = fe((left.x + left.y) * (right.x + right.y));
  return { x: fe(a * f * (h - c - d)), y: fe(a * g * (d - c)), z: fe(f * g) };
}

/**
 * Double a point with the cheaper formulas of RFC 8032, section 5.2.4.
 * @param point - Any point
 * @returns {Projective} Twice the point
 */
function double(point: Projective): Projective {
  const b = fe((point.x + point.y) ** 2n);
  const c = fe(point.x * point.x);
  const d = fe(point.y * point.y);
  const e = fe(c + d);
  const h = fe(point.z * point.z);
  const j = fe(e - 2n * h);
  return { x: fe((b - e) * j), y: fe(e * (c - d)), z: fe(e * j) };
}

/**
 * Negate a point.
 * @param point - Any point
 * @returns {Projective} (-x, y)
 */
function negate(point: Projective): Projective {
  return { x: fe(-point.x), y: point.y, z: point.z };
}

/**
 * Multiply by a public scalar, bit by bit from the top. The steps follow the bits.
 * @param point - Any point
 * @param scalar - From 0 up
 * @returns {Projective} The product
 */
function multiply(point: Projective, scalar: bigint): Projective {
  let result = IDENTITY;
  for (let bit = BigInt(scalar.toString(2).length) - 1n; bit >= 0n; bit--) {
    result = double(result);
    if ((scalar >> bit) & 1n) result = add(result, point);
  }
  return result;
}

/**
 * Whether a point is (0, 1), whatever its Z.
 * @param point - Any point
 * @returns {boolean} True for the identity
 */
function isNeutral(point: Projective): boolean {
  return point.x === 0n && fe(point.y - point.z) === 0n;
}

/**
 * Decoding of RFC 8032, section 5.2.3: y little-endian in 57 bytes, the sign of x in bit 455.
 * One power gives the inverse of v and the root at once, since p is 3 mod 4.
 * @param bytes - 57 bytes
 * @returns {Projective | undefined} The point, or undefined for a y from p up, a y with no x and
 * the sign bit set on x = 0
 */
function decode(bytes: ArrayLike<number>): Projective | undefined {
  const value = bytesToNumberLE(bytes);
  const y = value & Y_MASK;
  const odd = value >> 455n === 1n;
  if (bytes.length !== 57 || y >= P) return undefined;
  const u = fe(y * y - 1n);
  const v = fe(D * y * y - 1n);
  const x = fe(u ** 3n * v * power(fe(u ** 5n * v ** 3n), (P - 3n) / 4n, P));
  if (fe(v * x * x) !== u || (x === 0n && odd)) return undefined;
  const xOdd = (x & 1n) === 1n;
  return { x: xOdd === odd ? x : fe(-x), y, z: 1n };
}

/**
 * Read the context, empty when missing.
 * @param value - The caller's value
 * @returns {Uint8Array} Up to 255 bytes
 * @throws {RangeError} When the value is no hex, or longer than 255 bytes
 */
function readContext(value: unknown): Uint8Array {
  if (value === undefined) return new Uint8Array(0);
  const context = readHex(value, undefined, CONTEXT_LENGTH);
  if (context.length > 255) throw new RangeError(CONTEXT_LENGTH);
  return context;
}

/** What {@link verify} checks a signature against. */
export interface VerifyOptions {
  /** The signed bytes as hex, any length, empty too. Ed448ph's prehash is the caller's job. */
  readonly message: string;
  /** The signer's key, 114 hex digits. */
  readonly publicKey: string;
  /** The context the signer bound in, 0 to 255 bytes as hex. Empty by default, as OpenPGP signs. */
  readonly context?: string;
}

/**
 * Verify plain Ed448 by RFC 8032, section 5.2.7, without Ed448ph: 4SB = 4R + 4kA.
 * @param signature - 228 hex digits, R then S
 * @param options - The message, the key and the context
 * @returns {boolean} Whether the key signed the message under that context, false too for an R or
 * a key that doesn't decode and an S at or above l
 * @throws {RangeError} When the signature, the message, the key or the context is no hex of its
 * length
 * @throws {TypeError} When options is not an object
 */
export function verify(signature: string, options: VerifyOptions): boolean {
  const bytes = readHex(signature, 114, "Signature must be 228 hex digits without 0x, R then S");
  requireOptions(options, "verify(signature, { message, publicKey })");
  const message = readHex(options.message, undefined, "Message must be hex without 0x");
  const key = readHex(options.publicKey, 57, "Public key must be 114 hex digits without 0x");
  const context = readContext(options.context);
  const encodedR = bytes.subarray(0, 57);
  const s = bytesToNumberLE(bytes.subarray(57));
  const a = decode(key);
  const r = decode(encodedR);
  if (a === undefined || r === undefined || s >= L) return false;
  const dom4 = concatBytes(DOM4_PREFIX, [0, context.length], context);
  const k = mod(bytesToNumberLE(shake256(concatBytes(dom4, encodedR, key, message), 114)), L);
  const difference = add(add(r, multiply(a, k)), negate(multiply(BASE, s)));
  return isNeutral(double(double(difference)));
}
