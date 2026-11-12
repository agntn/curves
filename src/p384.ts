/** `@agntn/curves/p384`: SEC1 points and ECDSA, on NIST P-384 alone. */

export {
  addPoints,
  convertPoint,
  INVALID_POINT,
  isOnCurve,
  liftX,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  p384,
  recoverPublicKey,
  sign,
  signingNonce,
  subtractPoints,
  verify,
} from "./core/p384.ts";
export type {
  LiftedPoints,
  NonceHash,
  PointEncodingOptions,
  RecoverOptions,
  Scalar,
  Signature,
  SignOptions,
  VerifyOptions,
} from "./core/p384.ts";
