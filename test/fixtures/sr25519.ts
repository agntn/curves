/** Vectors for ristretto255 and sr25519. How each set was made sits above it. */

/** The encodings of 0 to 15 times the generator, RFC 9496 appendix A.1. */
export const generatorMultiples: readonly string[] = [
  "0000000000000000000000000000000000000000000000000000000000000000",
  "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76",
  "6a493210f7499cd17fecb510ae0cea23a110e8d5b901f8acadd3095c73a3b919",
  "94741f5d5d52755ece4f23f044ee27d5d1ea1e2bd196b462166b16152a9d0259",
  "da80862773358b466ffadfe0b3293ab3d9fd53c5ea6c955358f568322daf6a57",
  "e882b131016b52c1d3337080187cf768423efccbb517bb495ab812c4160ff44e",
  "f64746d3c92b13050ed8d80236a7f0007c3b3f962f5ba793d19a601ebb1df403",
  "44f53520926ec81fbd5a387845beb7df85a96a24ece18738bdcfa6a7822a176d",
  "903293d8f2287ebe10e2374dc1a53e0bc887e592699f02d077d5263cdd55601c",
  "02622ace8f7303a31cafc63f8fc48fdc16e1c8c8d234b2f0d6685282a9076031",
  "20706fd788b2720a1ed2a5dad4952b01f413bcf0e7564de8cdc816689e2db95f",
  "bce83f8ba5dd2fa572864c24ba1810f9522bc6004afe95877ac73241cafdab42",
  "e4549ee16b9aa03099ca208c67adafcafa4c3f3e4e5303de6026e3ca8ff84460",
  "aa52e000df2e16f55fb1032fc33bc42742dad6bd5a8fc0be0167436c5948501f",
  "46376b80f409b29dc2b5f6f0c52591990896e5716f41477cd30085ab7f10301e",
  "e0c418f7c8d9c4cdd7395b93ea124f3ad99021bb681dfc3302a9d99a2e53e64e",
];

/** Encodings that decoding must refuse, RFC 9496 appendix A.2, in its order. */
export const invalidEncodings: readonly string[] = [
  "00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
  "f3ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
  "edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
  "0100000000000000000000000000000000000000000000000000000000000000",
  "01ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
  "ed57ffd8c914fb201471d1c3d245ce3c746fcbe63a3679d51b6a516ebebe0e20",
  "c34c4e1826e5d403b78e246e88aa051c36ccf0aafebffe137d148a2bf9104562",
  "c940e5a4404157cfb1628b108db051a8d439e1a421394ec4ebccb9ec92a8ac78",
  "47cfc5497c53dc8e61c91d17fd626ffb1c49e2bca94eed052281b510b1117a24",
  "f1c6165d33367351b0da8f6e4511010c68174a03b6581212c71c0e1d026c3c72",
  "87260f7a2f12495118360f02c26a470f450dadf34a413d21042b43b9d93e1309",
  "26948d35ca62e643e26a83177332e6b6afeb9d08e4268b650f1f5bbd8d81d371",
  "4eac077a713c57b4f4397629a4145982c661f48044dd3f96427d40b147d9742f",
  "de6a7b00deadc788eb6b6c8d20c0ae96c2f2019078fa604fee5b87d6e989ad7b",
  "bcab477be20861e01e4a0e295284146a510150d9817763caf1a6f4b422d67042",
  "2a292df7e32cababbd9de088d1d1abec9fc0440f637ed2fba145094dc14bea08",
  "f4a9e534fc0d216c44b218fa0c42d99635a0127ee2e53c712f70609649fdff22",
  "8268436f8c4126196cf64b3c7ddbda90746a378625f9813dd9b8457077256731",
  "2810e5cbc2cc4d4eece54f61c6f69758e289aa7ab440b3cbeaa21995c2f4232b",
  "3eb858e78f5a7254d8c9731174a94f76755fd3941c0ac93735c07ba14579630e",
  "a45fdc55c76448c049a1ab33f17023edfb2be3581e9c7aade8a6125215e04220",
  "d483fe813c6ba647ebbfd3ec41adca1c6130c2beeee9d9bf065c8d151c5f396e",
  "8a2e1d30050198c65a54483123960ccc38aef6848e1ec8f5f780e8523769ba32",
  "32888462f8b486c68ad7dd9610be5192bbeaf3b443951ac1a8118419d9fa097b",
  "227142501b9d4355ccba290404bde41575b037693cef1f438c47f8fbf35d1165",
  "5c37cc491da847cfeb9281d407efc41e15144c876e0170b499a96a22ed31e01e",
  "445425117cb8c90edcbc7c1cc0e74f747f2c1efa5630a967c64f287792a48a4b",
  "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
];

/** The first challenge of the `equivalence_simple` test in the merlin crate. */
export const merlinVector = {
  label: "test protocol",
  messageLabel: "some label",
  message: "some data",
  challengeLabel: "challenge",
  challenge: "d5a21972d0d5fe320c0d263fac7fffb8145aa640af6e9bca177c03c7efcf0615",
} as const;

/**
 * The Substrate dev accounts: the mini secret of the dev phrase, its public key and the
 * `//Alice` and `//Bob` accounts, which every Substrate chain spec funds.
 */
export const devAccounts = {
  seed: "fac7959dbfe72f052e5a0c3c8d6530f202b02fd8f9f5ca3580ec8deb7797479e",
  publicKey: "46ebddef8cd9bb167dc30878d7113b7e168e6f0646beffd77d69d39bad76b47a",
  alice: "d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
  bob: "8eaf04151687736326c9fea17e25fc5287613693c912909cb226aa4794f26a48",
} as const;

/** Frozen from @scure/sr25519 2.4.0. signature and soft took random, randomSignature did not. */
export const scureVectors = {
  seed: "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
  secret:
    "307c83864f2833cb427a2ef1c00a013cfdff2768d980c0a3a520f006904de94f9b4f0afe280b746a778684e75442502057b7473a03f08f96f5a38e9287e01f8f",
  publicKey: "44a996beb1eef7bdcab976ab6d2ca26104834164ecf28fb375600576fcc6eb0f",
  message: "curves signs on ristretto255",
  random: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  signature:
    "30659dac94680407f781dd189dd7c2366b2a300c1753b6ab50dde85a702c9976dbc1b39a008bd8608b8fdd7e20d34cb04a69a6047f2f887c6ac75ec4e191fd8c",
  randomSignature:
    "aa0ad66f1ecc8c9885149bcce445e39a6772d4cd85ceab283530e1fcfbf8155f97c1913a832a754ae34c393802fcf30f8587181b42b789338877df79fa954486",
  chainCode: "2472697374726574746f00000000000000000000000000000000000000000000",
  hard: "288b28420963a503776622e2846a3a9d6cb2b7707c4fc0fba90fed0389811c6aa808144905f1ee796a3941ad2bd6c571192c8a147daa19f91f026c965aae39b3",
  soft: "305305c97b94709a6bcbfd4327a2f9d9061877ff9387d9afa307cc263ed49a11376cf232962e0ec44abffeae194a843122f67b5823c914d4bf495f8325a5c113",
  softPublic: "ac96f605071c0f63b37a4c6eb9aa7d4cc837c29da1fdc13489b51958bcc96142",
} as const;
