/**
 * The curves SEC 1 covers whose p and n have the same bit length: prime order, cofactor 1, p equal
 * to 3 mod 4, and a = 0 or a = -3. That's secp256k1 and P-256 in 32 bytes, P-384 in 48 and P-521
 * in 66, where the top byte keeps one bit. Every width (hex lengths, digits, the comb, the
 * verification table, the cut of a digest) comes from the curve, not from a constant. Points
 * travel as SEC1 hex (SEC 1 v2, sections
 * 2.3.3 and 2.3.4) and add in projective coordinates with complete formulas, so no sum needs a
 * branch of its own. ECDSA signing, verification and public key recovery follow SEC 1 v2,
 * sections 4.1.3, 4.1.4 and 4.1.6, and the signing nonce comes from RFC 6979. A multiply runs the
 * same additions and doublings for every scalar, and no digit stands for zero. Only verification,
 * whose scalars are public, reads G from a faster table whose time follows the digits. The bigint
 * arithmetic underneath is the JavaScript engine's, and it promises nothing about time.
 */

import { readHex, requireOptions } from "./arguments.ts";
import type { AffinePoint } from "./arithmetic.ts";
import { digitCount, digitsOf } from "./digits.ts";
import { invert, mod, power } from "./field.ts";
import { nonces } from "./rfc6979.ts";

/** The domain parameters: the curve, its generator and the order of the generator. */
export interface Sec1Domain {
  readonly a: bigint;
  readonly b: bigint;
  readonly p: bigint;
  readonly n: bigint;
  readonly h: bigint;
  readonly g: AffinePoint;
}

/** A scalar as hex without 0x, up to 64 digits (96 on P-384, 132 on P-521), or as a bigint. */
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

/** What `sign` signs. */
export interface SignOptions {
  /** The message digest as hex, 1 to 64 bytes, read as `verify` reads it. */
  readonly digest: string;
}

/** An ECDSA signature and the recovery id that brings its key back. */
export interface Signature {
  /** 128 hex digits, r then s, with s at most n / 2. */
  readonly signature: string;
  /** From 0 to 3, the id `recoverPublicKey` takes. */
  readonly recovery: number;
}

/** What `verify` checks a signature against. */
export interface VerifyOptions {
  /** The message digest as hex, 1 to 64 bytes. Past n's bit length only its leftmost bits count. */
  readonly digest: string;
  /** The signer's key, compressed or uncompressed SEC1 hex. */
  readonly publicKey: string;
  /** Refuse s above n / 2, as BIP 62 and BIP 146 do. Default: false, SEC 1 takes either. */
  readonly lowS?: boolean;
}

/** What `recoverPublicKey` needs besides the signature, and how to write the key. */
export interface RecoverOptions extends PointEncodingOptions {
  /** The message digest as hex, 1 to 64 bytes, read as `verify` reads it. */
  readonly digest: string;
  /** 0 to 3: bit 0 is the parity of y of R, bit 1 says the x of R is r + n. */
  readonly recovery: number;
}

/** A finite point with both coordinates from 0 to p minus 1. */
type Affine = AffinePoint;

/** (X, Y, Z) stands for (X / Z, Y / Z); Z = 0 is the point at infinity. */
interface Projective {
  readonly x: bigint;
  readonly y: bigint;
  readonly z: bigint;
}

/** r and s as the signature carries them, before any range check. */
interface SignatureParts {
  readonly r: bigint;
  readonly s: bigint;
}

/** Addition and doubling for one value of a, both complete on a prime order curve. */
export interface Formulas {
  /** The a they're for. */
  readonly a: bigint;
  readonly add: (left: Projective, right: Projective) => Projective;
  readonly double: (point: Projective) => Projective;
}

const ZERO: Projective = { x: 0n, y: 1n, z: 0n };

const INFINITY = "The result is the point at infinity, which is no public key, as with P minus P";

const DIGEST = /^(?:[0-9a-f]{2}){1,64}$/iu;
const DIGEST_REFUSAL = "Digest must be hex without 0x, 1 to 64 bytes";

/** Comb rows. More rows skip doublings, but then a repeated secret runs faster. */
const ROWS = 4;

/**
 * Algorithms 7 and 9 of Renes, Costello and Batina (2016), for a = 0.
 * @param p - The field prime
 * @param b - The curve's b
 * @returns {Formulas} Addition and doubling mod p
 */
