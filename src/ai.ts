/** Vercel AI SDK tool surface over the shared curve tool definitions. */

import { toAiTool, type AiToolOutput } from "@agntn/tools/ai";
import type { Static } from "@agntn/tools";
import type { Tool } from "ai";
import type {
  Bip340Details,
  BrainpoolP256r1Details,
  CurveDetails,
  Ed25519Details,
  P256Details,
  P384Details,
  P521Details,
  Secp256k1Details,
  Sr25519Details,
} from "./tool-operations.ts";
import {
  bip340ComputeSchema,
  bip340ComputeTool,
  brainpoolP256r1ComputeSchema,
  brainpoolP256r1ComputeTool,
  computeSchema,
  computeTool,
  ed25519ComputeSchema,
  ed25519ComputeTool,
  p256ComputeSchema,
  p256ComputeTool,
  p384ComputeSchema,
  p384ComputeTool,
  p521ComputeSchema,
  p521ComputeTool,
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

export const curvesP256ComputeTool: Tool<
  Static<typeof p256ComputeSchema>,
  AiToolOutput<P256Details>
> = toAiTool(p256ComputeTool);

export const curvesP384ComputeTool: Tool<
  Static<typeof p384ComputeSchema>,
  AiToolOutput<P384Details>
> = toAiTool(p384ComputeTool);

export const curvesP521ComputeTool: Tool<
  Static<typeof p521ComputeSchema>,
  AiToolOutput<P521Details>
> = toAiTool(p521ComputeTool);

export const curvesBrainpoolP256r1ComputeTool: Tool<
  Static<typeof brainpoolP256r1ComputeSchema>,
  AiToolOutput<BrainpoolP256r1Details>
> = toAiTool(brainpoolP256r1ComputeTool);

export const curvesSr25519ComputeTool: Tool<
  Static<typeof sr25519ComputeSchema>,
  AiToolOutput<Sr25519Details>
> = toAiTool(sr25519ComputeTool);

export const curvesEd25519ComputeTool: Tool<
  Static<typeof ed25519ComputeSchema>,
  AiToolOutput<Ed25519Details>
> = toAiTool(ed25519ComputeTool);

/** Every curve tool, keyed by the name MCP, Pi and OMP use for it. */
export const curvesAiTools = {
  curves_compute: curvesComputeTool,
  curves_secp256k1_compute: curvesSecp256k1ComputeTool,
  curves_bip340_compute: curvesBip340ComputeTool,
  curves_p256_compute: curvesP256ComputeTool,
  curves_p384_compute: curvesP384ComputeTool,
  curves_p521_compute: curvesP521ComputeTool,
  curves_brainpoolp256r1_compute: curvesBrainpoolP256r1ComputeTool,
  curves_sr25519_compute: curvesSr25519ComputeTool,
  curves_ed25519_compute: curvesEd25519ComputeTool,
};
