/**
 * Tool executors behind the definitions in `tools.ts`, loaded on the first call.
 *
 * Each executor returns the text a caller reads plus the structured details the
 * agent harnesses attach to the call. An MCP client sees only the text, so every
 * fact needed for a follow-up call has to be in it.
 */

import {
  add,
  double,
  isOnCurve,
  liftX,
  multiply,
  negate,
  onCurve,
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
import * as bip340 from "./core/bip340.ts";
import { hexToBytes } from "./core/bytes.ts";
import * as ed25519 from "./core/ed25519.ts";
import * as p256 from "./core/p256.ts";
import * as p384 from "./core/p384.ts";
import * as p521 from "./core/p521.ts";
import * as secp256k1 from "./core/secp256k1.ts";
import * as sr25519 from "./core/sr25519.ts";
import {
  BIP340_OPERATIONS,
  CURVE_INTEGER_PATTERN,
  CURVE_OPERATIONS,
  DEFAULT_CURVE_POINTS_SHOWN,
  ED25519_OPERATIONS,
  MAX_CURVE_INTEGER_LENGTH,
  MAX_CURVE_POINTS_SHOWN,
  MAX_CONTEXT_LENGTH,
  MAX_MESSAGE_LENGTH,
  MESSAGE_ENCODINGS,
  P256_OPERATIONS,
  P384_OPERATIONS,
  P521_OPERATIONS,
  SECP256K1_OPERATIONS,
  SR25519_OPERATIONS,
  type Bip340Operation,
  type CurveOperation,
  type Ed25519Operation,
  type P256Operation,
  type Secp256k1Operation,
  type Sr25519Operation,
} from "./tool-contract.ts";

/**
 * Text for the model plus details for the harness, shared by every tool surface.
 * A failure throws instead: Pi records every returned value as a successful call.
 */
export interface ToolResult<Details> {
  content: Array<{ type: "text"; text: string }>;
  details: Details;
}

/** A finite point as the curve tool writes it, in decimal. */
export type AffinePointText = { x: string; y: string };

/** A point as the curve tool writes it: decimal coordinates, or "infinity". */
export type CurvePointText = AffinePointText | "infinity";

/** What the curve tool computes, by operation. */
export type CurveDetails =
  | { operation: "add" | "double" | "negate" | "multiply"; point: CurvePointText }
  | { operation: "lift"; points: AffinePointText[] }
  | { operation: "check"; onCurve: boolean }
  | { operation: "order"; order: string }
  | { operation: "count"; count: string }
  | { operation: "points"; total: string; points: CurvePointText[]; truncated: boolean }
  | { operation: "log"; order: string; scalar: string | null };

/** What the secp256k1 tool computes, by operation. */
export type Secp256k1Details =
  | { operation: Exclude<Secp256k1Operation, "lift" | "check" | "sign" | "verify">; point: string }
  | { operation: "lift"; even: string; odd: string }
  | { operation: "check"; onCurve: boolean }
  | { operation: "sign"; signature: string; recovery: number; publicKey: string }
  | { operation: "verify"; valid: boolean };

/** What the P-256 tool computes, by operation. */
export type P256Details =
  | { operation: Exclude<P256Operation, "lift" | "check" | "verify">; point: string }
  | { operation: "lift"; even: string; odd: string }
  | { operation: "check"; onCurve: boolean }
  | { operation: "verify"; valid: boolean };

/** What the P-384 tool computes: the same answers as P-256, with longer hex. */
export type P384Details = P256Details;

/** What the P-521 tool computes: the same answers as P-256, with longer hex. */
export type P521Details = P256Details;

/** What the BIP340 tool computes, by operation. */
export type Bip340Details =
  | { operation: "keypair"; publicKey: string }
  | { operation: "sign"; signature: string; publicKey: string }
  | { operation: "verify"; valid: boolean };

/** What the Ed25519 tool computes, by operation. */
export type Ed25519Details =
  | { operation: "keypair"; publicKey: string }
  | { operation: "sign"; signature: string; publicKey: string }
  | { operation: "verify"; valid: boolean };

/** What the sr25519 tool computes, by operation. A secret or a seed comes back only when new. */
export type Sr25519Details =
  | { operation: "keypair"; secret?: string; publicKey: string }
  | { operation: "sign"; signature: string; publicKey: string }
  | { operation: "verify"; valid: boolean }
  | { operation: "derive"; hard: boolean; seed?: string; secret?: string; publicKey: string };

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
  lift: ["x"],
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
 * Read a point argument and refuse it by its own name when it's off the curve.
 * @param curve - A checked curve
 * @param args - Tool arguments
 * @param operation - The operation, for the error
 * @param name - point or other
 * @returns {AffinePoint} A point of the curve
 */
function curvePointOn(
  curve: Readonly<WeierstrassCurve>,
  args: Readonly<Record<string, unknown>>,
  operation: CurveOperation,
  name: string,
): AffinePoint {
  const point = curvePointArgument(args, operation, name);
  onCurve(curve, point, name);
  return point;
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
 * Put infinity, the one point of order 1, ahead of the finite points when the order lets it in.
 * @param sample - Finite points and their count
 * @param order - The order asked for, or undefined for every point
 * @param limit - Most points to write
 * @returns {{ points: CurvePointText[]; total: bigint }} Up to limit points and how many there are
 */
function sampleText(
  sample: Readonly<{ points: readonly Readonly<AffinePoint>[]; total: bigint }>,
  order: bigint | undefined,
  limit: number,
): { points: CurvePointText[]; total: bigint } {
  if (order !== undefined && order !== 1n) {
    return { points: sample.points.slice(0, limit).map(curvePointText), total: sample.total };
  }
  const points = sample.points.slice(0, limit - 1).map(curvePointText);
  return { points: ["infinity", ...points], total: sample.total + 1n };
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
  const { points, total } = sampleText(
    order === undefined ? samplePoints(curve, limit) : sampleOfOrder(curve, order),
    order,
    limit,
  );
  return {
    operation: "points",
    total: total.toString(),
    points,
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
  const base = curvePointOn(curve, args, "log", "point");
  const target = curvePointOn(curve, args, "log", "other");
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
      add(
        curve,
        curvePointOn(curve, args, "add", "point"),
        curvePointOn(curve, args, "add", "other"),
      ),
    ),
  }),
  double: (curve, args) => ({
    operation: "double",
    point: curvePointText(double(curve, curvePointOn(curve, args, "double", "point"))),
  }),
  negate: (curve, args) => ({
    operation: "negate",
    point: curvePointText(negate(curve, curvePointOn(curve, args, "negate", "point"))),
  }),
  multiply: (curve, args) => {
    const point = curvePointOn(curve, args, "multiply", "point");
    if (isUnset(args["scalar"])) throw new TypeError("multiply needs scalar");
    const scalar = curveInteger(args["scalar"], "scalar");
    return { operation: "multiply", point: curvePointText(multiply(curve, point, scalar)) };
  },
  lift: (curve, args) => {
    if (isUnset(args["x"])) throw new TypeError("lift needs x");
    const points = liftX(curve, curveInteger(args["x"], "x"));
    return { operation: "lift", points: points.map(({ x, y }) => ({ x: `${x}`, y: `${y}` })) };
  },
  check: (curve, args) => ({
    operation: "check",
    onCurve: isOnCurve(curve, curvePointArgument(args, "check", "point")),
  }),
  order: (curve, args) => ({
    operation: "order",
    order: pointOrder(curve, curvePointOn(curve, args, "order", "point")).toString(),
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
  sign: ["secret", "digest", "compressed"],
  verify: ["point", "digest", "signature", "lowS"],
  recover: ["digest", "signature", "recovery", "compressed"],
};

/** P-256 takes what secp256k1 takes for each operation the two share. */
const P256_ARGUMENTS: Readonly<Record<P256Operation, readonly string[]>> = {
  add: SECP256K1_ARGUMENTS.add,
  subtract: SECP256K1_ARGUMENTS.subtract,
  negate: SECP256K1_ARGUMENTS.negate,
  multiply: SECP256K1_ARGUMENTS.multiply,
  lift: SECP256K1_ARGUMENTS.lift,
  check: SECP256K1_ARGUMENTS.check,
  verify: SECP256K1_ARGUMENTS.verify,
};

/** What the point and verify operations call, the same for every SEC 1 curve module. */
interface Sec1Module {
  readonly INVALID_POINT: string;
  readonly addPoints: typeof secp256k1.addPoints;
  readonly subtractPoints: typeof secp256k1.subtractPoints;
  readonly negatePoint: typeof secp256k1.negatePoint;
  readonly multiplyPoint: typeof secp256k1.multiplyPoint;
  readonly liftX: typeof secp256k1.liftX;
  readonly isOnCurve: typeof secp256k1.isOnCurve;
  readonly verify: typeof secp256k1.verify;
}

/** A SEC 1 curve tool's arguments, read for one operation. */
interface Sec1Input {
  readonly args: Readonly<Record<string, unknown>>;
  readonly text: (name: string) => string;
  readonly encoding: { readonly compressed: boolean };
}

/**
 * Read lowS, false when missing.
 * @param value - Raw argument
 * @returns {boolean} Whether to refuse a high s
 */
function lowS(value: unknown): boolean {
  const flag = value ?? false;
  if (typeof flag !== "boolean") throw new TypeError("lowS must be a boolean");
  return flag;
}

/**
 * Read the recovery id. The library checks the range and says so in its own words.
 * @param value - Raw argument
 * @returns {number} The id as given
 */
function recoveryId(value: unknown): number {
  if (typeof value !== "number") throw new TypeError("recover needs recovery, from 0 to 3");
  return value;
}

/**
 * The point and verify operations of one curve, with refusals that name the bad argument.
 * @param curve - The curve's module
 * @param name - What the refusals call the curve
 * @returns {Record<P256Operation, (input: Sec1Input) => P256Details>} How each operation runs
 */
function sec1Computations(
  curve: Sec1Module,
  name: string,
): Readonly<Record<P256Operation, (input: Sec1Input) => P256Details>> {
  const isPoint = (value: unknown): boolean => {
    try {
      return typeof value === "string" && curve.isOnCurve(value);
    } catch {
      return false;
    }
  };
  const naming = <Value>(
    { args }: Sec1Input,
    names: readonly string[],
    run: () => Value,
  ): Value => {
    try {
      return run();
    } catch (error) {
      if (!(error instanceof Error) || error.message !== curve.INVALID_POINT) throw error;
      const refused = names.find((candidate) => !isPoint(args[candidate]));
      if (refused === undefined) throw error;
      throw new RangeError(`${refused} is not a SEC1 point of ${name}`, { cause: error });
    }
  };
  return {
    add: (input) => ({
      operation: "add",
      point: naming(input, ["point", "other"], () =>
        curve.addPoints(input.text("point"), input.text("other"), input.encoding),
      ),
    }),
    subtract: (input) => ({
      operation: "subtract",
      point: naming(input, ["point", "other"], () =>
        curve.subtractPoints(input.text("point"), input.text("other"), input.encoding),
      ),
    }),
    negate: (input) => ({
      operation: "negate",
      point: naming(input, ["point"], () => curve.negatePoint(input.text("point"), input.encoding)),
    }),
    multiply: (input) => ({
      operation: "multiply",
      point: naming(input, ["point"], () =>
        curve.multiplyPoint(input.text("point"), input.text("scalar"), input.encoding),
      ),
    }),
    lift: ({ text, encoding }) => ({ operation: "lift", ...curve.liftX(text("x"), encoding) }),
    check: ({ text }) => ({ operation: "check", onCurve: curve.isOnCurve(text("point")) }),
    verify: (input) => ({
      operation: "verify",
      valid: naming(input, ["point"], () =>
        curve.verify(input.text("signature"), {
          digest: input.text("digest"),
          publicKey: input.text("point"),
          lowS: lowS(input.args["lowS"]),
        }),
      ),
    }),
  };
}

/** How each secp256k1 operation turns the arguments into its result. */
const SECP256K1_COMPUTATIONS: Readonly<
  Record<Secp256k1Operation, (input: Sec1Input) => Secp256k1Details>
> = {
  ...sec1Computations(secp256k1, "secp256k1"),
  sign: ({ text, encoding }) => {
    const secret = text("secret");
    const { signature, recovery } = secp256k1.sign(secret, { digest: text("digest") });
    const publicKey = secp256k1.multiplyGenerator(secret, encoding);
    return { operation: "sign", signature, recovery, publicKey };
  },
  recover: ({ args, text, encoding }) => ({
    operation: "recover",
    point: secp256k1.recoverPublicKey(text("signature"), {
      digest: text("digest"),
      recovery: recoveryId(args["recovery"]),
      ...encoding,
    }),
  }),
};

/** How each P-256 operation turns the arguments into its result. */
const P256_COMPUTATIONS = sec1Computations(p256, "P-256");

/** How each P-384 operation turns the arguments into its result. */
const P384_COMPUTATIONS = sec1Computations(p384, "P-384");

/** How each P-521 operation turns the arguments into its result. */
const P521_COMPUTATIONS = sec1Computations(p521, "P-521");

/** One SEC 1 curve tool: its operations, the arguments each takes and how each runs. */
interface Sec1Tool<Operation extends string, Details> {
  readonly operations: readonly Operation[];
  readonly arguments: Readonly<Record<Operation, readonly string[]>>;
  readonly computations: Readonly<Record<Operation, (input: Sec1Input) => Details>>;
}

/**
 * Run one operation of a SEC 1 curve tool.
 * @param args - Tool arguments, the operation and the ones it takes
 * @param tool - The curve's operations
 * @returns {ToolResult<Details>} What the operation gives
 */
function computeSec1<Operation extends string, Details>(
  args: Readonly<Record<string, unknown>>,
  tool: Sec1Tool<Operation, Details>,
): ToolResult<Details> {
  const operation = oneOf(args["operation"], "operation", tool.operations);
  const optional = [...new Set(Object.values<readonly string[]>(tool.arguments).flat())];
  refuseForeign(args, operation, optional, tool.arguments[operation]);
  const text = (name: string): string => {
    if (isUnset(args[name])) throw new TypeError(`${operation} needs ${name}`);
    return requiredString(args[name], name);
  };
  const compressed = args["compressed"] ?? true;
  if (typeof compressed !== "boolean") throw new TypeError("Compressed must be a boolean");
  return result(tool.computations[operation]({ args, text, encoding: { compressed } }));
}

/**
 * Do math on public secp256k1 points, or sign a digest with ECDSA, verify a signature and recover
 * its key.
 * @param args - Tool arguments, the operation and the ones it takes
 * @returns {ToolResult<Secp256k1Details>} A point, the lifted pair, a signature or the verdict
 */
export function computeSecp256k1(
  args: Readonly<Record<string, unknown>>,
): ToolResult<Secp256k1Details> {
  return computeSec1(args, {
    operations: SECP256K1_OPERATIONS,
    arguments: SECP256K1_ARGUMENTS,
    computations: SECP256K1_COMPUTATIONS,
  });
}

/**
 * Do math on public P-256 points, or verify an ECDSA signature over a digest.
 * @param args - Tool arguments, the operation and the ones it takes
 * @returns {ToolResult<P256Details>} A point, the lifted pair or the verdict
 */
export function computeP256(args: Readonly<Record<string, unknown>>): ToolResult<P256Details> {
  return computeSec1(args, {
    operations: P256_OPERATIONS,
    arguments: P256_ARGUMENTS,
    computations: P256_COMPUTATIONS,
  });
}

/**
 * Do math on public P-384 points, or verify an ECDSA signature over a digest.
 * @param args - Tool arguments, the operation and the ones it takes
 * @returns {ToolResult<P384Details>} A point, the lifted pair or the verdict
 */
export function computeP384(args: Readonly<Record<string, unknown>>): ToolResult<P384Details> {
  return computeSec1(args, {
    operations: P384_OPERATIONS,
    arguments: P256_ARGUMENTS,
    computations: P384_COMPUTATIONS,
  });
}

/**
 * Do math on public P-521 points, or verify an ECDSA signature over a digest.
 * @param args - Tool arguments, the operation and the ones it takes
 * @returns {ToolResult<P521Details>} A point, the lifted pair or the verdict
 */
export function computeP521(args: Readonly<Record<string, unknown>>): ToolResult<P521Details> {
  return computeSec1(args, {
    operations: P521_OPERATIONS,
    arguments: P256_ARGUMENTS,
    computations: P521_COMPUTATIONS,
  });
}

/** The arguments each BIP340 operation takes. */
const BIP340_ARGUMENTS: Readonly<Record<Bip340Operation, readonly string[]>> = {
  keypair: ["secret"],
  sign: ["secret", "message", "random"],
  verify: ["publicKey", "message", "signature"],
};

/** Every optional argument of the BIP340 tool. */
const BIP340_OPTIONAL = [...new Set(Object.values(BIP340_ARGUMENTS).flat())];

/**
 * Read the hex message a BIP340 or Ed25519 signature covers. Blank is the empty one, not missing.
 * @param args - Tool arguments
 * @param operation - The operation, for the refusal
 * @returns {string} The message as given
 */
function signedMessage(args: Readonly<Record<string, unknown>>, operation: string): string {
  if (args["message"] === undefined) throw new TypeError(`${operation} needs message`);
  const message = requiredString(args["message"], "message");
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new RangeError(`message must be at most ${MAX_MESSAGE_LENGTH} characters`);
  }
  return message;
}

/**
 * Derive an x-only key, sign by BIP340, or verify a BIP340 signature.
 * @param args - Tool arguments, the operation and the ones it takes
 * @returns {ToolResult<Bip340Details>} The key, the signature with its key, or the verdict
 */
export function computeBip340(args: Readonly<Record<string, unknown>>): ToolResult<Bip340Details> {
  const operation = oneOf(args["operation"], "operation", BIP340_OPERATIONS);
  refuseForeign(args, operation, BIP340_OPTIONAL, BIP340_ARGUMENTS[operation]);
  const text = (name: string): string => {
    if (isUnset(args[name])) throw new TypeError(`${operation} needs ${name}`);
    return requiredString(args[name], name);
  };
  if (operation === "keypair") {
    return result({ operation, publicKey: bip340.getPublicKey(text("secret")) });
  }
  const message = signedMessage(args, operation);
  if (operation === "sign") {
    const secret = text("secret");
    const random = isUnset(args["random"]) ? {} : { random: text("random") };
    const signature = bip340.sign(secret, { message, ...random });
    return result({ operation, signature, publicKey: bip340.getPublicKey(secret) });
  }
  const publicKey = text("publicKey");
  const valid = bip340.verify(text("signature"), { message, publicKey });
  return result({ operation, valid });
}

/** The arguments each Ed25519 operation takes. */
const ED25519_ARGUMENTS: Readonly<Record<Ed25519Operation, readonly string[]>> = {
  keypair: ["secret"],
  sign: ["secret", "message"],
  verify: ["publicKey", "message", "signature", "zip215"],
};

/** Every optional argument of the Ed25519 tool. */
const ED25519_OPTIONAL = [...new Set(Object.values(ED25519_ARGUMENTS).flat())];

/**
 * Read zip215, true when missing.
 * @param value - Raw argument
 * @returns {boolean} Whether ZIP 215's rules apply
 */
function zip215(value: unknown): boolean {
  const flag = value ?? true;
  if (typeof flag !== "boolean") throw new TypeError("zip215 must be a boolean");
  return flag;
}

/**
 * Derive an Ed25519 public key, sign by RFC 8032, or verify under ZIP 215's rules, or the strict
 * ones when zip215 is false.
 * @param args - Tool arguments, the operation and the ones it takes
 * @returns {ToolResult<Ed25519Details>} The public key, the signature with its key, or the verdict
 */
export function computeEd25519(
  args: Readonly<Record<string, unknown>>,
): ToolResult<Ed25519Details> {
  const operation = oneOf(args["operation"], "operation", ED25519_OPERATIONS);
  refuseForeign(args, operation, ED25519_OPTIONAL, ED25519_ARGUMENTS[operation]);
  const text = (name: string): string => {
    if (isUnset(args[name])) throw new TypeError(`${operation} needs ${name}`);
    return requiredString(args[name], name);
  };
  if (operation === "keypair") {
    return result({ operation, publicKey: ed25519.getPublicKey(text("secret")) });
  }
  const message = signedMessage(args, operation);
  if (operation === "sign") {
    const secret = text("secret");
    const signature = ed25519.sign(secret, { message });
    return result({ operation, signature, publicKey: ed25519.getPublicKey(secret) });
  }
  const publicKey = text("publicKey");
  const rules = zip215(args["zip215"]);
  const valid = ed25519.verify(text("signature"), { message, publicKey, zip215: rules });
  return result({ operation, valid });
}

/** The arguments each sr25519 operation takes. */
const SR25519_ARGUMENTS: Readonly<Record<Sr25519Operation, readonly string[]>> = {
  keypair: ["seed", "secret"],
  sign: ["secret", "message", "encoding", "context", "random"],
  verify: ["publicKey", "message", "encoding", "signature", "context"],
  derive: ["seed", "secret", "publicKey", "chainCode", "hard", "random"],
};

/** Every optional argument of the sr25519 tool. */
const SR25519_OPTIONAL = [...new Set(Object.values(SR25519_ARGUMENTS).flat())];

/** The keys derive starts from, exactly one a call. */
const DERIVE_SOURCES = ["seed", "secret", "publicKey"] as const;

/** The sr25519 tool's arguments, read for one operation. */
interface Sr25519Arguments {
  readonly operation: Sr25519Operation;
  readonly has: (name: string) => boolean;
  readonly text: (name: string) => string;
}

/**
 * Read the arguments of one sr25519 operation.
 * @param args - Tool arguments
 * @returns {Sr25519Arguments} The operation and readers for the rest
 */
function sr25519Arguments(args: Readonly<Record<string, unknown>>): Sr25519Arguments {
  const operation = oneOf(args["operation"], "operation", SR25519_OPERATIONS);
  refuseForeign(args, operation, SR25519_OPTIONAL, SR25519_ARGUMENTS[operation]);
  const has = (name: string): boolean => !isUnset(args[name]);
  const text = (name: string): string => {
    if (!has(name)) throw new TypeError(`${operation} needs ${name}`);
    return requiredString(args[name], name);
  };
  return { operation, has, text };
}

/**
 * Read the message as bytes. Required, so a blank one is the empty message, not a missing one.
 * @param args - Tool arguments
 * @param input - The readers of the operation
 * @returns {Uint8Array} The message
 */
function messageBytes(
  args: Readonly<Record<string, unknown>>,
  input: Sr25519Arguments,
): Uint8Array {
  const message = args["message"];
  if (message === undefined) throw new TypeError(`${input.operation} needs message`);
  if (typeof message !== "string") throw new TypeError("message must be a string");
  const encoding = input.has("encoding")
    ? oneOf(args["encoding"], "encoding", MESSAGE_ENCODINGS)
    : "utf8";
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new RangeError(`message must be at most ${MAX_MESSAGE_LENGTH} characters`);
  }
  if (encoding === "utf8") return new TextEncoder().encode(message);
  const bytes = hexToBytes(message);
  if (bytes === undefined)
    throw new RangeError("message must be hex without 0x, two digits a byte");
  return bytes;
}

