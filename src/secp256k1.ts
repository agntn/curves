/** `@agntn/curves/secp256k1`: points as SEC1 hex and scalars mod the order, on secp256k1 alone. */

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
  secp256k1,
  subtractPoints,
  subtractScalars,
} from "./core/secp256k1.ts";
export type { LiftedPoints, PointEncodingOptions, Scalar } from "./core/secp256k1.ts";
