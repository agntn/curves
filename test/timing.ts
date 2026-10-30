/* Median milliseconds of each run, the two interleaved so drift hits both alike. */
export function medians(first: () => unknown, second: () => unknown): [number, number] {
  const times: [number[], number[]] = [[], []];
  for (let round = 0; round < 45; round++) {
    for (const [index, run] of [first, second].entries()) {
      const start = performance.now();
      run();
      if (round >= 5) times[index === 0 ? 0 : 1].push(performance.now() - start);
    }
  }
  const middle = (values: readonly number[]): number => values.toSorted((a, b) => a - b)[20] ?? 0;
  return [middle(times[0]), middle(times[1])];
}
