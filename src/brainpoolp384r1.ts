/** `@agntn/curves/brainpoolp384r1`: SEC1 points and ECDSA on this curve alone. */

export {
  addPoints,
  brainpoolP384r1,
  convertPoint,
  INVALID_POINT,
  isOnCurve,
  liftX,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  recoverPublicKey,
  sign,
  subtractPoints,
  verify,
} from "./core/brainpoolp384r1.ts";
export type {
  LiftedPoints,
  NonceHash,
  PointEncodingOptions,
  RecoverOptions,
  Scalar,
  Signature,
  SignOptions,
  VerifyOptions,
} from "./core/brainpoolp384r1.ts";
