<script setup lang="ts">
import { multiplyGenerator as p256Generator } from "@agntn/curves/p256";
import { invertScalar, multiplyGenerator, subtractScalars } from "@agntn/curves/secp256k1";
import type { Ref } from "vue";
import type { Bip340Details, CurvePointText, Ed25519Details, Secp256k1Details, Sr25519Details } from "#tool-operations";
import { EMPTY_VECTOR, PI_VECTOR } from "../../utils/bip340";
import { CURVES, pointArgument } from "../../utils/curves";
import { ORDER_EIGHT, RFC_TEST_1, RFC_TEST_2 } from "../../utils/ed25519";
import { shellArg } from "../../utils/format";
import { RFC_6979 } from "../../utils/p256";
import { BLOCK_170 } from "../../utils/secp";
import { ALICE, ALICE_HELLO, ALICE_JUNCTION, DEV_SECRET, DEV_SEED, flipBit } from "../../utils/sr25519";
import { jsonTokens, shellTokens } from "../../utils/tokens";
import { runTool, type ToolDetails, type ToolName } from "../../utils/tools";

/** An sr25519 key the operation can start from. The tool takes exactly one. */
type KeySource = "seed" | "secret" | "publicKey";

type Field =
  | "point"
  | "other"
  | "scalar"
  | "order"
  | "limit"
  | "x"
  | "compressed"
  | "source"
  | "secret"
  | "publicKey"
  | "message"
  | "encoding"
  | "signature"
  | "digest"
  | "recovery"
  | "lowS"
  | "chainCode"
  | "hard"
  | "zip215"
  | "random";

interface Operation {
  /** `compute:log`, `secp256k1:lift` or `sr25519:sign`, unique across the tools. */
  readonly key: string;
  readonly tool: ToolName;
  /** The `operation` argument. */
  readonly op: string;
  readonly takes: readonly Field[];
  /** The keys `source` picks from, the first one by default. */
  readonly sources?: readonly KeySource[];
  readonly about: string;
}

/** The CLI command of each tool, which is also its name in the operation list. */
const COMMANDS: Record<ToolName, string> = {
  curves_compute: "compute",
  curves_secp256k1_compute: "secp256k1",
  curves_bip340_compute: "bip340",
  curves_p256_compute: "p256",
  curves_sr25519_compute: "sr25519",
  curves_ed25519_compute: "ed25519",
};

/** Every operation of every tool, in the order the tools list them. */
const OPERATIONS: readonly Operation[] = [
  { key: "compute:add", tool: "curves_compute", op: "add", takes: ["point", "other"], about: "Add two points of the curve." },
  { key: "compute:double", tool: "curves_compute", op: "double", takes: ["point"], about: "Twice a point, infinity for a point with y = 0." },
  { key: "compute:negate", tool: "curves_compute", op: "negate", takes: ["point"], about: "Same x, the other y." },
  { key: "compute:multiply", tool: "curves_compute", op: "multiply", takes: ["point", "scalar"], about: "A point times any integer, a negative one multiplies the negation." },
  { key: "compute:lift", tool: "curves_compute", op: "lift", takes: ["x"], about: "Every point above an x, smaller y first. A compressed point is just x and a parity bit." },
  { key: "compute:check", tool: "curves_compute", op: "check", takes: ["point"], about: "Whether a point lies on the curve." },
  { key: "compute:order", tool: "curves_compute", op: "order", takes: ["point"], about: "The smallest n with n times the point at infinity." },
  { key: "compute:count", tool: "curves_compute", op: "count", takes: [], about: "How many points the curve has, infinity included." },
  { key: "compute:points", tool: "curves_compute", op: "points", takes: ["order", "limit"], about: "Infinity, then the points by x then y. With an order, only the points of that order." },
  { key: "compute:log", tool: "curves_compute", op: "log", takes: ["point", "other"], about: "The smallest k with k times the base equal to the target." },
  { key: "secp256k1:add", tool: "curves_secp256k1_compute", op: "add", takes: ["point", "other", "compressed"], about: "The sum of two secp256k1 points." },
  { key: "secp256k1:subtract", tool: "curves_secp256k1_compute", op: "subtract", takes: ["point", "other", "compressed"], about: "The offset between two known points." },
  { key: "secp256k1:negate", tool: "curves_secp256k1_compute", op: "negate", takes: ["point", "compressed"], about: "Same x, the other y. Only the prefix changes." },
  { key: "secp256k1:multiply", tool: "curves_secp256k1_compute", op: "multiply", takes: ["point", "scalar", "compressed"], about: "A point times a scalar from 1 to n - 1. G times a private key is its public key." },
  { key: "secp256k1:lift", tool: "curves_secp256k1_compute", op: "lift", takes: ["x", "compressed"], about: "Both points above an x. The even one is what a BIP340 key stands for." },
  { key: "secp256k1:check", tool: "curves_secp256k1_compute", op: "check", takes: ["point"], about: "Whether a SEC1 point lies on secp256k1." },
  { key: "secp256k1:sign", tool: "curves_secp256k1_compute", op: "sign", takes: ["secret", "digest", "compressed"], about: "Sign a digest with ECDSA. RFC 6979 picks k from the key and the digest, so the bytes never change. Low s, recovery id included." },
  { key: "secp256k1:verify", tool: "curves_secp256k1_compute", op: "verify", takes: ["point", "digest", "signature", "lowS"], about: "Check whether a key signed a digest. G didn't. The block 170 chip loads Satoshi's key, which did." },
  { key: "secp256k1:recover", tool: "curves_secp256k1_compute", op: "recover", takes: ["digest", "signature", "recovery", "compressed"], about: "Recover a verifying key from a digest, signature and id. For block 170, ids 0 and 1 both verify, but only 1 is Satoshi's." },
  { key: "bip340:keypair", tool: "curves_bip340_compute", op: "keypair", takes: ["secret"], about: "A 32-byte secret in, the x-only key out. y doesn't make the trip, it's whichever one is even." },
  { key: "bip340:sign", tool: "curves_bip340_compute", op: "sign", takes: ["secret", "message", "random"], about: "Sign the BIP340 way. Leave random empty and fresh bytes go in, so every signature differs and all of them verify." },
  { key: "bip340:verify", tool: "curves_bip340_compute", op: "verify", takes: ["publicKey", "message", "signature"], about: "The pi message comes with a signature. Flip a bit and see what verify says." },
  { key: "p256:add", tool: "curves_p256_compute", op: "add", takes: ["point", "other", "compressed"], about: "The sum of two P-256 points." },
  { key: "p256:subtract", tool: "curves_p256_compute", op: "subtract", takes: ["point", "other", "compressed"], about: "The offset between two P-256 points." },
  { key: "p256:negate", tool: "curves_p256_compute", op: "negate", takes: ["point", "compressed"], about: "Same x, the other y. Only the SEC1 prefix changes." },
  { key: "p256:multiply", tool: "curves_p256_compute", op: "multiply", takes: ["point", "scalar", "compressed"], about: "A point times a scalar from 1 to n - 1. G times a private key is its public key." },
  { key: "p256:lift", tool: "curves_p256_compute", op: "lift", takes: ["x", "compressed"], about: "Both points above an x. Try x = 1. Nobody's home." },
  { key: "p256:check", tool: "curves_p256_compute", op: "check", takes: ["point"], about: "Check a SEC1 point on P-256. secp256k1's G is on the wrong curve." },
  { key: "p256:verify", tool: "curves_p256_compute", op: "verify", takes: ["point", "digest", "signature", "lowS"], about: "Check ECDSA over a digest. The default signature doesn't verify with G. The RFC 6979 key chip loads the key that does." },
  { key: "sr25519:keypair", tool: "curves_sr25519_compute", op: "keypair", takes: ["source"], sources: ["seed", "secret"], about: "A 32-byte seed grows into a secret and a public key. A secret alone gives back its public key." },
  { key: "sr25519:sign", tool: "curves_sr25519_compute", op: "sign", takes: ["secret", "message", "encoding"], about: "Sign under the substrate context. Fresh randomness each time, so the bytes change and both still verify." },
  { key: "sr25519:verify", tool: "curves_sr25519_compute", op: "verify", takes: ["publicKey", "message", "encoding", "signature"], about: "Whether the key signed these bytes. A wrong signature is a plain false, not an error." },
  { key: "sr25519:derive", tool: "curves_sr25519_compute", op: "derive", takes: ["source", "chainCode", "hard"], sources: ["seed", "secret", "publicKey"], about: "A child as Substrate HDKD makes it. Hard needs the seed or secret. Soft follows from the public key too." },
  { key: "ed25519:keypair", tool: "curves_ed25519_compute", op: "keypair", takes: ["secret"], about: "32 bytes of secret in, the public key out. SHA-512 and a clamp sit in between." },
  { key: "ed25519:sign", tool: "curves_ed25519_compute", op: "sign", takes: ["secret", "message"], about: "Sign as RFC 8032 does. Same secret, same message, same bytes, every single time." },
  { key: "ed25519:verify", tool: "curves_ed25519_compute", op: "verify", takes: ["publicKey", "message", "signature", "zip215"], about: "Check an Ed25519 signature. An order 8 key can pass ZIP 215. Tick strict and watch it fail." },
];

