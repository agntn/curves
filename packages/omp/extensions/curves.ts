import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { registerOmpTools, type OmpResultView } from "@agntn/tools/omp";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

import type * as CurvesTools from "../../../dist/tools.d.mts";

/** Longest argument on the status line, cut before `sanitizeLine`, which is slow on long escapes. */
const PREVIEW_LENGTH = 100;

const sourceModulePath = fileURLToPath(new URL("../../../src/tools.ts", import.meta.url));

/**
 * Both specifiers stay literal: compiled OMP resolves bare imports only where it sees them.
 *
 * @returns {Promise<typeof CurvesTools>} The definitions and the executor loader.
 */
function loadTools(): Promise<typeof CurvesTools> {
  return (
    existsSync(sourceModulePath)
      ? import("../../../src/tools.ts")
      : import("../../../dist/tools.mjs")
  ) as Promise<typeof CurvesTools>;
}

/**
 * Names the answer of a call: the point, the verdict, the count or the log.
 *
 * @param result - Tool result from the host.
 * @returns {string[]} One entry per field of the answer, the operation left out.
 */
function describeAnswer(result: OmpResultView): string[] {
  const { details } = result;
  if (typeof details !== "object" || details === null) return [];
  return Object.entries(details)
    .filter(([key]) => key !== "operation")
    .map(([key, value]) =>
      `${key} ${typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}`.slice(
        0,
        PREVIEW_LENGTH,
      ),
    );
}

const answerRenderer = {
  describeCall: (args: Readonly<Record<string, unknown>>) =>
    String(args["operation"]).slice(0, PREVIEW_LENGTH),
  describeResult: describeAnswer,
};

/**
 * Registers the curve tools; the executors load on the first call.
 *
 * @param pi - OMP extension API supplied by the host.
 */
export default async function curvesExtension(pi: ExtensionAPI): Promise<void> {
  pi.setLabel("Curves");
  const { curvesTools } = await loadTools();
  registerOmpTools(pi, curvesTools, {
    Text: pi.pi.Text,
    renderers: {
      curves_compute: answerRenderer,
      curves_secp256k1_compute: answerRenderer,
    },
  });
}
