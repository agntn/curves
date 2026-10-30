/**
 * BIP340 signatures from @noble/curves 2.4.0 `schnorr.sign`, with its `schnorr.verify` verdict.
 * Secret i is SHA-256 of "agntn/curves bip340 key <i>", aux_rand SHA-256 of
 * "agntn/curves bip340 aux <i>". Messages 0 and 1 hash "agntn/curves bip340 <i>" with SHA-256,
 * a sighash in length. Then no bytes, the byte 01, SHA-512 of "agntn/curves bip340 4" and 200
 * bytes of ab.
 */

/** A signature over a message, the x-only key it names and what noble said about it. */
export interface SignedMessage {
  readonly message: string;
  readonly signature: string;
  readonly publicKey: string;
  readonly valid: boolean;
}

export const nobleSignatures: readonly SignedMessage[] = [
  {
    message: "e1f8d3c28d7cb7b371f87e3403236e591ac54c2efe89cc9dc4959588c83d5019",
    signature:
      "cf2be0beff60a616d4a5cd37c16aa9da3cdd3d1e277c08080814da522950665d8a19b76d4421390c87d95b7c80c15b20b50b23a3fde734a940556448569c322a",
    publicKey: "8d36c2968887ac3cb65a2696c9f50d9d02ab43af126ec6bcb09478a1930760bc",
    valid: true,
  },
  {
    message: "e8f415d6cb562d2cf76b7f89a5e08135da6f392f40c2b33b3cd2a6eb7b7c3fda",
    signature:
      "52baa1e9234d8ec497eb05379c94d920f274ca77906f23da2f74371181670f3892894c97aedd8f662dc4d65fc47b90261b5ee5f5d80dc9e81a45c3a48e541d7b",
    publicKey: "a37ba7fa0742fe6df61376a88a9523e7980a231d5a954a389addfbe3bb5248d8",
    valid: true,
  },
  {
    message: "",
    signature:
      "91f06dd2f3b05a57e8db4e160c72e09a5bd704ce755f0a75406b66d59e701a7676a92ea9de89d1c218c9cdba80e730eae6cc27cc8c2e640a37b644b8c83f3e8c",
    publicKey: "79546c4bdd784fc01f19809a64a6ac39ad8d02ba3a95bbd9b6cecb39bf669740",
    valid: true,
  },
  {
    message: "01",
    signature:
      "8ba7a5df909d326f7d0b74a3e068ee1d3f82f411e5ced5a061cec2920d087573635bb13a2782995a99080c138965bbef7babb6c8700305593dd46bec6aecfbec",
    publicKey: "8d700a53a055af0e9d3fbc234a88211c45e8864596fe85145dcf1fa196a408d6",
    valid: true,
  },
  {
    message:
      "313ba5d9a51294e5594ec7a0f864425f349f179de24fcd41eac80ac3877ba8337ec64742598c0a1ff4764204fbd90d5a86c35a6ffea44c9434128a992bb207f8",
    signature:
      "5461d1b7c519e015b86a7a0d9c56d7c8ba5bfe80360c08ca7a7c579c9463300f074ddc64349c74a2250114beed74c72c3b1a09a7ac7350b7d217c9f1cb668b21",
    publicKey: "0291fc692a78f09a0329432280c6ac9c0bb2b06ade26d6c1e85d701063eecf83",
    valid: true,
  },
  {
    message:
      "abababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab",
    signature:
      "11216c6f4d3b6bb5a3258d99b969900d0181cd381603d47726f123781a526a9dca6963b16dc2290e4d37d19f09e0be9f893b189c125b4c42badc67a5766006d0",
    publicKey: "ee84609da7f449b982b86a92e4ce0fd02b4a6176f150f8f1518b4b286fa9e947",
    valid: true,
  },
];

/** Signature 0 broken three ways, each one noble refused. */
export const tampered: readonly SignedMessage[] = [
  {
    /* the last bit of the message flipped */
    message: "e1f8d3c28d7cb7b371f87e3403236e591ac54c2efe89cc9dc4959588c83d5018",
    signature:
      "cf2be0beff60a616d4a5cd37c16aa9da3cdd3d1e277c08080814da522950665d8a19b76d4421390c87d95b7c80c15b20b50b23a3fde734a940556448569c322a",
    publicKey: "8d36c2968887ac3cb65a2696c9f50d9d02ab43af126ec6bcb09478a1930760bc",
    valid: false,
  },
  {
    /* the key of signature 1 */
    message: "e1f8d3c28d7cb7b371f87e3403236e591ac54c2efe89cc9dc4959588c83d5019",
    signature:
      "cf2be0beff60a616d4a5cd37c16aa9da3cdd3d1e277c08080814da522950665d8a19b76d4421390c87d95b7c80c15b20b50b23a3fde734a940556448569c322a",
    publicKey: "a37ba7fa0742fe6df61376a88a9523e7980a231d5a954a389addfbe3bb5248d8",
    valid: false,
  },
  {
    /* s turned into n - s */
    message: "e1f8d3c28d7cb7b371f87e3403236e591ac54c2efe89cc9dc4959588c83d5019",
    signature:
      "cf2be0beff60a616d4a5cd37c16aa9da3cdd3d1e277c08080814da522950665d75e64892bbdec6f37826a4837f3ea4de05a3b942b1616b927f7cfa44799a0f17",
    publicKey: "8d36c2968887ac3cb65a2696c9f50d9d02ab43af126ec6bcb09478a1930760bc",
    valid: false,
  },
];

/** A signature with the secret that made it, for the checks that sign. */
export interface SignedBySecret extends SignedMessage {
  readonly secret: string;
}

/**
 * Edges signed by @noble/curves 2.4.0 `schnorr.sign` with aux_rand of 32 zero bytes: secret 1 over
 * no bytes, then n - 1, whose point has odd y, so signing negates it first.
 */
export const nobleEdges: readonly SignedBySecret[] = [
  {
    secret: "0000000000000000000000000000000000000000000000000000000000000001",
    message: "",
    signature:
      "c77be847b5fd7c789048160bc419c590365d479b5ef579cff35c809c40e25ea9241c66d70a0d007f9b0d50faf8196477f6b65fc958ab287a72de32016617407f",
    publicKey: "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    valid: true,
  },
  {
    secret: "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140",
    message: "00",
    signature:
      "cca5cb053bbbd1346550f4381be0d3bbfd69e38be77df2a0df8d7576984d757f9ea1bf74d208382eb51c6507ecdcf2f98a8b76a574b5c38a8d38bad2a4dff163",
    publicKey: "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    valid: true,
  },
];
