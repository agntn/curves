/**
 * Keccak-f[1600] from FIPS 202, section 3, and the one sponge built on it here: SHAKE256, which
 * Ed448 hashes with. Merlin runs its STROBE duplex on the same permutation. Both wait here for
 * agntn/hashes#241 to ship SHAKE256.
 */

import { bytesToNumberLE, concatBytes, numberToBytesLE } from "./bytes.ts";

/** Round constants of the iota step, FIPS 202 section 3.2.5. */
const ROUND_CONSTANTS = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
] as const;

/** Rotation of the rho step for lane x + 5y, FIPS 202 section 3.2.2. */
const ROTATIONS = [
  0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14,
] as const;

const LANE = (1n << 64n) - 1n;

/**
 * Rotate a 64-bit lane left.
 * @param lane - From 0 to 2^64 minus 1
 * @param shift - From 0 to 63
 * @returns {bigint} The rotated lane
 */
function rotate(lane: bigint, shift: number): bigint {
  if (shift === 0) return lane;
  const bits = BigInt(shift);
  return ((lane << bits) | (lane >> (64n - bits))) & LANE;
}

/**
 * Lane x + 5y of a state, zero when missing.
 * @param lanes - 25 lanes
 * @param index - From 0 to 24
 * @returns {bigint} The lane
 */
function lane(lanes: readonly bigint[], index: number): bigint {
  return lanes[index] ?? 0n;
}

/**
 * The theta step.
 * @param lanes - 25 lanes
 * @returns {bigint[]} The lanes after theta
 */
function theta(lanes: readonly bigint[]): bigint[] {
  const columns = [0, 1, 2, 3, 4].map(
    (x) =>
      lane(lanes, x) ^
      lane(lanes, x + 5) ^
      lane(lanes, x + 10) ^
      lane(lanes, x + 15) ^
      lane(lanes, x + 20),
  );
  return lanes.map((value, index) => {
    const x = index % 5;
    return value ^ (columns[(x + 4) % 5] ?? 0n) ^ rotate(columns[(x + 1) % 5] ?? 0n, 1);
  });
}

/**
 * The rho and pi steps: lane (x, y) rotates and moves to (y, 2x + 3y).
 * @param lanes - 25 lanes
 * @returns {bigint[]} The lanes after rho and pi
 */
function rhoPi(lanes: readonly bigint[]): bigint[] {
  const moved: bigint[] = Array.from({ length: 25 }, () => 0n);
  for (let index = 0; index < 25; index++) {
    const x = index % 5;
    const y = Math.floor(index / 5);
    moved[y + 5 * ((2 * x + 3 * y) % 5)] = rotate(lane(lanes, index), ROTATIONS[index] ?? 0);
  }
  return moved;
}

/**
 * The chi step.
 * @param lanes - 25 lanes
 * @returns {bigint[]} The lanes after chi
 */
function chi(lanes: readonly bigint[]): bigint[] {
  return lanes.map((value, index) => {
    const row = index - (index % 5);
    const next = lane(lanes, row + ((index + 1) % 5));
    const after = lane(lanes, row + ((index + 2) % 5));
    return value ^ (~next & LANE & after);
  });
}

/**
 * Keccak-f[1600] on a 200-byte state, lanes little-endian.
 * @param state - 200 bytes
 * @returns {Uint8Array} The permuted state
 */
export function keccakF1600(state: ArrayLike<number>): Uint8Array {
  let lanes = Array.from({ length: 25 }, (_, index) =>
    bytesToNumberLE(Array.from({ length: 8 }, (_, byte) => state[index * 8 + byte] ?? 0)),
  );
  for (const constant of ROUND_CONSTANTS) {
    lanes = chi(rhoPi(theta(lanes)));
    lanes[0] = lane(lanes, 0) ^ constant;
  }
  return concatBytes(...lanes.map((value) => numberToBytesLE(value, 8)));
}

/** SHAKE256 absorbs and squeezes 136 bytes a block, FIPS 202, section 6.2. */
const SHAKE256_RATE = 136;

/** The SHAKE domain bits 1111 and the first bit of pad10*1, FIPS 202, section 6.2 and B.2. */
const SHAKE_SUFFIX = 0x1f;

/**
 * SHAKE256 from FIPS 202, section 6.2: any number of bytes in, as many out as asked.
 * @param data - The bytes to hash
 * @param length - How many bytes to squeeze
 * @returns {Uint8Array} The output
 */
export function shake256(data: ArrayLike<number>, length: number): Uint8Array {
  const blocks = Math.floor(data.length / SHAKE256_RATE) + 1;
  const padded = new Uint8Array(blocks * SHAKE256_RATE);
  padded.set(Array.from(data));
  padded[data.length] = SHAKE_SUFFIX;
  padded[padded.length - 1] = (padded.at(-1) ?? 0) | 0x80;
  let state: Uint8Array = new Uint8Array(200);
  for (let offset = 0; offset < padded.length; offset += SHAKE256_RATE) {
    const block = padded.subarray(offset, offset + SHAKE256_RATE);
    state = keccakF1600(state.map((byte, index) => byte ^ (block[index] ?? 0)));
  }
  const output = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += SHAKE256_RATE) {
    if (offset > 0) state = keccakF1600(state);
    output.set(state.subarray(0, Math.min(SHAKE256_RATE, length - offset)), offset);
  }
  return output;
}