export function zeroAFormulas(p: bigint, b: bigint): Formulas {
  const b3 = 3n * b;
  return {
    a: 0n,
    add: (left, right) => {
      const xx = (left.x * right.x) % p;
      const yy = (left.y * right.y) % p;
      const zz = (left.z * right.z) % p;
      const xy = mod((left.x + left.y) * (right.x + right.y) - xx - yy, p);
      const yz = mod((left.y + left.z) * (right.y + right.z) - yy - zz, p);
      const bxz = (b3 * mod((left.x + left.z) * (right.x + right.z) - xx - zz, p)) % p;
      const bzz = (b3 * zz) % p;
      const plus = (yy + bzz) % p;
      const minus = mod(yy - bzz, p);
      const triple = (3n * xx) % p;
      return {
        x: mod(xy * minus - yz * bxz, p),
        y: (bxz * triple + minus * plus) % p,
        z: (plus * yz + triple * xy) % p,
      };
    },
    double: ({ x, y, z }) => {
      const yy = (y * y) % p;
      const yy8 = (8n * yy) % p;
      const bzz = (b3 * ((z * z) % p)) % p;
      const rest = mod(yy - 3n * bzz, p);
      return {
        x: (2n * rest * ((x * y) % p)) % p,
        y: (rest * (yy + bzz) + bzz * yy8) % p,
        z: (((y * z) % p) * yy8) % p,
      };
    },
  };
}

/**
 * Algorithms 4 and 6 of the same paper, for a = -3, written from the sums printed above them.
 * @param p - The field prime
 * @param b - The curve's b
 * @returns {Formulas} Addition and doubling mod p
 */
export function minusThreeAFormulas(p: bigint, b: bigint): Formulas {
  return {
    a: -3n,
    add: (left, right) => {
      const xx = (left.x * right.x) % p;
      const yy = (left.y * right.y) % p;
      const zz = (left.z * right.z) % p;
      const xy = mod((left.x + left.y) * (right.x + right.y) - xx - yy, p);
      const yz = mod((left.y + left.z) * (right.y + right.z) - yy - zz, p);
      const xz = mod((left.x + left.z) * (right.x + right.z) - xx - zz, p);
      const shift = mod(3n * (xz - b * zz), p);
      const plus = (yy + shift) % p;
      const minus = mod(yy - shift, p);
      const rest = mod(b * xz - xx - 3n * zz, p);
      const triple = mod(3n * (xx - zz), p);
      return {
        x: mod(xy * plus - 3n * yz * rest, p),
        y: (3n * triple * rest + minus * plus) % p,
        z: (yz * minus + xy * triple) % p,
      };
    },
    double: ({ x, y, z }) => {
      const xx = (x * x) % p;
      const yy = (y * y) % p;
      const zz = (z * z) % p;
      const xz = (2n * x * z) % p;
      const shift = mod(3n * (xz - b * zz), p);
      const plus = (yy + shift) % p;
      const rest = mod(b * xz - xx - 3n * zz, p);
      return {
        x: mod(2n * x * y * plus - 6n * y * z * rest, p),
        y: (mod(yy - shift, p) * plus + 9n * mod(xx - zz, p) * rest) % p,
        z: (8n * yy * ((y * z) % p)) % p,
      };
    },
  };
}

/** Whether a whole text matches one hex layout, without the mutable `lastIndex` of a RegExp. */
interface Shape {
  readonly test: (text: string) => boolean;
}

/**
 * A case-insensitive layout of hex text, anchored at both ends.
 * @param source - The pattern between the anchors
 * @returns {Shape} Its test
 */
function shape(source: string): Shape {
  const pattern = new RegExp(`^(?:${source})$`, "iu");
  return { test: (text) => pattern.test(text) };
}

/** One curve as the SEC 1 code runs it: its numbers, its formulas and the name its refusals use. */
export interface Sec1Curve {
  readonly name: string;
  /** The one refusal for text that isn't a SEC1 point of the curve. */
  readonly invalidPoint: string;
  readonly a: bigint;
  readonly b: bigint;
  readonly p: bigint;
  readonly n: bigint;
  readonly g: Affine;
  /** Hex digits in one coordinate or scalar: 64 for 32 bytes, 96 for 48, 132 for 66. */
  readonly digits: number;
  /** n's bit length, the most of a digest that ECDSA reads: 521 on P-521, not 528. */
  readonly bits: bigint;
  /** Compressed or uncompressed SEC1 hex of this width. */
  readonly sec1: Shape;
  /** A scalar as up to {@link Sec1Curve.digits} hex digits. */
  readonly scalar: Shape;
  /** An x coordinate as exactly {@link Sec1Curve.digits} hex digits. */
  readonly xOnly: Shape;
  /** r then s, twice {@link Sec1Curve.digits} hex digits. */
  readonly signature: Shape;
  /** How far apart the digits one step of the comb picks are. */
  readonly spacing: number;
  /** p is 3 mod 4, so a square root of a square r is r^((p + 1) / 4). */
  readonly rootExponent: bigint;
  /** The largest s a low-S signature may carry, as BIP 62 and BIP 146 count it. */
  readonly halfN: bigint;
  readonly add: Formulas["add"];
  readonly double: Formulas["double"];
}

