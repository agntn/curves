<script setup lang="ts">
import type { AffinePoint } from "@agntn/curves";
import type { CurveSample } from "../../utils/curves";
import { equation, pointText } from "../../utils/curves";

const props = defineProps<{ sample: CurveSample; samples: readonly CurveSample[] }>();
const emit = defineEmits<{ step: [delta: number]; pause: [paused: boolean] }>();

const position = computed(() => props.samples.findIndex((other) => other.key === props.sample.key) + 1);
const call = computed(
  () =>
    `multiplyPoint(defineCurve({ a: ${props.sample.a}n, b: ${props.sample.curve.b}n, p: ${props.sample.curve.p}n }), ${pointText(props.sample.base)}, ${props.sample.scalar}n)`,
);

/** The plot is 100 units a side; x runs right, y up, one cell per field element. */
function place(point: Readonly<AffinePoint>, p: bigint): { x: number; y: number } {
  const cell = 100 / Number(p);
  return { x: (Number(point.x) + 0.5) * cell, y: 100 - (Number(point.y) + 0.5) * cell };
}

const plot = computed(() => {
  const { p } = props.sample.curve;
  const walk = props.sample.walk.map((point) => place(point, p));
  return {
    size: Math.min(3.4, Math.max(1.3, 44 / Number(p))),
    dots: props.sample.points.map((point) => ({ key: `${point.x},${point.y}`, ...place(point, p) })),
    path: walk.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(""),
    base: walk[0]!,
    target: walk.at(-1)!,
    ticks: Array.from({ length: Number(p) + 1 }, (_, index) => index * (100 / Number(p))),
  };
});

/** The walk as rows: the first five multiples, a gap, the last two. Always eight rows tall. */
const steps = computed(() => {
  const walk = props.sample.walk;
  const row = (index: number) => ({ key: String(index), k: `${index + 1}G`, point: pointText(walk[index]!), last: index === walk.length - 1 });
  if (walk.length <= 8) return walk.map((_, index) => row(index));
  return [
    ...[0, 1, 2, 3, 4].map(row),
    { key: "gap", k: "…", point: `${walk.length - 7} more`, last: false },
    row(walk.length - 2),
    row(walk.length - 1),
  ];
});

/** One tick per multiple up to the order of G, the ones the walk took open. */
const ticks = computed(() =>
  Array.from({ length: Number(props.sample.order) }, (_, index) => ({ key: index, open: BigInt(index) < props.sample.scalar })),
);
</script>

