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
