/**
 * How far the group walks go, in a module without imports, so the tool schemas can name the
 * limits without loading the arithmetic.
 */

/** Largest p whose points are counted or listed one x at a time. */
export const MAX_COUNTED_PRIME = 1n << 20n;

/** Largest p for listing the points of one order, which multiplies every point. */
export const MAX_FILTERED_PRIME = 1n << 16n;

/** Largest p for the order of a point, found by baby step giant step over the Hasse interval. */
export const MAX_ORDER_PRIME = 1n << 48n;

/** Largest prime in the order of a log's base. The search takes one prime at a time. */
export const MAX_LOG_ORDER = 1n << 36n;