const G = multiplyGenerator("1");
const TWO_G = multiplyGenerator("2");
const HALF = invertScalar(2n);
/** n - 1, the largest secret there is. Its public key is minus G. */
const TOP_SECRET = subtractScalars("0", "1");
/** G and 2G on P-256, compressed. */
const NIST_G = p256Generator("1");
const NIST_TWO_G = p256Generator("2");
/** The ids `recover` takes: bit 0 is the parity of y of R, bit 1 says its x is r + n. */
const RECOVERY_IDS = [0, 1, 2, 3] as const;

const route = useRoute();
const router = useRouter();

const key = ref("compute:log");
const a = ref("2");
const b = ref("2");
const p = ref("17");
const point = ref("5,1");
const other = ref("16,4");
const scalar = ref("13");
const order = ref("");
const curveX = ref("5");
const limit = ref("");
const secpPoint = ref(G);
const secpOther = ref(TWO_G);
const secpScalar = ref("3");
const secpSecret = ref("1");
const x = ref(G.slice(2));
const secpDigest = ref<string>(BLOCK_170.digest);
const secpSignature = ref<string>(BLOCK_170.signature);
const recovery = ref<number>(BLOCK_170.recovery);
const lowS = ref(false);
/** The secp256k1 fields that are text, by the argument each one fills. */
const SECP_FIELDS = { point: secpPoint, other: secpOther, scalar: secpScalar, secret: secpSecret, x, digest: secpDigest, signature: secpSignature } as const;
const nistPoint = ref(NIST_G);
const nistOther = ref(NIST_TWO_G);
const nistScalar = ref("3");
const nistX = ref(NIST_G.slice(2));
const nistDigest = ref<string>(RFC_6979.digest);
const nistSignature = ref<string>(RFC_6979.signature);
/** The P-256 fields that are text, by the argument each one fills. */
const NIST_FIELDS = { point: nistPoint, other: nistOther, scalar: nistScalar, x: nistX, digest: nistDigest, signature: nistSignature } as const;
/** The text fields of both SEC1 tools, by tool. */
const SEC1_FIELDS = { curves_secp256k1_compute: SECP_FIELDS, curves_p256_compute: NIST_FIELDS } as const;
const uncompressed = ref(false);
const schnorrSecret = ref<string>(PI_VECTOR.secret);
const schnorrRandom = ref<string>(PI_VECTOR.random);
const schnorrKey = ref<string>(PI_VECTOR.publicKey);
const schnorrMessage = ref<string>(PI_VECTOR.message);
const schnorrSignature = ref<string>(PI_VECTOR.signature);
/** The BIP340 fields, by the argument each one fills. */
const SCHNORR_FIELDS = {
  secret: schnorrSecret,
  random: schnorrRandom,
  publicKey: schnorrKey,
  message: schnorrMessage,
  signature: schnorrSignature,
} as const;
const seed = ref(DEV_SEED);
const secret = ref(DEV_SECRET);
const publicKey = ref(ALICE);
const message = ref("hello");
const hexMessage = ref(false);
const signature = ref(ALICE_HELLO);
const chainCode = ref(ALICE_JUNCTION);
const hard = ref(true);
const from = ref<KeySource>("seed");
const edSecret = ref<string>(RFC_TEST_1.secret);
const edKey = ref<string>(RFC_TEST_1.publicKey);
const edMessage = ref<string>(RFC_TEST_1.message);
const edSignature = ref<string>(RFC_TEST_1.signature);
/** Ticked, the call goes out with `zip215: false`. */
const strict = ref(false);
/** The Ed25519 fields that are text, by the argument each one fills. */
const ED_FIELDS = { secret: edSecret, publicKey: edKey, message: edMessage, signature: edSignature } as const;

const current = computed(() => OPERATIONS.find((row) => row.key === key.value) ?? OPERATIONS[0]!);
const position = computed(() => OPERATIONS.indexOf(current.value) + 1);
const curve = computed(() => current.value.tool === "curves_compute");
const secp = computed(() => current.value.tool === "curves_secp256k1_compute");
const schnorr = computed(() => current.value.tool === "curves_bip340_compute");
const nist = computed(() => current.value.tool === "curves_p256_compute");
/** The SEC1 fields on screen, secp256k1's or P-256's. */
const sec1Fields = computed(() => (nist.value ? NIST_FIELDS : SECP_FIELDS));
const sr = computed(() => current.value.tool === "curves_sr25519_compute");
const edwards = computed(() => current.value.tool === "curves_ed25519_compute");
/** The key the operation on screen starts from: the one picked, when this operation takes it. */
const source = computed(() => {
  const options = current.value.sources ?? [];
  return options.includes(from.value) ? from.value : options[0];
});
const SR_KEYS = { seed, secret, publicKey, signature, chainCode } as const;

/**
 * The sr25519 arguments on screen. The message stays as typed, so blank signs the empty one.
 *
 * @returns {Record<string, unknown>} The arguments, operation included.
 */
