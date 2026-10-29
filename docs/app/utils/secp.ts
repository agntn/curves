import { invertScalar, multiplyGenerator } from "@agntn/curves/secp256k1";
import { computeSecp256k1, type Secp256k1Details } from "#tool-operations";

/** G as compressed SEC1. */
export const G = multiplyGenerator("1");

/** Block 170, input 0: Satoshi's key, the sighash it signs and the signature that paid Hal. */
export const BLOCK_170 = {
  key: "0411db93e1dcdb8a016b49840f8c53bc1eb68a382e97b1482ecad7b148a6909a5cb2e0eaddfb84ccf9744464f82e160bfa9b8b64f9d4c03f999b8643f656b412a3",
  digest: "7a05c6145f10101e9d6325494245adf1297d80f8f38d4d576d57cdba220bcb19",
  signature:
    "4e45e16932b8af514961a1d3a1a25fdf3f4f7732e9d624c6c61548ab5fb8cd41181522ec8eca07de4860a4acdd12909d831cc56cbbac4622082221a8768d1d09",
  recovery: 1,
} as const;

/** One call of `curves_secp256k1_compute` the landing shows. */
export interface SecpSample {
  readonly key: string;
  /** What the call finds, as a heading. */
  readonly title: string;
  readonly note: string;
  readonly params: Readonly<Record<string, string | number>>;
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
  {
    key: "recover",
    title: "Satoshi's key, recovered",
    note: "Block 170, 12 January 2009: Satoshi paid Hal Finney 10 BTC. Recovery id 1 finds Satoshi's.",
    params: { operation: "recover", digest: BLOCK_170.digest, signature: BLOCK_170.signature, recovery: BLOCK_170.recovery },
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
