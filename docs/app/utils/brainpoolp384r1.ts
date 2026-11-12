/** Wycheproof tcId 1: a brainpoolP384r1 key and its signature over SHA-384 of 313233343030. */
export const WYCHEPROOF_BRAINPOOL_384 = {
  publicKey:
    "04192ed5ce547d2336911d3f6cecba227f08df077f6242a9147a914e854e6e32d325fd23ccc42921dc4a7e4c2eb71defd3631e69079ba982e7a1cad0a39eff47fc6d6e3a280d081286b624886ba1f3069671ec1a29986d84fb79736d2799e6fc21",
  /** SHA-384 of the six bytes 313233343030, "123400" in ASCII. */
  digest:
    "f9b127f0d81ebcd17b7ba0ea131c660d340b05ce557c82160e0f793de07d38179023942871acb7002dfafdfffc8deace",
  signature:
    "0e8e114a1c351405560bf8d47b166bfe957087a8003b353433b6144f7ee7d6f79c8dd14ef229fa7a2f2782bf33708b9183aa7ba485dc060df9922f9ccc5da29adb75d44671d18bad0636d2e09c5e2f95e892a79b9fd3b37e1f798b157b567a24",
  /** The recovery id that finds this key. */
  recovery: 0,
} as const;

/** RFC 7027 appendix A.2: the secret of its first key pair. */
export const RFC_7027_SECRET_384 =
  "1e20f5e048a5886f1f157c74e91bde2b98c8b52d58e5003d57053fc4b0bd65d6f15eb5d1ee1610df870795143627d042";
