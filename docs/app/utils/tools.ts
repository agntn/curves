import {
  computeCurve,
  computeSecp256k1,
  computeSr25519,
  type CurveDetails,
  type Secp256k1Details,
  type Sr25519Details,
  type ToolResult,
} from "#tool-operations";

/** Every agent tool, in the order every surface lists them. Same names over MCP, Pi, OMP and the AI SDK. */
export const TOOLS = ["curves_compute", "curves_secp256k1_compute", "curves_sr25519_compute"] as const;

export type ToolName = (typeof TOOLS)[number];

export type ToolDetails = CurveDetails | Secp256k1Details | Sr25519Details;

/**
 * Runs one tool's executor, the one the MCP server runs.
 *
 * @param {ToolName} name - The tool.
 * @param {Record<string, unknown>} params - Its arguments.
 * @returns {ToolResult<ToolDetails>} Text and details.
 */
export function runTool(name: ToolName, params: Readonly<Record<string, unknown>>): ToolResult<ToolDetails> {
  if (name === "curves_compute") return computeCurve(params);
  return name === "curves_secp256k1_compute" ? computeSecp256k1(params) : computeSr25519(params);
}
