import { describe, expect, it } from "vite-plus/test";
import * as root from "../src/index.ts";
import * as secp256k1 from "../src/secp256k1.ts";
import manifest from "../package.json" with { type: "json" };

describe("@agntn/curves", () => {
  it("exports the version of the manifest", () => {
    expect(root.version).toBe(manifest.version);
  });

  it("keeps its public names, the generic curve code at the root", () => {
    expect(Object.keys(root).toSorted()).toEqual([
      "MAX_COUNTED_PRIME",
      "MAX_FILTERED_PRIME",
      "MAX_LOG_ORDER",
      "MAX_ORDER_PRIME",
      "addPoints",
      "countPoints",
      "defineCurve",
      "discreteLog",
      "doublePoint",
      "isOnCurve",
      "isPrime",
      "listPoints",
      "multiplyPoint",
      "negatePoint",
      "pointOrder",
      "version",
    ]);
  });

  it("keeps secp256k1 in its own entry", () => {
    expect(Object.keys(secp256k1).toSorted()).toEqual([
      "INVALID_POINT",
      "addPoints",
      "addScalars",
      "convertPoint",
      "invertScalar",
      "isOnCurve",
      "liftX",
      "multiplyGenerator",
      "multiplyPoint",
      "multiplyScalars",
      "negatePoint",
      "secp256k1",
      "subtractPoints",
      "subtractScalars",
    ]);
  });
});
