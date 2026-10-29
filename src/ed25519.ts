/** `@agntn/curves/ed25519`: edwards25519 points as RFC 8032 encodes them, and Ed25519 verify. */

export {
  addPoints,
  ed25519,
  INVALID_POINT,
  isIdentity,
  isTorsionFree,
  isValidPoint,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  reduceScalar,
  subtractPoints,
  verify,
} from "./core/ed25519.ts";
export type { VerifyOptions } from "./core/ed25519.ts";
