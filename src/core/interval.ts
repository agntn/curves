import {
  add,
  checkedCurve,
  multiply,
  onCurve,
  type AffinePoint,
  type CurvePoint,
  type WeierstrassCurve,
} from "./arithmetic.ts";
import { invert, mod, squareRoot } from "./field.ts";
import { MAX_INTERVAL_TABLE } from "./limits.ts";

/** The points of a log and the scalars `discreteLogInInterval` tries for it. */
export interface IntervalLogOptions {
  /** The point that gets multiplied, or null for infinity. */
  readonly base: CurvePoint;
  /** The point to reach, or null for infinity. */
  readonly target: CurvePoint;
  /** The smallest scalar tried. Negative works. */
  readonly lo: bigint;
  /** The largest scalar tried, itself included. */
  readonly hi: bigint;
  /** Try only scalars with this remainder mod `modulus`. Comes with `modulus`. */
  readonly residue?: bigint;
  /** 1 or more. Comes with `residue`. */
  readonly modulus?: bigint;
  /** Most points to tabulate, from 1 to `MAX_INTERVAL_TABLE`, which is the default. */
  readonly tableLimit?: number;
}

/** The scalars to try: first, first + stride and so on, count of them. */
interface Scope {
  readonly first: bigint;
  readonly stride: bigint;
  readonly count: bigint;
}

/** The points start + i times step, for i from 0 to count minus 1. */
interface Line {
  readonly start: CurvePoint;
  readonly step: CurvePoint;
  readonly count: number;
}

/** A point of a line and its i. */
interface Stop {
  readonly point: CurvePoint;
  readonly index: number;
}

/** How many points of a line share one inversion. */
const BLOCK = 256;

/**
 * Name a point for the table: x and the parity of y, which no two points share.
 * @param point - A point or null for infinity
 * @returns {bigint} The name, -1 for infinity
 */
function pointName(point: Readonly<CurvePoint>): bigint {
  return point === null ? -1n : (point.x << 1n) | (point.y & 1n);
}

/**
 * Refuse anything but a bigint, since a Number above 2^53 has already lost digits.
 * @param value - What the caller passed
 * @param name - The option, for the message
 * @returns {bigint} The value
 */
function readBigint(value: unknown, name: string): bigint {
  if (typeof value !== "bigint") throw new TypeError(`${name} must be a bigint`);
  return value;
}

/**
 * Read the residue class, or every integer when the caller names none.
 * @param options - What the caller passed
 * @returns {{ residue: bigint; stride: bigint }} Any member of the class and the gap to the next
 */
function readClass(options: Readonly<IntervalLogOptions>): { residue: bigint; stride: bigint } {
  if (options.residue === undefined && options.modulus === undefined) {
    return { residue: 0n, stride: 1n };
  }
  if (options.residue === undefined || options.modulus === undefined) {
    throw new TypeError("residue and modulus come together");
  }
  const stride = readBigint(options.modulus, "modulus");
  if (stride < 1n) throw new RangeError("modulus must be 1 or more");
  return { residue: readBigint(options.residue, "residue"), stride };
}

/**
 * Line up the scalars to try: the ones from lo to hi in the residue class.
 * @param options - What the caller passed
 * @returns {Scope} The first scalar, the gap to the next and how many there are
 */
function readScope(options: Readonly<IntervalLogOptions>): Scope {
  const lo = readBigint(options.lo, "lo");
  const hi = readBigint(options.hi, "hi");
  if (lo > hi) throw new RangeError("lo must not pass hi");
  const { residue, stride } = readClass(options);
  const first = lo + mod(residue - lo, stride);
  return { first, stride, count: first > hi ? 0n : (hi - first) / stride + 1n };
}

/**
 * Refuse a point that is missing or off the curve.
 * @param curve - A checked curve
 * @param point - What the caller passed
 * @param name - What the error calls the point
 * @returns {CurvePoint} A point of the curve
 */
function readPoint(
  curve: Readonly<WeierstrassCurve>,
  point: Readonly<CurvePoint> | undefined,
  name: string,
): CurvePoint {
  if (point === undefined) throw new TypeError(`${name} is missing; null stands for infinity`);
  return onCurve(curve, point, name);
}

/**
 * Size the table, refusing a search the limit cannot hold.
 * @param count - How many scalars to try, 1 or more
 * @param limit - `tableLimit` as the caller passed it
 * @returns {number} The square root of the count, rounded up
 */
function tableSize(count: bigint, limit: number | undefined = MAX_INTERVAL_TABLE): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_INTERVAL_TABLE) {
    throw new RangeError(`tableLimit must be an integer from 1 to ${MAX_INTERVAL_TABLE}`);
  }
  const root = squareRoot(count - 1n) + 1n;
  if (root > BigInt(limit)) {
    throw new RangeError(
      `The interval holds ${count} scalars to try, and a table of ${limit} points covers ${BigInt(limit) ** 2n}; narrow it or split it`,
    );
  }
  return Number(root);
}

/**
 * Invert every value mod p for the price of one inversion, by Montgomery's trick.
 * @param values - Each from 0 to p minus 1
 * @param p - The field prime
 * @returns {bigint[]} The inverses, with 0 left where a value was 0
 */
function invertAll(values: readonly bigint[], p: bigint): bigint[] {
  const before: bigint[] = [];
  let product = 1n;
  for (const value of values) {
    before.push(product);
    if (value !== 0n) product = (product * value) % p;
  }
  let inverse = invert(product, p);
  const inverses = values.map(() => 0n);
  for (const [index, value] of [...values.entries()].toReversed()) {
    if (value !== 0n) {
      inverses[index] = (inverse * (before[index] ?? 1n)) % p;
      inverse = (inverse * value) % p;
    }
  }
  return inverses;
}

