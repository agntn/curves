import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/** Docus ships its layer as TypeScript source, and that source fails its own check here. */
const DOCUS_SOURCE = /(?:^|\/)node_modules\/docus\//u;

/** `file(line,col): error TS...`. A broken tsconfig reports with no file at all. */
const LOCATED = /^(?<file>[^(\n]+)\(\d+,\d+\): error TS\d+:/u;

const CONFIGS = ["app", "server", "shared", "node"];

/** Everything vue-tsc prints counts against the site, unless Docus's own source caused it. */
export function triage(output: string): { own: string[]; skipped: number } {
  const entries = output
    .trimEnd()
    .split(/\n(?=\S)/u)
    .filter((entry) => entry !== "");
  const own = entries.filter(
    (entry) => !DOCUS_SOURCE.test(LOCATED.exec(entry)?.groups?.file ?? ""),
  );
  return { own, skipped: entries.length - own.length };
}

if (import.meta.main) {
  const docs = fileURLToPath(new URL("..", import.meta.url));
  const vueTsc = createRequire(import.meta.url).resolve("vue-tsc/bin/vue-tsc.js");
  let failed = false;
  let skipped = 0;
  for (const config of CONFIGS) {
    const project = `.nuxt/tsconfig.${config}.json`;
    const run = spawnSync(
      process.execPath,
      [vueTsc, "--noEmit", "--pretty", "false", "-p", project],
      { cwd: docs, encoding: "utf8" },
    );
    if (run.error) throw run.error;
    const result = triage(run.stdout);
    skipped += result.skipped;
    if (result.own.length > 0) {
      console.error(result.own.join("\n"));
      failed = true;
    } else if (run.status !== 0 && (result.skipped === 0 || run.signal !== null)) {
      console.error(`vue-tsc -p ${project} exited with ${run.signal ?? run.status}\n${run.stderr}`);
      failed = true;
    }
  }
  const verdict = failed ? "errors above" : "clean";
  console.log(`vue-tsc: ${verdict}, ${skipped} in Docus's own source skipped.`);
  process.exitCode = failed ? 1 : 0;
}
