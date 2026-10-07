import { describe, expect, it } from "vite-plus/test";
import { Transcript } from "../src/core/merlin.ts";
import { multiplyGenerator, ristretto255 } from "../src/ristretto255.ts";
import {
  deriveHard,
  derivePublic,
  deriveSoft,
  expandSeed,
  getPublicKey,
  INVALID_PUBLIC_KEY,
  sign,
  SIGNING_CONTEXT,
  verify,
} from "../src/sr25519.ts";
import { devAccounts, merlinVector, scureVectors } from "./fixtures/sr25519.ts";

const { secret, publicKey, random, chainCode } = scureVectors;
const message = new TextEncoder().encode(scureVectors.message);
const identity = "0".repeat(64);

/* The chain code Substrate builds from a junction name short enough to need no hash. */
function junction(name: string): string {
  const encoded = new TextEncoder().encode(name);
  const bytes = new Uint8Array(32);
  bytes.set([encoded.length << 2, ...encoded]);
  return Buffer.from(bytes).toString("hex");
}

/* A signature with one bit flipped. */
function flip(signature: string, bit: number): string {
  const bytes = Buffer.from(signature, "hex");
  bytes[bit >> 3] = (bytes[bit >> 3] ?? 0) ^ (1 << (bit & 7));
  return bytes.toString("hex");
}

describe("Merlin transcripts", () => {
  it("squeeze the challenge of the merlin crate", () => {
    const transcript = new Transcript(merlinVector.label);
    transcript.appendMessage(merlinVector.messageLabel, merlinVector.message);
    const challenge = transcript.challengeBytes(merlinVector.challengeLabel, 32);
    expect(Buffer.from(challenge).toString("hex")).toBe(merlinVector.challenge);
  });
});

describe("sr25519 keys", () => {
  it("expand the Substrate dev seed into its keys and the //Alice and //Bob accounts", () => {
    const root = expandSeed(devAccounts.seed);
    expect(getPublicKey(root)).toBe(devAccounts.publicKey);
    expect(getPublicKey(deriveHard(root, junction("Alice")))).toBe(devAccounts.alice);
    expect(getPublicKey(deriveHard(root, junction("Bob")))).toBe(devAccounts.bob);
  });

  it("expand a seed as @scure/sr25519 does", () => {
    expect(expandSeed(scureVectors.seed)).toBe(secret);
    expect(expandSeed(scureVectors.seed.toUpperCase())).toBe(secret);
    expect(getPublicKey(secret)).toBe(publicKey);
  });

  it("refuse seeds and secrets of the wrong length", () => {
    expect(() => expandSeed(scureVectors.seed.slice(2))).toThrow(
      "Seed must be 64 hex digits without 0x",
    );
    expect(() => getPublicKey(secret.slice(2))).toThrow(
      "Secret must be 128 hex digits without 0x: the key, then the nonce",
    );
    expect(() => getPublicKey(new Uint8Array(64) as unknown as string)).toThrow("Secret must be");
  });

  it("refuse a key that isn't 8 times a scalar from 1 to the group order minus 1", () => {
    const refusal = "Secret key must be 8 times a scalar from 1 to the group order minus 1";
    const nonce = secret.slice(64);
    const key = (value: bigint): string =>
      Buffer.from(value.toString(16).padStart(64, "0"), "hex").reverse().toString("hex");
    const scalar = BigInt(`0x${Buffer.from(secret.slice(0, 64), "hex").reverse().toString("hex")}`);
    for (const bad of [0n, ristretto255.l << 3n, scalar + (ristretto255.l << 3n), scalar + 1n]) {
      expect(() => getPublicKey(`${key(bad)}${nonce}`), bad.toString(16)).toThrow(refusal);
      expect(() => deriveHard(`${key(bad)}${nonce}`, chainCode), bad.toString(16)).toThrow(refusal);
    }
    expect(getPublicKey(`${key(scalar)}${nonce}`)).toBe(publicKey);
  });
});

