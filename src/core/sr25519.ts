/**
 * sr25519: Schnorr signatures over ristretto255 with Merlin transcripts, as schnorrkel 0.11 signs
 * for Substrate and Polkadot, with its hard and soft HDKD. A secret is 64 bytes: the key as
 * schnorrkel writes it for ed25519 (the scalar times 8, little-endian), then the 32-byte nonce.
 * Nothing here runs in constant time.
 */

import { sha512 } from "@agntn/hashes/sha2";
import { bytesToHex, bytesToNumberLE, concatBytes, hexToBytes, numberToBytesLE } from "./bytes.ts";
import { mod } from "./field.ts";
import { Transcript } from "./merlin.ts";
import {
  BASE,
  IDENTITY,
  add,
  decode,
  encode,
  equals,
  multiply,
  negate,
  ristretto255,
  type Extended,
} from "./ristretto255.ts";

const L = ristretto255.l;

/** The signing context Substrate signs under. */
export const SIGNING_CONTEXT = "substrate";

/** The one refusal for text that isn't an sr25519 public key. */
export const INVALID_PUBLIC_KEY = "Invalid sr25519 public key";

const ZERO_KEY = "Secret key is 0 mod the group order, so its public key would be the identity";

/** Signing and verifying options. */
export interface SignatureOptions {
  /** The schnorrkel signing context. Default: "substrate" */
  readonly context?: string;
}

/** Options of an operation that draws a nonce. */
export interface RandomOptions {
  /** 64 hex digits that replace the 32 random bytes, for repeatable output. Default: fresh ones */
  readonly random?: string;
}

/** A secret split into its scalar and its nonce. */
interface SecretParts {
  readonly scalar: bigint;
  readonly nonce: Uint8Array;
}

/**
 * Read hex of one byte length, or refuse it in the caller's words.
 * @param value - The caller's value
 * @param length - The byte count
 * @param name - What the error calls it
 * @param extra - A clause the error adds after the length
 * @returns {Uint8Array} The bytes
 * @throws {RangeError} When the value is no hex of that length
 */
function readHex(value: unknown, length: number, name: string, extra = ""): Uint8Array {
  const bytes = typeof value === "string" ? hexToBytes(value, length) : undefined;
  if (bytes === undefined) {
    throw new RangeError(`${name} must be ${length * 2} hex digits without 0x${extra}`);
  }
  return bytes;
}

/**
 * Read a secret. A key that is 0 mod l would sign for the identity, which verify refuses.
 * @param secret - 128 hex digits
 * @returns {SecretParts} The scalar, the key divided by 8, and the nonce
 * @throws {RangeError} When the secret is no 128 hex digits, or its key is 0 mod l
 */
function readSecret(secret: unknown): SecretParts {
  const bytes = readHex(secret, 64, "Secret", ": the key, then the nonce");
  const scalar = bytesToNumberLE(bytes.subarray(0, 32)) >> 3n;
  if (mod(scalar, L) === 0n) throw new RangeError(ZERO_KEY);
  return { scalar, nonce: bytes.slice(32) };
}

/**
 * Write a secret the way schnorrkel's `to_ed25519_bytes` does.
 * @param scalar - From 0 to l minus 1
 * @param nonce - 32 bytes
 * @returns {string} 128 hex digits
 */
function writeSecret(scalar: bigint, nonce: ArrayLike<number>): string {
  return bytesToHex(concatBytes(numberToBytesLE((scalar << 3n) & ((1n << 256n) - 1n), 32), nonce));
}

/**
 * Read a public key.
 * @param publicKey - 64 hex digits, a ristretto255 encoding
 * @returns {Extended} The point
 * @throws {Error} When the text is no canonical encoding
 */
function readPublicKey(publicKey: unknown): Extended {
  const bytes = typeof publicKey === "string" ? hexToBytes(publicKey, 32) : undefined;
  const point = bytes === undefined ? undefined : decode(bytes);
  if (point === undefined) throw new Error(INVALID_PUBLIC_KEY);
  return point;
}

/**
 * Read the message bytes.
 * @param message - The caller's message
 * @returns {Uint8Array} The bytes
 * @throws {TypeError} When the message is no Uint8Array
 */
function readMessage(message: unknown): Uint8Array {
  if (!(message instanceof Uint8Array)) throw new TypeError("Message must be a Uint8Array");
  return message;
}

