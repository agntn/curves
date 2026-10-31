/** `@agntn/curves/p384`: SEC1 points and ECDSA verification, on NIST P-384 alone. */

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
  subtractPoints,
  verify,
} from "./core/p384.ts";
export type { LiftedPoints, PointEncodingOptions, Scalar, VerifyOptions } from "./core/p384.ts";
