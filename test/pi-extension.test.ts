import { fileURLToPath } from "node:url";

import { wireSchema } from "@agntn/tools";
import { describe, expect, it } from "vite-plus/test";

import { computeTool, secp256k1ComputeTool } from "../src/tools.ts";
import { loadPiExtension } from "./fixtures/pi-host.ts";
import { secp256k1Vectors } from "./fixtures/vectors.ts";

const extensionPath = fileURLToPath(
  new URL("../packages/pi/extensions/curves.ts", import.meta.url),
);

describe("pi curves extension", () => {
  it("registers both tools with the shared schemas and nothing else", async () => {
    const host = await loadPiExtension(extensionPath);

    expect([...host.tools.keys()]).toEqual(["curves_compute", "curves_secp256k1_compute"]);
    expect(host.tool("curves_compute").parameters).toEqual(wireSchema(computeTool));
    expect(host.tool("curves_secp256k1_compute").parameters).toEqual(
      wireSchema(secp256k1ComputeTool),
    );
  });

  it("executes through the shared executor and returns structured details", async () => {
    const host = await loadPiExtension(extensionPath);

    const result = await host
      .tool("curves_secp256k1_compute")
      .execute(
        "call-1",
        { operation: "negate", point: secp256k1Vectors.g },
        undefined,
        undefined,
        host.context,
      );

    expect(result.content[0]?.type).toBe("text");
    expect(result.details).toEqual({ operation: "negate", point: secp256k1Vectors.minusG });
  });

  it("fails the call on input the schema rejects and on a refusal of the library", async () => {
    const host = await loadPiExtension(extensionPath);
    const tool = host.tool("curves_compute");

    // Pi records every returned value as a successful call; only a throw fails it.
    await expect(
      tool.execute(
        "call-1",
        { operation: "count", a: "2", b: "2", p: "seventeen" },
        undefined,
        undefined,
        host.context,
      ),
    ).rejects.toThrow("Invalid arguments at /p");
    await expect(
      tool.execute(
        "call-2",
        { operation: "count", a: "0", b: "0", p: "17" },
        undefined,
        undefined,
        host.context,
      ),
    ).rejects.toThrow("singular");
  });
});
