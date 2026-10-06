/**
 * Textbook curves: y^2 = x^3 + 2x + 2 over F17 with the multiples of (5, 1) from Paar and Pelzl,
 * Understanding Cryptography, chapter 9, and y^2 = x^3 + x + 1 over F23.
 */
export const curveVectors = {
  paar: {
    a: 2n,
    b: 2n,
    p: 17n,
    order: 19n,
    multiples: [
      [5n, 1n],
      [6n, 3n],
      [10n, 6n],
      [3n, 1n],
      [9n, 16n],
      [16n, 13n],
      [0n, 6n],
      [13n, 7n],
      [7n, 6n],
      [7n, 11n],
      [13n, 10n],
      [0n, 11n],
      [16n, 4n],
      [9n, 1n],
      [3n, 16n],
      [10n, 11n],
      [6n, 14n],
      [5n, 16n],
    ],
  },
  f23: {
    a: 1n,
    b: 1n,
    p: 23n,
    count: 28n,
    /** The one point with y = 0, so its double is infinity. */
    orderTwo: { x: 4n, y: 0n },
    orderSeven: [
      [5n, 4n],
      [5n, 19n],
      [13n, 7n],
      [13n, 16n],
      [17n, 3n],
      [17n, 20n],
    ],
  },
  /** secp256k1 given as a, b and p, with G and 3G from `secp256k1Vectors`. */
  secp256k1: {
    a: 0n,
    b: 7n,
    p: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn,
    g: {
      x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
      y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
    },
    threeG: {
      x: 0xf9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9n,
      y: 0x388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672n,
    },
  },
} as const;

/** Multiples of G as SEC1 hex and scalars mod n, the usual published secp256k1 constants. */
export const secp256k1Vectors = {
  g: "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  gUncompressed:
    "0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" +
    "483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8",
  minusG: "0379be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  twoG: "02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5",
  threeG: "02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
  threeGUncompressed:
    "04f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9" +
    "388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672",
  orderMinusOne: "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140",
  inverseOfTwo: "7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a1",
  /** No point of the curve has x = 5. */
  xWithoutPoint: "0000000000000000000000000000000000000000000000000000000000000005",
} as const;

/**
 * k and k times G, uncompressed, from @noble/curves 2.4.0 (`Point.BASE.multiply(k).toHex(false)`),
 * frozen here so the tests need no second implementation. The scalars are small ones, ones near n,
 * and SHA-256 of "curves vector 0" to "curves vector 7" mod n.
 */
