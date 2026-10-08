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
  "lift",
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

/** What `curves_sr25519_compute` does with sr25519 keys and signatures. */
export const SR25519_OPERATIONS = ["keypair", "sign", "verify", "derive"] as const;

export type Sr25519Operation = (typeof SR25519_OPERATIONS)[number];

/** How `curves_sr25519_compute` reads a message. */
export const MESSAGE_ENCODINGS = ["utf8", "hex"] as const;

export type MessageEncoding = (typeof MESSAGE_ENCODINGS)[number];

/** Longest message `curves_sr25519_compute` reads, in characters. */
export const MAX_MESSAGE_LENGTH = 8192;

/** Longest signing context `curves_sr25519_compute` reads, in characters. */
export const MAX_CONTEXT_LENGTH = 256;

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
