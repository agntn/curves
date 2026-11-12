/**
 * Deterministic ECDSA nonces, RFC 6979 section 3.2: an HMAC seeded with the secret and the digest,
 * so a broken random number generator has nothing to leak the key through. The HMAC runs on the
 * hash that made the digest, SHA-1 or SHA-2. The order is a parameter, so the RFC's own K-163,
 * P-256, P-384 and P-521 examples test the code every SEC 1 curve signs with.
 */

import { hmac } from "@agntn/hashes/hmac";
import { Sha1Hasher } from "@agntn/hashes/sha1";
import { Sha224Hasher, Sha256Hasher, Sha384Hasher, Sha512Hasher } from "@agntn/hashes/sha2";
import { bytesToHex, concatBytes, numberToBytesBE } from "./bytes.ts";
import type { NonceHash } from "./nonce-hashes.ts";

/** What {@link nonces} seeds the generator with. */
export interface NonceSeed {
  /** The private key x, from 1 to q minus 1. */
  readonly secret: bigint;
  /** The message digest h1 as bytes, before bits2int. */
  readonly digest: Uint8Array;
  /** The hash that made h1, and so the one under the HMAC. */
  readonly hash: NonceHash;
}

/** One HMAC under the current K, over the joined parts. */
type Mac = (key: Uint8Array, ...parts: ReadonlyArray<ArrayLike<number>>) => Uint8Array;

/** A fresh hasher for each name, built only when a signature asks for it. */
const HASHERS = {
  sha1: () => new Sha1Hasher(),
  sha224: () => new Sha224Hasher(),
  sha256: () => new Sha256Hasher(),
  sha384: () => new Sha384Hasher(),
  sha512: () => new Sha512Hasher(),
} as const satisfies Record<NonceHash, unknown>;

/**
 * HMAC with one hash, of the parts joined.
 * @param hash - The hash under the HMAC
 * @returns {Mac} The HMAC, with an output as long as the hash's
 */
function macOf(hash: NonceHash): Mac {
  const create = HASHERS[hash];
  return (key, ...parts) => hmac(create, key, concatBytes(...parts));
}

/**
 * bits2int of section 2.3.2: the leftmost bits of a byte string, as many as q has.
 * @param bytes - Any bytes
 * @param bits - qlen, the bit length of q
 * @returns {bigint} The number
 */
function bitsToNumber(bytes: ArrayLike<number>, bits: number): bigint {
  if (bytes.length === 0) return 0n;
  const value = BigInt(`0x${bytesToHex(bytes)}`);
  const extra = bytes.length * 8 - bits;
  return extra > 0 ? value >> BigInt(extra) : value;
}

/**
 * Steps b to h of section 3.2. A signer whose r or s comes out zero takes the next k, per h.3.
 * @param order - q, the order of the group
 * @param seed - The secret, the digest and its hash
 * @yields {bigint} k, from 1 to q minus 1
 */
export function* nonces(order: bigint, seed: NonceSeed): Generator<bigint, never> {
  const mac = macOf(seed.hash);
  const bits = order.toString(2).length;
  const length = Math.ceil(bits / 8);
  const secret = numberToBytesBE(seed.secret, length);
  const digest = numberToBytesBE(bitsToNumber(seed.digest, bits) % order, length);
  const width = HASHERS[seed.hash]().outputLength;
  let k = mac(new Uint8Array(width), new Uint8Array(width).fill(1), [0], secret, digest);
  let v = mac(k, new Uint8Array(width).fill(1));
  k = mac(k, v, [1], secret, digest);
  v = mac(k, v);
  for (;;) {
    let t: Uint8Array = new Uint8Array(0);
    while (t.length < length) {
      v = mac(k, v);
      t = concatBytes(t, v);
    }
    const candidate = bitsToNumber(t, bits);
    if (candidate > 0n && candidate < order) yield candidate;
    k = mac(k, v, [0]);
    v = mac(k, v);
  }
}
