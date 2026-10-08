/** The curve tools, declared once for every surface. Executors load on the first call. */

import {
  defineTool,
  Type,
  type TObject,
  type TOptional,
  type TString,
  type ToolDefinition,
} from "@agntn/tools";
import {
  CURVE_INTEGER_PATTERN,
  CURVE_OPERATIONS,
  DEFAULT_CURVE_POINTS_SHOWN,
  MAX_COUNTED_PRIME,
  MAX_CURVE_INTEGER_LENGTH,
  MAX_CONTEXT_LENGTH,
  MAX_CURVE_POINTS_SHOWN,
  MAX_FILTERED_PRIME,
  MAX_LOG_ORDER,
  MAX_MESSAGE_LENGTH,
  MAX_ORDER_PRIME,
  MESSAGE_ENCODINGS,
  SEC1_PATTERN,
  SECP256K1_OPERATIONS,
  SR25519_OPERATIONS,
} from "./tool-contract.ts";

type ToolOperations = typeof import("./tool-operations.ts");

let operations: Promise<ToolOperations> | undefined;

/**
 * Loads the executors once. A failed load isn't cached, so a broken `dist` doesn't stick.
 *
 * @returns {Promise<ToolOperations>} The executors.
 */
export function loadOperations(): Promise<ToolOperations> {
  operations ??= import("./tool-operations.ts").catch((error: unknown) => {
    operations = undefined;
    throw error;
  });
  return operations;
}

/**
 * Integer argument of the curve tool, decimal or 0x hex.
 * @param description - What the integer is
 * @returns {TString} The argument
 */
function curveInteger(description: string): TString {
  return Type.String({
    maxLength: MAX_CURVE_INTEGER_LENGTH,
    pattern: `^${CURVE_INTEGER_PATTERN}$`,
    description: `${description}. Decimal, or hex with 0x`,
  });
}

/**
 * Optional integer argument of the curve tool, where a blank stands for none.
 * @param description - What the integer is
 * @returns {TOptional<TString>} The argument
 */
function optionalCurveInteger(description: string): TOptional<TString> {
  return Type.Optional(
    Type.String({
      maxLength: MAX_CURVE_INTEGER_LENGTH,
      pattern: `^(?:${CURVE_INTEGER_PATTERN})?$`,
      description,
    }),
  );
}

/**
 * Point argument of the curve tool.
 * @param description - The operations that take it
 * @returns {TOptional<TObject<{ x: TString; y: TString }>>} The optional argument
 */
function curvePoint(description: string): TOptional<TObject<{ x: TString; y: TString }>> {
  return Type.Optional(
    Type.Object(
      { x: curveInteger("x, from 0 to p - 1"), y: curveInteger("y, from 0 to p - 1") },
      {
        additionalProperties: false,
        description: `${description}. A finite point; the point at infinity comes back as "infinity" and does not go in`,
      },
    ),
  );
}

/**
 * SEC1 point argument of the secp256k1 tool.
 * @param description - The operations that take it
 * @returns {TOptional<TString>} The optional argument
 */
function sec1Point(description: string): TOptional<TString> {
  return Type.Optional(
    Type.String({
      maxLength: 130,
      pattern: `^(?:${SEC1_PATTERN})?$`,
      description: `${description}. Compressed or uncompressed SEC1 hex, without 0x`,
    }),
  );
}

export const computeSchema = Type.Object(
  {
    operation: Type.String({
      enum: [...CURVE_OPERATIONS],
      description:
        "add takes point and other, double, negate and order take point, multiply takes point and scalar, lift takes x and lists the points above it, check takes point and answers whether it lies on the curve, count counts the points, points lists them, log takes point as the base and other as the target",
    }),
    a: curveInteger("a in y^2 = x^3 + ax + b, reduced mod p, so -3 works"),
    b: curveInteger("b in y^2 = x^3 + ax + b, reduced mod p"),
    p: curveInteger("The field prime, above 3"),
    point: curvePoint(
      "Every operation but lift, count and points, required there; the base for log",
    ),
    other: curvePoint("add and log only, required there; the target for log"),
    scalar: optionalCurveInteger(
      "multiply only, required there: any integer, decimal or hex with 0x. A negative one multiplies the negation",
    ),
    x: optionalCurveInteger(
      "lift only, required there: the x coordinate, from 0 to p - 1, decimal or hex with 0x. No limit on p, unlike count and points",
    ),
    order: optionalCurveInteger(
      `points only: list just the points of exactly this order, 1 or more. Takes p up to ${MAX_FILTERED_PRIME}`,
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: MAX_CURVE_POINTS_SHOWN,
        description: `points only: most points to list, from 1 to ${MAX_CURVE_POINTS_SHOWN}. Default: ${DEFAULT_CURVE_POINTS_SHOWN}`,
      }),
    ),
  },
  { additionalProperties: false },
);

