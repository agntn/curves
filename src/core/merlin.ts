/**
 * Merlin transcripts (merlin.cool) over the slice of STROBE-128 v1.0.2 they use: meta-AD, AD, PRF
 * and KEY, on Keccak-f[1600] from FIPS 202, section 3. sr25519 hashes every challenge, nonce and
 * derived key through one of these.
 */

import { numberToBytesLE } from "./bytes.ts";
import { keccakF1600 } from "./keccak.ts";

/** STROBE-128 keeps 166 of the 168 rate bytes for data and two for framing. */
const STROBE_RATE = 166;

const FLAG_I = 1;
const FLAG_A = 2;
const FLAG_C = 4;
const FLAG_M = 16;

/**
 * Text as UTF-8, or bytes as they are.
 * @param data - A label or a message
 * @returns {Uint8Array} The bytes
 */
function toBytes(data: string | ArrayLike<number>): Uint8Array {
  return typeof data === "string" ? new TextEncoder().encode(data) : Uint8Array.from(data);
}

/** The duplex of STROBE-128, with the operations Merlin needs and no transport. */
class Strobe128 {
  private state: Uint8Array = new Uint8Array(200);
  private position = 0;
  private begin = 0;
  private flags = 0;

  /**
   * Start a protocol.
   * @param label - The protocol label
   */
  constructor(label: string) {
    this.state.set([1, STROBE_RATE + 2, 1, 0, 1, 96], 0);
    this.state.set(toBytes("STROBEv1.0.2"), 6);
    this.state = keccakF1600(this.state);
    this.metaAd(label, false);
  }

  /**
   * A copy that goes its own way, for the nonce generator.
   * @returns {Strobe128} The copy
   */
  clone(): Strobe128 {
    const copy = Object.create(Strobe128.prototype) as Strobe128;
    copy.state = Uint8Array.from(this.state);
    copy.position = this.position;
    copy.begin = this.begin;
    copy.flags = this.flags;
    return copy;
  }

  /**
   * Meta-AD: framing that the transcript commits to.
   * @param data - The bytes
   * @param more - Whether this continues the previous meta-AD
   */
  metaAd(data: string | ArrayLike<number>, more: boolean): void {
    this.operate(FLAG_M | FLAG_A, more);
    this.absorb(toBytes(data));
  }

  /**
   * AD: data that the transcript commits to.
   * @param data - The bytes
   */
  ad(data: ArrayLike<number>): void {
    this.operate(FLAG_A, false);
    this.absorb(toBytes(data));
  }

  /**
   * PRF: bytes squeezed from the state.
   * @param length - How many
   * @returns {Uint8Array} The bytes
   */
  prf(length: number): Uint8Array {
    this.operate(FLAG_I | FLAG_A | FLAG_C, false);
    const output = new Uint8Array(length);
    for (let index = 0; index < length; index++) {
      output[index] = this.state[this.position] ?? 0;
      this.state[this.position] = 0;
      this.step();
    }
    return output;
  }

  /**
   * KEY: bytes that overwrite the state.
   * @param data - The key bytes
   */
  key(data: ArrayLike<number>): void {
    this.operate(FLAG_A | FLAG_C, false);
    for (let index = 0; index < data.length; index++) {
      this.state[this.position] = data[index] ?? 0;
      this.step();
    }
  }

  /**
   * Advance one byte, running F at the end of the rate.
   */
  private step(): void {
    this.position++;
    if (this.position === STROBE_RATE) this.runF();
  }

  /**
   * Absorb bytes into the state.
   * @param data - The bytes
   */
  private absorb(data: ArrayLike<number>): void {
    for (let index = 0; index < data.length; index++) {
      this.state[this.position] = (this.state[this.position] ?? 0) ^ (data[index] ?? 0);
      this.step();
    }
  }

  /**
   * Pad the block with the begin position and the domain bits, then permute.
   */
  private runF(): void {
    this.state[this.position] = (this.state[this.position] ?? 0) ^ this.begin;
    this.state[this.position + 1] = (this.state[this.position + 1] ?? 0) ^ 0x04;
    this.state[STROBE_RATE + 1] = (this.state[STROBE_RATE + 1] ?? 0) ^ 0x80;
    this.state = keccakF1600(this.state);
    this.position = 0;
    this.begin = 0;
  }

  /**
   * Begin an operation, or continue the one under way.
   * @param flags - The operation flags
   * @param more - Whether this continues the previous operation
   */
  private operate(flags: number, more: boolean): void {
    if (more) {
      if (this.flags !== flags) throw new Error("A continued STROBE operation changed its flags");
      return;
    }
    const previous = this.begin;
    this.begin = this.position + 1;
    this.flags = flags;
    this.absorb([previous, flags]);
    if ((flags & FLAG_C) !== 0 && this.position !== 0) this.runF();
  }
}

/** A Merlin transcript. */
export class Transcript {
  private readonly strobe: Strobe128;

  /**
   * Start a transcript under a domain separator.
   * @param label - The application label
   */
  constructor(label: string) {
    this.strobe = new Strobe128("Merlin v1.0");
    this.appendMessage("dom-sep", label);
  }

  /**
   * Commit a labelled message.
   * @param label - What the message is
   * @param message - The message
   */
  appendMessage(label: string, message: string | ArrayLike<number>): void {
    const bytes = toBytes(message);
    this.strobe.metaAd(label, false);
    this.strobe.metaAd(numberToBytesLE(BigInt(bytes.length), 4), true);
    this.strobe.ad(bytes);
  }

  /**
   * Squeeze labelled challenge bytes.
   * @param label - What the challenge is
   * @param length - How many bytes
   * @returns {Uint8Array} The bytes
   */
  challengeBytes(label: string, length: number): Uint8Array {
    this.strobe.metaAd(label, false);
    this.strobe.metaAd(numberToBytesLE(BigInt(length), 4), true);
    return this.strobe.prf(length);
  }

  /**
   * Witness bytes, as schnorrkel's transcript RNG builds them: secrets rekey a copy of the
   * transcript, then the caller's randomness does, and the copy squeezes the output.
   * @param label - What the witness is
   * @param length - How many bytes
   * @param secrets - Secret seeds, each committed under the label
   * @param random - 32 random bytes
   * @returns {Uint8Array} The bytes
   */
  witnessBytes(
    label: string,
    length: number,
    secrets: ReadonlyArray<ArrayLike<number>>,
    random: ArrayLike<number>,
  ): Uint8Array {
    const rng = this.strobe.clone();
    for (const secret of secrets) {
      rng.metaAd(label, false);
      rng.metaAd(numberToBytesLE(BigInt(secret.length), 4), true);
      rng.key(secret);
    }
    rng.metaAd("rng", false);
    rng.key(random);
    rng.metaAd(numberToBytesLE(BigInt(length), 4), false);
    return rng.prf(length);
  }
}
