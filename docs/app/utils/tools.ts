import {
  computeBip340,
  computeCurve,
  computeEd25519,
  computeP256,
  computeP384,
  computeP521,
  computeSecp256k1,
  computeSr25519,
  type Bip340Details,
  type CurveDetails,
  type Ed25519Details,
  type P256Details,
  type P384Details,
  type P521Details,
  type Secp256k1Details,
  type Sr25519Details,
  type ToolResult,
} from "#tool-operations";

/** Every agent tool, in the order every surface lists them. Same names over MCP, Pi, OMP and the AI SDK. */
export const TOOLS = ["curves_compute", "curves_secp256k1_compute", "curves_bip340_compute", "curves_p256_compute", "curves_p384_compute", "curves_p521_compute", "curves_sr25519_compute", "curves_ed25519_compute"] as const;

export type ToolName = (typeof TOOLS)[number];

export type ToolDetails = CurveDetails | Secp256k1Details | Bip340Details | P256Details | P384Details | P521Details | Sr25519Details | Ed25519Details;

/**
 * Runs one tool's executor, the one the MCP server runs.
 *
 * @param {ToolName} name - The tool.
 * @param {Record<string, unknown>} params - Its arguments.
 * @returns {ToolResult<ToolDetails>} Text and details.
 */
export function runTool(name: ToolName, params: Readonly<Record<string, unknown>>): ToolResult<ToolDetails> {
  if (name === "curves_compute") return computeCurve(params);
  if (name === "curves_bip340_compute") return computeBip340(params);
  if (name === "curves_p256_compute") return computeP256(params);
  if (name === "curves_p384_compute") return computeP384(params);
  if (name === "curves_p521_compute") return computeP521(params);
  if (name === "curves_ed25519_compute") return computeEd25519(params);
  return name === "curves_secp256k1_compute" ? computeSecp256k1(params) : computeSr25519(params);
}
