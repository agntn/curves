import {
  CURVE_OPERATIONS,
  MAX_COUNTED_PRIME,
  MAX_LOG_ORDER,
  MAX_ORDER_PRIME,
  SECP256K1_OPERATIONS,
} from "#tool-contract";

export { CURVE_OPERATIONS, MAX_COUNTED_PRIME, MAX_LOG_ORDER, MAX_ORDER_PRIME, SECP256K1_OPERATIONS };

/** Every operation the two tools take, curve first. */
export const OPERATION_COUNT = CURVE_OPERATIONS.length + SECP256K1_OPERATIONS.length;

/** A limit that is a power of two, as the page prints it: `2^48`. */
export function powerOfTwo(limit: bigint): string {
  return `2^${limit.toString(2).length - 1}`;
}
