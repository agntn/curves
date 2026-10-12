/** `@agntn/curves/ed25519`: edwards25519 points as RFC 8032 encodes them, cofactor and all. */

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
} from "./core/ed25519.ts";