<template>
  <section
    class="tool-console console-wide landing-field"
    aria-label="One small curve, every point on it, and the walk from G to k times G"
    @mouseenter="emit('pause', true)"
    @mouseleave="emit('pause', false)"
    @focusin="emit('pause', true)"
    @focusout="emit('pause', false)"
  >
    <span class="console-cross console-cross-tl" aria-hidden="true">+</span>
    <span class="console-cross console-cross-br" aria-hidden="true">+</span>

    <header class="console-bar">
      <UTooltip :text="call">
        <span class="console-title field-call" tabindex="0"
          ><span class="console-tag">Call</span>multiplyPoint(curve, G, {{ sample.scalar }}n)</span
        >
      </UTooltip>
      <span class="console-meta">F{{ sample.curve.p }} · {{ String(position).padStart(2, "0") }} / {{ samples.length }}</span>
      <span class="console-mark" aria-hidden="true" />
    </header>
    <div class="console-ruler" aria-hidden="true">
      <span :key="sample.key" class="console-cursor" />
    </div>

    <div class="console-band console-subject-band field-subject">
      <div :key="sample.key" class="console-scan" aria-hidden="true" />
      <div class="field-left">
        <div class="console-identity-block">
          <ConsoleReticle :key="sample.key" icon="i-lucide-spline" />
          <!-- Every sample's name sits in the same cell, hidden, so the band keeps the tallest one's height. -->
          <div class="field-names">
            <div
              v-for="other in samples"
              :key="other.key"
              class="console-name"
              :class="{ 'field-sizer': other.key !== sample.key }"
              :aria-hidden="other.key !== sample.key ? 'true' : undefined"
            >
              <span class="console-label">Curve / <span class="console-label-key">F{{ other.curve.p }}</span></span>
              <h3>{{ equation(other) }}</h3>
              <p class="console-about">{{ other.about }}</p>
            </div>
          </div>
        </div>

        <div class="field-board">
          <p class="console-label console-rule-title">
            <span>Field <span aria-hidden="true">[ every point, and the walk from G to {{ sample.scalar }}G ]</span></span>
            <span class="console-mark" aria-hidden="true" />
          </p>
          <div class="field-pair">
          <svg
            :key="sample.key"
            class="field-plot"
            viewBox="-4 -4 108 108"
            role="img"
            :aria-label="`${sample.points.length} points over F${sample.curve.p}; the walk visits ${sample.walk.length} of them and ends at ${pointText(sample.target)}`"
          >
            <path class="field-frame" d="M0 0H100V100H0Z" />
            <path
              v-for="tick in plot.ticks"
              :key="`x${tick}`"
              class="field-tick"
              :d="`M${tick.toFixed(2)} 100V102.5M-2.5 ${tick.toFixed(2)}H0`"
            />
            <rect
              v-for="dot in plot.dots"
              :key="dot.key"
              class="field-dot"
              :x="dot.x - plot.size / 2"
              :y="dot.y - plot.size / 2"
              :width="plot.size"
              :height="plot.size"
            />
            <path class="field-walk" :d="plot.path" pathLength="1" />
            <rect class="field-base" :x="plot.base.x - 2" :y="plot.base.y - 2" width="4" height="4" />
            <rect class="field-target" :x="plot.target.x - 2.6" :y="plot.target.y - 2.6" width="5.2" height="5.2" />
          </svg>
          <ol :key="sample.key" class="field-steps console-animate" aria-label="The walk, multiple by multiple">
            <li
              v-for="(item, index) in steps"
              :key="item.key"
              :class="{ 'field-step-last': item.last, 'field-step-gap': item.key === 'gap' }"
              :style="{ animationDelay: `${index * 30}ms` }"
            >
              <span>{{ item.k }}</span>
              <span class="console-leader" aria-hidden="true" />
              <span>{{ item.point }}</span>
            </li>
          </ol>
          </div>
          <p class="field-legend">
            <span><span class="field-swatch field-swatch-dot" aria-hidden="true" />point</span>
            <span><span class="field-swatch field-swatch-base" aria-hidden="true" />G {{ pointText(sample.base) }}</span>
            <span><span class="field-swatch field-swatch-target" aria-hidden="true" />{{ sample.scalar }}G {{ pointText(sample.target) }}</span>
          </p>
        </div>
      </div>

      <div class="console-readout">
        <svg class="console-link" viewBox="0 0 32 40" fill="none" aria-hidden="true">
          <circle cx="3" cy="12" r="2.5" />
          <path d="M5.5 12H14L22 20H32" />
        </svg>
        <dl :key="sample.key" class="console-readout-rows console-animate">
          <div>
            <dt>Points</dt>
            <dd><span class="field-line">{{ sample.count }} with infinity</span></dd>
          </div>
          <div>
            <dt>G</dt>
            <dd><span class="field-line">{{ pointText(sample.base) }}</span></dd>
          </div>
          <div>
            <dt>Order of G</dt>
            <dd><span class="field-line">{{ sample.order }}</span></dd>
          </div>
          <div>
            <dt>{{ sample.scalar }}G</dt>
            <dd class="console-accent"><span class="field-line">{{ pointText(sample.target) }}</span></dd>
          </div>
          <div>
            <dt>Log back</dt>
            <dd>
              <UTooltip :text="`discreteLog(curve, G, ${pointText(sample.target)}) = ${sample.log}n`">
                <span class="field-line" tabindex="0">k = {{ sample.log }}</span>
              </UTooltip>
            </dd>
          </div>
        </dl>
        <div class="console-gauge" :aria-label="`${sample.scalar} of the ${sample.order} multiples of G walked`">
          <span class="console-ticks" aria-hidden="true">
            <span
              v-for="(tick, index) in ticks"
              :key="tick.key"
              :class="tick.open ? 'console-tick-open' : 'console-tick-closed'"
              :style="{ animationDelay: `${Math.min(index * 12, 720)}ms` }"
            />
          </span>
          <span class="console-gauge-read">walked {{ sample.scalar }} / {{ sample.order }}</span>
        </div>
      </div>
    </div>

    <footer class="console-footer console-footer-plain">
      <NuxtLink to="/math/groups" class="field-link"
        ><span aria-hidden="true">→ </span>Orders and logs<span> · /math/groups</span></NuxtLink
      >
      <div class="console-controls" aria-label="Sample curves">
        <UButton
          color="neutral"
          variant="subtle"
          square
          icon="i-lucide-chevron-left"
          aria-label="Previous curve"
          @click="emit('step', -1)"
        />
        <span>Curve</span>
        <UButton
          color="neutral"
          variant="subtle"
          square
          icon="i-lucide-chevron-right"
          aria-label="Next curve"
          @click="emit('step', 1)"
        />
      </div>
    </footer>
  </section>
