/** `@agntn/curves/brainpoolp512r1`: SEC1 points and ECDSA on this curve alone. */

export {
  addPoints,
  brainpoolP512r1,
  convertPoint,
  INVALID_POINT,
  isOnCurve,
  liftX,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  recoverPublicKey,
  sign,
  signingNonce,
  subtractPoints,
  verify,
} from "./core/brainpoolp512r1.ts";
export type {
  LiftedPoints,
  NonceHash,
  PointEncodingOptions,
  RecoverOptions,
  Scalar,
  Signature,
  SignOptions,
  VerifyOptions,
} from "./core/brainpoolp512r1.ts";
