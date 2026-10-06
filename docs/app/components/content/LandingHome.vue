<script setup lang="ts">
import { CURVE_OPERATIONS, MAX_COUNTED_PRIME, MAX_LOG_ORDER, SECP256K1_OPERATIONS, powerOfTwo } from "../../utils/contract";
import { spellOutCapital } from "../../utils/format";
import { TOOLS } from "../../utils/tools";

const { samples, tick, paused, current, step } = useLandingSample();
</script>

<template>
  <div class="curves-landing not-prose">
    <LandingHero :sample="current" :samples="samples" @step="step" @pause="paused = $event" />

    <LandingFeature
      title="Ask for k, get k"
      to="/math/groups"
      link="Orders and discrete logs"
      :checks="[
        `Counting and listing points for p up to ${powerOfTwo(MAX_COUNTED_PRIME)}, one x at a time`,
        'Orders by baby step giant step over the Hasse interval',
        `Logs for a base of order up to ${powerOfTwo(MAX_LOG_ORDER)}. No k? You get null, not a guess`,
      ]"
    >
      CTFs love a toy curve. Small prime, a base point, a target, find k. A model will try it in its
      head and drift by step three. <code class="curves-code">curves_compute</code> does the walk in
      code and hands back the order it searched in, so you know the answer is the smallest k. Every
      sample above goes through it right in your tab.
      <template #visual>
        <LandingToolCall :sample="current" @pause="paused = $event" />
      </template>
    </LandingFeature>

    <LandingFeature
      title="secp256k1, no noble"
      to="/math/secp256k1"
      link="secp256k1 with SEC1 points"
      :checks="[
        'Add, subtract, negate and multiply points, lift an x, check a point',
        'Scalars mod n: add, subtract, multiply, invert',
        'Domain parameters from SEC 2, encodings from SEC 1, Jacobian coordinates inside',
      ]"
      reverse
    >
      Two public keys and you need their sum? Or the x-only key of a Taproot output as a full
      point? <code class="curves-code">@agntn/curves/secp256k1</code> takes SEC1 hex and gives SEC1
      hex back. It's written here from the SEC specs, not wrapped around another library. And it
      agrees with <code class="curves-code">@noble/curves</code> on every vector we threw at it.
      <template #visual>
        <LandingSecp :tick="tick" @pause="paused = $event" />
      </template>
    </LandingFeature>

    <LandingFeature
      :title="`${spellOutCapital(TOOLS.length)} tools, one executor`"
      to="/guide/agents"
      link="MCP, Pi, OMP and AI SDK"
      :checks="[
        `${TOOLS[0]}: ${CURVE_OPERATIONS.join(', ')}`,
        `${TOOLS[1]}: ${SECP256K1_OPERATIONS.join(', ')}`,
        'An argument the operation does not take is an error, never silently dropped',
      ]"
    >
      <code class="curves-code">curves mcp</code>, the Pi and OMP extensions and
      <code class="curves-code">@agntn/curves/ai</code> all call the same executors. This page runs
      them too. Open a full response on any instrument above and you're reading exactly what a
      model reads. Integers travel as decimal strings, since JSON has never heard of a bigint.
      <template #visual>
        <LandingAgents />
      </template>
    </LandingFeature>

    <section class="curves-section">
      <div class="mx-auto w-full max-w-[var(--ui-container)] px-8 py-20 sm:px-12 lg:px-16">
        <LandingStart />
      </div>
    </section>
  </div>
</template>