/**
 * Add two points with different x, given the inverse of the gap between them.
 * @param left - A finite point
 * @param right - A finite point with another x
 * @param p - The field prime
 * @param inverse - The inverse of right.x minus left.x
 * @returns {AffinePoint} The sum
 */
function chord(
  left: Readonly<AffinePoint>,
  right: Readonly<AffinePoint>,
  p: bigint,
  inverse: bigint,
): AffinePoint {
  const slope = ((right.y - left.y) * inverse) % p;
  const x = mod(slope * slope - left.x - right.x, p);
  return { x, y: mod(slope * (left.x - x) - left.y, p) };
}

/**
 * Add one point to each of a list, sharing a single inversion between the sums.
 * @param curve - A checked curve
 * @param anchor - A point of the curve
 * @param offsets - Points of the curve
 * @returns {CurvePoint[]} The anchor plus each offset, in order
 */
function addToEach(
  curve: Readonly<WeierstrassCurve>,
  anchor: Readonly<CurvePoint>,
  offsets: readonly Readonly<CurvePoint>[],
): CurvePoint[] {
  if (anchor === null) return [...offsets];
  const gaps = offsets.map((offset) => (offset === null ? 0n : mod(offset.x - anchor.x, curve.p)));
  const inverses = invertAll(gaps, curve.p);
  return offsets.map((offset, index) => {
    const inverse = inverses[index] ?? 0n;
    if (offset === null || inverse === 0n) return add(curve, anchor, offset);
    return chord(anchor, offset, curve.p, inverse);
  });
}

/**
 * Walk a line in order and stop at the first point the visitor takes.
 * @param curve - A checked curve
 * @param line - Where the walk starts, its step and how many points it has
 * @param visit - Takes a point and its i, and answers true to stop there
 * @returns {Stop | undefined} The point the walk stopped at, undefined when it ran out
 */
function walk(
  curve: Readonly<WeierstrassCurve>,
  line: Readonly<Line>,
  visit: (point: Readonly<CurvePoint>, index: number) => boolean,
): Stop | undefined {
  const offsets: CurvePoint[] = [];
  let jump: CurvePoint = null;
  for (let index = 0; index < Math.min(BLOCK, line.count); index += 1) {
    offsets.push(jump);
    jump = add(curve, jump, line.step);
  }
  let anchor = line.start;
  for (let done = 0; done < line.count; done += offsets.length) {
    const points = addToEach(curve, anchor, offsets).slice(0, line.count - done);
    const at = points.findIndex((point, index) => visit(point, done + index));
    if (at !== -1) return { point: points[at] ?? null, index: done + at };
    anchor = add(curve, anchor, jump);
  }
  return undefined;
}

/**
 * Find the smallest j of 0 or more with j times the step equal to the rest.
 * @param curve - A checked curve
 * @param search - The step, the rest, and the table size the scalars to try need
 * @returns {bigint | undefined} j, which may pass the scalars asked for, or undefined
 */
function stepsTo(
  curve: Readonly<WeierstrassCurve>,
  search: Readonly<{ step: CurvePoint; rest: CurvePoint; size: number; count: bigint }>,
): bigint | undefined {
  const { step, rest, size } = search;
  const table = new Map<bigint, number>();
  const lapped = walk(curve, { start: null, step, count: size }, (point, index) => {
    const name = pointName(point);
    if (table.has(name)) return true;
    table.set(name, index);
    return false;
  });
  if (lapped !== undefined) {
    const index = table.get(pointName(rest));
    return index === undefined ? undefined : BigInt(index);
  }
  const rounds = Number((search.count - 1n) / BigInt(size)) + 1;
  const giant = multiply(curve, step, BigInt(-size));
  const hit = walk(curve, { start: rest, step: giant, count: rounds }, (point) =>
    table.has(pointName(point)),
  );
  if (hit === undefined) return undefined;
  return BigInt(hit.index) * BigInt(size) + BigInt(table.get(pointName(hit.point)) ?? 0);
}

/**
 * Find the smallest k from lo to hi with k times the base equal to the target.
 * @param curve - From `defineCurve`, or parameters it accepts
 * @param options - The base, the target, lo and hi, and a residue class to stay in
 * @returns {bigint | undefined} k, or undefined when no scalar asked for fits
 * @throws {RangeError} When a point is off the curve, lo passes hi or the table is too small
 * @throws {TypeError} When a point or a bound is missing, or residue comes without modulus
 */
export function discreteLogInInterval(
  curve: Readonly<WeierstrassCurve>,
  options: Readonly<IntervalLogOptions>,
): bigint | undefined {
  const checkedOne = checkedCurve(curve);
  if (typeof options !== "object" || options === null) {
    throw new TypeError("discreteLogInInterval takes { base, target, lo, hi }");
  }
  const base = readPoint(checkedOne, options.base, "The base");
  const target = readPoint(checkedOne, options.target, "The target");
  const { first, stride, count } = readScope(options);
  if (count === 0n) return undefined;
  const size = tableSize(count, options.tableLimit);
  const step = multiply(checkedOne, base, stride);
  const rest = add(checkedOne, target, multiply(checkedOne, base, -first));
  const index = stepsTo(checkedOne, { step, rest, size, count });
  if (index === undefined || index >= count) return undefined;
  const scalar = first + stride * index;
  if (pointName(multiply(checkedOne, base, scalar)) !== pointName(target)) {
    throw new Error(`The search answered ${scalar}, which does not give the target`);
  }
  return scalar;
}
