/** `@agntn/curves/p521`: SEC1 points and ECDSA verification, on NIST P-521 alone. */

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
  subtractPoints,
  verify,
} from "./core/p521.ts";
export type { LiftedPoints, PointEncodingOptions, Scalar, VerifyOptions } from "./core/p521.ts";
