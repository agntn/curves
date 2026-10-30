import { sha256, sha512 } from "@agntn/hashes/sha2";
import { describe, expect, it } from "vite-plus/test";
import { defineCurve, multiplyPoint as multiplyOnCurve } from "../src/index.ts";
import {
  addPoints,
  addScalars,
  convertPoint,
  invertScalar,
  isOnCurve,
  liftX,
  multiplyGenerator,
  multiplyPoint,
  multiplyScalars,
  negatePoint,
  recoverPublicKey,
  secp256k1,
  subtractPoints,
  subtractScalars,
  verify,
  type RecoverOptions,
} from "../src/secp256k1.ts";
import { combine } from "../src/core/secp256k1.ts";
import { block170, highS, nobleSignatures, overflow } from "./fixtures/ecdsa.ts";
import {
  curveVectors,
  generatorMultiples,
  POINT_TWEAK,
  pointMultiples,
  secp256k1Vectors,
} from "./fixtures/vectors.ts";
import wycheproof from "./fixtures/wycheproof-ecdsa.json" with { type: "json" };
import { medians } from "./timing.ts";

const {
  g,
  gUncompressed,
  minusG,
  twoG,
  threeG,
  threeGUncompressed,
  orderMinusOne,
  inverseOfTwo,
  xWithoutPoint,
  xOne,
  yOne,
} = secp256k1Vectors;
const infinity = "The result is the point at infinity";
const invalidPoint = "Invalid SEC1 secp256k1 public key";
const uncompressed = { compressed: false };
const order = BigInt(`0x${orderMinusOne}`) + 1n;
const onePlusP = (curveVectors.secp256k1.p + 1n).toString(16);

/* A point as uncompressed SEC1, or "infinity", so results from every path compare as text. */
function sec1(point: Readonly<{ x: bigint; y: bigint }> | null | undefined): string {
  if (point === null || point === undefined) return "infinity";
  return `04${point.x.toString(16).padStart(64, "0")}${point.y.toString(16).padStart(64, "0")}`;
}

/* x and y of uncompressed SEC1 hex. */
function coordinates(point: string): { x: bigint; y: bigint } {
  return { x: BigInt(`0x${point.slice(2, 66)}`), y: BigInt(`0x${point.slice(66)}`) };
}

/* 1 + 16 + ... + 16^63: a multiply recodes a scalar minus this, so its neighbours are edges. */
const ones = ((1n << 256n) - 1n) / 15n;
const hashed = Array.from({ length: 8 }, (_, index) =>
  BigInt(`0x${Buffer.from(sha256(new Uint8Array([index]))).toString("hex")}`),
);
const edges = [
  1n,
  2n,
  15n,
  16n,
  17n,
  255n,
  256n,
  ones - 1n,
  ones,
  ones + 1n,
  1n << 252n,
  1n << 255n,
  order >> 1n,
  (order >> 1n) + 1n,
  order - 17n,
  order - 2n,
  order - 1n,
  ...hashed,
];
const other = multiplyPoint(g, 0x5eedn, uncompressed);

describe("secp256k1 domain parameters", () => {
  it("match SEC 2, and n times G is infinity on the generic curve code", () => {
    const { a, b, p, g: generator } = curveVectors.secp256k1;
    expect(secp256k1).toEqual({ a, b, p, n: order, h: 1n, g: generator });
    expect(multiplyOnCurve(defineCurve(secp256k1), generator, order)).toBeNull();
  });
});