export const generatorMultiples: readonly (readonly [string, string])[] = [
  [
    "0000000000000000000000000000000000000000000000000000000000000001",
    "0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8",
  ],
  [
    "0000000000000000000000000000000000000000000000000000000000000002",
    "04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a",
  ],
  [
    "0000000000000000000000000000000000000000000000000000000000000007",
    "045cbdf0646e5db4eaa398f365f2ea7a0e3d419b7e0330e39ce92bddedcac4f9bc6aebca40ba255960a3178d6d861a54dba813d0b813fde7b5a5082628087264da",
  ],
  [
    "000000000000000000000000000000000000000000000000000000000000ffff",
    "04dc27130a5e29d465f8ed0ec8c9032add3165def4a19421a6aa709b47acf7efd0fca03dd32057fc6ea0e41c0934b26aaeabff1997e407be325b855796dd8b1300",
  ],
  [
    "0000000000000000000000000000000100000000000000000000000000000000",
    "048f68b9d2f63b5f339239c1ad981f162ee88c5678723ea3351b7b444c9ec4c0da662a9f2dba063986de1d90c2b6be215dbbea2cfe95510bfdf23cbf79501fff82",
  ],
  [
    "8000000000000000000000000000000000000000000000000000000000000000",
    "04b23790a42be63e1b251ad6c94fdef07271ec0aada31db6c3e8bd32043f8be384fc6b694919d55edbe8d50f88aa81f94517f004f4149ecb58d10a473deb19880e",
  ],
  [
    "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd036413f",
    "04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5e51e970159c23cc65c3a7be6b99315110809cd9acd992f1edc9bce55af301705",
  ],
  [
    "7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0",
    "0400000000000000000000003b78ce563f89a0ed9414f5aa28ad0d96d6795f9c633f3979bf72ae8202983dc989aec7f2ff2ed91bdd69ce02fc0700ca100e59ddf3",
  ],
  [
    "ab9804c27d5c382a1c80786dfa1fa0541339d6fc7b9d9ad04aa3f1857312a4e0",
    "04b3e05c8b621cae808e0a1413fce7bd54b7f00f0b7288f6b857c9f0a45a9a400592b1a8d052b59fbbb74a293c9e9615a0e9927f78a2e0e4e595500d1bea470eac",
  ],
  [
    "6bd4287fa99fd885b65ca4cadec4234c8ab5b8c3aeb950245ecb633c4f6de6a1",
    "04923206a7b10be8b69286a8d28e94ced1eca1855309a8170edfa2375880a4e5ce0f6d77a66cfba6c7308f4175f8124da09cf1254715050bcf0cf8b468ea740037",
  ],
  [
    "ab3fbefffab10473b68828dbeda93ba0a5a4acf91a8bc2e5906039b984b76f3b",
    "040a9a5867924f255957e9fd56dd84da7c858e016026197cf70b4cb2862c4a4c9d60bd744032718bd74ecbd20a3967fa488bdefb8f2ee60bdbcff547e3a0d95836",
  ],
  [
    "dcb264be00e75df41fd366a71eb89178923948cb6d245a7314a25a3c9d8abb2e",
    "04c33f20bdc61ac32f7c71cea521c09f39813dbdff3d7973bc3a9fe6ea36bd38d595f98e5a012dbf061abf29d49f178ca698352e6807e48744510c2a0e4d62d1b8",
  ],
  [
    "5573bbd246381ce9d29be483a1591568e0e9a9f2021de4e5d7ec7ecaa9c6adb6",
    "04f334a0085fa83ed3639cbe0c0d7beef50c50d7571bf45c979f4f8d8acc9201dddf0b2137f043cd33a2127c111f44d8d0386778b3cd74477b972e2f032befcf6b",
  ],
  [
    "5059a4428dc770da4187b32d3a70845f443ede61a5b95c533d66d153ddb5e2a5",
    "049acc7f0f890e2667a3aba12e5fb3b3d9e299499579d65d21c3968f97160992de51772c1f99dd2d579fce3aef91bc97522fa7059750014775e1d4f36778ae8a08",
  ],
  [
    "f6028f6ae413c42c828a262522f55f896a27d58db34740de06c4c42731e19a6b",
    "0491c7db0f20c866719826015b8e6be86873334c6dbd881c11d50e94efc7f91ab079668cf7c7d2e1be58199480a0365776050ab955602d6942e8707b3ccc33d5de",
  ],
  [
    "10bca1ce60bfe0b80cc49348bc3e36b3f3b8c762603a110a2992b973770c3c3e",
    "041774a7e8695b1225ccf4346ee415857e7160800ccade5f7e6e9195674c07f5e48d86ecfc46d5a873f6f23035e1496e83473f3ce5ef72962faf8bd7ea1535d266",
  ],
];

/** A point and that point times 0x1234567890abcdef, compressed, from @noble/curves 2.4.0. */
export const pointMultiples: readonly (readonly [string, string])[] = [
  [
    "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    "03f973a0b87062c389d125d8199e803b832b6ac6bf7867a4f6cd87506060fc4c58",
  ],
  [
    "02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5",
    "024d384c13b02b35b2772078657ba7dbe7009d06aa566a40542deb9a7a35252349",
  ],
  [
    "025cbdf0646e5db4eaa398f365f2ea7a0e3d419b7e0330e39ce92bddedcac4f9bc",
    "0223e9b8e3bc148683fc9a860a5f8b6490bcd735cf1bb72855c1d8818ce8e4849a",
  ],
  [
    "02dc27130a5e29d465f8ed0ec8c9032add3165def4a19421a6aa709b47acf7efd0",
    "02f4c415a07cbd4d856b892985bb330e35ba54a179abfb54e51b0317fa660e1b3d",
  ],
];

export const POINT_TWEAK = "1234567890abcdef";
