/**
 * Hex and little-endian helpers for the edwards25519 code, which reads every byte string least
 * significant byte first. Written by hand, since `Uint8Array.fromHex` is too new for the
 * browsers the docs playground runs in.
 */

const HEX = /^(?:[0-9a-f]{2})*$/iu;

/**
 * Read hex without 0x into bytes.
 * @param text - Hex digits, two per byte
 * @param length - The byte count the caller needs, or undefined for any
 * @returns {Uint8Array | undefined} The bytes, or undefined when the text is no hex of that length
 */
export function hexToBytes(text: string, length?: number): Uint8Array | undefined {
  if (!HEX.test(text)) return undefined;
  if (length !== undefined && text.length !== length * 2) return undefined;
  const bytes = new Uint8Array(text.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(text.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Write bytes as lowercase hex.
 * @param bytes - Any bytes
 * @returns {string} Two hex digits per byte
 */
export function bytesToHex(bytes: ArrayLike<number>): string {
  let text = "";
  for (let index = 0; index < bytes.length; index++) {
    text += (bytes[index] ?? 0).toString(16).padStart(2, "0");
  }
  return text;
}

/**
 * Read bytes as a little-endian number.
 * @param bytes - Any bytes
 * @returns {bigint} The number
 */
export function bytesToNumberLE(bytes: ArrayLike<number>): bigint {
  let value = 0n;
  for (let index = bytes.length - 1; index >= 0; index--) {
    value = (value << 8n) | BigInt(bytes[index] ?? 0);
  }
  return value;
}

/**
 * Write a number as little-endian bytes.
 * @param value - From 0 to 256^length minus 1
 * @param length - The byte count
 * @returns {Uint8Array} The bytes
 */
export function numberToBytesLE(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let rest = value;
  for (let index = 0; index < length; index++) {
    bytes[index] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return bytes;
}

/**
 * Join byte strings.
 * @param parts - The byte strings, in order
 * @returns {Uint8Array} One byte string
 */
export function concatBytes(...parts: ReadonlyArray<ArrayLike<number>>): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
