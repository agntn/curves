/**
 * The hashes an RFC 6979 nonce can run its HMAC on, in a module without imports, so the tool
 * schemas can list them without loading a hash.
 */

/** SHA-1 and SHA-2, the five RFC 6979 prints vectors for. */
export const NONCE_HASHES = ["sha1", "sha224", "sha256", "sha384", "sha512"] as const;

/** The hash that made the digest, which RFC 6979 then keys its HMAC with. */
export type NonceHash = (typeof NONCE_HASHES)[number];

/** The hash ECDSA pairs with each SEC 1 curve, which signs with it when the caller names none. */
export const CURVE_HASHES = {
  secp256k1: "sha256",
  p256: "sha256",
  p384: "sha384",
  p521: "sha512",
  brainpoolP256r1: "sha256",
  brainpoolP384r1: "sha384",
  brainpoolP512r1: "sha512",
} as const satisfies Readonly<Record<string, NonceHash>>;