export const computeTool = defineTool({
  name: "curves_compute",
  title: "Compute on a Curve",
  description: `Do arithmetic on a short Weierstrass curve y^2 = x^3 + ax + b over a prime field the caller gives: add, double, negate or multiply points, lift an x coordinate to the points above it, check a point, find the order of a point, count the points, list them, or find a discrete log. Integers go in as decimal or 0x hex strings and come out as decimal strings; the point at infinity comes out as "infinity". count and points take p up to ${MAX_COUNTED_PRIME}, or ${MAX_FILTERED_PRIME} when points filters by order. order and log take p up to ${MAX_ORDER_PRIME}, and log a base whose order has no prime factor above ${MAX_LOG_ORDER}. Public math only; secp256k1 with SEC1 points has curves_secp256k1_compute.`,
  snippet:
    "Use for toy curves over small prime fields, points of a given order and discrete logs, smooth orders included, and for lifting an x on a curve of any size.",
  guidelines: [
    "add takes point and other; double, negate, check and order take point",
    "multiply takes point and scalar, any integer",
    "lift takes x and lists the points with that x, smaller y first, none when x has no point; pick the y a compressed point's parity asks for",
    "count gives the group order with infinity; points lists by x then y, optionally of one order",
    "log takes point as the base and other as the target, and answers scalar null when there is no k",
  ],
  effect: "read",
  cli: {
    description:
      "Arithmetic on y^2 = x^3 + ax + b over a prime field: points, orders, counts and discrete logs",
    positional: ["operation"],
  },
  input: computeSchema,
  execute: async (params) => (await loadOperations()).computeCurve(params),
});

export const secp256k1ComputeSchema = Type.Object(
  {
    operation: Type.String({
      enum: [...SECP256K1_OPERATIONS],
      description:
        "add and subtract take point and other, negate takes point, multiply takes point and scalar, lift takes x, check takes point and answers whether it lies on the curve",
    }),
    point: sec1Point("Every operation but lift, required there"),
    other: sec1Point(
      "add and subtract only, required there: the point added to point or subtracted from it",
    ),
    scalar: Type.Optional(
      Type.String({
        maxLength: 64,
        pattern: "^[0-9A-Fa-f]{0,64}$",
        description:
          "multiply only, required there: 1 to n - 1 as hex without 0x. It enters the transcript, so pass a public tweak or a disposable key",
      }),
    ),
    x: Type.Optional(
      Type.String({
        maxLength: 64,
        pattern: "^(?:[0-9A-Fa-f]{64})?$",
        description:
          "lift only, required there: x coordinate as 64 hex digits. The even point is the full key of a BIP340 x-only key",
      }),
    ),
    compressed: Type.Optional(
      Type.Boolean({
        description: "Output SEC1 encoding, for every operation but check. Default: true",
      }),
    ),
  },
  { additionalProperties: false },
);

export const secp256k1ComputeTool = defineTool({
  name: "curves_secp256k1_compute",
  title: "Compute on secp256k1",
  description:
    "Do curve math on public secp256k1 points: add or subtract two points, negate one, multiply one by a scalar, lift an x coordinate to both points, or check that a point lies on the curve. Points go in and come out as SEC1 hex. A sum that lands on the point at infinity is refused. The scalar enters the transcript, and multiplying G by a private key gives its public key, so pass only public tweaks or disposable keys.",
  snippet: "Use for split key vanity addresses, offsets between known public keys and x-only keys.",
  guidelines: [
    "add and subtract take point and other; negate takes point",
    "multiply takes point and scalar, hex from 1 to n - 1",
    "lift takes x and returns the even and the odd point; the even one is the BIP340 key",
    "check takes point and answers onCurve true or false",
  ],
  effect: "read",
  cli: {
    command: "secp256k1",
    description: "Point math on secp256k1 with SEC1 hex points",
    positional: ["operation"],
  },
  input: secp256k1ComputeSchema,
  execute: async (params) => (await loadOperations()).computeSecp256k1(params),
});

