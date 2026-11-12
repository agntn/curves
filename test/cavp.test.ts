import { sha224, sha256, sha384, sha512 } from "@agntn/hashes/sha2";
import { describe, expect, it } from "vite-plus/test";
import { CURVE_HASHES } from "../src/core/nonce-hashes.ts";
import { minusThreeAFormulas, sec1Curve, signWithNonce } from "../src/core/sec1.ts";
import * as p256 from "../src/p256.ts";
import * as p384 from "../src/p384.ts";
import * as p521 from "../src/p521.ts";
import cavp from "./fixtures/cavp-siggen.json" with { type: "json" };

const HASHES = { "SHA-224": sha224, "SHA-256": sha256, "SHA-384": sha384, "SHA-512": sha512 };

const CURVES = {
  "P-256": { module: p256, domain: p256.p256, key: "p256" },
  "P-384": { module: p384, domain: p384.p384, key: "p384" },
  "P-521": { module: p521, domain: p521.p521, key: "p521" },
} as const;

describe("NIST CAVP FIPS 186-4 SigGen", () => {
  it.each(Object.entries(cavp.groups))("%s: d gives Q, and k gives R and S", (group, entries) => {
    const [curveName, hashName] = group.split(" ") as [keyof typeof CURVES, keyof typeof HASHES];
    const { module, domain, key } = CURVES[curveName];
    const curve = sec1Curve(domain, {
      name: curveName,
      formulas: minusThreeAFormulas,
      hash: CURVE_HASHES[key],
    });
    const digits = curve.digits;
    const bits = domain.n.toString(2).length;
    const pad = (hex: string): string => hex.padStart(digits, "0");
    expect(entries).toHaveLength(15);
    for (const { msg, d, qx, qy, k, r, s } of entries) {
      const digest = Buffer.from(HASHES[hashName](Buffer.from(msg, "hex")));
      const extra = digest.length * 8 - bits;
      const whole = BigInt(`0x${digest.toString("hex")}`);
      const e = extra > 0 ? whole >> BigInt(extra) : whole;
      const secret = BigInt(`0x${d}`);
      expect(module.multiplyGenerator(d, { compressed: false })).toBe(`04${pad(qx)}${pad(qy)}`);
      const printed = BigInt(`0x${s}`);
      const low = printed > domain.n >> 1n ? domain.n - printed : printed;
      const signed = signWithNonce(curve, { secret, e, k: BigInt(`0x${k}`) });
      expect(signed?.signature, `${group} ${k}`).toBe(`${pad(r)}${pad(low.toString(16))}`);
      const publicKey = `04${pad(qx)}${pad(qy)}`;
      expect(
        module.verify(`${pad(r)}${pad(s)}`, { digest: digest.toString("hex"), publicKey }),
      ).toBe(true);
    }
  });
});
