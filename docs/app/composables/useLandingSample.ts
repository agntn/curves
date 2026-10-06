import { CURVES, type CurveSample } from "../utils/curves";

/** One clock for every landing panel. The library computes the samples, at build and live. */
export function useLandingSample() {
  const samples = CURVES;
  const tick = ref(0);
  const paused = ref(false);
  const index = computed(() => tick.value % samples.length);
  const current = computed(() => samples[index.value]!);

  let timer: number | undefined;

  /** Wraps at both ends, so previous on the first curve lands on the last one. */
  function step(delta: number) {
    tick.value = (tick.value + delta + samples.length) % samples.length;
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
