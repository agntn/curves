/**
 * ECDSA signatures from @noble/curves 2.4.0, with the key each one recovers to. Key i is SHA-256
 * of "agntn/curves ecdsa key <i>". Digest i hashes "agntn/curves ecdsa <i>": SHA-256 twice, its
 * first 20 bytes, SHA-512 cut to 48 bytes, SHA-512 whole, then the single byte 01.
 */

/** A signature over a digest, the recovery id noble gave it and the key it recovers to. */
export interface SignedDigest {
  readonly digest: string;
  readonly signature: string;
  readonly recovery: number;
  readonly publicKey: string;
}

export const nobleSignatures: readonly SignedDigest[] = [
  {
    digest: "d8e52930c0c745b054a5ad5280ca45a45ab209e65cd18715c920c085edf25b06",
    signature:
      "1066f06c25425efa289878af543a8f19f71950808e096bc3ae4afb0fd72e794a611c857056811cb2ce8a6dae0cb42734e55c6dda245cd1bd49c1763ce3378a57",
    recovery: 1,
    publicKey: "038774ca9f1054882057eecdaf6093b281a8eee1a4983a2eb953a6f773f1da6221",
  },
  {
    digest: "71bbdde3f4792530386a0f1fb5359deda81c9fbaa701c16613e4aa3baaa0ff8d",
    signature:
      "a79fe2343ee8affaf3d9fb27ad97caf36add2d366e5700ea9afc2dceac58a3f570b722ee27b95b1d92d19011e961c8854a947ddcc3d17fd08998f37ed307542b",
    recovery: 1,
    publicKey: "03f6432806c21c6d2ef741e7806ff57e2616267b47d64d775da1a732ff62deeecf",
  },
  {
    digest: "9a9e201306889346c4e9225021ca2ba4de791073",
    signature:
      "4713cfd87f3f11652cda337e4a756aa5daf84f1e6b038ec71df8d73401524e817856fa71598c926a3579cd7c462b2679dad74094f3358ca3c8f0b20e417d6b28",
    recovery: 0,
    publicKey: "037f9cee3c731057196d7d7ece5fc48ed5b3620c4b53e0841d8f73245b9e88f4f5",
  },
  {
    digest:
      "7adcdd8abffbd8bd7730388463370f8587003af1841a8336023a0c0ab3f04fa7d0fc97dcbb9138e9f5ccc9e0bedc18c2",
    signature:
      "e67760a99e0c4b9e68d32e62bc3afd9f1d14ed44f070ca0673eb3bd46f32ebd722411aa879b9e1e3abc61c91506874a87c869dd26be74b8c6159fe4f3268cc30",
    recovery: 0,
    publicKey: "0304d34acfef2aa87efac339b3d1943863ce42cba503267179ce69b04d696c9be5",
  },
  {
    digest:
      "a1b8aa4d8ea01776428a588d3773152cb4c4f89ef62b7b18752ce33c636bc618c5caf4375287e420e91062ecd6651c699bb89d0fe47638b862dd4ca7f7173c35",
    signature:
      "9c3115ba4cbb93673896d5d8badd92595a47154e50a03664f95dc46cff7e0e2720090e3c03c0de85393894411d0c36a9750f5376d4e0920c41ae921a0c28f142",
    recovery: 0,
    publicKey: "029d9056a8c0975712caa7a8ad5143280156b224bf784d917bdfed37a3a6ce6f37",
  },
  {
    digest: "01",
    signature:
      "b7a8baf3bbe0d65c0fb3a457d2ee79680048f47b0a54bd98f1802dfa8598abc364c3d8a56103e20cd13fa9625271847fb9866dd11c9aa74dbdeeb75dd85b4362",
    recovery: 0,
    publicKey: "0257c8fabc53ecccad1dc0a540deacd56a031558b197b29d3468bb8dbbf822aacd",
  },
];

/** The first signature with s turned into n - s, which flips the parity of R in the recovery id. */
export const highS: SignedDigest = {
  digest: "d8e52930c0c745b054a5ad5280ca45a45ab209e65cd18715c920c085edf25b06",
  signature:
    "1066f06c25425efa289878af543a8f19f71950808e096bc3ae4afb0fd72e794a9ee37a8fa97ee34d31759251f34bd8c9d5526f0c8aebce7e7610e84fecfeb6ea",
  recovery: 0,
  publicKey: "038774ca9f1054882057eecdaf6093b281a8eee1a4983a2eb953a6f773f1da6221",
};

/** r = 2 with R at x = n + 2, the first x above n with a point. noble recovered it with id 2. */
export const overflow: SignedDigest = {
  digest: "7e9f5461c2d15d616a18f4e08fd0b700b7a028ed1b09713415b7656607708e59",
  signature:
    "00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000001234567890abcdef",
  recovery: 2,
  publicKey: "02d70bbc7534b3cd6cb3191d3b37a10294a2d77492cd58735bbf46cecfcfa2445a",
};

/** Block 170, input 0, Satoshi paying Hal: its sighash as @agntn/keys reads the raw transaction. */
export const block170: SignedDigest = {
  digest: "7a05c6145f10101e9d6325494245adf1297d80f8f38d4d576d57cdba220bcb19",
  signature:
    "4e45e16932b8af514961a1d3a1a25fdf3f4f7732e9d624c6c61548ab5fb8cd41181522ec8eca07de4860a4acdd12909d831cc56cbbac4622082221a8768d1d09",
  recovery: 1,
  publicKey:
    "0411db93e1dcdb8a016b49840f8c53bc1eb68a382e97b1482ecad7b148a6909a5cb2e0eaddfb84ccf9744464f82e160bfa9b8b64f9d4c03f999b8643f656b412a3",
};
