import {
  countPoints,
  defineCurve,
  discreteLog,
  listPoints,
  multiplyPoint,
  pointOrder,
  type AffinePoint,
  type WeierstrassCurve,
} from "@agntn/curves";

/** What the landing needs to know about one small curve before the library has run. */
interface CurveSpec {
  readonly key: string;
  readonly a: bigint;
  readonly b: bigint;
  readonly p: bigint;
  /** The base; the first point of the largest order when left out. */
  readonly base?: AffinePoint;
  /** How many times the walk adds the base, below its order. */
  readonly scalar: bigint;
  /** One sentence for the subject band. */
  readonly about: string;
}

/** The curves the landing walks, each small enough to draw every point of. */
const SPECS: readonly CurveSpec[] = [
  {
    key: "paar",
    a: 2n,
    b: 2n,
    p: 17n,
    base: { x: 5n, y: 1n },
    scalar: 13n,
    about: "The textbook curve from Paar and Pelzl. Nineteen points, and every one but infinity generates the rest.",
  },
  {
    key: "secp97",
    a: 0n,
    b: 7n,
    p: 97n,
    scalar: 42n,
    about: "secp256k1's own equation, over a field you could count on paper.",
  },
  {
    key: "nist101",
    a: -3n,
    b: 5n,
    p: 101n,
    scalar: 77n,
    about: "a = -3, the shape the NIST curves picked. Reduced mod p, so it's really 98.",
  },
  {
    key: "f23",
    a: 1n,
    b: 1n,
    p: 23n,
    scalar: 9n,
    about: "Twenty-eight points over F23. Small enough to check every one by hand.",
  },
  {
    key: "prime89",
    a: 7n,
    b: 11n,
    p: 89n,
    scalar: 61n,
    about: "A prime number of points, so no subgroup to hide in. The kind a log is supposed to be hard on.",
  },
];

/** One curve the landing draws, with everything the library said about it. */
export interface CurveSample {
  readonly key: string;
  readonly curve: WeierstrassCurve;
  /** a as written, so -3 stays -3 in a call. */
  readonly a: bigint;
  readonly about: string;
  /** Every point but infinity, by x then y. */
  readonly points: readonly AffinePoint[];
  /** The group order, infinity included. */
  readonly count: bigint;
  readonly base: AffinePoint;
  readonly order: bigint;
  readonly scalar: bigint;
  /** base, 2 base and on to scalar times base. */
  readonly walk: readonly AffinePoint[];
  readonly target: AffinePoint;
  /** What `discreteLog` finds for the target, which is the scalar. */
  readonly log: bigint;
}

/**
 * Runs the library over one spec: the points, the base, the walk and the log back.
 *
 * @param spec - The curve and the scalar.
 * @returns {CurveSample} The sample.
 */
function sample(spec: CurveSpec): CurveSample {
  const curve = defineCurve(spec);
  const points = listPoints(curve);
  const base =
    spec.base ??
    points.reduce((best, point) => (pointOrder(curve, point) > pointOrder(curve, best) ? point : best));
  const walk: AffinePoint[] = [];
  for (let k = 1n; k <= spec.scalar; k += 1n) {
    const point = multiplyPoint(curve, base, k);
    if (point === null) throw new Error(`${spec.key}: ${k} times the base is infinity`);
    walk.push(point);
  }
  const target = walk.at(-1)!;
  const log = discreteLog(curve, base, target);
  if (log === undefined) throw new Error(`${spec.key}: no log for the target`);
  return {
    key: spec.key,
    curve,
    a: spec.a,
    about: spec.about,
    points,
    count: countPoints(curve),
    base,
    order: pointOrder(curve, base),
    scalar: spec.scalar,
    walk,
    target,
    log,
  };
}

/** Every sample, computed once when the module loads, at build and in the tab alike. */
export const CURVES: readonly CurveSample[] = SPECS.map(sample);

/** The equation as a heading writes it: `y² = x³ + 2x + 2`. */
export function equation(sample: Readonly<Pick<CurveSample, "a" | "curve">>): string {
  const a = sample.a === 0n ? "" : ` ${sample.a < 0n ? "-" : "+"} ${sample.a === 1n || sample.a === -1n ? "" : String(sample.a < 0n ? -sample.a : sample.a)}x`;
  const b = sample.curve.b === 0n ? "" : ` + ${sample.curve.b}`;
  return `y² = x³${a}${b}`;
}

/** A point as the page writes it: `(5, 1)`. */
export function pointText(point: Readonly<AffinePoint> | null): string {
  return point === null ? "infinity" : `(${point.x}, ${point.y})`;
}

/** A point as the tool takes it: decimal strings. */
export function pointArgument(point: Readonly<AffinePoint>): { x: string; y: string } {
  return { x: String(point.x), y: String(point.y) };
}
