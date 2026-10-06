/**
 * Tool executors behind the definitions in `tools.ts`, loaded on the first call.
 *
 * Each executor returns the text a caller reads plus the structured details the
 * agent harnesses attach to the call. An MCP client sees only the text, so every
 * fact needed for a follow-up call has to be in it.
 */

import {
  addPoints,
  doublePoint,
  isOnCurve,
  multiplyPoint,
  negatePoint,
  type AffinePoint,
  type CurvePoint,
  type WeierstrassCurve,
  defineCurve,
} from "./core/arithmetic.ts";
import {
  countPoints,
  findLog,
  listPoints,
  pointOrder,
  samplePoints,
  type PointSample,
} from "./core/group.ts";
import * as secp256k1 from "./core/secp256k1.ts";
import {
  CURVE_INTEGER_PATTERN,
  CURVE_OPERATIONS,
  DEFAULT_CURVE_POINTS_SHOWN,
  MAX_CURVE_INTEGER_LENGTH,
  MAX_CURVE_POINTS_SHOWN,
  SECP256K1_OPERATIONS,
  type CurveOperation,
  type Secp256k1Operation,
} from "./tool-contract.ts";

/**
 * Text for the model plus details for the harness, shared by every tool surface.
 * A failure throws instead: Pi records every returned value as a successful call.
 */
export interface ToolResult<Details> {
  content: Array<{ type: "text"; text: string }>;
  details: Details;
}

/** A point as the curve tool writes it: decimal coordinates, or "infinity". */
export type CurvePointText = { x: string; y: string } | "infinity";

/** What the curve tool computes, by operation. */
export type CurveDetails =
  | { operation: "add" | "double" | "negate" | "multiply"; point: CurvePointText }
  | { operation: "check"; onCurve: boolean }
  | { operation: "order"; order: string }
  | { operation: "count"; count: string }
  | { operation: "points"; total: string; points: CurvePointText[]; truncated: boolean }
  | { operation: "log"; order: string; scalar: string | null };

/** What the secp256k1 tool computes, by operation. */
export type Secp256k1Details =
  | { operation: Exclude<Secp256k1Operation, "lift" | "check">; point: string }
  | { operation: "lift"; even: string; odd: string }
  | { operation: "check"; onCurve: boolean };

/**
 * Wraps details as the one JSON text every surface returns.
 * @param details - The structured result
 * @returns {ToolResult<Details>} Text and details
 */
function result<Details>(details: Details): ToolResult<Details> {
  return { content: [{ type: "text", text: JSON.stringify(details) }], details };
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  return value;
}

/**
 * Tell whether an optional argument is missing. A blank string counts as missing: OMP fills every
 * field, and strict function calling sends "".
 * @param value - Raw argument
 * @returns {boolean} True for undefined and blank strings
 */
function isUnset(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.trim() === "");
}

function oneOf<const Value extends string>(
  value: unknown,
  name: string,
  allowed: readonly Value[],
): Value {
  const matched = allowed.find((candidate) => candidate === value);
  if (matched === undefined) throw new RangeError(`${name} must be one of ${allowed.join(", ")}`);
  return matched;
}

/**
 * Refuses an argument the operation does not take, so none drops silently.
 * @param args - Tool arguments
 * @param operation - The operation
 * @param optional - Every optional argument of the tool
 * @param taken - The ones this operation reads
 */
function refuseForeign(
  args: Readonly<Record<string, unknown>>,
  operation: string,
  optional: readonly string[],
  taken: readonly string[],
): void {
  const foreign = optional.filter((name) => !taken.includes(name) && !isUnset(args[name]));
  if (foreign.length > 0) throw new RangeError(`${operation} does not take ${foreign.join(", ")}`);
}

/** The optional arguments each curve operation takes. */
const CURVE_ARGUMENTS: Readonly<Record<CurveOperation, readonly string[]>> = {
  add: ["point", "other"],
  double: ["point"],
  negate: ["point"],
  multiply: ["point", "scalar"],
  check: ["point"],
  order: ["point"],
  count: [],
  points: ["order", "limit"],
  log: ["point", "other"],
};

/** Every optional argument of the curve tool, so the refusal covers each one a table names. */
const CURVE_OPTIONAL = [...new Set(Object.values(CURVE_ARGUMENTS).flat())];

const CURVE_INTEGER = new RegExp(`^${CURVE_INTEGER_PATTERN}$`, "u");