/**
 * Read the signing context.
 * @param options - The caller's options
 * @returns {string} The context
 * @throws {TypeError} When the context is no string
 */
function readContext(options: SignatureOptions): string {
  const { context = SIGNING_CONTEXT } = options;
  if (typeof context !== "string") throw new TypeError("Context must be a string");
  return context;
}

/**
 * The caller's random bytes, or fresh ones.
 * @param options - The caller's options
 * @returns {Uint8Array} 32 bytes
 */
function readRandom(options: RandomOptions): Uint8Array {
  if (options.random === undefined) return crypto.getRandomValues(new Uint8Array(32));
  return readHex(options.random, 32, "Random");
}

/**
 * Reduce 64 little-endian bytes mod l, as schnorrkel turns a challenge or a witness into a scalar.
 * @param bytes - 64 bytes
 * @returns {bigint} The scalar
 */
function wideScalar(bytes: ArrayLike<number>): bigint {
  return mod(bytesToNumberLE(bytes), L);
}

/**
 * The transcript a signature hashes: the context, the message and the protocol name.
 * @param context - The signing context
 * @param message - The message
 * @returns {Transcript} The transcript, before the public key
 */
function signingTranscript(context: string, message: ArrayLike<number>): Transcript {
  const transcript = new Transcript("SigningContext");
  transcript.appendMessage("", context);
  transcript.appendMessage("sign-bytes", message);
  transcript.appendMessage("proto-name", "Schnorr-sig");
  return transcript;
}

/**
 * The transcript HDKD hashes, up to the chain code.
 * @param chainCode - 32 bytes
 * @returns {Transcript} The transcript
 */
function derivationTranscript(chainCode: ArrayLike<number>): Transcript {
  const transcript = new Transcript("SchnorrRistrettoHDKD");
  transcript.appendMessage("sign-bytes", []);
  transcript.appendMessage("chain-code", chainCode);
  return transcript;
}

/**
 * Expand a 32-byte mini secret into a secret the way Substrate does, schnorrkel's
 * `ExpansionMode::Ed25519`: SHA-512, the ed25519 clamp, then the key divided by the cofactor.
 * @param seed - 64 hex digits, the mini secret
 * @returns {string} The secret as 128 hex digits
 * @throws {RangeError} When the seed is no 64 hex digits
 */
export function expandSeed(seed: string): string {
  const hash = sha512(readHex(seed, 32, "Seed"));
  hash[0] = (hash[0] ?? 0) & 248;
  hash[31] = ((hash[31] ?? 0) & 63) | 64;
  return writeSecret(bytesToNumberLE(hash.subarray(0, 32)) >> 3n, hash.subarray(32));
}

/**
 * The public key of a secret.
 * @param secret - 128 hex digits: the key, then the nonce
 * @returns {string} The ristretto255 encoding as 64 hex digits
 */
export function getPublicKey(secret: string): string {
  return bytesToHex(encode(multiply(BASE, readSecret(secret).scalar)));
}

/**
 * Sign a message. The nonce mixes the secret with random bytes, so two signatures of the same
 * message differ unless options.random is the same.
 * @param secret - 128 hex digits: the key, then the nonce
 * @param message - The bytes to sign
 * @param options - The signing context, and random bytes to replace fresh ones
 * @returns {string} The 64-byte signature as hex, with schnorrkel's marker bit set
 */
export function sign(
  secret: string,
  message: Uint8Array,
  options: SignatureOptions & RandomOptions = {},
): string {
  const bytes = readMessage(message);
  const { scalar, nonce } = readSecret(secret);
  const transcript = signingTranscript(readContext(options), bytes);
  transcript.appendMessage("sign:pk", encode(multiply(BASE, scalar)));
  const witness = transcript.witnessBytes("signing", 64, [nonce], readRandom(options));
  const r = wideScalar(witness);
  const commitment = encode(multiply(BASE, r));
  transcript.appendMessage("sign:R", commitment);
  const s = mod(wideScalar(transcript.challengeBytes("sign:c", 64)) * scalar + r, L);
  const signature = concatBytes(commitment, numberToBytesLE(s, 32));
  signature[63] = (signature[63] ?? 0) | 128;
  return bytesToHex(signature);
}

