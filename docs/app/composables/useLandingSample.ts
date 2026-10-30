import { CURVES, type CurveSample } from "../utils/curves";

/** A tick as an index into a list of the given length, minus one landing on the last entry. */
export function sampleIndex(tick: number, length: number): number {
  return ((tick % length) + length) % length;
}

/** One clock for every landing panel. The library computes the samples, at build and live. */
export function useLandingSample() {
  const samples = CURVES;
  /** Steps taken, never wrapped, so a panel with more samples than curves reaches all of them. */
  const tick = ref(0);
  const paused = ref(false);
  const index = computed(() => sampleIndex(tick.value, samples.length));
  const current = computed(() => samples[index.value]!);

  let timer: number | undefined;

  /** Previous on the first curve lands on the last one, since the index wraps at both ends. */
  function step(delta: number) {
    tick.value += delta;
  }

  function stopWalk() {
    if (timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  }

  function startWalk() {
    stopWalk();
    if (!import.meta.client || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    timer = window.setInterval(() => {
      if (!paused.value && !document.hidden) {
        step(1);
      }
    }, 6000);
  }

  onMounted(startWalk);
  onUnmounted(stopWalk);

  return { samples, tick, index, paused, current, step };
}