describe("sr25519 signatures", () => {
  it("match @scure/sr25519 byte for byte under the same random bytes", () => {
    expect(sign(secret, message, { random })).toBe(scureVectors.signature);
  });

  it("verify signatures @scure/sr25519 made with fresh randomness", () => {
    expect(verify(scureVectors.randomSignature, message, publicKey)).toBe(true);
    expect(verify(scureVectors.signature, message, publicKey)).toBe(true);
  });

  it("differ between two signings and both verify", () => {
    const first = sign(secret, message);
    const second = sign(secret, message);
    expect(first).not.toBe(second);
    expect(verify(first, message, publicKey)).toBe(true);
    expect(verify(second, message, publicKey)).toBe(true);
  });

  it("fail for another message, another key or another context", () => {
    const signature = scureVectors.signature;
    expect(verify(signature, message.subarray(1), publicKey)).toBe(false);
    expect(verify(signature, message, devAccounts.alice)).toBe(false);
    expect(verify(signature, message, publicKey, { context: "polkadot" })).toBe(false);
    expect(verify(signature, message, publicKey, { context: SIGNING_CONTEXT })).toBe(true);
  });

  it("sign and verify under a context of the caller's", () => {
    const signature = sign(secret, message, { context: "curves" });
    expect(verify(signature, message, publicKey, { context: "curves" })).toBe(true);
    expect(verify(signature, message, publicKey)).toBe(false);
  });

  it("fail with any bit flipped", () => {
    for (let bit = 0; bit < 512; bit += 7) {
      expect(verify(flip(scureVectors.signature, bit), message, publicKey), `bit ${bit}`).toBe(
        false,
      );
    }
  });

  it("fail without the schnorrkel marker, though the rest holds", () => {
    expect(verify(flip(scureVectors.signature, 511), message, publicKey)).toBe(false);
  });

  it("fail when s is pushed past the group order, though it names the same scalar", () => {
    const bytes = Buffer.from(scureVectors.signature, "hex");
    bytes[63] = (bytes[63] ?? 0) & 127;
    const s = BigInt(`0x${Buffer.from(bytes.subarray(32)).reverse().toString("hex")}`);
    const pushed = Buffer.from(
      (s + ristretto255.l).toString(16).padStart(64, "0"),
      "hex",
    ).reverse();
    pushed[31] = (pushed[31] ?? 0) | 128;
    const signature = Buffer.concat([bytes.subarray(0, 32), pushed]).toString("hex");
    expect(verify(signature, message, publicKey)).toBe(false);
  });

  it("fail for the identity as the public key, where any R = sB would pass", () => {
    const forged = `${multiplyGenerator(5n)}05${"0".repeat(60)}80`;
    expect(verify(forged, message, identity)).toBe(false);
  });

  it("refuse malformed input instead of answering false", () => {
    expect(() => verify(scureVectors.signature.slice(2), message, publicKey)).toThrow(
      "Signature must be 128 hex digits without 0x",
    );
    expect(() => verify(scureVectors.signature, message, "ff".repeat(32))).toThrow(
      INVALID_PUBLIC_KEY,
    );
    expect(() => sign(secret, "hello" as unknown as Uint8Array)).toThrow(
      "Message must be a Uint8Array",
    );
    expect(() => sign(secret, message, { random: "00" })).toThrow(
      "Random must be 64 hex digits without 0x",
    );
    expect(() => sign(secret, message, { context: 1 as unknown as string })).toThrow(
      "Context must be a string",
    );
  });
});

describe("sr25519 HDKD", () => {
  it("derives a hard child as @scure/sr25519 does", () => {
    expect(deriveHard(secret, chainCode)).toBe(scureVectors.hard);
  });

  it("derives a soft child as @scure/sr25519 does under the same random bytes", () => {
    expect(deriveSoft(secret, chainCode, { random })).toBe(scureVectors.soft);
  });

  it("gives a soft child the same public key from the secret and from the public key", () => {
    expect(derivePublic(publicKey, chainCode)).toBe(scureVectors.softPublic);
    expect(getPublicKey(deriveSoft(secret, chainCode))).toBe(scureVectors.softPublic);
  });

  it("refuses chain codes of the wrong length", () => {
    const refusal = "Chain code must be 64 hex digits without 0x";
    expect(() => deriveHard(secret, chainCode.slice(2))).toThrow(refusal);
    expect(() => deriveSoft(secret, `${chainCode}00`)).toThrow(refusal);
    expect(() => derivePublic(publicKey, "")).toThrow(refusal);
  });
});