/** How {@link sec1Curve} names a curve and which formulas it adds with. */
export interface Sec1CurveOptions {
  /** What refusals call the curve. */
  readonly name: string;
  /** `zeroAFormulas` or `minusThreeAFormulas`, whichever matches a. */
  readonly formulas: (p: bigint, b: bigint) => Formulas;
}

/**
 * Take a curve's domain parameters, refusing one this code can't take.
 * @param domain - p, a, b, G, n and h
 * @param options - The name and the formulas
 * @returns {Sec1Curve} The curve
 * @throws {RangeError} When n and p differ in bits, the comb rows don't split the digits, p isn't
 * 3 mod 4, h isn't 1 or the formulas misfit
 */
export function sec1Curve(domain: Sec1Domain, options: Sec1CurveOptions): Sec1Curve {
  const { b, p, n, g } = domain;
  const bits = n.toString(2).length;
  const digits = digitCount(n);
  if (bits !== p.toString(2).length || digits % ROWS !== 0 || p % 4n !== 3n || domain.h !== 1n) {
    throw new RangeError(
      "A SEC1 curve here needs n as long as p in bits, an even number of bytes, p = 3 mod 4 and cofactor 1",
    );
  }
  const { a, add, double } = options.formulas(p, b);
  if (mod(a, p) !== mod(domain.a, p)) throw new RangeError("These formulas are for another a");
  const { name } = options;
  const invalidPoint = `Invalid SEC1 ${name} public key`;
  const rootExponent = (p + 1n) / 4n;
  return {
    name,
    invalidPoint,
    a: mod(a, p),
    b,
    p,
    n,
    g,
    digits,
    bits: BigInt(bits),
    sec1: shape(`0[23][0-9a-f]{${digits}}|04[0-9a-f]{${2 * digits}}`),
    scalar: shape(`[0-9a-f]{1,${digits}}`),
    xOnly: shape(`[0-9a-f]{${digits}}`),
    signature: shape(`[0-9a-f]{${2 * digits}}`),
    spacing: digits / ROWS,
    rootExponent,
    halfN: n >> 1n,
    add,
    double,
  };
}

/**
 * Comb rows per curve, built on the first secret multiply: row r is 1 to 16 times 16^(sr) G, with
 * s the spacing, 16 on a 32-byte curve, 24 on P-384 and 33 on P-521.
 */
const combTables = new WeakMap<Sec1Curve, readonly (readonly Projective[])[]>();

/** Each curve's verification table: entry j of row i is (j + 1) times 16^(digits - 1 - i) G. */
const publicTables = new WeakMap<Sec1Curve, readonly (readonly Projective[])[]>();

function toProjective(point: Affine): Projective {
  return { x: point.x, y: point.y, z: 1n };
}

/** A point on its way out: the curve it's on and whether to drop y for its parity. */
interface Encoding {
  readonly curve: Sec1Curve;
  readonly compressed: boolean;
}

/**
 * Write a point as SEC1 hex.
 * @param point - A finite point
 * @param encoding - The curve, whose width pads both coordinates, and the compression
 * @returns {string} Lowercase SEC1 hex, 33 or 65 bytes on a 32-byte curve
 */
