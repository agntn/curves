/** Guards for what a signature check gets from its caller: an options object, and hex as bytes. */

import { hexToBytes } from "./bytes.ts";

/**
 * Refuse options that are no object, so a call in another library's shape fails loudly.
 * @param options - The caller's value
 * @param shape - The call as it should read, for the error
 * @throws {TypeError} When options is not an object
 */
export function requireOptions(options: unknown, shape: string): void {
  if (typeof options !== "object" || options === null) throw new TypeError(`Call it as ${shape}`);
}

/**
 * Read hex without 0x, or refuse it in the caller's words.
 * @param value - The caller's value
 * @param length - The byte count, or undefined for any
 * @param refusal - The error message
 * @returns {Uint8Array} The bytes
 * @throws {RangeError} When the value is no hex of that length
 */
export function readHex(value: unknown, length: number | undefined, refusal: string): Uint8Array {
  const bytes = typeof value === "string" ? hexToBytes(value, length) : undefined;
  if (bytes === undefined) throw new RangeError(refusal);
  return bytes;
}