describe("secp256k1 point math", () => {
  it("adds, subtracts and negates points", () => {
    expect(addPoints(g, g)).toBe(twoG);
    expect(subtractPoints(threeG, g)).toBe(twoG);
    expect(addPoints(gUncompressed, twoG, { compressed: false })).toBe(threeGUncompressed);
    expect(negatePoint(g)).toBe(minusG);
    expect(addPoints(twoG, minusG)).toBe(g);
  });

  it("multiplies a point and the generator by a scalar", () => {
    expect(multiplyPoint(g, "3")).toBe(threeG);
    expect(multiplyPoint(g, 3n, { compressed: false })).toBe(threeGUncompressed);
    expect(multiplyGenerator("03")).toBe(threeG);
    expect(multiplyGenerator(orderMinusOne)).toBe(minusG);
  });

  it("gives the multiples of G that @noble/curves gives", () => {
    for (const [scalar, point] of generatorMultiples) {
      expect(multiplyGenerator(scalar, { compressed: false })).toBe(point);
      expect(multiplyPoint(g, BigInt(`0x${scalar}`), { compressed: false })).toBe(point);
    }
    for (const [point, product] of pointMultiples) {
      expect(multiplyPoint(point, POINT_TWEAK)).toBe(product);
    }
  });

  it("agrees with affine arithmetic over the same parameters", () => {
    const curve = defineCurve(secp256k1);
    for (const [scalar] of generatorMultiples) {
      const point = multiplyOnCurve(curve, secp256k1.g, BigInt(`0x${scalar}`));
      if (point === null) throw new Error("A scalar below n gave infinity");
      const x = point.x.toString(16).padStart(64, "0");
      const y = point.y.toString(16).padStart(64, "0");
      expect(multiplyGenerator(scalar, { compressed: false })).toBe(`04${x}${y}`);
    }
  });

  it("reads every entry of the comb and of the verification table right", () => {
    for (let row = 0n; row < 64n; row++) {
      const base = multiplyPoint(g, 16n ** row, uncompressed);
      let multiple = base;
      for (let digit = 1n; digit < 16n; digit++) {
        expect(multiplyGenerator(digit * 16n ** row, uncompressed)).toBe(multiple);
        expect(sec1(combine(digit * 16n ** row, 0n, secp256k1.g))).toBe(multiple);
        multiple = addPoints(multiple, base, uncompressed);
      }
    }
  });

  it("refuses the point at infinity instead of encoding it", () => {
    expect(() => addPoints(g, minusG)).toThrow(infinity);
    expect(() => subtractPoints(g, g)).toThrow(infinity);
  });

  it("refuses scalars outside 1 to n minus 1 and encodings that are not SEC1", () => {
    for (const scalar of ["0", 0n, "0x03", "", "f".repeat(65)]) {
      expect(() => multiplyPoint(g, scalar)).toThrow(RangeError);
    }
    expect(() => multiplyGenerator(order.toString(16))).toThrow(
      "from 1 to the curve order minus 1",
    );
    expect(() => multiplyGenerator(-1n)).toThrow(RangeError);
    for (const point of [`06${threeGUncompressed.slice(2)}`, g.slice(2), `0x${g}`]) {
      expect(() => negatePoint(point)).toThrow(invalidPoint);
    }
  });

  it("refuses coordinates at or above p, as SEC 1 section 2.3.4 asks", () => {
    expect(isOnCurve(xOne)).toBe(true);
    expect(isOnCurve(`04${onePlusP}${xOne.slice(66)}`)).toBe(false);
    expect(() => negatePoint(`02${onePlusP}`)).toThrow(invalidPoint);
    expect(isOnCurve(yOne)).toBe(true);
    expect(isOnCurve(`${yOne.slice(0, 66)}${onePlusP}`)).toBe(false);
  });
});

describe("secp256k1 multiplication", () => {
  it("multiplies G and another point like the affine code, at the digit edges too", () => {
    const curve = defineCurve(secp256k1);
    for (const scalar of edges) {
      const product = sec1(multiplyOnCurve(curve, secp256k1.g, scalar));
      expect(multiplyGenerator(scalar, uncompressed)).toBe(product);
      expect(multiplyPoint(g, scalar, uncompressed)).toBe(product);
      expect(multiplyPoint(other, scalar, uncompressed)).toBe(
        sec1(multiplyOnCurve(curve, coordinates(other), scalar)),
      );
    }
  });

  it("combines G and a point for verification, through zero scalars and infinity", () => {
    const point = coordinates(other);
    expect(sec1(combine(0n, 5n, point))).toBe(multiplyPoint(other, 5n, uncompressed));
    expect(sec1(combine(5n, 0n, point))).toBe(multiplyGenerator(5n, uncompressed));
    expect(combine(0n, 0n, point)).toBeUndefined();
    for (const scalar of edges) {
      expect(combine(scalar, order - scalar, secp256k1.g)).toBeUndefined();
      expect(sec1(combine(scalar, scalar, secp256k1.g))).toBe(
        multiplyGenerator((2n * scalar) % order, uncompressed),
      );
    }
  });

  it("takes about as long for 1 as for n - 1", () => {
    for (const run of [
      (scalar: bigint) => multiplyGenerator(scalar),
      (scalar: bigint) => multiplyPoint(other, scalar),
    ]) {
      const [one, top] = medians(
        () => run(1n),
        () => run(order - 1n),
      );
      expect(one / top).toBeGreaterThan(0.75);
      expect(one / top).toBeLessThan(1.33);
    }
  });
});

describe("secp256k1 scalar math", () => {
  it("adds, subtracts, multiplies and inverts mod n", () => {
    expect(addScalars(orderMinusOne, "2")).toBe("1".padStart(64, "0"));
    expect(subtractScalars("0", 1n)).toBe(orderMinusOne);
    expect(multiplyScalars("2", inverseOfTwo)).toBe("1".padStart(64, "0"));
    expect(invertScalar(2n)).toBe(inverseOfTwo);
    expect(multiplyScalars(orderMinusOne, orderMinusOne)).toBe("1".padStart(64, "0"));
  });

  it("refuses zero as an inverse and values at or above n", () => {
    expect(() => invertScalar("0")).toThrow(RangeError);
    expect(() => addScalars(order.toString(16), "1")).toThrow("Scalar a must be hex");
    expect(() => subtractScalars("1", order)).toThrow("Scalar b must be hex");
  });
});

