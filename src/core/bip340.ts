/**
 * BIP340 Schnorr signatures on secp256k1, the ones Taproot spends and Nostr events carry. A key is
 * the x coordinate of the point with even y, 32 bytes. A signature is the x of R, then s. Sign and
 * verify walk the BIP's own steps. In verify a key no point has, r at or above p and s at or above
 * n make it answer false rather than throw, since the BIP's test vectors count them as failed
 * signatures.
 */

import { sha256 } from "@agntn/hashes/sha2";
import { readHex, requireOptions } from "./arguments.ts";
import { bytesToHex, concatBytes, numberToBytesBE } from "./bytes.ts";
import { mod } from "./field.ts";
import { combine, liftY, publicPoint, secp256k1 } from "./secp256k1.ts";

const { p: P, n: N } = secp256k1;

const SECRET_REFUSAL = "Secret must be 64 hex digits without 0x, from 1 to the curve order minus 1";

/** What {@link sign} signs, and the randomness it mixes in. */
export interface SignOptions {
  /** The bytes to sign as hex, any length, empty too. Taproot signs a 32-byte sighash. */
  readonly message: string;
  /** 64 hex digits of aux_rand in place of 32 fresh random bytes, for repeatable output. */
  readonly random?: string;
}

/** What {@link verify} checks a signature against. */
export interface VerifyOptions {
  /** The signed bytes as hex, any length, empty too. Taproot signs a 32-byte sighash. */
  readonly message: string;
  /** The signer's x-only key, 64 hex digits. */
  readonly publicKey: string;
}

/** The tags of BIP340's hashes. */
type Tag = "BIP0340/aux" | "BIP0340/nonce" | "BIP0340/challenge";

/** SHA-256 of each tag, written twice, kept after the first hash that needs it. */
const tagPrefixes: Partial<Record<Tag, Uint8Array>> = {};

/**
 * Read bytes as a big-endian number, BIP340's int(x).
 * @param bytes - At least one byte
 * @returns {bigint} The number
 */
function toNumber(bytes: ArrayLike<number>): bigint {
  return BigInt(`0x${bytesToHex(bytes)}`);
}

/**
 * Write a number as 32 big-endian bytes, BIP340's bytes(x).
 * @param value - From 0 to 2^256 minus 1
 * @returns {Uint8Array} 32 bytes
 */
function toBytes(value: bigint): Uint8Array {
  return numberToBytesBE(value, 32);
}

/**
 * hash_tag(x) = SHA-256(SHA-256(tag) || SHA-256(tag) || x).
 * @param tag - Which of BIP340's hashes
 * @param parts - x, in pieces
 * @returns {Uint8Array} 32 bytes
 */
function taggedHash(tag: Tag, ...parts: readonly Uint8Array[]): Uint8Array {
  let prefix = tagPrefixes[tag];
  if (prefix === undefined) {
    const hash = sha256(new TextEncoder().encode(tag));
    prefix = concatBytes(hash, hash);
    tagPrefixes[tag] = prefix;
  }
  return sha256(concatBytes(prefix, ...parts));
}

/**
 * hash_BIP0340/challenge(r || key || message) mod n, the e a signature commits to.
 * @param parts - The x of R, the key and the message
 * @returns {bigint} e, from 0 to n minus 1
 */
function challenge(...parts: readonly Uint8Array[]): bigint {
  return mod(toNumber(taggedHash("BIP0340/challenge", ...parts)), N);
}

/**
 * Read a secret key, which BIP340 takes as 32 bytes holding a number from 1 to n minus 1.
 * @param secret - The caller's value
 * @returns {bigint} d', the secret as a number
 * @throws {RangeError} When the secret is no 64 hex digits, or is 0 or n and above
 */
function readSecret(secret: unknown): bigint {
  const value = toNumber(readHex(secret, 32, SECRET_REFUSAL));
  if (value === 0n || value >= N) throw new RangeError(SECRET_REFUSAL);
  return value;
}

