/** `@agntn/curves/bip340`: BIP340 Schnorr keys and signatures on secp256k1, x-only keys as hex. */

export { getPublicKey, sign, verify } from "./core/bip340.ts";
export type { SignOptions, VerifyOptions } from "./core/bip340.ts";
