/** One contract for every surface; the schemas repeat it, the executors enforce it. */

export {
  MAX_COUNTED_PRIME,
  MAX_FILTERED_PRIME,
  MAX_LOG_ORDER,
  MAX_ORDER_PRIME,
} from "./core/limits.ts";

/** What `curves_compute` does on a curve the caller defines. */
export const CURVE_OPERATIONS = [
  "add",
  "double",
  "negate",
  "multiply",
  "check",
  "order",
  "count",
  "points",
  "log",
] as const;

export type CurveOperation = (typeof CURVE_OPERATIONS)[number];

/** What `curves_secp256k1_compute` does with public points. */
export const SECP256K1_OPERATIONS = [
  "add",
  "subtract",
  "negate",
  "multiply",
  "lift",
  "check",
] as const;

export type Secp256k1Operation = (typeof SECP256K1_OPERATIONS)[number];

/** Longest integer `curves_compute` reads, enough for a 512-bit decimal with a sign. */
export const MAX_CURVE_INTEGER_LENGTH = 160;

/** Most points one `points` call lists. */
export const MAX_CURVE_POINTS_SHOWN = 1000;

/** Points a `points` call lists when it names no limit. */
export const DEFAULT_CURVE_POINTS_SHOWN = 100;

/** An integer as decimal or 0x hex, with an optional minus sign. */
export const CURVE_INTEGER_PATTERN = "-?(?:0[xX][0-9A-Fa-f]+|[0-9]+)";

/** A compressed or uncompressed SEC1 point. */
export const SEC1_PATTERN = "0[23][0-9A-Fa-f]{64}|04[0-9A-Fa-f]{128}";
