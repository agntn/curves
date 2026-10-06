import { invertScalar, multiplyGenerator } from "@agntn/curves/secp256k1";
import { computeSecp256k1, type Secp256k1Details } from "#tool-operations";

/** G as compressed SEC1. */
export const G = multiplyGenerator("1");

/** One call of `curves_secp256k1_compute` the landing shows. */
export interface SecpSample {
  readonly key: string;
  /** What the call finds, as a heading. */
  readonly title: string;
  readonly note: string;
  readonly params: Readonly<Record<string, string>>;
  readonly details: Secp256k1Details;
  /** `content[0].text`, what a model reads. */
  readonly text: string;
}

const CALLS: readonly Omit<SecpSample, "details" | "text">[] = [
  {
    key: "three",
    title: "Three times G",
    note: "The usual first check. 02f930… if your arithmetic is right.",
    params: { operation: "multiply", point: G, scalar: "3" },
  },
  {
    key: "half",
    title: "Half of G",
    note: "G times the inverse of 2 mod n. Count the zeros in x. Funny, right?",
    params: { operation: "multiply", point: G, scalar: invertScalar(2n) },
  },
  {
    key: "lift",
    title: "Both points above x",
    note: "An x-only BIP340 key stands for the even one.",
    params: { operation: "lift", x: G.slice(2) },
  },
  {
    key: "add",
    title: "G plus 2G",
    note: "Two public keys in, their sum out. Split key vanity addresses work like this.",
    params: { operation: "add", point: G, other: multiplyGenerator("2") },
  },
  {
    key: "negate",
    title: "Minus G",
    note: "Same x, the other y. Only the prefix changes.",
    params: { operation: "negate", point: G },
  },
];

/** Every sample, run through the executor `curves mcp` runs. */
export const SECP_SAMPLES: readonly SecpSample[] = CALLS.map((call) => {
  const result = computeSecp256k1(call.params);
  return { ...call, details: result.details, text: result.content[0]!.text };
});

/** A SEC1 point cut for a row: prefix, start and end of x. */
export function shortPoint(point: string): string {
  return point.length > 20 ? `${point.slice(0, 10)}…${point.slice(-6)}` : point;
}
