import { describe, expect, it } from "vite-plus/test";
import { curvesAiTools } from "../src/ai.ts";
import { curvesTools } from "../src/tools.ts";
import { nobleSignatures } from "./fixtures/bip340.ts";

describe("@agntn/curves/ai", () => {
  it("offers every tool MCP, Pi and OMP list, under the same name and in the same order", () => {
    expect(Object.keys(curvesAiTools)).toEqual(curvesTools.map((tool) => tool.name));
  });

  it("verifies a BIP340 signature through the AI SDK tool", async () => {
    const [signed] = nobleSignatures;
    if (signed === undefined) throw new Error("The BIP340 fixture lost its first signature");
    const { message, signature, publicKey } = signed;
    const output = await curvesAiTools.curves_bip340_compute.execute?.(
      { operation: "verify", publicKey, message, signature },
      { toolCallId: "bip340", messages: [], context: {} },
    );
    expect(output).toMatchObject({ operation: "verify", valid: true });
  });
});
