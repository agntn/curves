/** Vectors for ed25519. Where each set comes from sits above it. */

/** Secret and public keys of RFC 8032, section 7.1, tests 1 to 3. */
export const rfc8032Keys: readonly (readonly [secret: string, publicKey: string])[] = [
  [
    "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
    "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  ],
  [
    "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb",
    "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c",
  ],
  [
    "c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7",
    "fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025",
  ],
];

/**
 * A Monero wallet from the agntn/keys tests: spend and view keys, the private view key, and the
 * subaddress at account 1, index 1, which monero-wallet-cli 0.18.5.3 lists there.
 */
export const monero = {
  spend: "1b3bd040020d3712ab84992b773d0a965134eb2df0392fb84af95de8a17be2ab",
  view: "231c9bf8341c6a870d92e3fb98063a90a355fb8dbf74a8561b9d7f9273247e99",
  viewSecret: "49774391fa5e8d249fc2c5b45dadef13534bf2483dede880dac88f061e809100",
  subSpend: "8e4841533f2f07f99b01a3c22bdd10710de56282addfba178f4bb79742be9abd",
  subView: "b833d78e77da6d8d9ec64e9aead37e9bac9262362d49598ec46de2dca32a5269",
} as const;

/** A point of order 8 from the same tests, which Monero's subgroup check refuses. */
export const orderEight = "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a";

/** Encodings RFC 8032 decoding refuses: y = p, y = p + 1, -0 as x, a y with no x, odd sizes. */
export const invalidEncodings: readonly string[] = [
  "edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
  "eeffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
  "0100000000000000000000000000000000000000000000000000000000000080",
  "0200000000000000000000000000000000000000000000000000000000000000",
  "01000000000000000000000000000000000000000000000000000000000000",
  "010000000000000000000000000000000000000000000000000000000000000000",
  "zz00000000000000000000000000000000000000000000000000000000000000",
];

/** A signature over a message, as hex, and the key that signed it. */
export interface SignedMessage {
  readonly publicKey: string;
  readonly message: string;
  readonly signature: string;
}

/** RFC 8032, section 7.1, all five tests: messages of 0, 1, 2, 1023 and 64 bytes. */
export const rfc8032Signatures: readonly (SignedMessage & { readonly name: string })[] = [
  {
    name: "1",
    publicKey: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
    message: "",
    signature:
      "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
  },
  {
    name: "2",
    publicKey: "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c",
    message: "72",
    signature:
      "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00",
  },
  {
    name: "3",
    publicKey: "fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025",
    message: "af82",
    signature:
      "6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a",
  },
  {
    name: "1024",
    publicKey: "278117fc144c72340f67d0f2316e8386ceffbf2b2428c9c51fef7c597f1d426e",
    message:
      "08b8b2b733424243760fe426a4b54908632110a66c2f6591eabd3345e3e4eb98fa6e264bf09efe12ee50f8f54e9f77b1e355f6c50544e23fb1433ddf73be84d879de7c0046dc4996d9e773f4bc9efe5738829adb26c81b37c93a1b270b20329d658675fc6ea534e0810a4432826bf58c941efb65d57a338bbd2e26640f89ffbc1a858efcb8550ee3a5e1998bd177e93a7363c344fe6b199ee5d02e82d522c4feba15452f80288a821a579116ec6dad2b3b310da903401aa62100ab5d1a36553e06203b33890cc9b832f79ef80560ccb9a39ce767967ed628c6ad573cb116dbefefd75499da96bd68a8a97b928a8bbc103b6621fcde2beca1231d206be6cd9ec7aff6f6c94fcd7204ed3455c68c83f4a41da4af2b74ef5c53f1d8ac70bdcb7ed185ce81bd84359d44254d95629e9855a94a7c1958d1f8ada5d0532ed8a5aa3fb2d17ba70eb6248e594e1a2297acbbb39d502f1a8c6eb6f1ce22b3de1a1f40cc24554119a831a9aad6079cad88425de6bde1a9187ebb6092cf67bf2b13fd65f27088d78b7e883c8759d2c4f5c65adb7553878ad575f9fad878e80a0c9ba63bcbcc2732e69485bbc9c90bfbd62481d9089beccf80cfe2df16a2cf65bd92dd597b0707e0917af48bbb75fed413d238f5555a7a569d80c3414a8d0859dc65a46128bab27af87a71314f318c782b23ebfe808b82b0ce26401d2e22f04d83d1255dc51addd3b75a2b1ae0784504df543af8969be3ea7082ff7fc9888c144da2af58429ec96031dbcad3dad9af0dcbaaaf268cb8fcffead94f3c7ca495e056a9b47acdb751fb73e666c6c655ade8297297d07ad1ba5e43f1bca32301651339e22904cc8c42f58c30c04aafdb038dda0847dd988dcda6f3bfd15c4b4c4525004aa06eeff8ca61783aacec57fb3d1f92b0fe2fd1a85f6724517b65e614ad6808d6f6ee34dff7310fdc82aebfd904b01e1dc54b2927094b2db68d6f903b68401adebf5a7e08d78ff4ef5d63653a65040cf9bfd4aca7984a74d37145986780fc0b16ac451649de6188a7dbdf191f64b5fc5e2ab47b57f7f7276cd419c17a3ca8e1b939ae49e488acba6b965610b5480109c8b17b80e1b7b750dfc7598d5d5011fd2dcc5600a32ef5b52a1ecc820e308aa342721aac0943bf6686b64b2579376504ccc493d97e6aed3fb0f9cd71a43dd497f01f17c0e2cb3797aa2a2f256656168e6c496afc5fb93246f6b1116398a346f1a641f3b041e989f7914f90cc2c7fff357876e506b50d334ba77c225bc307ba537152f3f1610e4eafe595f6d9d90d11faa933a15ef1369546868a7f3a45a96768d40fd9d03412c091c6315cf4fde7cb68606937380db2eaaa707b4c4185c32eddcdd306705e4dc1ffc872eeee475a64dfac86aba41c0618983f8741c5ef68d3a101e8a3b8cac60c905c15fc910840b94c00a0b9d0",
    signature:
      "0aab4c900501b3e24d7cdf4663326a3a87df5e4843b2cbdb67cbf6e460fec350aa5371b1508f9f4528ecea23c436d94b5e8fcd4f681e30a6ac00a9704a188a03",
  },
  {
    name: "SHA(abc)",
    publicKey: "ec172b93ad5e563bf4932c70e1245034c35467ef2efd4d64ebf819683467e2bf",
    message:
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    signature:
      "dc2a4459e7369633a52b1bf277839a00201009a3efbf3ecb69bea2186c26b58909351fc9ac90b3ecfdfbc7c66431e0303dca179c138ac17ad9bef1177331a704",
  },
];

/**
 * The twelve cases of "Taming the many EdDSAs" (ed25519-speccheck 6551933, cases.json) with the
 * verdicts of @noble/curves 2.4.0 `ed25519.verify` under each `zip215`, case i at index i.
 */
export const speccheck: readonly (SignedMessage & {
  readonly zip215: boolean;
  readonly strict: boolean;
})[] = [
  {
    message: "8c93255d71dcab10e8f379c26200f3c7bd5f09d9bc3068d3ef4edeb4853022b6",
    publicKey: "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa",
    signature:
      "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a0000000000000000000000000000000000000000000000000000000000000000",
    zip215: true,
    strict: false,
  },
  {
    message: "9bd9f44f4dcc75bd531b56b2cd280b0bb38fc1cd6d1230e14861d861de092e79",
    publicKey: "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa",
    signature:
      "f7badec5b8abeaf699583992219b7b223f1df3fbbea919844e3f7c554a43dd43a5bb704786be79fc476f91d3f3f89b03984d8068dcf1bb7dfc6637b45450ac04",
    zip215: true,
    strict: false,
  },
  {
    message: "aebf3f2601a0c8c5d39cc7d8911642f740b78168218da8471772b35f9d35b9ab",
    publicKey: "f7badec5b8abeaf699583992219b7b223f1df3fbbea919844e3f7c554a43dd43",
    signature:
      "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa8c4bd45aecaca5b24fb97bc10ac27ac8751a7dfe1baff8b953ec9f5833ca260e",
    zip215: true,
    strict: true,
  },
  {
    message: "9bd9f44f4dcc75bd531b56b2cd280b0bb38fc1cd6d1230e14861d861de092e79",
    publicKey: "cdb267ce40c5cd45306fa5d2f29731459387dbf9eb933b7bd5aed9a765b88d4d",
    signature:
      "9046a64750444938de19f227bb80485e92b83fdb4b6506c160484c016cc1852f87909e14428a7a1d62e9f22f3d3ad7802db02eb2e688b6c52fcd6648a98bd009",
    zip215: true,
    strict: true,
  },
  {
    message: "e47d62c63f830dc7a6851a0b1f33ae4bb2f507fb6cffec4011eaccd55b53f56c",
    publicKey: "cdb267ce40c5cd45306fa5d2f29731459387dbf9eb933b7bd5aed9a765b88d4d",
    signature:
      "160a1cb0dc9c0258cd0a7d23e94d8fa878bcb1925f2c64246b2dee1796bed5125ec6bc982a269b723e0668e540911a9a6a58921d6925e434ab10aa7940551a09",
    zip215: true,
    strict: true,
  },
  {
    message: "e47d62c63f830dc7a6851a0b1f33ae4bb2f507fb6cffec4011eaccd55b53f56c",
    publicKey: "cdb267ce40c5cd45306fa5d2f29731459387dbf9eb933b7bd5aed9a765b88d4d",
    signature:
      "21122a84e0b5fca4052f5b1235c80a537878b38f3142356b2c2384ebad4668b7e40bc836dac0f71076f9abe3a53f9c03c1ceeeddb658d0030494ace586687405",
    zip215: true,
    strict: true,
  },
  {
    message: "85e241a07d148b41e47d62c63f830dc7a6851a0b1f33ae4bb2f507fb6cffec40",
    publicKey: "442aad9f089ad9e14647b1ef9099a1ff4798d78589e66f28eca69c11f582a623",
    signature:
      "e96f66be976d82e60150baecff9906684aebb1ef181f67a7189ac78ea23b6c0e547f7690a0e2ddcd04d87dbc3490dc19b3b3052f7ff0538cb68afb369ba3a514",
    zip215: false,
    strict: false,
  },
  {
    message: "85e241a07d148b41e47d62c63f830dc7a6851a0b1f33ae4bb2f507fb6cffec40",
    publicKey: "442aad9f089ad9e14647b1ef9099a1ff4798d78589e66f28eca69c11f582a623",
    signature:
      "8ce5b96c8f26d0ab6c47958c9e68b937104cd36e13c33566acd2fe8d38aa19427e71f98a473474f2f13f06f97c20d58cc3f54b8bd0d272f42b695dd7e89a8c22",
    zip215: false,
    strict: false,
  },
  {
    message: "9bedc267423725d473888631ebf45988bad3db83851ee85c85e241a07d148b41",
    publicKey: "f7badec5b8abeaf699583992219b7b223f1df3fbbea919844e3f7c554a43dd43",
    signature:
      "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff03be9678ac102edcd92b0210bb34d7428d12ffc5df5f37e359941266a4e35f0f",
    zip215: false,
    strict: false,
  },
  {
    message: "9bedc267423725d473888631ebf45988bad3db83851ee85c85e241a07d148b41",
    publicKey: "f7badec5b8abeaf699583992219b7b223f1df3fbbea919844e3f7c554a43dd43",
    signature:
      "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffca8c5b64cd208982aa38d4936621a4775aa233aa0505711d8fdcfdaa943d4908",
    zip215: true,
    strict: false,
  },
  {
    message: "e96b7021eb39c1a163b6da4e3093dcd3f21387da4cc4572be588fafae23c155b",
    publicKey: "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    signature:
      "a9d55260f765261eb9b84e106f665e00b867287a761990d7135963ee0a7d59dca5bb704786be79fc476f91d3f3f89b03984d8068dcf1bb7dfc6637b45450ac04",
    zip215: true,
    strict: false,
  },
  {
    message: "39a591f5321bbe07fd5a23dc2f39d025d74526615746727ceefd6e82ae65c06f",
    publicKey: "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    signature:
      "a9d55260f765261eb9b84e106f665e00b867287a761990d7135963ee0a7d59dca5bb704786be79fc476f91d3f3f89b03984d8068dcf1bb7dfc6637b45450ac04",
    zip215: true,
    strict: false,
  },
];

/**
 * R written as y = p, a point of order 4 to ZIP 215. Key 7G, no message, S = 7k with k over R as
 * written. @noble/curves 2.4.0 says true under `zip215: true` and false under `zip215: false`.
 */
export const unreducedR: SignedMessage = {
  publicKey: "b862409fb5c4c4123df2abf7462b88f041ad36dd6864ce872fd5472be363c5b1",
  message: "",
  signature:
    "edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fdc4faec99871a286b3cb7c7cb8aab3c66f637b0260f956da003bb5e8fe84c20c",
};
