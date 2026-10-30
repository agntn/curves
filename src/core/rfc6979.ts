/**
 * Deterministic ECDSA nonces, RFC 6979 section 3.2: HMAC-SHA-256 seeded with the secret and the
 * digest, so a broken random number generator has nothing to leak the key through. The order is a
 * parameter, so the RFC's own K-163 and P-256 examples test the code secp256k1 signs with.
 */

import { hmac } from "@agntn/hashes/hmac";
import { Sha256Hasher } from "@agntn/hashes/sha2";
import { bytesToHex, concatBytes, numberToBytesBE } from "./bytes.ts";

/** What {@link nonces} seeds the generator with. */
export interface NonceSeed {
  /** The private key x, from 1 to q minus 1. */
  readonly secret: bigint;
  /** The message digest h1 as bytes, before bits2int. */
  readonly digest: Uint8Array;
}

/**
 * HMAC-SHA-256 of the joined parts.
 * @param key - The current K
 * @param parts - What V and the seed contribute, in order
 * @returns {Uint8Array} 32 bytes
 */
function mac(key: Uint8Array, ...parts: ReadonlyArray<ArrayLike<number>>): Uint8Array {
  return hmac(() => new Sha256Hasher(), key, concatBytes(...parts));
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
 * @param seed - The secret and the digest
 * @yields {bigint} k, from 1 to q minus 1
 */
export function* nonces(order: bigint, seed: NonceSeed): Generator<bigint, never> {
  const bits = order.toString(2).length;
  const length = Math.ceil(bits / 8);
  const secret = numberToBytesBE(seed.secret, length);
  const digest = numberToBytesBE(bitsToNumber(seed.digest, bits) % order, length);
  let k = mac(new Uint8Array(32), new Uint8Array(32).fill(1), [0], secret, digest);
  let v = mac(k, new Uint8Array(32).fill(1));
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