function srArgs(): Record<string, unknown> {
  const args: Record<string, unknown> = { operation: current.value.op };
  for (const field of current.value.takes) {
    if (field === "message") args.message = message.value;
    else if (field === "encoding") {
      if (hexMessage.value) args.encoding = "hex";
    } else if (field === "hard") {
      if (hard.value) args.hard = true;
    } else {
      const name = field === "source" ? source.value : (field as "secret" | "publicKey" | "signature" | "chainCode");
      const value = name === undefined ? "" : SR_KEYS[name].value.trim();
      if (name !== undefined && value !== "") args[name] = value;
    }
  }
  return args;
}

/**
 * The BIP340 arguments on screen. The message always goes along, so blank is the empty one.
 *
 * @returns {Record<string, unknown>} The arguments, operation included.
 */
function schnorrArgs(): Record<string, unknown> {
  const args: Record<string, unknown> = { operation: current.value.op };
  for (const field of current.value.takes) {
    if (field === "message") args.message = schnorrMessage.value.trim();
    else {
      const value = SCHNORR_FIELDS[field as keyof typeof SCHNORR_FIELDS].value.trim();
      if (value !== "") args[field] = value;
    }
  }
  return args;
}

/**
 * The Ed25519 arguments on screen. The message always goes along, so blank is the empty one.
 *
 * @returns {Record<string, unknown>} The arguments, operation included.
 */
function edArgs(): Record<string, unknown> {
  const args: Record<string, unknown> = { operation: current.value.op };
  for (const field of current.value.takes) {
    if (field === "message") args.message = edMessage.value.trim();
    else if (field === "zip215") {
      if (strict.value) args.zip215 = false;
    } else {
      const value = ED_FIELDS[field as "secret" | "publicKey" | "signature"].value.trim();
      if (value !== "") args[field] = value;
    }
  }
  return args;
}

/**
 * A point typed as `x,y`, as the tool takes it, or the text as typed when it has no comma.
 *
 * @param text - The field.
 * @returns {{ x: string; y: string } | string} The point argument.
 */
function pointValue(text: string): { x: string; y: string } | string {
  const [px, py, ...rest] = text.split(",");
  return px === undefined || py === undefined || rest.length > 0 ? text : { x: px.trim(), y: py.trim() };
}

/** The arguments the operation on screen takes, from the fields it shows; blanks stay out. */
const toolArgs = computed(() => {
  if (sr.value) return srArgs();
  if (schnorr.value) return schnorrArgs();
  if (edwards.value) return edArgs();
  const args: Record<string, unknown> = { operation: current.value.op };
  if (curve.value) Object.assign(args, { a: a.value.trim(), b: b.value.trim(), p: p.value.trim() });
  for (const field of current.value.takes) {
    if (field === "compressed") {
      if (uncompressed.value) args.compressed = false;
    } else if (field === "limit") {
      if (limit.value.trim() !== "") args.limit = Number(limit.value);
    } else if (field === "recovery") {
      args.recovery = recovery.value;
    } else if (field === "lowS") {
      if (lowS.value) args.lowS = true;
    } else if (!curve.value) {
      const fields: Readonly<Record<string, Ref<string> | undefined>> = sec1Fields.value;
      const value = fields[field]?.value.trim() ?? "";
      if (value !== "") args[field] = value;
    } else if (field === "point" || field === "other") {
      const value = (field === "point" ? point : other).value.trim();
      if (value !== "") args[field] = pointValue(value);
    } else {
      const value = { scalar, order, x: curveX }[field as "scalar" | "order" | "x"].value.trim();
      if (value !== "") args[field] = value;
    }
  }
  return args;
});

interface Answer {
  readonly ok: boolean;
  /** `content[0].text`, or the error line an MCP client reads. */
  readonly text: string;
  readonly details?: ToolDetails;
  readonly error?: string;
  readonly ms: number;
}

/**
 * Runs one call through the executor the MCP server runs. A refusal comes back as an answer with
 * the text an MCP client would read.
 *
 * @param tool - Which tool.
 * @param args - Its arguments.
 * @returns {Answer} The answer.
 */
function run(tool: ToolName, args: Readonly<Record<string, unknown>>): Answer {
  const started = performance.now();
  try {
    const result = runTool(tool, args);
    return { ok: true, text: result.content[0]!.text, details: result.details, ms: performance.now() - started };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return { ok: false, text: `${tool} failed: ${error.message}`, error: error.message, ms: performance.now() - started };
  }
}

/** The call on screen, run 250 ms after the form stops changing. */
const request = shallowRef({ operation: current.value, args: toolArgs.value });
let pending: ReturnType<typeof setTimeout> | undefined;
watch(toolArgs, (args) => {
  clearTimeout(pending);
  pending = setTimeout(() => {
    request.value = { operation: current.value, args };
  }, 250);
});

const answer = computed(() => run(request.value.operation.tool, request.value.args));
const answered = computed(() => request.value.operation);

/** One cursor sweep and scan per answer text, not per keystroke. */
const scan = ref(0);
watch(
  () => answer.value.text,
  () => {
    scan.value += 1;
  },
);

const cliLine = computed(() => {
  const { operation, args } = request.value;
  const flags = Object.entries(args)
    .filter(([name]) => name !== "operation")
    .map(([name, value]) => {
      if (name === "compressed") return " --no-compressed";
      if (name === "hard") return " --hard";
      if (name === "lowS") return " --low-s";
      if (name === "zip215") return " --no-zip215";
      const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
      return ` --${name.replaceAll(/[A-Z]/gu, (upper) => `-${upper.toLowerCase()}`)} ${shellArg(text)}`;
    })
    .join("");
  return `curves ${COMMANDS[operation.tool]} ${operation.op}${flags}`;
});
const toolCall = computed(() => JSON.stringify({ name: answered.value.tool, arguments: request.value.args }, null, 2));
const responseTitle = computed(() => `${answered.value.tool}(${JSON.stringify(request.value.args)})`);

/** A point of the tool result as a row writes it. */
function pointRow(value: CurvePointText): string {
  return value === "infinity" ? "infinity" : `(${value.x}, ${value.y})`;
}

