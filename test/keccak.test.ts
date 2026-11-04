import { createHash } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { bytesToHex } from "../src/core/bytes.ts";
import { shake256 } from "../src/core/keccak.ts";

/* SHAKE256 by node:crypto, which @agntn/hashes 0.6.7 doesn't export. */
function nodeShake256(data: Uint8Array, length: number): string {
  return createHash("shake256", { outputLength: length }).update(data).digest("hex");
}

describe("SHAKE256", () => {
  it("matches node:crypto on both sides of every block edge, in and out", () => {
    for (const inputLength of [0, 1, 135, 136, 137, 271, 272, 273]) {
      const data = Uint8Array.from({ length: inputLength }, (_, index) => (index * 7 + 3) & 0xff);
      for (const outputLength of [0, 1, 57, 114, 136, 137, 273]) {
        const label = `${inputLength} bytes in, ${outputLength} out`;
        expect(bytesToHex(shake256(data, outputLength)), label).toBe(
          nodeShake256(data, outputLength),
        );
      }
    }
  });
});
