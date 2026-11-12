import { describe, expect, it } from "vite-plus/test";

import { COMMANDS, OPERATIONS } from "../docs/app/utils/playground.ts";
import {
  BIP340_OPERATIONS,
  BRAINPOOLP256R1_OPERATIONS,
  BRAINPOOLP384R1_OPERATIONS,
  BRAINPOOLP512R1_OPERATIONS,
  CURVE_OPERATIONS,
  ED25519_OPERATIONS,
  ED448_OPERATIONS,
  P256_OPERATIONS,
  P384_OPERATIONS,
  P521_OPERATIONS,
  SECP256K1_OPERATIONS,
  SR25519_OPERATIONS,
} from "../src/tool-contract.ts";
import { curvesTools } from "../src/tools.ts";

/* Each tool's `operation` enum, in the order `curvesTools` serves the tools. */
const TOOL_OPERATIONS: Readonly<Record<string, readonly string[]>> = {
  curves_compute: CURVE_OPERATIONS,
  curves_secp256k1_compute: SECP256K1_OPERATIONS,
  curves_bip340_compute: BIP340_OPERATIONS,
  curves_p256_compute: P256_OPERATIONS,
  curves_p384_compute: P384_OPERATIONS,
  curves_p521_compute: P521_OPERATIONS,
  curves_brainpoolp256r1_compute: BRAINPOOLP256R1_OPERATIONS,
  curves_brainpoolp384r1_compute: BRAINPOOLP384R1_OPERATIONS,
  curves_brainpoolp512r1_compute: BRAINPOOLP512R1_OPERATIONS,
  curves_sr25519_compute: SR25519_OPERATIONS,
  curves_ed25519_compute: ED25519_OPERATIONS,
  curves_ed448_compute: ED448_OPERATIONS,
};

describe("the playground rows", () => {
  it("knows every tool the package serves", () => {
    const served = curvesTools.map((tool) => tool.name);

    expect(Object.keys(TOOL_OPERATIONS)).toEqual(served);
    expect(Object.keys(COMMANDS)).toEqual(served);
  });

  /** The page counts operations from these lists, so a missing row makes its own count a lie. */
  it("has one row per operation, in the tools' order", () => {
    const expected = Object.entries(TOOL_OPERATIONS).flatMap(([tool, operations]) =>
      operations.map((operation) => `${tool} ${operation}`),
    );

    expect(OPERATIONS.map((row) => `${row.tool} ${row.op}`)).toEqual(expected);
  });

  it("keys each row by its command and operation", () => {
    for (const row of OPERATIONS) {
      expect(row.key).toBe(`${COMMANDS[row.tool]}:${row.op}`);
    }
  });
});