/**
 * Verify a signature. A signature without schnorrkel's marker bit, with s at or above l, or with
 * a commitment that isn't a point fails, and so does any signature for the identity as the key.
 * @param signature - 128 hex digits
 * @param message - The signed bytes
 * @param publicKey - 64 hex digits, a ristretto255 encoding
 * @param options - The signing context
 * @returns {boolean} Whether the signature holds
 * @throws {RangeError} When the signature is no 128 hex digits
 * @throws {Error} When the public key is no ristretto255 encoding
 */
export function verify(
  signature: string,
  message: Uint8Array,
  publicKey: string,
  options: SignatureOptions = {},
): boolean {
  const bytes = readHex(signature, 64, "Signature");
  const transcript = signingTranscript(readContext(options), readMessage(message));
  const key = readPublicKey(publicKey);
  const commitment = decode(bytes.subarray(0, 32));
  const s = bytesToNumberLE(bytes.subarray(32)) & ((1n << 255n) - 1n);
  if (commitment === undefined || ((bytes[63] ?? 0) & 128) === 0 || s >= L) return false;
  if (equals(key, IDENTITY)) return false;
  transcript.appendMessage("sign:pk", encode(key));
  transcript.appendMessage("sign:R", bytes.subarray(0, 32));
  const k = wideScalar(transcript.challengeBytes("sign:c", 64));
  return equals(add(multiply(BASE, s), multiply(negate(key), k)), commitment);
}

/**
 * Derive a hard child, which needs the secret: the child's mini secret comes out of a transcript
 * over the chain code and the parent scalar, then expands as {@link expandSeed} does.
 * @param secret - 128 hex digits: the key, then the nonce
 * @param chainCode - 64 hex digits, as Substrate builds it from a `//hard` junction
 * @returns {string} The child secret as 128 hex digits
 */
export function deriveHard(secret: string, chainCode: string): string {
  const { scalar } = readSecret(secret);
  const transcript = derivationTranscript(readHex(chainCode, 32, "Chain code"));
  transcript.appendMessage("secret-key", numberToBytesLE(scalar, 32));
  return expandSeed(bytesToHex(transcript.challengeBytes("HDKD-hard", 32)));
}

/**
 * The scalar a soft derivation adds to the key, and the transcript that squeezed it.
 * @param key - The parent public key
 * @param chainCode - 64 hex digits
 * @returns {{ transcript: Transcript; tweak: bigint }} Both, the chain code challenge taken
 */
function softTweak(key: Extended, chainCode: unknown): { transcript: Transcript; tweak: bigint } {
  const transcript = derivationTranscript(readHex(chainCode, 32, "Chain code"));
  transcript.appendMessage("public-key", encode(key));
  const tweak = wideScalar(transcript.challengeBytes("HDKD-scalar", 64));
  transcript.challengeBytes("HDKD-chaincode", 32);
  return { transcript, tweak };
}

/**
 * Derive a soft child of a secret. Its public key is {@link derivePublic} of the parent's,
 * and its nonce mixes the parent's with random bytes, as schnorrkel does.
 * @param secret - 128 hex digits: the key, then the nonce
 * @param chainCode - 64 hex digits, as Substrate builds it from a `/soft` junction
 * @param options - Random bytes to replace fresh ones
 * @returns {string} The child secret as 128 hex digits
 */
export function deriveSoft(secret: string, chainCode: string, options: RandomOptions = {}): string {
  const { scalar, nonce } = readSecret(secret);
  const { transcript, tweak } = softTweak(multiply(BASE, scalar), chainCode);
  const seed = concatBytes(numberToBytesLE(scalar, 32), nonce);
  const childNonce = transcript.witnessBytes("HDKD-nonce", 32, [nonce, seed], readRandom(options));
  return writeSecret(mod(scalar + tweak, L), childNonce);
}

/**
 * Derive the public key of a soft child from the parent's public key alone.
 * @param publicKey - 64 hex digits, a ristretto255 encoding
 * @param chainCode - 64 hex digits, as Substrate builds it from a `/soft` junction
 * @returns {string} The child public key as 64 hex digits
 * @throws {Error} When the public key is no ristretto255 encoding
 */
export function derivePublic(publicKey: string, chainCode: string): string {
  const key = readPublicKey(publicKey);
  const { tweak } = softTweak(key, chainCode);
  return bytesToHex(encode(add(key, multiply(BASE, tweak))));
}