/**
 * Read the optional context and random bytes.
 * @param input - The readers of the operation
 * @returns {{ context?: string; random?: string }} The options the library takes
 */
function sr25519Options(input: Sr25519Arguments): { context?: string; random?: string } {
  if (input.has("context") && input.text("context").length > MAX_CONTEXT_LENGTH) {
    throw new RangeError(`context must be at most ${MAX_CONTEXT_LENGTH} characters`);
  }
  return {
    ...(input.has("context") ? { context: input.text("context") } : {}),
    ...(input.has("random") ? { random: input.text("random") } : {}),
  };
}

/**
 * Make a key pair from a seed, or the public key of a secret.
 * @param input - The readers of the operation
 * @returns {Sr25519Details} The new secret and its public key, or the public key alone
 */
function sr25519Keypair(input: Sr25519Arguments): Sr25519Details {
  if (input.has("seed") === input.has("secret")) {
    throw new TypeError("keypair needs seed or secret, one of them");
  }
  if (input.has("secret")) {
    return { operation: "keypair", publicKey: sr25519.getPublicKey(input.text("secret")) };
  }
  const secret = sr25519.expandSeed(input.text("seed"));
  return { operation: "keypair", secret, publicKey: sr25519.getPublicKey(secret) };
}

/** One derive call: its readers, the kind of child and the chain code. */
interface DeriveCall {
  readonly input: Sr25519Arguments;
  readonly hard: boolean;
  readonly chainCode: string;
}