describe("secp256k1 x coordinates", () => {
  it("lifts x to both points, the even one being the BIP340 key", () => {
    expect(liftX(g.slice(2))).toEqual({ even: g, odd: minusG });
    expect(liftX(threeG.slice(2), { compressed: false }).even).toBe(threeGUncompressed);
  });

  it("refuses an x without a point and an x that is not 64 hex digits", () => {
    expect(() => liftX(xWithoutPoint)).toThrow("No point of secp256k1 has this x");
    expect(() => liftX("f".repeat(64))).toThrow("No point of secp256k1 has this x");
    expect(() => liftX(g)).toThrow("x must be 64 hex digits");
  });

  it("checks points against the curve and refuses what is not SEC1", () => {
    expect(isOnCurve(g)).toBe(true);
    expect(isOnCurve(threeGUncompressed)).toBe(true);
    const offCurve = `${threeGUncompressed.slice(0, -1)}3`;
    expect(isOnCurve(offCurve)).toBe(false);
    expect(isOnCurve(`02${xWithoutPoint}`)).toBe(false);
    expect(() => isOnCurve(g.slice(2))).toThrow(invalidPoint);
  });
});

describe("secp256k1 SEC1 encodings", () => {
  it("converts between compressed and uncompressed and lowercases", () => {
    expect(convertPoint(gUncompressed)).toBe(g);
    expect(convertPoint(g, { compressed: false })).toBe(gUncompressed);
    expect(convertPoint(minusG.toUpperCase())).toBe(minusG);
    expect(() => convertPoint(`02${xWithoutPoint}`)).toThrow(invalidPoint);
    expect(() => {
      Reflect.apply(convertPoint, undefined, [g, { compressed: "no" }]);
    }).toThrow("Compressed must be a boolean");
  });
});

const [signed] = nobleSignatures;
if (signed === undefined) throw new Error("The noble fixture lost its first signature");

/* Recover with one recovery id, or undefined when no point has the x that id names. */
function recoverOrMiss(signature: string, options: RecoverOptions): string | undefined {
  try {
    return recoverPublicKey(signature, options);
  } catch (error) {
    if (error instanceof RangeError && error.message.startsWith("No point")) return undefined;
    throw error;
  }
}

