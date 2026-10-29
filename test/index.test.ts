import { describe, expect, it } from "vite-plus/test";
import * as ed25519 from "../src/ed25519.ts";
import * as root from "../src/index.ts";
import * as ristretto255 from "../src/ristretto255.ts";
import * as secp256k1 from "../src/secp256k1.ts";
import * as sr25519 from "../src/sr25519.ts";
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
      "liftX",
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

  it("keeps ed25519 in its own entry", () => {
    expect(Object.keys(ed25519).toSorted()).toEqual([
      "INVALID_POINT",
      "addPoints",
      "ed25519",
      "isIdentity",
      "isTorsionFree",
      "isValidPoint",
      "multiplyGenerator",
      "multiplyPoint",
      "negatePoint",
      "reduceScalar",
      "subtractPoints",
    ]);
  });

  it("keeps ristretto255 and sr25519 in entries of their own", () => {
    expect(Object.keys(ristretto255).toSorted()).toEqual([
      "INVALID_POINT",
      "addPoints",
      "isValidPoint",
      "multiplyGenerator",
      "multiplyPoint",
      "negatePoint",
      "ristretto255",
      "subtractPoints",
    ]);
    expect(Object.keys(sr25519).toSorted()).toEqual([
      "INVALID_PUBLIC_KEY",
      "SIGNING_CONTEXT",
      "deriveHard",
      "deriveHardSeed",
      "derivePublic",
      "deriveSoft",
      "expandSeed",
      "getPublicKey",
      "sign",
      "verify",
    ]);
  });
});
