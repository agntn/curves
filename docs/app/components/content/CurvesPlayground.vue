<script setup lang="ts">
import { invertScalar, multiplyGenerator } from "@agntn/curves/secp256k1";
import type { CurveDetails, CurvePointText, Secp256k1Details } from "#tool-operations";
import { CURVES, pointArgument } from "../../utils/curves";
import { shellArg } from "../../utils/format";
import { jsonTokens, shellTokens } from "../../utils/tokens";
import { runTool, type ToolName } from "../../utils/tools";

type Field = "point" | "other" | "scalar" | "order" | "limit" | "x" | "compressed";

interface Operation {
  /** `compute:log` or `secp256k1:lift`, unique across both tools. */
  readonly key: string;
  readonly tool: ToolName;
  /** The `operation` argument. */
  readonly op: string;
  readonly takes: readonly Field[];
  readonly about: string;
}

/** Every operation of both tools, in the order the tools list them. */
const OPERATIONS: readonly Operation[] = [
  { key: "compute:add", tool: "curves_compute", op: "add", takes: ["point", "other"], about: "Add two points of the curve." },
  { key: "compute:double", tool: "curves_compute", op: "double", takes: ["point"], about: "Twice a point, infinity for a point with y = 0." },
  { key: "compute:negate", tool: "curves_compute", op: "negate", takes: ["point"], about: "Same x, the other y." },
  { key: "compute:multiply", tool: "curves_compute", op: "multiply", takes: ["point", "scalar"], about: "A point times any integer, a negative one multiplies the negation." },
  { key: "compute:check", tool: "curves_compute", op: "check", takes: ["point"], about: "Whether a point lies on the curve." },
  { key: "compute:order", tool: "curves_compute", op: "order", takes: ["point"], about: "The smallest n with n times the point at infinity." },
  { key: "compute:count", tool: "curves_compute", op: "count", takes: [], about: "How many points the curve has, infinity included." },
  { key: "compute:points", tool: "curves_compute", op: "points", takes: ["order", "limit"], about: "The points by x then y, optionally only those of one order." },
  { key: "compute:log", tool: "curves_compute", op: "log", takes: ["point", "other"], about: "The smallest k with k times the base equal to the target." },
  { key: "secp256k1:add", tool: "curves_secp256k1_compute", op: "add", takes: ["point", "other", "compressed"], about: "The sum of two secp256k1 points." },
  { key: "secp256k1:subtract", tool: "curves_secp256k1_compute", op: "subtract", takes: ["point", "other", "compressed"], about: "The offset between two known points." },
  { key: "secp256k1:negate", tool: "curves_secp256k1_compute", op: "negate", takes: ["point", "compressed"], about: "Same x, the other y. Only the prefix changes." },
  { key: "secp256k1:multiply", tool: "curves_secp256k1_compute", op: "multiply", takes: ["point", "scalar", "compressed"], about: "A point times a scalar from 1 to n - 1. G times a private key is its public key." },
  { key: "secp256k1:lift", tool: "curves_secp256k1_compute", op: "lift", takes: ["x", "compressed"], about: "Both points above an x. The even one is what a BIP340 key stands for." },
  { key: "secp256k1:check", tool: "curves_secp256k1_compute", op: "check", takes: ["point"], about: "Whether a SEC1 point lies on secp256k1." },
];

const G = multiplyGenerator("1");
const TWO_G = multiplyGenerator("2");
const HALF = invertScalar(2n);

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
const limit = ref("");
const secpPoint = ref(G);
const secpOther = ref(TWO_G);
const secpScalar = ref("3");
const x = ref(G.slice(2));
const uncompressed = ref(false);

const current = computed(() => OPERATIONS.find((row) => row.key === key.value) ?? OPERATIONS[0]!);
const position = computed(() => OPERATIONS.indexOf(current.value) + 1);
const secp = computed(() => current.value.tool === "curves_secp256k1_compute");

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
  const args: Record<string, unknown> = { operation: current.value.op };
  if (!secp.value) Object.assign(args, { a: a.value.trim(), b: b.value.trim(), p: p.value.trim() });
  for (const field of current.value.takes) {
    if (field === "compressed") {
      if (uncompressed.value) args.compressed = false;
    } else if (field === "limit") {
      if (limit.value.trim() !== "") args.limit = Number(limit.value);
    } else if (secp.value) {
      const value = { point: secpPoint, other: secpOther, scalar: secpScalar, x }[field as "point" | "other" | "scalar" | "x"].value.trim();
      if (value !== "") args[field] = value;
    } else if (field === "point" || field === "other") {
      const value = (field === "point" ? point : other).value.trim();
      if (value !== "") args[field] = pointValue(value);
    } else {
      const value = (field === "scalar" ? scalar : order).value.trim();
      if (value !== "") args[field] = value;
    }
  }
  return args;
});

interface Answer {
  readonly ok: boolean;
  /** `content[0].text`, or the error line an MCP client reads. */
  readonly text: string;
  readonly details?: CurveDetails | Secp256k1Details;
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
      if (name === "compressed") return " --uncompressed";
      const text = typeof value === "object" && value !== null ? `${(value as { x: string }).x},${(value as { y: string }).y}` : String(value);
      return ` --${name} ${shellArg(text)}`;
    })
    .join("");
  return `curves ${operation.tool === "curves_compute" ? "compute" : "secp256k1"} ${operation.op}${flags}`;
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

