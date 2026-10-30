/**
 * The digits a multiply walks when every scalar has to take the same steps. edwards25519 and
 * secp256k1 both read them, each mod the order of its own group.
 */

import { mod } from "./field.ts";

/** 1 + 16 + ... + 16^63. Taken off a scalar first, it comes back as one more in every digit. */
const ONES = ((1n << 256n) - 1n) / 15n;

/** A bit above the top digit, so every scalar shifts as a bigint of the same length. */
const PAD = 1n << 256n;

/**
 * The 64 digits a multiply walks, lowest first. Digit d picks d + 1 times the point, never 0.
 * @param scalar - Zero or more
 * @param order - Below 2^256, and any point of the group times it is the identity
 * @returns {number[]} From 0 to 15, base 16 digits of the scalar minus {@link ONES}, mod the order
 */
export function digitsOf(scalar: bigint, order: bigint): number[] {
  const padded = mod(scalar - ONES, order) | PAD;
  return Array.from({ length: 64 }, (_, index) => Number((padded >> BigInt(4 * index)) & 15n));
}
