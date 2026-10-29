import { describe, expect, it } from "vite-plus/test";
import { curvesAiTools } from "../src/ai.ts";
import { curvesTools } from "../src/tools.ts";
import { nobleSignatures } from "./fixtures/bip340.ts";
import { speccheck } from "./fixtures/ed25519.ts";

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

  it("verifies an Ed25519 signature through the AI SDK tool, strict on request", async () => {
    const [smallOrder] = speccheck;
    if (smallOrder === undefined) throw new Error("The speccheck fixture lost case 0");
    const { message, signature, publicKey } = smallOrder;
    const options = { toolCallId: "ed25519", messages: [], context: {} };
    const call = { operation: "verify", publicKey, message, signature };
    const tool = curvesAiTools.curves_ed25519_compute;
    expect(await tool.execute?.(call, options)).toMatchObject({ valid: true });
    expect(await tool.execute?.({ ...call, zip215: false }, options)).toMatchObject({
      valid: false,
    });
  });
});
