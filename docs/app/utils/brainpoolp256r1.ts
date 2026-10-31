/** Wycheproof tcId 1: a brainpoolP256r1 key and its signature over SHA-256 of 313233343030. */
export const WYCHEPROOF_BRAINPOOL = {
  publicKey:
    "04019a2d9637743a63ddaefdbca0ee229a163b809b9b145e5313bbeb8defeab9d6548caf89bf5ba49499404145651234336401b9b2843a579ed152e090f11b9e59",
  /** SHA-256 of the six bytes 313233343030, "123400" in ASCII. */
  digest: "bb5a52f42f9c9261ed4361f59422a1e30036e7c32b270c8807a419feca605023",
  signature:
    "0a5f8c70ba2d0842d5d0f841f160ad15195769a8159bfe692634d73d469d111f426e857aad3ff7aa96e4d200c03b45f1846a36d089ee3917768ca1a0d6d4da6e",
} as const;
