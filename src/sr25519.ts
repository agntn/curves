/** `@agntn/curves/sr25519`: the Schnorr signatures and HDKD of Polkadot accounts, keys as hex. */

export {
  deriveHard,
  derivePublic,
  deriveSoft,
  expandSeed,
  getPublicKey,
  INVALID_PUBLIC_KEY,
  sign,
  SIGNING_CONTEXT,
  verify,
} from "./core/sr25519.ts";
export type { RandomOptions, SignatureOptions } from "./core/sr25519.ts";
