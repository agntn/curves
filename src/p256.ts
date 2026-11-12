/** `@agntn/curves/p256`: SEC1 points and ECDSA, on NIST P-256 alone. */

export {
  addPoints,
  convertPoint,
  INVALID_POINT,
  isOnCurve,
  liftX,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  p256,
  recoverPublicKey,
  sign,
  subtractPoints,
  verify,
} from "./core/p256.ts";
export type {
  LiftedPoints,
  NonceHash,
  PointEncodingOptions,
  RecoverOptions,
  Scalar,
  Signature,
  SignOptions,
  VerifyOptions,
} from "./core/p256.ts";