function encodeAffine(point: Affine, encoding: Encoding): string {
  const x = encodeScalar(encoding.curve, point.x);
  if (!encoding.compressed) return `04${x}${encodeScalar(encoding.curve, point.y)}`;
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

/**
 * Write a number as many hex digits as the curve's coordinates take.
 * @param curve - The curve
 * @param scalar - From 0 to below 16^digits
 * @returns {string} Zero padded lowercase hex
 */
function encodeScalar(curve: Sec1Curve, scalar: bigint): string {
  return scalar.toString(16).padStart(curve.digits, "0");
}

/**
 * Read a compact signature: r, then s, one coordinate width each, big-endian.
 * @param curve - The curve
 * @param value - The caller's value
 * @returns {SignatureParts} r and s, not yet checked against n
 * @throws {RangeError} When the value is no hex of twice the width
 */
function readSignature(curve: Sec1Curve, value: unknown): SignatureParts {
  if (typeof value !== "string" || !curve.signature.test(value)) {
    throw new RangeError(`Signature must be ${2 * curve.digits} hex digits without 0x, r then s`);
  }
  const half = curve.digits;
  return { r: BigInt(`0x${value.slice(0, half)}`), s: BigInt(`0x${value.slice(half)}`) };
}

/**
 * Turn a digest into e as SEC 1 v2 section 4.1.4 step 3 does: its leftmost bits, as many as n has.
 * @param curve - The curve, 256 bits of n on secp256k1 and P-256, 384 on P-384 and 521 on P-521
 * @param value - Hex without 0x, 1 to 64 bytes
 * @returns {bigint} e, not reduced mod n
 * @throws {RangeError} When the value is no hex of whole bytes, or longer than 64
 */
function readDigest(curve: Sec1Curve, value: unknown): bigint {
  if (typeof value !== "string" || !DIGEST.test(value)) throw new RangeError(DIGEST_REFUSAL);
  const extra = BigInt(value.length * 4) - curve.bits;
  const e = BigInt(`0x${value}`);
  return extra > 0n ? e >> extra : e;
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
 * The right side of the curve equation.
 * @param curve - The curve
 * @param x - From 0 to p minus 1
 * @returns {bigint} x^3 + ax + b mod p
 */
function rightSide(curve: Sec1Curve, x: bigint): bigint {
  return mod(x * x * x + curve.a * x + curve.b, curve.p);
}

/**
 * The y with the asked parity above x, if any point has this x.
 * @param curve - The curve
 * @param x - From 0 to p minus 1
 * @param odd - Whether y should be odd
 * @returns {bigint | undefined} y, or undefined when the right side is no square
 */
export function liftY(curve: Sec1Curve, x: bigint, odd: boolean): bigint | undefined {
  const { p } = curve;
  const square = rightSide(curve, x);
  const root = power(square, curve.rootExponent, p);
  if ((root * root) % p !== square) return undefined;
  return ((root & 1n) === 1n) === odd ? root : mod(-root, p);
}

/**
 * Read SEC1 hex into a point of the curve.
 * @param curve - The curve
 * @param text - Compressed or uncompressed SEC1 hex without 0x
 * @returns {Affine} The point
 * @throws {Error} When the text is no SEC1 hex, a coordinate reaches p or the point is off curve
 */
function decodePoint(curve: Sec1Curve, text: unknown): Affine {
  if (typeof text !== "string" || !curve.sec1.test(text)) throw new Error(curve.invalidPoint);
  const { p } = curve;
  const end = 2 + curve.digits;
  const x = BigInt(`0x${text.slice(2, end)}`);
  if (x >= p) throw new Error(curve.invalidPoint);
  const prefix = text.slice(0, 2);
  if (prefix === "04") {
    const y = BigInt(`0x${text.slice(end)}`);
    if (y >= p || (y * y) % p !== rightSide(curve, x)) throw new Error(curve.invalidPoint);
    return { x, y };
  }
  const y = liftY(curve, x, prefix === "03");
  if (y === undefined) throw new Error(curve.invalidPoint);
  return { x, y };
}

/**
 * Scale a finite point back to x and y.
 * @param curve - The curve
 * @param point - Any point but infinity
 * @param zInverse - The inverse of its Z mod p
 * @returns {Affine} The point
 */
function scale(curve: Sec1Curve, point: Projective, zInverse: bigint): Affine {
  return { x: (point.x * zInverse) % curve.p, y: (point.y * zInverse) % curve.p };
}

/**
 * Same x, the other y.
 * @param curve - The curve
 * @param point - Any point
 * @returns {Projective} Minus the point
 */
function negate(curve: Sec1Curve, point: Projective): Projective {
  return { x: point.x, y: mod(-point.y, curve.p), z: point.z };
}

/**
 * Multiply by 16 with four doublings.
 * @param curve - The curve
 * @param point - Any point
 * @returns {Projective} 16 times the point
 */
function timesSixteen(curve: Sec1Curve, point: Projective): Projective {
  const { double } = curve;
  return double(double(double(double(point))));
}

/**
 * The table a digit picks from.
 * @param curve - The curve
 * @param point - Any point
 * @returns {Projective[]} 1 to 16 times the point, so digit d picks entry d
 */
function multiplesOf(curve: Sec1Curve, point: Projective): Projective[] {
  const multiples = [point];
  let multiple = point;
  for (let count = 2; count <= 16; count++) {
    multiple = curve.add(multiple, point);
    multiples.push(multiple);
  }
  return multiples;
}

/**
 * Multiply digit by digit from the top, four doublings and one table addition each.
 * @param curve - The curve
 * @param point - Any point
 * @param scalar - Zero or more
 * @returns {Projective} The product
 */
function multiply(curve: Sec1Curve, point: Projective, scalar: bigint): Projective {
  const multiples = multiplesOf(curve, point);
  return digitsOf(scalar, curve.n)
    .toReversed()
    .reduce(
      (result, digit) => curve.add(timesSixteen(curve, result), multiples[digit] ?? ZERO),
      ZERO,
    );
}

/**
 * Bring many finite points to Z = 1 with one inversion, Montgomery's trick. Public points only.
 * @param curve - The curve
 * @param points - Finite points
 * @returns {Projective[]} The same points, in order
 */
function normalizeAll(curve: Sec1Curve, points: readonly Projective[]): Projective[] {
  const { p } = curve;
  let product = 1n;
  const steps = points.map((point) => {
    const before = product;
    product = (product * point.z) % p;
    return { point, before };
  });
  let inverse = invert(product, p);
  return steps
    .toReversed()
    .map(({ point, before }) => {
      const zInverse = (inverse * before) % p;
      inverse = (inverse * point.z) % p;
      return { ...scale(curve, point, zInverse), z: 1n };
    })
    .toReversed();
}

/**
 * Build the comb's rows, 16 points per row.
 * @param curve - The curve
 * @returns {Projective[][]} The rows, lowest first
 */
function buildCombTable(curve: Sec1Curve): Projective[][] {
  let base = toProjective(curve.g);
  const points = Array.from({ length: ROWS }, () => {
    const row = multiplesOf(curve, base);
    for (let step = 0; step < curve.spacing; step++) base = timesSixteen(curve, base);
    return row;
  }).flat();
  const normal = normalizeAll(curve, points);
  return Array.from({ length: ROWS }, (_, row) => normal.slice(row * 16, row * 16 + 16));
}

/**
 * Multiply G by a secret with a comb of one step per spacing, building its table on the first call.
 * @param curve - The curve
 * @param scalar - Zero or more
 * @returns {Projective} The product
 */
function multiplyBase(curve: Sec1Curve, scalar: bigint): Projective {
  let table = combTables.get(curve);
  if (table === undefined) {
    table = buildCombTable(curve);
    combTables.set(curve, table);
  }
  const digits = digitsOf(scalar, curve.n);
  const { spacing } = curve;
  let result = ZERO;
  for (let step = spacing - 1; step >= 0; step--) {
    result = timesSixteen(curve, result);
    for (const [row, multiples] of table.entries()) {
      result = curve.add(result, multiples[digits[row * spacing + step] ?? 0] ?? ZERO);
    }
  }
  return result;
}

/**
 * Build the verification table, one row of 15 points per hex digit of a scalar.
 * @param curve - The curve
 * @returns {Projective[][]} The rows, the top hex digit's first
 */
function buildPublicTable(curve: Sec1Curve): Projective[][] {
  const points: Projective[] = [];
  let base = toProjective(curve.g);
  for (let row = 0; row < curve.digits; row++) {
    let multiple = base;
    for (let digit = 1; digit < 16; digit++) {
      points.push(multiple);
      multiple = curve.add(multiple, base);
    }
    base = multiple;
  }
  const normal = normalizeAll(curve, points);
  return Array.from({ length: curve.digits }, (_, row) =>
    normal.slice(row * 15, row * 15 + 15),
  ).toReversed();
}

/**
 * Multiply G by a public scalar, one table addition per nonzero hex digit and no doubling.
 * Its time follows the digits, so it never sees a secret.
 * @param curve - The curve
 * @param scalar - Zero to n minus 1
 * @returns {Projective} The product
 */
function multiplyBasePublic(curve: Sec1Curve, scalar: bigint): Projective {
  let table = publicTables.get(curve);
  if (table === undefined) {
    table = buildPublicTable(curve);
    publicTables.set(curve, table);
  }
  const digits = encodeScalar(curve, scalar);
  let result = ZERO;
  for (const [row, multiples] of table.entries()) {
    const point = multiples[Number.parseInt(digits.charAt(row), 16) - 1];
    if (point !== undefined) result = curve.add(result, point);
  }
  return result;
}

/**
 * Encode a result, refusing the point at infinity, which SEC1 public keys have no form for.
 * Z^(p - 2) inverts Z, since Euclid's step count leaks it.
 * @param curve - The curve
 * @param point - Any point
 * @param options - Output encoding
 * @returns {string} SEC1 hex
 */
function encodePoint(curve: Sec1Curve, point: Projective, options: PointEncodingOptions): string {
  const compressed = compression(options);
  if (point.z === 0n) throw new RangeError(INFINITY);
  return encodeAffine(scale(curve, point, power(point.z, curve.p - 2n, curve.p)), {
    curve,
    compressed,
  });
}

/** What a scalar is called in a refusal, and the least value its operation takes. */
interface ScalarSlot {
  readonly name: string;
  /** 0 for scalar arithmetic, 1 where zero would give the point at infinity. */
  readonly minimum: 0n | 1n;
}

/**
 * Read a scalar and check it against the range the operation allows.
 * @param curve - The curve
 * @param value - Hex without 0x, as many digits as the curve takes, or a bigint
 * @param slot - The name and the least value
 * @returns {bigint} The scalar
 * @throws {RangeError} When the value is no hex or bigint, or falls outside minimum to n minus 1
 */
function decodeScalar(curve: Sec1Curve, value: unknown, slot: ScalarSlot): bigint {
  let scalar: bigint | undefined;
  if (typeof value === "bigint") scalar = value;
  else if (typeof value === "string" && curve.scalar.test(value)) scalar = BigInt(`0x${value}`);
  if (scalar === undefined || scalar < slot.minimum || scalar >= curve.n) {
    throw new RangeError(
      `${slot.name} must be hex without 0x or a bigint, from ${slot.minimum} to the curve order minus 1`,
    );
  }
  return scalar;
}

const SCALAR_SLOT: ScalarSlot = { name: "Scalar", minimum: 1n };

/**
 * Add two points.
 * @param curve - The curve
 * @param a - SEC1 hex, compressed or uncompressed
 * @param b - SEC1 hex, compressed or uncompressed
 * @param options - Output encoding
 * @returns {string} The sum as SEC1 hex
 */
export function addPoints(
  curve: Sec1Curve,
  a: string,
  b: string,
  options: PointEncodingOptions,
): string {
  const sum = curve.add(toProjective(decodePoint(curve, a)), toProjective(decodePoint(curve, b)));
  return encodePoint(curve, sum, options);
}

/**
 * Subtract point b from point a.
 * @param curve - The curve
 * @param a - SEC1 hex, compressed or uncompressed
 * @param b - SEC1 hex, compressed or uncompressed
 * @param options - Output encoding
 * @returns {string} The difference as SEC1 hex
 */
export function subtractPoints(
  curve: Sec1Curve,
  a: string,
  b: string,
  options: PointEncodingOptions,
): string {
  const right = negate(curve, toProjective(decodePoint(curve, b)));
  return encodePoint(curve, curve.add(toProjective(decodePoint(curve, a)), right), options);
}

/**
 * Negate a point.
 * @param curve - The curve
 * @param point - SEC1 hex, compressed or uncompressed
 * @param options - Output encoding
 * @returns {string} The negated point as SEC1 hex
 */
export function negatePoint(
  curve: Sec1Curve,
  point: string,
  options: PointEncodingOptions,
): string {
  return encodePoint(curve, negate(curve, toProjective(decodePoint(curve, point))), options);
}

/**
 * Multiply a point by a scalar.
 * @param curve - The curve
 * @param point - SEC1 hex, compressed or uncompressed
 * @param scalar - From 1 to the curve order minus 1
 * @param options - Output encoding
 * @returns {string} The product as SEC1 hex
 */
export function multiplyPoint(
  curve: Sec1Curve,
  point: string,
  scalar: Scalar,
  options: PointEncodingOptions,
): string {
  const decoded = toProjective(decodePoint(curve, point));
  const product = multiply(curve, decoded, decodeScalar(curve, scalar, SCALAR_SLOT));
  return encodePoint(curve, product, options);
}

/**
 * Multiply the generator by a scalar.
 * @param curve - The curve
 * @param scalar - From 1 to the curve order minus 1
 * @param options - Output encoding
 * @returns {string} The product as SEC1 hex
 */
export function multiplyGenerator(
  curve: Sec1Curve,
  scalar: Scalar,
  options: PointEncodingOptions,
): string {
  return encodePoint(curve, multiplyBase(curve, decodeScalar(curve, scalar, SCALAR_SLOT)), options);
}

/**
 * Secret times G as x and y, through the same comb and Z^(p - 2) as multiplyGenerator.
 * @param curve - The curve
 * @param secret - From 1 to n minus 1
 * @returns {Affine} The point
 */
export function publicPoint(curve: Sec1Curve, secret: bigint): Affine {
  const point = multiplyBase(curve, secret);
  return scale(curve, point, power(point.z, curve.p - 2n, curve.p));
}

/**
 * Read two scalars from 0 to n minus 1, named a and b in refusals.
 * @param curve - The curve
 * @param pair - Both scalars
 * @returns {[bigint, bigint]} a and b
 */
function scalarPair(curve: Sec1Curve, pair: readonly [Scalar, Scalar]): [bigint, bigint] {
  return [
    decodeScalar(curve, pair[0], { name: "Scalar a", minimum: 0n }),
    decodeScalar(curve, pair[1], { name: "Scalar b", minimum: 0n }),
  ];
}

/**
 * Add two scalars mod the curve order.
 * @param curve - The curve
 * @param pair - a and b, from 0 to the curve order minus 1
 * @returns {string} The sum as hex of the curve's width
 */
export function addScalars(curve: Sec1Curve, pair: readonly [Scalar, Scalar]): string {
  const [a, b] = scalarPair(curve, pair);
  return encodeScalar(curve, mod(a + b, curve.n));
}

/**
 * Subtract scalar b from scalar a mod the curve order.
 * @param curve - The curve
 * @param pair - a and b, from 0 to the curve order minus 1
 * @returns {string} The difference as hex of the curve's width
 */
export function subtractScalars(curve: Sec1Curve, pair: readonly [Scalar, Scalar]): string {
  const [a, b] = scalarPair(curve, pair);
  return encodeScalar(curve, mod(a - b, curve.n));
}

/**
 * Multiply two scalars mod the curve order.
 * @param curve - The curve
 * @param pair - a and b, from 0 to the curve order minus 1
 * @returns {string} The product as hex of the curve's width
 */
export function multiplyScalars(curve: Sec1Curve, pair: readonly [Scalar, Scalar]): string {
  const [a, b] = scalarPair(curve, pair);
  return encodeScalar(curve, mod(a * b, curve.n));
}

/**
 * Invert a scalar mod the curve order.
 * @param curve - The curve
 * @param scalar - From 1 to the curve order minus 1, since zero has no inverse
 * @returns {string} The inverse as hex of the curve's width
 */
export function invertScalar(curve: Sec1Curve, scalar: Scalar): string {
  return encodeScalar(curve, invert(decodeScalar(curve, scalar, SCALAR_SLOT), curve.n));
}

/**
 * Find both points above an x coordinate.
 * @param curve - The curve
 * @param x - hex without 0x, as many digits as a coordinate
 * @param options - Output encoding
 * @returns {LiftedPoints} The even and odd point as SEC1 hex
 * @throws {RangeError} When x is not hex of that width, or no point of the curve has it
 */
export function liftX(curve: Sec1Curve, x: string, options: PointEncodingOptions): LiftedPoints {
  if (typeof x !== "string" || !curve.xOnly.test(x)) {
    throw new RangeError(`x must be ${curve.digits} hex digits without 0x`);
  }
  const compressed = compression(options);
  const value = BigInt(`0x${x}`);
  const y = value < curve.p ? liftY(curve, value, false) : undefined;
  if (y === undefined) throw new RangeError(`No point of ${curve.name} has this x`);
  return {
    even: encodeAffine({ x: value, y }, { curve, compressed }),
    odd: encodeAffine({ x: value, y: mod(-y, curve.p) }, { curve, compressed }),
  };
}

/**
 * Check that a SEC1 point lies on the curve.
 * @param curve - The curve
 * @param point - Compressed or uncompressed SEC1 hex
 * @returns {boolean} False for a point off the curve, or a compressed x that no point has
 * @throws {Error} When the value is not SEC1 hex at all, since there is no point to check
 */
export function isOnCurve(curve: Sec1Curve, point: string): boolean {
  if (typeof point !== "string" || !curve.sec1.test(point)) throw new Error(curve.invalidPoint);
  try {
    decodePoint(curve, point);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write a point in the other SEC1 encoding, or check and lowercase it in the same one.
 * @param curve - The curve
 * @param point - Compressed or uncompressed SEC1 hex
 * @param options - Output encoding
 * @returns {string} The same point as SEC1 hex
 */
export function convertPoint(
  curve: Sec1Curve,
  point: string,
  options: PointEncodingOptions,
): string {
  const compressed = compression(options);
  return encodeAffine(decodePoint(curve, point), { curve, compressed });
}

/** The two scalars and the point of a {@link combine}. */
export interface Combination {
  /** Zero to n minus 1, never a secret: it goes through the faster table. */
  readonly a: bigint;
  /** Zero to n minus 1. */
  readonly b: bigint;
  /** A finite point. */
  readonly point: Affine;
}

/**
 * a times G plus b times a point, the sum ECDSA and BIP340 verification and recovery end on.
 * Both scalars are public there, so G comes from the faster table and Euclid inverts Z.
 * @param curve - The curve
 * @param terms - a, b and the point
 * @returns {Affine | undefined} The sum, undefined for the point at infinity
 */
export function combine(curve: Sec1Curve, terms: Combination): Affine | undefined {
  const product = multiply(curve, toProjective(terms.point), terms.b);
  const sum = curve.add(multiplyBasePublic(curve, terms.a), product);
  return sum.z === 0n ? undefined : scale(curve, sum, invert(sum.z, curve.p));
}

/**
 * Keep s at most n / 2. n - s signs with -k, whose R has the other y, so the parity bit flips.
 * @param curve - The curve
 * @param commitment - R, the point k times G
 * @param parts - r, the x of R mod n, and s, from 1 to n minus 1
 * @returns {Signature} The low-S signature and its recovery id
 */
function lowSignature(curve: Sec1Curve, commitment: Affine, parts: SignatureParts): Signature {
  const { n } = curve;
  const { r, s } = parts;
  const high = s > curve.halfN;
  const parity = Number(commitment.y & 1n) ^ Number(high);
  return {
    signature: `${encodeScalar(curve, r)}${encodeScalar(curve, high ? n - s : s)}`,
    recovery: parity | (commitment.x >= n ? 2 : 0),
  };
}

/**
 * ECDSA by SEC 1 v2 section 4.1.3, k from RFC 6979, low s.
 * @param curve - The curve
 * @param secret - The private key, from 1 to the curve order minus 1
 * @param options - The digest
 * @returns {Signature} The signature as r then s, and its recovery id
 */
export function sign(curve: Sec1Curve, secret: Scalar, options: SignOptions): Signature {
  const { n } = curve;
  const d = decodeScalar(curve, secret, { name: "Secret", minimum: 1n });
  requireOptions(options, "sign(secret, { digest })");
  const e = readDigest(curve, options.digest);
  const digest = readHex(options.digest, undefined, DIGEST_REFUSAL);
  const candidates = nonces(n, { secret: d, digest });
  for (;;) {
    const k = candidates.next().value;
    const commitment = publicPoint(curve, k);
    const r = commitment.x % n;
    const s = (power(k, n - 2n, n) * (e + r * d)) % n;
    if (r !== 0n && s !== 0n) return lowSignature(curve, commitment, { r, s });
  }
}

/**
 * Whether r and s both run from 1 to n minus 1.
 * @param curve - The curve
 * @param parts - r and s
 * @returns {boolean} True when both are in range
 */
function inRange(curve: Sec1Curve, parts: SignatureParts): boolean {
  const { n } = curve;
  return parts.r > 0n && parts.r < n && parts.s > 0n && parts.s < n;
}

/**
 * Verify an ECDSA signature over a digest, SEC 1 v2 section 4.1.4.
 * @param curve - The curve
 * @param signature - r then s, twice the hex digits of a coordinate
 * @param options - The digest, the public key and the low-S rule
 * @returns {boolean} Whether the key signed the digest, false for r or s outside 1 to n - 1 too
 * @throws {TypeError} When lowS is no boolean
 */
export function verify(curve: Sec1Curve, signature: string, options: VerifyOptions): boolean {
  const { n } = curve;
  const parts = readSignature(curve, signature);
  requireOptions(options, "verify(signature, { digest, publicKey })");
  const e = readDigest(curve, options.digest);
  const point = decodePoint(curve, options.publicKey);
  const lowS = options.lowS ?? false;
  if (typeof lowS !== "boolean") throw new TypeError("lowS must be a boolean");
  if (!inRange(curve, parts) || (lowS && parts.s > curve.halfN)) return false;
  const inverse = invert(parts.s, n);
  const commitment = combine(curve, { a: mod(e * inverse, n), b: (parts.r * inverse) % n, point });
  return commitment !== undefined && commitment.x % n === parts.r;
}

/**
 * Rebuild R from r and the recovery id, SEC 1 v2 section 4.1.6 steps 1.1 to 1.3.
 * @param curve - The curve
 * @param r - From 1 to n minus 1
 * @param recovery - From 0 to 3
 * @returns {Affine} The point R the signer committed to
 * @throws {RangeError} When no point has that x
 */
function liftCommitment(curve: Sec1Curve, r: bigint, recovery: number): Affine {
  const x = recovery >= 2 ? r + curve.n : r;
  const y = x < curve.p ? liftY(curve, x, recovery % 2 === 1) : undefined;
  if (y === undefined) {
    const named = recovery >= 2 ? "r + n" : "r";
    throw new RangeError(
      `No point of ${curve.name} has x = ${named}, so recovery ${recovery} fails`,
    );
  }
  return { x, y };
}

/**
 * Recover the key behind an ECDSA signature, SEC 1 v2 section 4.1.6.
 * @param curve - The curve
 * @param signature - r then s, twice the hex digits of a coordinate
 * @param options - The digest, the recovery id and the output encoding
 * @returns {string} The public key as SEC1 hex, one the signature verifies under whatever it is
 * @throws {RangeError} When r or s is out of range, or the sum is the point at infinity
 */
export function recoverPublicKey(
  curve: Sec1Curve,
  signature: string,
  options: RecoverOptions,
): string {
  const { n } = curve;
  const parts = readSignature(curve, signature);
  requireOptions(options, "recoverPublicKey(signature, { digest, recovery })");
  const e = readDigest(curve, options.digest);
  const recovery = readRecovery(options.recovery);
  const compressed = compression(options);
  if (!inRange(curve, parts)) {
    throw new RangeError("r and s must both be from 1 to the curve order minus 1");
  }
  const inverse = invert(parts.r, n);
  const point = liftCommitment(curve, parts.r, recovery);
  const key = combine(curve, { a: mod(-e * inverse, n), b: (parts.s * inverse) % n, point });
  if (key === undefined) {
    throw new RangeError("This signature recovers the point at infinity, which is no public key");
  }
  return encodeAffine(key, { curve, compressed });
}
