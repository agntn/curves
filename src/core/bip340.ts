/**
 * BIP340 Schnorr signatures on secp256k1, the ones Taproot spends and Nostr events carry. A key is
 * the x coordinate of the point with even y, 32 bytes. A signature is the x of R, then s. Verify
 * walks the BIP's own steps: a key no point has, r at or above p and s at or above n make it
 * answer false rather than throw, since the BIP's test vectors count them as failed signatures.
 */

import { sha256 } from "@agntn/hashes/sha2";
import { bytesToHex, concatBytes, hexToBytes } from "./bytes.ts";
import { mod } from "./field.ts";
import { combine, liftY, requireOptions, secp256k1 } from "./secp256k1.ts";

const { p: P, n: N } = secp256k1;

/** What {@link verify} checks a signature against. */
export interface VerifyOptions {
  /** The signed bytes as hex, any length, empty too. Taproot signs a 32-byte sighash. */
  readonly message: string;
  /** The signer's x-only key, 64 hex digits. */
  readonly publicKey: string;
}

/** SHA-256 of the tag, written twice: every challenge hash starts with it. */
let challengePrefix: Uint8Array | undefined;

/**
 * Read hex without 0x, or refuse it in the caller's words.
 * @param value - The caller's value
 * @param length - The byte count, or undefined for any
 * @param refusal - The error message
 * @returns {Uint8Array} The bytes
 * @throws {RangeError} When the value is no hex of that length
 */
function readHex(value: unknown, length: number | undefined, refusal: string): Uint8Array {
  const bytes = typeof value === "string" ? hexToBytes(value, length) : undefined;
  if (bytes === undefined) throw new RangeError(refusal);
  return bytes;
}

/**
 * Read bytes as a big-endian number, BIP340's int(x).
 * @param bytes - At least one byte
 * @returns {bigint} The number
 */
function toNumber(bytes: ArrayLike<number>): bigint {
  return BigInt(`0x${bytesToHex(bytes)}`);
}

/**
 * hash_BIP0340/challenge(r || key || message) mod n, the e a signature commits to.
 * @param parts - The x of R, the key and the message
 * @returns {bigint} e, from 0 to n minus 1
 */
function challenge(...parts: readonly Uint8Array[]): bigint {
  if (challengePrefix === undefined) {
    const tag = sha256(new TextEncoder().encode("BIP0340/challenge"));
    challengePrefix = concatBytes(tag, tag);
  }
  return mod(toNumber(sha256(concatBytes(challengePrefix, ...parts))), N);
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
