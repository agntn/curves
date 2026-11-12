/** `@agntn/curves/p521`: SEC1 points and ECDSA, on NIST P-521 alone. */

export {
  addPoints,
  convertPoint,
  INVALID_POINT,
  isOnCurve,
  liftX,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  p521,
  recoverPublicKey,
  sign,
  subtractPoints,
  verify,
} from "./core/p521.ts";
export type {
  LiftedPoints,
  NonceHash,
  PointEncodingOptions,
  RecoverOptions,
  Scalar,
  Signature,
  SignOptions,
  VerifyOptions,
} from "./core/p521.ts";