/**
 * Read an integer the curve tool takes as decimal or 0x hex, with an optional minus sign.
 * @param value - Raw argument
 * @param name - What the error calls it
 * @returns {bigint} The integer
 */
function curveInteger(value: unknown, name: string): bigint {
  const text = requiredString(value, name);
  if (text.length > MAX_CURVE_INTEGER_LENGTH || !CURVE_INTEGER.test(text)) {
    throw new RangeError(`${name} must be an integer, decimal or hex with 0x`);
  }
  const negative = text.startsWith("-");
  const magnitude = BigInt(negative ? text.slice(1) : text);
  return negative ? -magnitude : magnitude;
}

/**
 * Read a point argument of an operation that needs it.
 * @param args - Tool arguments
 * @param operation - The operation, for the error
 * @param name - point or other
 * @returns {AffinePoint} The point, not yet checked against the curve
 */
function curvePointArgument(
  args: Readonly<Record<string, unknown>>,
  operation: CurveOperation,
  name: string,
): AffinePoint {
  const value = args[name];
  if (value === undefined) throw new TypeError(`${operation} needs ${name}`);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object with x and y`);
  }
  const extra = Object.keys(value).filter((key) => key !== "x" && key !== "y");
  if (extra.length > 0) throw new RangeError(`${name} takes only x and y`);
  const coordinate = (key: string): unknown =>
    Object.hasOwn(value, key) ? Reflect.get(value, key) : undefined;
  return {
    x: curveInteger(coordinate("x"), `${name}.x`),
    y: curveInteger(coordinate("y"), `${name}.y`),
  };
}

/**
 * Write a point for the tool result.
 * @param point - A point, or null for infinity
 * @returns {CurvePointText} Decimal coordinates, or "infinity"
 */
function curvePointText(point: Readonly<CurvePoint>): CurvePointText {
  return point === null ? "infinity" : { x: point.x.toString(), y: point.y.toString() };
}

/**
 * Read how many points to list.
 * @param value - Raw argument
 * @returns {number} The limit
 */
function pointLimit(value: unknown): number {
  if (value === undefined) return DEFAULT_CURVE_POINTS_SHOWN;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_CURVE_POINTS_SHOWN
  ) {
    throw new RangeError(`limit must be an integer between 1 and ${MAX_CURVE_POINTS_SHOWN}`);
  }
  return value;
}

/**
 * List every point of one order, which is also how many there are.
 * @param curve - A checked curve
 * @param order - The order asked for
 * @returns {PointSample} The points and their count
 */
function sampleOfOrder(curve: Readonly<WeierstrassCurve>, order: bigint): PointSample {
  const points = listPoints(curve, { order });
  return { points, total: BigInt(points.length) };
}

/**
 * List points, at most the limit of them, and say how many there are.
 * @param curve - A checked curve
 * @param args - Tool arguments
 * @returns {CurveDetails} The points listed, their total and whether the list stops short
 */
function listCurvePoints(
  curve: Readonly<WeierstrassCurve>,
  args: Readonly<Record<string, unknown>>,
): CurveDetails {
  const order = isUnset(args["order"]) ? undefined : curveInteger(args["order"], "order");
  const limit = pointLimit(args["limit"]);
  const { points, total } =
    order === undefined ? samplePoints(curve, limit) : sampleOfOrder(curve, order);
  return {
    operation: "points",
    total: total.toString(),
    points: points.slice(0, limit).map(curvePointText),
    truncated: total > BigInt(limit),
  };
}

/**
 * Find a discrete log and name the order it was searched in.
 * @param curve - A checked curve
 * @param args - Tool arguments
 * @returns {CurveDetails} The order of the base and k, or null when the target is no multiple
 */
function findCurveLog(
  curve: Readonly<WeierstrassCurve>,
  args: Readonly<Record<string, unknown>>,
): CurveDetails {
  const base = curvePointArgument(args, "log", "point");
  const target = curvePointArgument(args, "log", "other");
  const { order, scalar } = findLog(curve, base, target);
  return {
    operation: "log",
    order: order.toString(),
    scalar: scalar === undefined ? null : scalar.toString(),
  };
}

/** How each operation turns a checked curve and the arguments into its result. */
const CURVE_COMPUTATIONS: Readonly<
  Record<
    CurveOperation,
    (curve: Readonly<WeierstrassCurve>, args: Readonly<Record<string, unknown>>) => CurveDetails
  >
> = {
  add: (curve, args) => ({
    operation: "add",
    point: curvePointText(
      addPoints(
        curve,
        curvePointArgument(args, "add", "point"),
        curvePointArgument(args, "add", "other"),
      ),
    ),
  }),
  double: (curve, args) => ({
    operation: "double",
    point: curvePointText(doublePoint(curve, curvePointArgument(args, "double", "point"))),
  }),
  negate: (curve, args) => ({
    operation: "negate",
    point: curvePointText(negatePoint(curve, curvePointArgument(args, "negate", "point"))),
  }),
  multiply: (curve, args) => {
    const point = curvePointArgument(args, "multiply", "point");
    if (isUnset(args["scalar"])) throw new TypeError("multiply needs scalar");
    const scalar = curveInteger(args["scalar"], "scalar");
    return { operation: "multiply", point: curvePointText(multiplyPoint(curve, point, scalar)) };
  },
  check: (curve, args) => ({
    operation: "check",
    onCurve: isOnCurve(curve, curvePointArgument(args, "check", "point")),
  }),
  order: (curve, args) => ({
    operation: "order",
    order: pointOrder(curve, curvePointArgument(args, "order", "point")).toString(),
  }),
  count: (curve) => ({ operation: "count", count: countPoints(curve).toString() }),
  points: listCurvePoints,
  log: findCurveLog,
};

/**
 * Do arithmetic on a short Weierstrass curve the caller defines: points, orders, counts and logs.
 * @param args - Tool arguments: the operation, a, b, p and the ones the operation takes
 * @returns {ToolResult<CurveDetails>} The result of the operation
 */
export function computeCurve(args: Readonly<Record<string, unknown>>): ToolResult<CurveDetails> {
  const operation = oneOf(args["operation"], "operation", CURVE_OPERATIONS);
  refuseForeign(args, operation, CURVE_OPTIONAL, CURVE_ARGUMENTS[operation]);
  const curve = defineCurve({
    a: curveInteger(args["a"], "a"),
    b: curveInteger(args["b"], "b"),
    p: curveInteger(args["p"], "p"),
  });
  return result(CURVE_COMPUTATIONS[operation](curve, args));
}

/** The arguments each secp256k1 operation takes. */
const SECP256K1_ARGUMENTS: Readonly<Record<Secp256k1Operation, readonly string[]>> = {
  add: ["point", "other", "compressed"],
  subtract: ["point", "other", "compressed"],
  negate: ["point", "compressed"],
  multiply: ["point", "scalar", "compressed"],
  lift: ["x", "compressed"],
  check: ["point"],
};

/** Every optional argument of the secp256k1 tool. */
const SECP256K1_OPTIONAL = [...new Set(Object.values(SECP256K1_ARGUMENTS).flat())];

/**
 * Add, subtract, negate or multiply public secp256k1 points, lift an x or check a point.
 * @param args - Tool arguments, the operation and the ones it takes
 * @returns {ToolResult<Secp256k1Details>} The resulting point, both lifted points or the verdict
 */
export function computeSecp256k1(
  args: Readonly<Record<string, unknown>>,
): ToolResult<Secp256k1Details> {
  const operation = oneOf(args["operation"], "operation", SECP256K1_OPERATIONS);
  refuseForeign(args, operation, SECP256K1_OPTIONAL, SECP256K1_ARGUMENTS[operation]);
  const argument = (name: string): string => {
    if (isUnset(args[name])) throw new TypeError(`${operation} needs ${name}`);
    return requiredString(args[name], name);
  };
  const compressed = args["compressed"] ?? true;
  if (typeof compressed !== "boolean") throw new TypeError("Compressed must be a boolean");
  const options = { compressed };
  if (operation === "check") {
    return result({ operation, onCurve: secp256k1.isOnCurve(argument("point")) });
  }
  if (operation === "lift")
    return result({ operation, ...secp256k1.liftX(argument("x"), options) });
  if (operation === "negate") {
    return result({ operation, point: secp256k1.negatePoint(argument("point"), options) });
  }
  if (operation === "multiply") {
    const point = secp256k1.multiplyPoint(argument("point"), argument("scalar"), options);
    return result({ operation, point });
  }
  const compute = operation === "add" ? secp256k1.addPoints : secp256k1.subtractPoints;
  return result({ operation, point: compute(argument("point"), argument("other"), options) });
}
