/** `@agntn/curves/ed25519`: RFC 8032 points and scalars, Ed25519 keys and signatures. */

export {
  addPoints,
  ed25519,
  getPublicKey,
  INVALID_POINT,
  isIdentity,
  isTorsionFree,
  isValidPoint,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  reduceScalar,
  sign,
  subtractPoints,
  verify,
} from "./core/ed25519.ts";
export type { SignOptions, VerifyOptions } from "./core/ed25519.ts";