/** A SEC1 point cut for a heading: prefix and both ends of x. */
function shortHex(value: string): string {
  return value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

interface Row {
  readonly label: string;
  readonly value: string;
  readonly full?: string;
  readonly accent?: boolean;
}

/** A hex value as a row: cut on screen, whole in the tooltip. */
function hexRow(label: string, value: string, accent = false): Row {
  return { label, value: shortHex(value), full: value, accent };
}

/** An answer that carries a key: a key pair, a signature or a child. */
type KeyDetails =
  | Exclude<Sr25519Details | Ed25519Details | Bip340Details, { operation: "verify" }>
  | Extract<Secp256k1Details, { operation: "sign" }>;

/**
 * Whether the details carry a key. A `verify` has the verdict's shape instead.
 *
 * @param {ToolDetails} details - Any tool's details.
 * @returns {boolean} True for a key pair, a signature or a child.
 */
function carriesKey(details: ToolDetails): details is KeyDetails {
  return "publicKey" in details;
}

/**
 * A verdict as the response band shows it, the same for both tools that verify.
 *
 * @param {boolean} valid - What `verify` answered.
 * @returns {{ icon: string; heading: string; rows: Row[] }} The subject band.
 */
function verdictView(valid: boolean): { icon: string; heading: string; rows: Row[] } {
  return {
    icon: valid ? "i-lucide-circle-check" : "i-lucide-circle-x",
    heading: valid ? "Signed by this key" : "Doesn't verify",
    rows: [{ label: "valid", value: String(valid), accent: true }],
  };
}

/**
 * A key answer as a glyph, a heading and rows. An ECDSA signature brings its recovery id along.
 *
 * @param {KeyDetails} details - What the tool returned.
 * @returns {{ icon: string; heading: string; rows: Row[] }} The subject band.
 */
function keyView(details: KeyDetails): { icon: string; heading: string; rows: Row[] } {
  if (details.operation === "sign") {
    return {
      icon: "i-lucide-signature",
      heading: shortHex(details.signature),
      rows: [
        hexRow("signature", details.signature, true),
        ...("recovery" in details ? [{ label: "recovery", value: String(details.recovery) }] : []),
        hexRow("publicKey", details.publicKey),
      ],
    };
  }
  const rows = [hexRow("publicKey", details.publicKey, true)];
  if (details.operation === "derive" && details.seed !== undefined) rows.push(hexRow("seed", details.seed));
  if ("secret" in details && details.secret !== undefined) rows.push(hexRow("secret", details.secret));
  if (details.operation === "derive") rows.push({ label: "child", value: details.hard ? "hard, //" : "soft, /" });
  return { icon: details.operation === "derive" ? "i-lucide-git-branch" : "i-lucide-key-round", heading: shortHex(details.publicKey), rows };
}

/** The answer as the response band shows it: a glyph, a heading, rows, and the points of a listing. */
const view = computed(() => {
  const result = answer.value;
  const label = `${answered.value.tool === "curves_compute" ? "Compute" : COMMANDS[answered.value.tool]} / ${answered.value.op}`;
  if (!result.ok || result.details === undefined) {
    return { icon: "i-lucide-circle-alert", label, heading: "Refused", about: result.error ?? "", rows: [], points: [] };
  }
  const details = result.details;
  if ("valid" in details) return { ...verdictView(details.valid), label, about: answered.value.about, points: [] };
  if (carriesKey(details)) return { ...keyView(details), label, about: answered.value.about, points: [] };
  const rows: Row[] = [];
  let heading = "";
  let icon = "i-lucide-spline";
  let points: string[] = [];
  if ("count" in details) {
    icon = "i-lucide-sigma";
    heading = `${details.count} points`;
    rows.push({ label: "count", value: details.count, accent: true }, { label: "infinity", value: "included" });
  } else if ("total" in details) {
    icon = "i-lucide-chart-scatter";
    heading = `${details.points.length} of ${details.total} points`;
    points = details.points.map(pointRow);
    rows.push({ label: "total", value: details.total, accent: true }, { label: "listed", value: String(details.points.length) }, { label: "truncated", value: String(details.truncated) });
  } else if ("points" in details) {
    icon = "i-lucide-arrow-up-from-dot";
    heading = details.points.length === 0 ? "Nothing up there" : `${details.points.length === 1 ? "One point" : "Two points"} above x`;
    points = details.points.map(pointRow);
    rows.push({ label: "points", value: String(details.points.length), accent: true });
  } else if ("scalar" in details) {
    icon = "i-lucide-target";
    heading = details.scalar === null ? "No k" : `k = ${details.scalar}`;
    rows.push({ label: "order", value: details.order }, { label: "scalar", value: details.scalar ?? "null", accent: true });
  } else if ("order" in details) {
    icon = "i-lucide-orbit";
    heading = `Order ${details.order}`;
    rows.push({ label: "order", value: details.order, accent: true });
  } else if ("onCurve" in details) {
    icon = details.onCurve ? "i-lucide-circle-check" : "i-lucide-circle-x";
    heading = details.onCurve ? "On the curve" : "Not on the curve";
    rows.push({ label: "onCurve", value: String(details.onCurve), accent: true });
  } else if ("even" in details) {
    icon = "i-lucide-key-round";
    heading = shortHex(details.even);
    rows.push({ label: "even", value: shortHex(details.even), full: details.even, accent: true }, { label: "odd", value: shortHex(details.odd), full: details.odd });
  } else if (typeof details.point === "string") {
    icon = "i-lucide-key-round";
    heading = shortHex(details.point);
    rows.push({ label: "point", value: shortHex(details.point), full: details.point, accent: true }, { label: "bytes", value: String(details.point.length / 2) });
  } else {
    heading = pointRow(details.point);
    rows.push({ label: "point", value: pointRow(details.point), accent: true });
  }
  return { icon, label, heading, about: answered.value.about, rows, points };
});

/**
 * Loads a sample curve with its base and target into the curve fields.
 *
 * @param index - Which of `CURVES`.
 */
function loadCurve(index: number) {
  const sample = CURVES[index]!;
  a.value = String(sample.a);
  b.value = String(sample.curve.b);
  p.value = String(sample.curve.p);
  const base = pointArgument(sample.base);
  const target = pointArgument(sample.target);
  point.value = `${base.x},${base.y}`;
  other.value = `${target.x},${target.y}`;
  scalar.value = String(sample.scalar);
}

/** secp256k1 samples, each a different kind of point to start from, and two keys for sign alone. */
const SECP_SAMPLES: readonly { label: string; op?: string; load: () => unknown }[] = [
  { label: "G and 2G", load: () => ((secpPoint.value = G), (secpOther.value = TWO_G), (secpScalar.value = "3")) },
  { label: "half of G", load: () => ((secpPoint.value = G), (secpScalar.value = HALF)) },
  { label: "x of G", load: () => (x.value = G.slice(2)) },
  { label: "x = 5", load: () => ((x.value = "5".padStart(64, "0")), (secpPoint.value = `02${"5".padStart(64, "0")}`)) },
  {
    label: "block 170",
    load: () => {
      secpPoint.value = BLOCK_170.key;
      secpDigest.value = BLOCK_170.digest;
      secpSignature.value = BLOCK_170.signature;
      recovery.value = BLOCK_170.recovery;
    },
  },
  { label: "secret 1", op: "sign", load: () => (secpSecret.value = "1") },
  { label: "secret n - 1", op: "sign", load: () => (secpSecret.value = TOP_SECRET) },
];

/** The secp256k1 chips on screen. The secret ones show up where there's a secret to fill. */
const secpSamples = computed(() => SECP_SAMPLES.filter((sample) => sample.op === undefined || sample.op === current.value.op));

/** P-256 samples: G and 2G, an x no point has, the RFC 6979 key, and one bit off on verify. */
const NIST_SAMPLES: readonly { label: string; op?: string; load: () => unknown }[] = [
  { label: "G and 2G", load: () => ((nistPoint.value = NIST_G), (nistOther.value = NIST_TWO_G), (nistScalar.value = "3")) },
  { label: "x of G", load: () => (nistX.value = NIST_G.slice(2)) },
  { label: "x = 1", load: () => ((nistX.value = "1".padStart(64, "0")), (nistPoint.value = `02${"1".padStart(64, "0")}`)) },
  {
    label: "RFC 6979 key",
    load: () => {
      nistPoint.value = RFC_6979.publicKey;
      nistDigest.value = RFC_6979.digest;
      nistSignature.value = RFC_6979.signature;
    },
  },
  { label: "one bit off", op: "verify", load: () => (nistSignature.value = flipBit(nistSignature.value)) },
];

/** The P-256 chips on screen. `one bit off` waits for a signature to break. */
const nistSamples = computed(() => NIST_SAMPLES.filter((sample) => sample.op === undefined || sample.op === current.value.op));

/**
 * Loads one BIP340 vector into every BIP340 field, secret and aux_rand included.
 *
 * @param vector - The vector.
 */
function loadSchnorr(vector: typeof PI_VECTOR | typeof EMPTY_VECTOR) {
  schnorrSecret.value = vector.secret;
  schnorrRandom.value = vector.random;
  schnorrKey.value = vector.publicKey;
  schnorrMessage.value = vector.message;
  schnorrSignature.value = vector.signature;
}

/** BIP340 samples: the pi vector, the empty one, and two chips that wait for their op. */
const SCHNORR_SAMPLES: readonly { label: string; op?: string; load: () => unknown }[] = [
  { label: "pi message", load: () => loadSchnorr(PI_VECTOR) },
  { label: "empty message", load: () => loadSchnorr(EMPTY_VECTOR) },
  { label: "fresh random", op: "sign", load: () => (schnorrRandom.value = "") },
  { label: "one bit off", op: "verify", load: () => (schnorrSignature.value = flipBit(schnorrSignature.value)) },
];

/** The BIP340 chips on screen: fresh random on sign, one bit off where a signature can break. */
const schnorrSamples = computed(() => SCHNORR_SAMPLES.filter((sample) => sample.op === undefined || sample.op === current.value.op));

/**
 * Loads one RFC 8032 test into every Ed25519 field.
 *
 * @param test - The test.
 */
function loadEd(test: typeof RFC_TEST_1 | typeof RFC_TEST_2) {
  edSecret.value = test.secret;
  edKey.value = test.publicKey;
  edMessage.value = test.message;
  edSignature.value = test.signature;
}

/** Ed25519 samples: two RFC 8032 tests everywhere, an order 8 key and one bit off on verify. */
const ED_SAMPLES = [
  { label: "RFC 8032 test 1", verify: false, load: () => loadEd(RFC_TEST_1) },
  { label: "RFC 8032 test 2", verify: false, load: () => loadEd(RFC_TEST_2) },
  {
    label: "order 8 key",
    verify: true,
    load: () => ((edKey.value = ORDER_EIGHT.publicKey), (edMessage.value = ORDER_EIGHT.message), (edSignature.value = ORDER_EIGHT.signature)),
  },
  { label: "one bit off", verify: true, load: () => (edSignature.value = flipBit(edSignature.value)) },
] as const;

/** The Ed25519 chips on screen. The verify ones wait for a signature to break. */
const edSamples = computed(() => ED_SAMPLES.filter((sample) => !sample.verify || current.value.op === "verify"));

/** sr25519 samples: the dev seed with `//Alice`, and her signature one bit off. */
const SR_SAMPLES = [
  {
    label: "dev seed //Alice",
    load: () => {
      seed.value = DEV_SEED;
      secret.value = DEV_SECRET;
      publicKey.value = ALICE;
      message.value = "hello";
      hexMessage.value = false;
      signature.value = ALICE_HELLO;
      chainCode.value = ALICE_JUNCTION;
      hard.value = true;
    },
  },
  { label: "one bit off", load: () => (signature.value = flipBit(ALICE_HELLO)) },
] as const;

const { copied, copy } = useCopied();

/** The query keys a link may carry, each with the field it sets. */
const FIELDS = { a, b, p, point, other, scalar, order, limit, x: curveX } as const;
const SR_FIELDS = { ...SR_KEYS, message } as const;

/**
 * The sr25519 part of a link. A flag it leaves out is off: an unticked box writes nothing.
 *
 * @param {Operation} op - The operation the link opens.
 * @param {Record<string, unknown>} query - The query.
 */
function readSrQuery(op: Operation, query: Readonly<Record<string, unknown>>) {
  for (const [name, field] of Object.entries(SR_FIELDS)) {
    if (typeof query[name] === "string") field.value = query[name];
  }
  const given = op.sources?.find((name) => typeof query[name] === "string");
  if (given) from.value = given;
  if (op.takes.includes("hard")) hard.value = query.hard === "true";
  if (op.takes.includes("encoding")) hexMessage.value = query.encoding === "hex";
}

/** Query in, state out. Only values the form knows are read, the rest of the query is ignored. */
function readQuery(query: Readonly<Record<string, unknown>>) {
  const op = OPERATIONS.find((row) => row.key === query.op);
  if (op) key.value = op.key;
  if (op?.tool === "curves_sr25519_compute") readSrQuery(op, query);
  if (op?.tool === "curves_bip340_compute") {
    for (const [name, field] of Object.entries(SCHNORR_FIELDS)) {
      if (typeof query[name] === "string") field.value = query[name];
    }
  }
  if (op?.tool === "curves_ed25519_compute") {
    for (const [name, field] of Object.entries(ED_FIELDS)) {
      if (typeof query[name] === "string") field.value = query[name];
    }
    strict.value = query.zip215 === "false";
  }
  const sec1 = op?.tool === "curves_secp256k1_compute" || op?.tool === "curves_p256_compute" ? SEC1_FIELDS[op.tool] : undefined;
  for (const [name, field] of Object.entries({ ...FIELDS, ...sec1 })) {
    if (typeof query[name] === "string") field.value = query[name];
  }
  if (typeof query.uncompressed === "string") uncompressed.value = query.uncompressed === "true";
  if (sec1 && op?.takes.includes("lowS")) lowS.value = query.lowS === "true";
  if (typeof query.recovery === "string" && /^[0-3]$/u.test(query.recovery)) recovery.value = Number(query.recovery);
  request.value = { operation: current.value, args: toolArgs.value };
}

/** The state as a query. An empty random stays, so the link doesn't bring the sample's back. */
const shareQuery = computed(() => {
  const query: Record<string, string> = { op: current.value.key };
  for (const [name, value] of Object.entries(toolArgs.value)) {
    if (name === "operation") continue;
    if (name === "compressed") query.uncompressed = "true";
    else query[name] = typeof value === "object" && value !== null ? `${(value as { x: string }).x},${(value as { y: string }).y}` : String(value);
  }
  if (schnorr.value && current.value.takes.includes("random") && query.random === undefined) query.random = "";
  return query;
});

/**
 * Deep link once after mount. A prerendered page hydrates with an empty `route.query` and Nuxt
 * restores the address only afterwards, so the first non-empty query is read once, whichever
 * comes first.
 */
function applyDeepLink() {
  const stop = watch(
    () => route.query,
    (query) => {
      readQuery(query as Record<string, unknown>);
      stop();
    },
    { once: true, flush: "post" },
  );
  if (Object.keys(route.query).length > 0) {
    stop();
    readQuery(route.query as Record<string, unknown>);
  }
}

onMounted(() => {
  applyDeepLink();
  watch(shareQuery, (query) => {
    void router.replace({ query });
  });
});

const shareLink = computed(() => {
  if (!import.meta.client) return "";
  const url = new URL(window.location.href);
  url.search = new URLSearchParams(shareQuery.value).toString();
  return url.toString();
});
</script>

<template>
  <div class="playground">
    <form class="tool-console console-wide" @submit.prevent>
      <span class="console-cross console-cross-tl" aria-hidden="true">+</span>
      <span class="console-cross console-cross-br" aria-hidden="true">+</span>
      <header class="console-bar">
        <span class="console-title"
          ><span class="console-tag">Call</span>{{ current.tool
          }}<span class="console-file">{{ String(position).padStart(2, "0") }} / {{ OPERATIONS.length }}</span></span
        >
        <span class="console-meta" aria-label="Supported hosts: MCP, Pi, OMP and the AI SDK">MCP · Pi · OMP · AI SDK</span>
        <span class="console-mark" aria-hidden="true" />
      </header>
      <div class="console-ruler" aria-hidden="true"><span class="console-cursor" /></div>

      <div class="console-band playground-band-first playground-columns">
        <div class="playground-column">
          <p class="console-label console-rule-title">
            <span>Operation <span aria-hidden="true">[ {{ OPERATIONS.length }} ]</span></span>
            <span class="console-mark" aria-hidden="true" />
          </p>
          <div role="group" aria-label="Operation" class="playground-ops console-draw">
            <button
              v-for="(row, index) in OPERATIONS"
              :key="row.key"
              type="button"
              class="console-lead"
              :aria-pressed="key === row.key"
              @click="key = row.key"
            >
              <span class="console-tag">{{ row.op }}</span>
              <span>{{ COMMANDS[row.tool] }}</span>
              <span class="console-leader" aria-hidden="true" :style="{ animationDelay: `${index * 60}ms` }" />
            </button>
          </div>
          <p class="console-about playground-tool-about">{{ current.about }}</p>
        </div>

        <div class="playground-column">
          <p class="console-label console-rule-title">
            <span
              >Input <span aria-hidden="true">[ {{ Object.keys(toolArgs).length - 1 || "no" }}
                {{ Object.keys(toolArgs).length === 2 ? "argument" : "arguments" }} besides operation ]</span></span
            >
            <span class="console-mark" aria-hidden="true" />
          </p>

          <div class="console-readout">
            <dl v-if="curve" class="console-readout-rows">
              <div>
                <dt><label for="playground-a">a</label></dt>
                <dd><UInput id="playground-a" v-model="a" variant="none" class="w-full" spellcheck="false" /></dd>
              </div>
              <div>
                <dt><label for="playground-b">b</label></dt>
                <dd><UInput id="playground-b" v-model="b" variant="none" class="w-full" spellcheck="false" /></dd>
              </div>
              <div>
                <dt><label for="playground-p">p</label></dt>
                <dd><UInput id="playground-p" v-model="p" variant="none" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('point')">
                <dt><label for="playground-point">{{ current.op === "log" ? "base" : "point" }}</label></dt>
                <dd><UInput id="playground-point" v-model="point" variant="none" placeholder="x,y" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('other')">
                <dt><label for="playground-other">{{ current.op === "log" ? "target" : "other" }}</label></dt>
                <dd><UInput id="playground-other" v-model="other" variant="none" placeholder="x,y" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('scalar')">
                <dt><label for="playground-scalar">scalar</label></dt>
                <dd><UInput id="playground-scalar" v-model="scalar" variant="none" placeholder="any integer" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('order')">
                <dt><label for="playground-order">order</label></dt>
                <dd><UInput id="playground-order" v-model="order" variant="none" placeholder="every order" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('x')">
                <dt><label for="playground-curve-x">x</label></dt>
                <dd><UInput id="playground-curve-x" v-model="curveX" variant="none" placeholder="0 to p - 1" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('limit')">
                <dt><label for="playground-limit">limit</label></dt>
                <dd><UInput id="playground-limit" v-model="limit" variant="none" inputmode="numeric" placeholder="default 100" class="w-full" /></dd>
              </div>
            </dl>
            <dl v-else-if="secp || nist" class="console-readout-rows">
              <div v-if="current.takes.includes('secret')">
                <dt><label for="playground-secp-secret">secret</label></dt>
                <dd><UInput id="playground-secp-secret" v-model="secpSecret" variant="none" placeholder="hex, 1 to n - 1" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('point')">
                <dt><label for="playground-secp-point">point</label></dt>
                <dd><UInput id="playground-secp-point" v-model="sec1Fields.point.value" variant="none" placeholder="SEC1 hex" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('other')">
                <dt><label for="playground-secp-other">other</label></dt>
                <dd><UInput id="playground-secp-other" v-model="sec1Fields.other.value" variant="none" placeholder="SEC1 hex" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('scalar')">
                <dt><label for="playground-secp-scalar">scalar</label></dt>
                <dd><UInput id="playground-secp-scalar" v-model="sec1Fields.scalar.value" variant="none" placeholder="hex, 1 to n - 1" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('x')">
                <dt><label for="playground-x">x</label></dt>
                <dd><UInput id="playground-x" v-model="sec1Fields.x.value" variant="none" placeholder="64 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('digest')">
                <dt><label for="playground-digest">digest</label></dt>
                <dd><UInput id="playground-digest" v-model="sec1Fields.digest.value" variant="none" placeholder="digest hex, 1 to 64 bytes" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('signature')">
                <dt><label for="playground-secp-signature">signature</label></dt>
                <dd><UInput id="playground-secp-signature" v-model="sec1Fields.signature.value" variant="none" placeholder="r then s, 128 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('recovery')">
                <dt>recovery</dt>
                <dd class="playground-sources" role="group" aria-label="Recovery id, 0 to 3">
                  <UButton
                    v-for="id in RECOVERY_IDS"
                    :key="id"
                    variant="chip"
                    :color="recovery === id ? 'primary' : 'neutral'"
                    :aria-pressed="recovery === id"
                    :label="String(id)"
                    @click="recovery = id"
                  />
                </dd>
              </div>
              <div v-if="current.takes.includes('lowS')">
                <dt><label for="playground-low-s">s</label></dt>
                <dd><UCheckbox id="playground-low-s" v-model="lowS" :label="nist ? 'low s, at most n / 2' : 'low s, Bitcoin\'s stricter rule'" /></dd>
              </div>
              <div v-if="current.takes.includes('compressed')">
                <dt><label for="playground-uncompressed">output</label></dt>
                <dd><UCheckbox id="playground-uncompressed" v-model="uncompressed" label="uncompressed, 65 bytes" /></dd>
              </div>
            </dl>
            <dl v-else-if="schnorr" class="console-readout-rows">
              <div v-if="current.takes.includes('secret')">
                <dt><label for="playground-schnorr-secret">secret</label></dt>
                <dd><UInput id="playground-schnorr-secret" v-model="schnorrSecret" variant="none" placeholder="secret, 64 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('publicKey')">
                <dt><label for="playground-schnorr-key">publicKey</label></dt>
                <dd><UInput id="playground-schnorr-key" v-model="schnorrKey" variant="none" placeholder="x-only key, 64 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('message')">
                <dt><label for="playground-schnorr-message">message</label></dt>
                <dd><UInput id="playground-schnorr-message" v-model="schnorrMessage" variant="none" placeholder="hex, empty is fine" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('signature')">
                <dt><label for="playground-schnorr-signature">signature</label></dt>
                <dd><UInput id="playground-schnorr-signature" v-model="schnorrSignature" variant="none" placeholder="x of R then s, 128 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('random')">
                <dt><label for="playground-schnorr-random">random</label></dt>
                <dd><UInput id="playground-schnorr-random" v-model="schnorrRandom" variant="none" placeholder="empty draws 32 fresh bytes" class="w-full" spellcheck="false" /></dd>
              </div>
            </dl>
            <dl v-else-if="edwards" class="console-readout-rows">
              <div v-if="current.takes.includes('secret')">
                <dt><label for="playground-ed-secret">secret</label></dt>
                <dd><UInput id="playground-ed-secret" v-model="edSecret" variant="none" placeholder="secret, 64 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('publicKey')">
                <dt><label for="playground-ed-key">publicKey</label></dt>
                <dd><UInput id="playground-ed-key" v-model="edKey" variant="none" placeholder="public key, 64 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('message')">
                <dt><label for="playground-ed-message">message</label></dt>
                <dd><UInput id="playground-ed-message" v-model="edMessage" variant="none" placeholder="hex, empty is fine" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('signature')">
                <dt><label for="playground-ed-signature">signature</label></dt>
                <dd><UInput id="playground-ed-signature" v-model="edSignature" variant="none" placeholder="R then S, 128 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('zip215')">
                <dt><label for="playground-strict">rules</label></dt>
                <dd><UCheckbox id="playground-strict" v-model="strict" label="strict rules, zip215 false" /></dd>
              </div>
            </dl>
            <dl v-else class="console-readout-rows">
              <div v-if="current.sources">
                <dt>from</dt>
                <dd class="playground-sources" role="group" aria-label="The key to start from">
                  <UButton
                    v-for="name in current.sources"
                    :key="name"
                    variant="chip"
                    :color="source === name ? 'primary' : 'neutral'"
                    :aria-pressed="source === name"
                    :label="name"
                    @click="from = name"
                  />
                </dd>
              </div>
              <div v-if="source === 'seed'">
                <dt><label for="playground-seed">seed</label></dt>
                <dd><UInput id="playground-seed" v-model="seed" variant="none" placeholder="64 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="source === 'secret' || current.takes.includes('secret')">
                <dt><label for="playground-secret">secret</label></dt>
                <dd><UInput id="playground-secret" v-model="secret" variant="none" placeholder="128 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="source === 'publicKey' || current.takes.includes('publicKey')">
                <dt><label for="playground-public-key">publicKey</label></dt>
                <dd><UInput id="playground-public-key" v-model="publicKey" variant="none" placeholder="64 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('message')">
                <dt><label for="playground-message">message</label></dt>
                <dd><UInput id="playground-message" v-model="message" variant="none" placeholder="empty is a message too" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('encoding')">
                <dt><label for="playground-hex-message">read as</label></dt>
                <dd><UCheckbox id="playground-hex-message" v-model="hexMessage" label="hex bytes, not text" /></dd>
              </div>
              <div v-if="current.takes.includes('signature')">
                <dt><label for="playground-signature">signature</label></dt>
                <dd><UInput id="playground-signature" v-model="signature" variant="none" placeholder="128 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('chainCode')">
                <dt><label for="playground-chain-code">chainCode</label></dt>
                <dd><UInput id="playground-chain-code" v-model="chainCode" variant="none" placeholder="64 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('hard')">
                <dt><label for="playground-hard">child</label></dt>
                <dd><UCheckbox id="playground-hard" v-model="hard" label="hard, the // kind" /></dd>
              </div>
            </dl>
          </div>

          <div v-if="curve" class="playground-chips" role="group" aria-label="Sample curves">
            <UButton
              v-for="(sample, index) in CURVES"
              :key="sample.key"
              variant="chip"
              :color="a === String(sample.a) && b === String(sample.curve.b) && p === String(sample.curve.p) ? 'primary' : 'neutral'"
              :label="`F${sample.curve.p}`"
              @click="loadCurve(index)"
            />
          </div>
          <div v-else-if="secp" class="playground-chips" role="group" aria-label="Sample points">
            <UButton v-for="sample in secpSamples" :key="sample.label" variant="chip" color="neutral" :label="sample.label" @click="sample.load()" />
          </div>
          <div v-else-if="nist" class="playground-chips" role="group" aria-label="Sample P-256 points">
            <UButton v-for="sample in nistSamples" :key="sample.label" variant="chip" color="neutral" :label="sample.label" @click="sample.load()" />
          </div>
          <div v-else-if="schnorr" class="playground-chips" role="group" aria-label="BIP340 test vectors">
            <UButton v-for="sample in schnorrSamples" :key="sample.label" variant="chip" color="neutral" :label="sample.label" @click="sample.load()" />
          </div>
          <div v-else-if="edwards" class="playground-chips" role="group" aria-label="Ed25519 test vectors">
            <UButton v-for="sample in edSamples" :key="sample.label" variant="chip" color="neutral" :label="sample.label" @click="sample.load()" />
          </div>
          <div v-else class="playground-chips" role="group" aria-label="Sample keys">
            <UButton v-for="sample in SR_SAMPLES" :key="sample.label" variant="chip" color="neutral" :label="sample.label" @click="sample.load()" />
          </div>

          <p class="playground-note">
            <template v-if="sr"
              >Keys and signatures are hex without 0x. The dev seed is public on purpose, so anyone
              can sign as Alice. Your own secret would land in the address bar, so maybe don't.</template
            >
            <template v-else-if="edwards"
              >Keys, messages and signatures are hex without 0x. Empty messages are fine. The RFC secrets are public on purpose. Yours would land in the address bar, so maybe don't.</template
            >
            <template v-else-if="schnorr"
              >Keys and signatures are hex without 0x. The key is just the x coordinate, with even y
              filling in the other half. The BIP's secrets are public on purpose. Yours would land in
              the address bar, so maybe don't.</template
            >
            <template v-else-if="nist"
              >As on secp256k1, points use SEC1 hex in 33 or 65 bytes. Digests and signatures are hex
              without 0x. Unpack a WebAuthn or X.509 DER signature into r then s first, and keep private
              scalars out: the address bar is a bad place for secrets.</template
            >
            <template v-else-if="secp"
              >Points are SEC1 hex, 33 or 65 bytes. Digests and signatures are hex without 0x. Every
              field lands in the address bar, so keep private scalars out of it.</template
            >
            <template v-else
              >A chip loads one of the landing's curves with its base and target. Points go in as
              <code>x,y</code>. Try a point off the curve and see what it says.</template
            >
          </p>
        </div>
      </div>

      <div class="console-band playground-columns">
        <div class="playground-column">
          <p class="console-label console-rule-title">
            <span>CLI <span aria-hidden="true">[ same call ]</span></span>
            <span class="console-mark" aria-hidden="true" />
            <UButton
              color="neutral"
              variant="subtle"
              :icon="copied === 'cli' ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copied === 'cli' ? 'copied' : 'copy'"
              :aria-label="copied === 'cli' ? 'Copied' : 'Copy the CLI line'"
              @click="copy('cli', cliLine)"
            />
          </p>
          <!-- prettier-ignore -->
          <pre class="console-snippet"><code><span class="playground-prompt">$ </span><span v-for="(token, index) in shellTokens(cliLine)" :key="index" :class="token.cls">{{ token.text }}</span></code></pre>
        </div>
        <div class="playground-column">
          <p class="console-label console-rule-title">
            <span>Tool <span aria-hidden="true">[ what an MCP client sends ]</span></span>
            <span class="console-mark" aria-hidden="true" />
            <UButton
              color="neutral"
              variant="subtle"
              :icon="copied === 'tool' ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copied === 'tool' ? 'copied' : 'copy'"
              :aria-label="copied === 'tool' ? 'Copied' : 'Copy the tool call'"
              @click="copy('tool', toolCall)"
            />
          </p>
          <!-- prettier-ignore -->
          <pre class="console-snippet"><code><span v-for="(token, index) in jsonTokens(toolCall)" :key="index" :class="token.cls">{{ token.text }}</span></code></pre>
        </div>
      </div>

      <footer class="console-footer console-footer-plain">
        <ul class="console-links">
          <li>
            <button type="button" @click="copy('link', shareLink)">
              <span aria-hidden="true">→ </span>{{ copied === "link" ? "permalink copied" : "copy the permalink" }}
            </button>
          </li>
        </ul>
        <span class="console-meta">every state is a link</span>
      </footer>
    </form>

    <!-- The call runs from the request down into the response, the way the zone's circuit runs into the request. -->
    <div class="playground-link" aria-hidden="true">
      <svg :key="scan" class="hero-circuit" viewBox="0 0 160 56">
        <path class="hero-circuit-rail" d="M80 0V16L96 32V56" />
        <path class="hero-circuit-live" d="M80 0V16L96 32V56" pathLength="1" />
        <path class="hero-circuit-seg" d="M96 38V48" />
        <rect class="hero-circuit-node" x="92.5" y="52.5" width="7" height="7" />
      </svg>
      <span class="hero-circuit-tag">answer</span>
    </div>

    <section class="tool-console console-wide" aria-live="polite">
      <span class="console-cross console-cross-tl" aria-hidden="true">+</span>
      <span class="console-cross console-cross-br" aria-hidden="true">+</span>
      <header class="console-bar">
        <UTooltip :text="responseTitle">
          <span class="console-title playground-call" tabindex="0"
            ><span class="console-tag">{{ answered.op }}</span>{{ answered.tool }}(<span class="tok-str"
              >"{{ answered.op }}"</span
            >)</span
          >
        </UTooltip>
        <span class="console-meta">{{ answer.ok ? "answered" : "refused" }}</span>
        <span class="console-mark" aria-hidden="true" />
      </header>
      <div class="console-ruler" aria-hidden="true">
        <span :key="scan" class="console-cursor" />
      </div>

      <div class="console-band console-subject-band">
        <div :key="scan" class="console-scan" aria-hidden="true" />
        <div class="console-identity-block">
          <ConsoleReticle :key="scan" :icon="view.icon" />
          <div class="console-name">
            <span class="console-label"
              >{{ view.label.split(" / ")[0] }} / <span class="console-label-key">{{ view.label.split(" / ")[1] }}</span></span
            >
            <h3 :class="{ 'playground-refused': !answer.ok }">{{ view.heading }}</h3>
            <p class="console-about">{{ view.about }}</p>
          </div>
        </div>
        <div v-if="view.rows.length > 0" class="console-readout">
          <svg class="console-link" viewBox="0 0 32 40" fill="none" aria-hidden="true">
            <circle cx="3" cy="12" r="2.5" />
            <path d="M5.5 12H14L22 20H32" />
          </svg>
          <dl :key="scan" class="console-readout-rows console-animate">
            <div v-for="row in view.rows" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd :class="{ 'console-accent': row.accent }">
                <UTooltip v-if="row.full" :text="row.full">
                  <span class="playground-line" tabindex="0">{{ row.value }}</span>
                </UTooltip>
                <span v-else class="playground-line">{{ row.value }}</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div v-if="view.points.length > 0" class="console-band">
        <p class="console-label console-rule-title">
          <span>Points <span aria-hidden="true">[ by x, then y ]</span></span>
          <span class="console-mark" aria-hidden="true" />
        </p>
        <ol :key="scan" class="playground-points console-animate">
          <li v-for="(item, index) in view.points" :key="index">{{ item }}</li>
        </ol>
      </div>

      <ConsoleResponse :title="responseTitle" :text="answer.text" />

      <footer class="console-footer console-footer-plain">
        <span>computed in this tab · {{ answer.ms < 1 ? "under 1" : Math.round(answer.ms) }} ms</span>
        <span class="console-meta">same executor as curves mcp</span>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.playground {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}
/* The link between the two instruments: the zone's circuit, standing on its own 56 px of height. */
.playground-link {
  position: relative;
  height: 56px;
}
.playground-link > .hero-circuit {
  bottom: 0;
}
.playground-link > .hero-circuit-tag {
  bottom: 18px;
}
/* One track by default: an implicit auto track would grow to the widest chip row and push the page sideways. */
.playground-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px 48px;
}
.playground-column {
  min-width: 0;
}
@media (width >= 56rem) {
  .playground-columns {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
@media (width >= 80rem) {
  .playground-ops {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
/* The playground carries more rows than a dossier, so its bands breathe a little wider. */
.playground .console-bar {
  padding-block: 12px;
}
.playground .console-band {
  padding: 22px 24px 24px;
}
.playground .console-rule-title {
  margin-bottom: 18px;
}
.playground .console-readout-rows > div {
  padding: 12px 16px;
}
/* a, b and p are names in an equation: A is not a. */
.playground .console-readout-rows dt {
  text-transform: none;
  letter-spacing: 0.02em;
}
.playground-prompt {
  color: var(--ui-text-dimmed);
}
.playground .console-snippet {
  padding: 12px 16px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.playground .console-footer {
  padding: 14px 24px;
}
.playground-band-first {
  border-top: 0;
}
.playground-tool-about {
  margin-top: 20px;
  font-size: 14px;
}
.playground-ops {
  display: grid;
  gap: 0 40px;
  margin-top: -12px;
}
.playground-ops .console-lead {
  margin-top: 12px;
  padding: 2px 0;
}
.playground-ops .console-lead > span:not(.console-tag, .console-leader) {
  white-space: nowrap;
  color: var(--ui-text-muted);
}
.playground-ops .console-lead[aria-pressed="true"] > span:not(.console-tag, .console-leader),
.playground-ops .console-lead:hover > span:not(.console-tag, .console-leader) {
  color: var(--ui-text-highlighted);
}
/* The key picker: a chip row like the samples, only inside the readout. */
.playground-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.playground-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}
.playground-note {
  margin: 16px 0 0;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.7;
  color: var(--ui-text-muted);
}
.playground-call {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.playground-refused {
  color: var(--curves-del);
}
.playground-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* The points of a listing as a grid of values, wrapped, never a scroll of their own. */
.playground-points {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
  gap: 6px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--ui-text-highlighted);
}
@media (width < 640px) {
  /* The bracket note goes on a phone: a band title with two buttons has no room left for it. */
  .playground .console-rule-title > span:first-child > span {
    display: none;
  }
}
@media (width < 400px) {
  .playground .console-readout-rows > div {
    grid-template-columns: 5rem minmax(0, 1fr);
    gap: 8px;
    padding: 10px 12px;
  }
  .playground .console-band,
  .playground .console-footer {
    padding-inline: 14px;
  }
}
</style>