</template>

<style scoped>
.field-call {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.field-names {
  display: grid;
  min-width: 0;
}
.field-names > .console-name {
  grid-area: 1 / 1;
}
.field-sizer {
  visibility: hidden;
}
.field-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.landing-field :deep(.console-readout-rows > div) {
  grid-template-columns: 6.5rem minmax(0, 1fr);
}
.landing-field :deep(.console-readout-rows dt) {
  text-transform: none;
  letter-spacing: 0.02em;
}
/* The left column: the curve, then its field with every point and the walk on it. */
.field-left {
  display: grid;
  gap: 18px;
  min-width: 0;
}
.field-board {
  display: grid;
  gap: 10px;
  min-width: 0;
}
.field-board > .console-rule-title {
  margin: 0 0 2px;
}
/* The field and the walk beside it; under 40rem of the band the walk goes under the field. */
.field-pair {
  display: grid;
  grid-template-columns: minmax(0, 19rem) minmax(0, 1fr);
  gap: 24px 32px;
  align-items: start;
}
.field-steps {
  display: grid;
  grid-auto-rows: 28px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: var(--font-mono);
  font-size: 12px;
}
.field-steps > li {
  display: grid;
  grid-template-columns: 3rem minmax(1rem, 1fr) auto;
  gap: 10px;
  align-items: center;
  color: var(--ui-text-muted);
}
.field-steps > li > span:last-child {
  white-space: nowrap;
  color: var(--ui-text-highlighted);
}
.field-steps > .field-step-gap > span {
  color: var(--ui-text-dimmed);
}
.field-steps > .field-step-last > span:first-child,
.field-steps > .field-step-last > span:last-child {
  color: var(--console-accent);
}
@container (width < 40rem) {
  .field-pair {
    grid-template-columns: minmax(0, 1fr);
  }
}
.field-plot {
  display: block;
  width: 100%;
  max-width: 19rem;
  aspect-ratio: 1;
  overflow: visible;
}
.field-frame {
  fill: none;
  stroke: var(--console-line);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.field-tick {
  stroke: var(--console-corner);
  stroke-opacity: 0.5;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.field-dot {
  fill: color-mix(in srgb, var(--ui-text-muted) 55%, var(--ui-bg));
}
.field-walk {
  fill: none;
  stroke: color-mix(in srgb, var(--console-accent) 70%, transparent);
  stroke-width: 1;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: field-draw 1.6s ease-out 0.2s forwards;
}
.field-base {
  fill: var(--ui-bg);
  stroke: var(--ui-text-highlighted);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.field-target {
  fill: var(--console-accent);
}
.field-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--ui-text-muted);
}
.field-legend > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.field-swatch {
  display: inline-block;
  width: 8px;
  height: 8px;
}
.field-swatch-dot {
  background: color-mix(in srgb, var(--ui-text-muted) 55%, var(--ui-bg));
}
.field-swatch-base {
  box-shadow: inset 0 0 0 1px var(--ui-text-highlighted);
}
.field-swatch-target {
  background: var(--console-accent);
}
@keyframes field-draw {
  to {
    stroke-dashoffset: 0;
  }
}
/* Side by side, the readout runs as tall as the board beside it; stacked, it keeps its own height. */
@container (width >= 46rem) {
  .field-subject > .console-readout {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    align-self: stretch;
  }
  .field-subject .console-readout-rows {
    grid-auto-rows: minmax(2.5rem, 1fr);
  }
  .field-subject .console-readout-rows > div {
    align-items: center;
  }
}
.field-link {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text-highlighted);
}
.field-link > span:last-child {
  color: var(--ui-text-dimmed);
}
.field-link:hover {
  color: var(--console-accent);
}
.field-link:focus-visible {
  outline: 1px solid var(--ui-primary);
  outline-offset: 3px;
}
@media (width < 640px) {
  .field-board > .console-rule-title > .console-mark {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .field-walk {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