/**
 * Derive the soft child of a public key, the one kind of child a public key has.
 * @param call - The derive call
 * @returns {Sr25519Details} The child public key
 */
function derivePublicChild(call: DeriveCall): Sr25519Details {
  const { input, hard, chainCode } = call;
  if (hard) throw new RangeError("A hard child needs the seed or the secret, not the public key");
  if (input.has("random")) throw new RangeError("derive from publicKey does not take random");
  const publicKey = sr25519.derivePublic(input.text("publicKey"), chainCode);
  return { operation: "derive", hard, publicKey };
}

/**
 * Derive a child of a secret.
 * @param call - The derive call
 * @param parent - The parent secret
 * @returns {Sr25519Details} The child secret and public key
 */
function deriveSecretChild(call: DeriveCall, parent: string): Sr25519Details {
  const { input, hard, chainCode } = call;
  const secret = hard
    ? sr25519.deriveHard(parent, chainCode)
    : sr25519.deriveSoft(parent, chainCode, sr25519Options(input));
  return { operation: "derive", hard, secret, publicKey: sr25519.getPublicKey(secret) };
}

/**
 * Derive a child of a seed: a hard one keeps a seed, as in subkey, a soft one has none.
 * @param call - The derive call
 * @returns {Sr25519Details} The child seed when hard, its secret and public key
 */