/**
 * The x-only public key of a secret, the x of secret times G.
 * @param secret - 64 hex digits, a number from 1 to n minus 1
 * @returns {string} The key, 64 hex digits
 * @throws {RangeError} When the secret is no 64 hex digits, or is 0 or n and above
 */
export function getPublicKey(secret: string): string {
  return bytesToHex(toBytes(publicPoint(readSecret(secret)).x));
}

/**
 * The caller's aux_rand, or 32 fresh random bytes, as the BIP recommends.
 * @param random - The caller's value, or undefined
 * @returns {Uint8Array} 32 bytes
 * @throws {RangeError} When the value is no 64 hex digits
 */
function auxiliary(random: unknown): Uint8Array {
  if (random === undefined) return crypto.getRandomValues(new Uint8Array(32));
  return readHex(random, 32, "Random must be 64 hex digits without 0x, the aux_rand of BIP340");
}

/**
 * BIP340's default signing, checked by verify before it leaves, as the BIP recommends. Both
 * multiplications take the same steps for any scalar, SHA-256 and the math mod n don't promise it.
 * @param secret - 64 hex digits, a number from 1 to n minus 1
 * @param options - The message, and aux_rand in place of fresh bytes
 * @returns {string} 128 hex digits, the x of R then s
 * @throws {RangeError} When the secret, the message or aux_rand is no hex of its length
 * @throws {TypeError} When options is not an object
 * @throws {Error} When the signature fails its own check, which only a fault in the math can cause
 */
export function sign(secret: string, options: SignOptions): string {
  const value = readSecret(secret);
  requireOptions(options, "sign(secret, { message })");
  const message = readHex(options.message, undefined, "Message must be hex without 0x");
  const random = auxiliary(options.random);
  const point = publicPoint(value);
  const d = (point.y & 1n) === 0n ? value : N - value;
  const key = toBytes(point.x);
  const masked = toBytes(d ^ toNumber(taggedHash("BIP0340/aux", random)));
  const nonce = mod(toNumber(taggedHash("BIP0340/nonce", masked, key, message)), N);
  if (nonce === 0n) throw new Error("BIP340 signing drew the nonce 0; sign again with other aux");
  const commitment = publicPoint(nonce);
  const k = (commitment.y & 1n) === 0n ? nonce : N - nonce;
  const r = toBytes(commitment.x);
  const s = mod(k + challenge(r, key, message) * d, N);
  const signature = bytesToHex(concatBytes(r, toBytes(s)));
  if (!verify(signature, { message: options.message, publicKey: bytesToHex(key) })) {
    throw new Error("BIP340 signing produced a signature that fails to verify");
  }
  return signature;
}

/**
 * Verify a BIP340 Schnorr signature over a message.
 * @param signature - 128 hex digits, the x of R then s
 * @param options - The message and the x-only key
 * @returns {boolean} Whether the key signed the message, false too for a key no point has
 * @throws {RangeError} When the signature, the message or the key is no hex of its length
 * @throws {TypeError} When options is not an object
 */
export function verify(signature: string, options: VerifyOptions): boolean {
  const bytes = readHex(signature, 64, "Signature must be 128 hex digits without 0x, r then s");
  requireOptions(options, "verify(signature, { message, publicKey })");
  const message = readHex(options.message, undefined, "Message must be hex without 0x");
  const key = readHex(options.publicKey, 32, "Public key must be 64 hex digits without 0x");
  const x = toNumber(key);
  const y = x < P ? liftY(x, false) : undefined;
  const r = toNumber(bytes.subarray(0, 32));
  const s = toNumber(bytes.subarray(32));
  if (y === undefined || r >= P || s >= N) return false;
  const e = challenge(bytes.subarray(0, 32), key, message);
  const commitment = combine(s, mod(-e, N), { x, y });
  return commitment !== undefined && (commitment.y & 1n) === 0n && commitment.x === r;
}
