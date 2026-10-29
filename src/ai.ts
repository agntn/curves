/** Vercel AI SDK tool surface over the shared curve tool definitions. */

import { toAiTool, type AiToolOutput } from "@agntn/tools/ai";
import type { Static } from "@agntn/tools";
import type { Tool } from "ai";
import type {
  Bip340Details,
  CurveDetails,
  Secp256k1Details,
  Sr25519Details,
} from "./tool-operations.ts";
import {
  bip340ComputeSchema,
  bip340ComputeTool,
  computeSchema,
  computeTool,
  secp256k1ComputeSchema,
  secp256k1ComputeTool,
  sr25519ComputeSchema,
  sr25519ComputeTool,
} from "./tools.ts";

export const curvesComputeTool: Tool<
  Static<typeof computeSchema>,
  AiToolOutput<CurveDetails>
> = toAiTool(computeTool);

export const curvesSecp256k1ComputeTool: Tool<
  Static<typeof secp256k1ComputeSchema>,
  AiToolOutput<Secp256k1Details>
> = toAiTool(secp256k1ComputeTool);

export const curvesBip340ComputeTool: Tool<
  Static<typeof bip340ComputeSchema>,
  AiToolOutput<Bip340Details>
> = toAiTool(bip340ComputeTool);

export const curvesSr25519ComputeTool: Tool<
  Static<typeof sr25519ComputeSchema>,
  AiToolOutput<Sr25519Details>
> = toAiTool(sr25519ComputeTool);

/** Every curve tool, keyed by the name MCP, Pi and OMP use for it. */
export const curvesAiTools = {
  curves_compute: curvesComputeTool,
  curves_secp256k1_compute: curvesSecp256k1ComputeTool,
  curves_bip340_compute: curvesBip340ComputeTool,
  curves_sr25519_compute: curvesSr25519ComputeTool,
};