function deriveSeedChild(call: DeriveCall): Sr25519Details {
  const parent = call.input.text("seed");
  if (!call.hard) return deriveSecretChild(call, sr25519.expandSeed(parent));
  const seed = sr25519.deriveHardSeed(parent, call.chainCode);
  const secret = sr25519.expandSeed(seed);
  return { operation: "derive", hard: true, seed, secret, publicKey: sr25519.getPublicKey(secret) };
}

/**
 * Derive a child of a seed or a secret, or the soft child of a public key.
 * @param args - Tool arguments
 * @param input - The readers of the operation
 * @returns {Sr25519Details} The child keys, or the public key alone
 */
function sr25519Derive(
  args: Readonly<Record<string, unknown>>,
  input: Sr25519Arguments,
): Sr25519Details {
  const hard = args["hard"] ?? false;
  if (typeof hard !== "boolean") throw new TypeError("hard must be a boolean");
  if (DERIVE_SOURCES.filter((name) => input.has(name)).length !== 1) {
    throw new TypeError("derive needs seed, secret or publicKey, one of them");
  }
  const call = { input, hard, chainCode: input.text("chainCode") };
  if (input.has("publicKey")) return derivePublicChild(call);
  if (hard && input.has("random")) throw new RangeError("A hard child takes no random");
  if (input.has("seed")) return deriveSeedChild(call);
  return deriveSecretChild(call, input.text("secret"));
}

/**
 * Make sr25519 keys from a seed, sign, verify, or derive children as Substrate does.
 * @param args - Tool arguments, the operation and the ones it takes
 * @returns {ToolResult<Sr25519Details>} The keys, the signature, the verdict or the child
 */
export function computeSr25519(
  args: Readonly<Record<string, unknown>>,
): ToolResult<Sr25519Details> {
  const input = sr25519Arguments(args);
  if (input.operation === "keypair") return result(sr25519Keypair(input));
  if (input.operation === "derive") return result(sr25519Derive(args, input));
  const message = messageBytes(args, input);
  if (input.operation === "verify") {
    const valid = sr25519.verify(
      input.text("signature"),
      message,
      input.text("publicKey"),
      sr25519Options(input),
    );
    return result({ operation: "verify", valid });
  }
  const secret = input.text("secret");
  const signature = sr25519.sign(secret, message, sr25519Options(input));
  return result({ operation: "sign", signature, publicKey: sr25519.getPublicKey(secret) });
}
