import { describe, expect, it } from "vite-plus/test";
import { curvesAiTools } from "../src/ai.ts";
import { curvesTools } from "../src/tools.ts";
import { nobleEdges, nobleSignatures } from "./fixtures/bip340.ts";
import { nobleEdges as ecdsaEdges } from "./fixtures/ecdsa.ts";
import { rfc8032Keys, rfc8032Signatures, speccheck } from "./fixtures/ed25519.ts";

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

  it("signs with ECDSA and BIP340 through the AI SDK tools", async () => {
    const [ecdsa] = ecdsaEdges;
    const [schnorr] = nobleEdges;
    if (ecdsa === undefined || schnorr === undefined) throw new Error("A noble fixture shrank");
    const options = { toolCallId: "secp256k1-sign", messages: [], context: {} };
    const ecdsaOutput = await curvesAiTools.curves_secp256k1_compute.execute?.(
      { operation: "sign", secret: ecdsa.secret, digest: ecdsa.digest },
      options,
    );
    expect(ecdsaOutput).toMatchObject({
      operation: "sign",
      signature: ecdsa.signature,
      recovery: ecdsa.recovery,
      publicKey: ecdsa.publicKey,
    });
    const schnorrOutput = await curvesAiTools.curves_bip340_compute.execute?.(
      {
        operation: "sign",
        secret: schnorr.secret,
        message: schnorr.message,
        random: "00".repeat(32),
      },
      { ...options, toolCallId: "bip340-sign" },
    );
    expect(schnorrOutput).toMatchObject({
      operation: "sign",
      signature: schnorr.signature,
      publicKey: schnorr.publicKey,
    });
  });

  it("signs with Ed25519 through the AI SDK tool", async () => {
    const [keys] = rfc8032Keys;
    const [empty] = rfc8032Signatures;
    if (keys === undefined || empty === undefined)
      throw new Error("The RFC 8032 fixture lost test 1");
    const [secret, publicKey] = keys;
    const output = await curvesAiTools.curves_ed25519_compute.execute?.(
      { operation: "sign", secret, message: "" },
      { toolCallId: "ed25519-sign", messages: [], context: {} },
    );
    expect(output).toMatchObject({ operation: "sign", signature: empty.signature, publicKey });
  });
});