describe("secp256k1 ECDSA", () => {
  it("answers every Wycheproof P1363 vector, over SHA-256 and over SHA-512", () => {
    let count = 0;
    for (const [groups, hash] of [
      [wycheproof.sha256, sha256],
      [wycheproof.sha512, sha512],
    ] as const) {
      for (const { publicKey, tests } of groups) {
        for (const { tcId, msg, sig, valid } of tests) {
          const digest = Buffer.from(hash(Buffer.from(msg, "hex"))).toString("hex");
          if (sig.length === 128) {
            expect(verify(sig, { digest, publicKey }), `tcId ${tcId}`).toBe(valid);
          } else {
            expect(valid, `tcId ${tcId}`).toBe(false);
            expect(() => verify(sig, { digest, publicKey }), `tcId ${tcId}`).toThrow(RangeError);
          }
          count++;
        }
      }
    }
    expect(count).toBe(574);
  });

  it("recovers the keys @noble/curves 2.4.0 signed with, from digests of 1 to 64 bytes", () => {
    for (const { digest, signature, recovery, publicKey } of nobleSignatures) {
      expect(recoverPublicKey(signature, { digest, recovery })).toBe(publicKey);
      expect(recoverPublicKey(signature, { digest, recovery, ...uncompressed })).toBe(
        convertPoint(publicKey, uncompressed),
      );
      expect(verify(signature, { digest, publicKey })).toBe(true);
      const upper = { digest: digest.toUpperCase(), publicKey, lowS: true };
      expect(verify(signature.toUpperCase(), upper)).toBe(true);
    }
  });

  it("finds the signer behind one of the four recovery ids of every valid Wycheproof signature", () => {
    for (const { publicKey, tests } of wycheproof.sha256) {
      for (const { tcId, msg, sig } of tests.filter((test) => test.valid)) {
        const digest = Buffer.from(sha256(Buffer.from(msg, "hex"))).toString("hex");
        const keys = [0, 1, 2, 3].map((recovery) =>
          recoverOrMiss(sig, { digest, recovery, ...uncompressed }),
        );
        expect(keys, `tcId ${tcId}`).toContain(publicKey);
      }
    }
  });

  it("verifies Satoshi's signature in block 170 and recovers his key from it", () => {
    const { digest, signature, recovery, publicKey } = block170;
    expect(verify(signature, { digest, publicKey, lowS: true })).toBe(true);
    expect(recoverPublicKey(signature, { digest, recovery, ...uncompressed })).toBe(publicKey);
    const other = recoverPublicKey(signature, { digest, recovery: 0 });
    expect(other).not.toBe(convertPoint(publicKey));
    expect(verify(signature, { digest, publicKey: other })).toBe(true);
  });

  it("takes a high s unless lowS asks for low ones", () => {
    const { digest, signature, recovery, publicKey } = highS;
    expect(verify(signature, { digest, publicKey })).toBe(true);
    expect(verify(signature, { digest, publicKey, lowS: true })).toBe(false);
    expect(recoverPublicKey(signature, { digest, recovery })).toBe(publicKey);
  });

  it("recovers through an R whose x is r + n, and refuses an r + n with no point", () => {
    const { digest, signature, recovery, publicKey } = overflow;
    expect(recoverPublicKey(signature, { digest, recovery })).toBe(publicKey);
    expect(verify(signature, { digest, publicKey })).toBe(true);
    expect(() =>
      recoverPublicKey(signed.signature, { digest: signed.digest, recovery: 2 }),
    ).toThrow("No point of secp256k1 has x = r + n, so recovery 2 fails");
  });

  it("calls r or s outside 1 to n - 1 invalid when verifying and refuses it when recovering", () => {
    const { digest, signature, publicKey } = signed;
    const [r, s] = [signature.slice(0, 64), signature.slice(64)];
    const [zero, n] = ["0".repeat(64), order.toString(16)];
    for (const outside of [zero + s, r + zero, n + s, r + n]) {
      expect(verify(outside, { digest, publicKey })).toBe(false);
      expect(() => recoverPublicKey(outside, { digest, recovery: 0 })).toThrow(
        "r and s must both be from 1 to the curve order minus 1",
      );
    }
  });

  it("reads only the leftmost 256 bits of a digest past 32 bytes, as SEC 1 asks", () => {
    const wide = nobleSignatures.find(({ digest }) => digest.length === 128);
    if (wide === undefined) throw new Error("The noble fixture lost its 64-byte digest");
    const { digest, signature, publicKey } = wide;
    expect(verify(signature, { digest: digest.slice(0, 64), publicKey })).toBe(true);
    expect(
      verify(signature, { digest: `${digest.slice(0, 64)}${"00".repeat(32)}`, publicKey }),
    ).toBe(true);
    expect(verify(signature, { digest: `00${digest.slice(2)}`, publicKey })).toBe(false);
  });

  it("refuses arguments in another shape, in the caller's words", () => {
    const { digest, signature, recovery, publicKey } = signed;
    for (const malformed of [signature.slice(2), `0x${signature.slice(2)}`, null, 7]) {
      expect(() => {
        Reflect.apply(verify, undefined, [malformed, { digest, publicKey }]);
      }).toThrow("Signature must be 128 hex digits without 0x, r then s");
    }
    for (const malformed of ["", "0", "0x00", "00".repeat(65)]) {
      expect(() => verify(signature, { digest: malformed, publicKey })).toThrow(
        "Digest must be hex without 0x, 1 to 64 bytes",
      );
    }
    expect(() => verify(signature, { digest, publicKey: publicKey.slice(2) })).toThrow(
      invalidPoint,
    );
    for (const options of [undefined, null, digest]) {
      expect(() => {
        Reflect.apply(verify, undefined, [signature, options]);
      }).toThrow("Call it as verify(signature, { digest, publicKey })");
    }
    const nobleShape = [signature, Buffer.from(digest, "hex"), Buffer.from(publicKey, "hex")];
    expect(() => {
      Reflect.apply(verify, undefined, nobleShape);
    }).toThrow("Digest must be hex without 0x");
    expect(() => {
      Reflect.apply(verify, undefined, [signature, { digest, publicKey, lowS: "yes" }]);
    }).toThrow("lowS must be a boolean");
    for (const id of [4, -1, 1.5, Number.NaN, "1"]) {
      expect(() => {
        Reflect.apply(recoverPublicKey, undefined, [signature, { digest, recovery: id }]);
      }).toThrow("Recovery must be an integer from 0 to 3");
    }
    expect(() => {
      Reflect.apply(recoverPublicKey, undefined, [signature, recovery]);
    }).toThrow("Call it as recoverPublicKey(signature, { digest, recovery })");
    expect(() => {
      Reflect.apply(recoverPublicKey, undefined, [signature, { digest, recovery, compressed: 1 }]);
    }).toThrow("Compressed must be a boolean");
  });
});
