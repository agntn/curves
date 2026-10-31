/** `@agntn/curves/brainpoolp512r1`: SEC1 points and ECDSA verification on this curve alone. */

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
  subtractPoints,
  verify,
} from "./core/brainpoolp512r1.ts";
export type {
  LiftedPoints,
  PointEncodingOptions,
  Scalar,
  VerifyOptions,
} from "./core/brainpoolp512r1.ts";