/**
 * Hex argument of the sr25519 tool, of one byte length.
 * @param bytes - The byte count
 * @param description - What it is and which operations take it
 * @returns {TOptional<TString>} The optional argument
 */
function sr25519Hex(bytes: number, description: string): TOptional<TString> {
  return Type.Optional(
    Type.String({
      maxLength: bytes * 2,
      pattern: `^(?:[0-9A-Fa-f]{${bytes * 2}})?$`,
      description: `${description}. ${bytes * 2} hex digits without 0x`,
    }),
  );
}

export const sr25519ComputeSchema = Type.Object(
  {
    operation: Type.String({
      enum: [...SR25519_OPERATIONS],
      description:
        "keypair takes seed or secret, sign takes secret and message, verify takes publicKey, message and signature, derive takes chainCode with secret or publicKey",
    }),
    seed: sr25519Hex(
      32,
      "keypair only: the 32-byte mini secret Substrate keeps, which expands into a secret",
    ),
    secret: sr25519Hex(
      64,
      "keypair, sign and derive: the 64-byte secret, the key as schnorrkel writes it for ed25519, then the nonce",
    ),
    publicKey: sr25519Hex(32, "verify, required there, and derive: a ristretto255 public key"),
    message: Type.Optional(
      Type.String({
        maxLength: MAX_MESSAGE_LENGTH,
        description: "sign and verify only, required there: the signed bytes, read by encoding",
      }),
    ),
    encoding: Type.Optional(
      Type.String({
        enum: [...MESSAGE_ENCODINGS],
        description:
          "sign and verify only: utf8 reads message as text, hex as bytes. Default: utf8",
      }),
    ),
    signature: sr25519Hex(64, "verify only, required there: the signature with its marker bit"),
    context: Type.Optional(
      Type.String({
        maxLength: MAX_CONTEXT_LENGTH,
        description: 'sign and verify only: the schnorrkel signing context. Default: "substrate"',
      }),
    ),
    chainCode: sr25519Hex(
      32,
      "derive only, required there: the chain code Substrate builds from a junction, its SCALE encoding padded or hashed to 32 bytes",
    ),
    hard: Type.Optional(
      Type.Boolean({
        description: "derive only: a hard child, which needs secret. Default: false, a soft child",
      }),
    ),
    random: sr25519Hex(
      32,
      "sign and soft derive from secret only: bytes in place of fresh randomness, for repeatable output",
    ),
  },
  { additionalProperties: false },
);

export const sr25519ComputeTool = defineTool({
  name: "curves_sr25519_compute",
  title: "Compute with sr25519",
  description:
    "Work with sr25519, the Schnorr signatures over ristretto255 that Polkadot and Substrate accounts use: expand a 32-byte seed into a key pair, sign a message, verify a signature, or derive a hard or soft child as Substrate HDKD does. Keys, signatures and chain codes go in and come out as hex without 0x. Signatures are randomized, so signing twice gives two valid signatures. Seeds and secrets enter the transcript, so pass only disposable keys or dev accounts.",
  snippet: "Use for Polkadot and Substrate keys, signatures and //hard or /soft derivations.",
  guidelines: [
    "keypair takes seed and returns secret and publicKey, or takes secret and returns publicKey",
    "sign takes secret and message and returns signature; verify takes publicKey, message and signature",
    "derive takes chainCode with secret, or with publicKey for a soft child; hard needs secret",
    "message is utf8 text unless encoding is hex; the context defaults to substrate",
  ],
  effect: "read",
  cli: {
    command: "sr25519",
    description: "sr25519 keys, signatures and HDKD, as Polkadot accounts use them",
    positional: ["operation"],
  },
  input: sr25519ComputeSchema,
  execute: async (params) => (await loadOperations()).computeSr25519(params),
});

export const curvesTools: readonly ToolDefinition[] = [
  computeTool,
  secp256k1ComputeTool,
  sr25519ComputeTool,
];
