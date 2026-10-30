/**
 * The digits a multiply walks when every scalar has to take the same steps. edwards25519 and the
 * SEC 1 curves all read them, each mod the order of its own group.
 */

import { mod } from "./field.ts";

/**
 * How many hex digits a scalar below the order takes: 64 up to 2^256, 96 for P-384.
 * @param order - The order of the group
 * @returns {number} The digit count, from the bit length of the order, which is public
 */
export function digitCount(order: bigint): number {
  return Math.ceil(order.toString(2).length / 4);
}

/**
 * The digits a multiply walks, lowest first. Digit d picks d + 1 times the point, never 0.
 * 1 + 16 + 16^2 + ... comes off the scalar first and back as one more in every digit, and a bit
 * above the top digit makes every scalar shift as a bigint of the same length.
 * @param scalar - Zero or more
 * @param order - Any point of the group times it is the identity
 * @returns {number[]} From 0 to 15, base 16 digits of the scalar minus 1 + 16 + ..., mod the order
 */
export function digitsOf(scalar: bigint, order: bigint): number[] {
  const count = digitCount(order);
  const top = 1n << BigInt(4 * count);
  const padded = mod(scalar - (top - 1n) / 15n, order) | top;
  return Array.from({ length: count }, (_, index) => Number((padded >> BigInt(4 * index)) & 15n));
}