/** The answer as the response band shows it: a glyph, a heading, rows, and the points of a listing. */
const view = computed(() => {
  const result = answer.value;
  const label = `${answered.value.tool === "curves_compute" ? "Compute" : "secp256k1"} / ${answered.value.op}`;
  if (!result.ok || result.details === undefined) {
    return { icon: "i-lucide-circle-alert", label, heading: "Refused", about: result.error ?? "", rows: [], points: [] };
  }
  const details = result.details;
  const rows: Array<{ label: string; value: string; full?: string; accent?: boolean }> = [];
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

/** secp256k1 samples, each a different kind of point to start from. */
const SECP_SAMPLES = [
  { label: "G and 2G", load: () => ((secpPoint.value = G), (secpOther.value = TWO_G), (secpScalar.value = "3")) },
  { label: "half of G", load: () => ((secpPoint.value = G), (secpScalar.value = HALF)) },
  { label: "x of G", load: () => (x.value = G.slice(2)) },
  { label: "x = 5", load: () => ((x.value = "5".padStart(64, "0")), (secpPoint.value = `02${"5".padStart(64, "0")}`)) },
] as const;

const { copied, copy } = useCopied();

/** The query keys a link may carry, each with the field it sets. */
const FIELDS = { a, b, p, point, other, scalar, order, limit, x } as const;
const SECP_FIELDS = { point: secpPoint, other: secpOther, scalar: secpScalar } as const;

/** Query in, state out. Only values the form knows are read, the rest of the query is ignored. */
function readQuery(query: Readonly<Record<string, unknown>>) {
  const op = OPERATIONS.find((row) => row.key === query.op);
  if (op) key.value = op.key;
  const onSecp = op?.tool === "curves_secp256k1_compute";
  for (const [name, field] of Object.entries(onSecp ? { ...FIELDS, ...SECP_FIELDS } : FIELDS)) {
    if (typeof query[name] === "string") field.value = query[name];
  }
  if (typeof query.uncompressed === "string") uncompressed.value = query.uncompressed === "true";
  request.value = { operation: current.value, args: toolArgs.value };
}

const shareQuery = computed(() => {
  const query: Record<string, string> = { op: current.value.key };
  for (const [name, value] of Object.entries(toolArgs.value)) {
    if (name === "operation") continue;
    if (name === "compressed") query.uncompressed = "true";
    else query[name] = typeof value === "object" && value !== null ? `${(value as { x: string }).x},${(value as { y: string }).y}` : String(value);
  }
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
              <span>{{ row.tool === "curves_compute" ? "compute" : "secp256k1" }}</span>
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
            <dl v-if="!secp" class="console-readout-rows">
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
              <div v-if="current.takes.includes('limit')">
                <dt><label for="playground-limit">limit</label></dt>
                <dd><UInput id="playground-limit" v-model="limit" variant="none" inputmode="numeric" placeholder="default 100" class="w-full" /></dd>
              </div>
            </dl>
            <dl v-else class="console-readout-rows">
              <div v-if="current.takes.includes('point')">
                <dt><label for="playground-secp-point">point</label></dt>
                <dd><UInput id="playground-secp-point" v-model="secpPoint" variant="none" placeholder="SEC1 hex" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('other')">
                <dt><label for="playground-secp-other">other</label></dt>
                <dd><UInput id="playground-secp-other" v-model="secpOther" variant="none" placeholder="SEC1 hex" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('scalar')">
                <dt><label for="playground-secp-scalar">scalar</label></dt>
                <dd><UInput id="playground-secp-scalar" v-model="secpScalar" variant="none" placeholder="hex, 1 to n - 1" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('x')">
                <dt><label for="playground-x">x</label></dt>
                <dd><UInput id="playground-x" v-model="x" variant="none" placeholder="64 hex digits" class="w-full" spellcheck="false" /></dd>
              </div>
              <div v-if="current.takes.includes('compressed')">
                <dt><label for="playground-uncompressed">output</label></dt>
                <dd><UCheckbox id="playground-uncompressed" v-model="uncompressed" label="uncompressed, 65 bytes" /></dd>
              </div>
            </dl>
          </div>

          <div v-if="!secp" class="playground-chips" role="group" aria-label="Sample curves">
            <UButton
              v-for="(sample, index) in CURVES"
              :key="sample.key"
              variant="chip"
              :color="a === String(sample.a) && b === String(sample.curve.b) && p === String(sample.curve.p) ? 'primary' : 'neutral'"
              :label="`F${sample.curve.p}`"
              @click="loadCurve(index)"
            />
          </div>
          <div v-else class="playground-chips" role="group" aria-label="Sample points">
            <UButton v-for="sample in SECP_SAMPLES" :key="sample.label" variant="chip" color="neutral" :label="sample.label" @click="sample.load()" />
          </div>

          <p class="playground-note">
            <template v-if="secp"
              >Points are SEC1 hex, 33 or 65 bytes. The scalar is hex without 0x. It lands in the
              address bar, so keep real keys out of it.</template
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
