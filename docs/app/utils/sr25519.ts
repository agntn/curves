import { expandSeed } from "@agntn/curves/sr25519";

/** The mini secret of the Substrate dev phrase, public on purpose: dev chains fund its children. */
export const DEV_SEED = "fac7959dbfe72f052e5a0c3c8d6530f202b02fd8f9f5ca3580ec8deb7797479e";

/** The dev seed expanded, the secret `//Alice` hangs off. */
export const DEV_SECRET = expandSeed(DEV_SEED);

/** The chain code of `//Alice`: `Alice` in SCALE, padded to 32 bytes. */
export const ALICE_JUNCTION = "14416c696365".padEnd(64, "0");

/** `//Alice` itself, the account every Substrate dev chain funds. */
export const ALICE = "d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d";

/** Alice signing `hello` under `substrate`, the signature the CLI guide verifies. */
export const ALICE_HELLO =
  "dcd271ee89206ca33f53e56e69947f54bc4642c5088eb13a55520f38f89ffd1236edd2fc8bcb13d8fab81a455fbd2f0d86d05bd805ea42299e2a75cd346f5885";

/**
 * A signature with the lowest bit of its first byte flipped, which no key signed.
 *
 * @param {string} signature - 128 hex digits.
 * @returns {string} The same signature one bit off.
 */
export function flipBit(signature: string): string {
  const first = Number.parseInt(signature.slice(0, 2), 16) ^ 1;
  return first.toString(16).padStart(2, "0") + signature.slice(2);
}
