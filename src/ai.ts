/** Vercel AI SDK tool surface over the shared curve tool definitions. */

import { toAiTool, type AiToolOutput } from "@agntn/tools/ai";
import type { Static } from "@agntn/tools";
import type { Tool } from "ai";
import type { CurveDetails, Secp256k1Details } from "./tool-operations.ts";
import {
  computeSchema,
  computeTool,
  secp256k1ComputeSchema,
  secp256k1ComputeTool,
} from "./tools.ts";

export const curvesComputeTool: Tool<
  Static<typeof computeSchema>,
  AiToolOutput<CurveDetails>
> = toAiTool(computeTool);

export const curvesSecp256k1ComputeTool: Tool<
  Static<typeof secp256k1ComputeSchema>,
  AiToolOutput<Secp256k1Details>
> = toAiTool(secp256k1ComputeTool);

/** Every curve tool, keyed by the name MCP, Pi and OMP use for it. */
export const curvesAiTools = {
  curves_compute: curvesComputeTool,
  curves_secp256k1_compute: curvesSecp256k1ComputeTool,
};
