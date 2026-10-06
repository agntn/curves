<script setup lang="ts">
import { SECP_SAMPLES, shortPoint } from "../../utils/secp";

const props = defineProps<{ tick: number }>();
const emit = defineEmits<{ pause: [paused: boolean] }>();

const sample = computed(() => SECP_SAMPLES[props.tick % SECP_SAMPLES.length]!);
const title = computed(() => `curves_secp256k1_compute(${JSON.stringify(sample.value.params)})`);

/** The arguments in, then what came out, the answer in the accent. */
const rows = computed(() => {
  const { params, details } = sample.value;
  const input = Object.entries(params)
    .filter(([name]) => name !== "operation")
    .map(([name, value]) => ({ label: name, value: shortPoint(value), full: value, accent: false }));
  const output =
    details.operation === "lift"
      ? [
          { label: "even", value: shortPoint(details.even), full: details.even, accent: true },
          { label: "odd", value: shortPoint(details.odd), full: details.odd },
        ]
      : details.operation === "check"
        ? [{ label: "onCurve", value: String(details.onCurve), full: String(details.onCurve), accent: true }]
        : [{ label: "point", value: shortPoint(details.point), full: details.point, accent: true }];
  return [...input, ...output];
});
</script>

<template>
  <section
    class="tool-console landing-secp"
    aria-label="One secp256k1 call"
    @mouseenter="emit('pause', true)"
    @mouseleave="emit('pause', false)"
    @focusin="emit('pause', true)"
    @focusout="emit('pause', false)"
  >
    <span class="console-cross console-cross-tl" aria-hidden="true">+</span>
    <span class="console-cross console-cross-br" aria-hidden="true">+</span>

    <header class="console-bar">
      <UTooltip :text="title">
        <span class="console-title secp-title" tabindex="0"
          ><span class="console-tag">Call</span>curves_secp256k1_compute(<Transition name="curves-roll" mode="out-in"
            ><span :key="sample.key" class="curves-roll-slot tok-str">"{{ sample.params.operation }}"</span></Transition
          >)</span
        >
      </UTooltip>
      <span class="console-mark" aria-hidden="true" />
    </header>
    <div class="console-ruler" aria-hidden="true">
      <span :key="sample.key" class="console-cursor" />
    </div>

    <div class="secp-subject">
      <div :key="sample.key" class="console-scan" aria-hidden="true" />
      <div class="secp-identity">
        <ConsoleReticle :key="sample.key" icon="i-lucide-key-round" />
        <!-- Every sample's name in one cell, so the panel keeps the tallest one's height. -->
        <div class="secp-names">
          <div
            v-for="other in SECP_SAMPLES"
            :key="other.key"
            class="secp-name"
            :class="{ 'secp-sizer': other.key !== sample.key }"
            :aria-hidden="other.key !== sample.key ? 'true' : undefined"
          >
            <span class="console-label">secp256k1 / <span class="console-label-key">{{ other.params.operation }}</span></span>
            <h3>{{ other.title }}</h3>
            <p class="secp-note">{{ other.note }}</p>
          </div>
        </div>
      </div>
      <div class="console-readout">
        <!-- Three rows for every sample, empty ones included, so the readout never changes height. -->
        <dl :key="sample.key" class="console-readout-rows console-animate">
          <div v-for="(row, index) in rows" :key="row.label" :style="{ animationDelay: `${index * 45}ms` }">
            <dt>{{ row.label }}</dt>
            <dd :class="{ 'console-accent': row.accent }">
              <UTooltip :text="row.full">
                <span class="secp-line" tabindex="0">{{ row.value }}</span>
              </UTooltip>
            </dd>
          </div>
          <div v-for="pad in Math.max(0, 3 - rows.length)" :key="`pad${pad}`" aria-hidden="true">
            <dt>&#8203;</dt>
            <dd />
          </div>
        </dl>
      </div>
    </div>

    <ConsoleResponse :title="title" :text="sample.text" />

    <footer class="console-footer console-footer-plain">
      <span>SEC1 hex in, SEC1 hex out</span>
      <span class="console-meta">@agntn/curves/secp256k1</span>
    </footer>
  </section>
</template>

<style scoped>
.secp-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.secp-subject {
  position: relative;
  display: grid;
  gap: 16px;
  padding: 18px 20px 20px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Cpath d='M16 18h4m-2-2v4' fill='none' stroke='%23818a94' stroke-opacity='.1'/%3E%3C/svg%3E");
  background-size: 36px 36px;
  background-position: 24px 20px;
}
.secp-subject > :not(.console-scan) {
  position: relative;
}
.secp-identity {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}
.secp-names {
  display: grid;
  min-width: 0;
}
.secp-name {
  display: grid;
  grid-area: 1 / 1;
  gap: 4px;
  min-width: 0;
}
.secp-sizer {
  visibility: hidden;
}
.secp-name h3 {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 22px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--ui-text-highlighted);
}
.secp-note {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-text-muted);
}
.landing-secp .console-readout-rows > div {
  grid-template-columns: 6.5rem minmax(0, 1fr);
}
.landing-secp .console-readout-rows dt {
  text-transform: none;
  letter-spacing: 0.02em;
}
.secp-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (width < 400px) {
  .secp-subject {
    padding-inline: 14px;
  }
  .secp-identity {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 12px;
  }
}
</style>
