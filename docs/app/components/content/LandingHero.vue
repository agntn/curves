<script setup lang="ts">
import { version } from "../../../../package.json";
import type { CurveSample } from "../../utils/curves";
import { MAX_LOG_ORDER, MAX_ORDER_PRIME, OPERATION_COUNT, powerOfTwo } from "../../utils/contract";
import { TOOLS } from "../../utils/tools";

defineProps<{ sample: CurveSample; samples: readonly CurveSample[] }>();
const emit = defineEmits<{ step: [delta: number]; pause: [paused: boolean] }>();

const INSTALL = "pnpm add @agntn/curves";
const { copied, copy } = useCopied();
</script>

<template>
  <header class="curves-hero hero-page">
    <div class="hero-zone">
      <span class="hero-cross hero-cross-tl" aria-hidden="true">+</span>
      <span class="hero-cross hero-cross-tr" aria-hidden="true">+</span>
      <span class="hero-bracket hero-bracket-l" aria-hidden="true" />
      <span class="hero-bracket hero-bracket-r" aria-hidden="true" />

      <p class="console-id">
        <span class="console-id-tag">ID</span>
        <span>@agntn/curves</span>
        <span class="console-id-sep" aria-hidden="true">/</span>
        <span>v{{ version }}</span>
      </p>

      <h1 class="hero-title">Find k. <span>Don't guess it.</span></h1>
      <p class="hero-lead">
        A CTF hands you a curve, a point and another point. What's k? A model will do the modular
        inverse in its head and get it wrong by step three. This does the arithmetic. Points, orders,
        counts and discrete logs on a curve you define, plus secp256k1 with SEC1 points. Written from
        the specs, no noble underneath. Same call in TypeScript, the terminal and your agent.
      </p>

      <dl class="hero-metrics">
        <div>
          <dt>Operations</dt>
          <dd>{{ OPERATION_COUNT }}</dd>
          <dd class="hero-metric-sub">in {{ TOOLS.length }} agent tools</dd>
        </div>
        <div>
          <dt>Orders up to</dt>
          <dd>{{ powerOfTwo(MAX_ORDER_PRIME) }}</dd>
          <dd class="hero-metric-sub">logs for a base up to {{ powerOfTwo(MAX_LOG_ORDER) }}</dd>
        </div>
        <div>
          <dt>Network calls</dt>
          <dd class="hero-metric-accent">0</dd>
          <dd class="hero-metric-sub">every point computed in place</dd>
        </div>
      </dl>

      <div class="console-actions">
        <UButton
          to="/guide"
          color="primary"
          variant="solid"
          trailing-icon="i-lucide-arrow-right"
          label="Get started"
        />
        <UButton
          to="https://github.com/agntn/curves"
          target="_blank"
          color="neutral"
          variant="outline"
          icon="i-simple-icons-github"
          label="Star on GitHub"
        />
      </div>
      <div class="console-install">
        <span class="console-install-tag">Install</span>
        <code><span class="console-install-prompt">$</span> {{ INSTALL }}</code>
        <UButton
          color="neutral"
          variant="subtle"
          :icon="copied === 'install' ? 'i-lucide-check' : 'i-lucide-copy'"
          :aria-label="copied === 'install' ? 'Copied' : 'Copy install command'"
          @click="copy('install', INSTALL)"
        />
      </div>
    </div>

    <!-- One small curve, every point on it, and the walk from G to k times G. -->
    <div class="hero-instrument">
      <svg class="hero-circuit" viewBox="0 0 160 56" aria-hidden="true">
        <path class="hero-circuit-rail" d="M80 0V16L96 32V56" />
        <path :key="sample.key" class="hero-circuit-live" d="M80 0V16L96 32V56" pathLength="1" />
        <path class="hero-circuit-seg" d="M96 38V48" />
        <rect class="hero-circuit-node" x="92.5" y="52.5" width="7" height="7" />
      </svg>
      <span class="hero-circuit-tag" aria-hidden="true">multiply</span>
      <LandingField
        :sample="sample"
        :samples="samples"
        @step="emit('step', $event)"
        @pause="emit('pause', $event)"
      />
    </div>
  </header>
</template>
