<script setup lang="ts">
import type { CurveSample } from "../../utils/curves";
import { pointArgument, pointText } from "../../utils/curves";
import { runTool } from "../../utils/tools";
import type { CurveDetails } from "#tool-operations";

const props = defineProps<{ sample: CurveSample }>();
const emit = defineEmits<{ pause: [paused: boolean] }>();

const params = computed(() => ({
  operation: "log",
  a: String(props.sample.a),
  b: String(props.sample.curve.b),
  p: String(props.sample.curve.p),
  point: pointArgument(props.sample.base),
  other: pointArgument(props.sample.target),
}));
const result = computed(() => runTool("curves_compute", params.value));
const text = computed(() => result.value.content[0]!.text);
const details = computed(() => result.value.details as Extract<CurveDetails, { operation: "log" }>);
const title = computed(() => `curves_compute(${JSON.stringify(params.value)})`);

/** What the tool text tells a model, as rows: the curve, the order it searched in, the answer. */
const rows = computed(() => [
  { label: "base", value: pointText(props.sample.base) },
  { label: "target", value: pointText(props.sample.target) },
  { label: "order", value: details.value.order },
  { label: "scalar", value: details.value.scalar ?? "null, no k", accent: true },
]);
</script>

<template>
  <section
    class="tool-console landing-call"
    aria-label="One tool call"
    @mouseenter="emit('pause', true)"
    @mouseleave="emit('pause', false)"
    @focusin="emit('pause', true)"
    @focusout="emit('pause', false)"
  >
    <span class="console-cross console-cross-tl" aria-hidden="true">+</span>
    <span class="console-cross console-cross-br" aria-hidden="true">+</span>

    <header class="console-bar">
      <UTooltip :text="title">
        <span class="console-title call-title" tabindex="0"
          ><span class="console-tag">Call</span>curves_compute(<span class="tok-str">"log"</span>, p
          <Transition name="curves-roll" mode="out-in"
            ><span :key="sample.key" class="curves-roll-slot">{{ sample.curve.p }}</span></Transition
          >)</span
        >
      </UTooltip>
      <span class="console-mark" aria-hidden="true" />
    </header>
    <div class="console-ruler" aria-hidden="true">
      <span :key="sample.key" class="console-cursor" />
    </div>

    <!-- The question on the crosses grid, what the tool text tells a model in the readout. -->
    <div class="call-subject">
      <div :key="sample.key" class="console-scan" aria-hidden="true" />
      <div class="call-identity">
        <ConsoleReticle :key="sample.key" icon="i-lucide-target" />
        <div class="call-name">
          <span class="console-label">Tool / <span class="console-label-key">log</span></span>
          <h3>Which k gives {{ pointText(sample.target) }}?</h3>
          <p class="call-note">
            Baby step giant step, in the executor. The model asks, the library answers, nobody
            does long division in a chat window.
          </p>
        </div>
      </div>
      <div class="console-readout">
        <dl :key="sample.key" class="console-readout-rows console-animate">
          <div v-for="(row, index) in rows" :key="row.label" :style="{ animationDelay: `${index * 45}ms` }">
            <dt>{{ row.label }}</dt>
            <dd :class="{ 'console-accent': row.accent }">
              <span class="call-line">{{ row.value }}</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <ConsoleResponse :title="title" :text="text" />

    <footer class="console-footer console-footer-plain">
      <span aria-label="Supported hosts: MCP, Pi and OMP">MCP · Pi · OMP</span>
      <span class="console-meta">curves mcp · stdio</span>
    </footer>
  </section>
</template>

<style scoped>
.call-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.call-subject {
  position: relative;
  display: grid;
  gap: 16px;
  padding: 18px 20px 20px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Cpath d='M16 18h4m-2-2v4' fill='none' stroke='%23818a94' stroke-opacity='.1'/%3E%3C/svg%3E");
  background-size: 36px 36px;
  background-position: 24px 20px;
}
.call-subject > :not(.console-scan) {
  position: relative;
}
.call-identity {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}
.call-name {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.call-name h3 {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 22px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--ui-text-highlighted);
}
.call-note {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-text-muted);
}
.landing-call .console-readout-rows > div {
  grid-template-columns: 6.5rem minmax(0, 1fr);
}
.landing-call .console-readout-rows dt {
  text-transform: none;
  letter-spacing: 0.02em;
}
.call-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (width < 400px) {
  .call-subject {
    padding-inline: 14px;
  }
  .call-identity {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 12px;
  }
}
</style>
