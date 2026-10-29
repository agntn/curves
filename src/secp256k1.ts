/** `@agntn/curves/secp256k1`: SEC1 points, scalars mod the order and ECDSA, on secp256k1 alone. */

export {
  addPoints,
  addScalars,
  convertPoint,
  INVALID_POINT,
  invertScalar,
  isOnCurve,
  liftX,
  multiplyGenerator,
  multiplyPoint,
  multiplyScalars,
  negatePoint,
  recoverPublicKey,
  secp256k1,
  subtractPoints,
  subtractScalars,
  verify,
} from "./core/secp256k1.ts";
export type {
  LiftedPoints,
  PointEncodingOptions,
  RecoverOptions,
  Scalar,
  VerifyOptions,
} from "./core/secp256k1.ts";
