import { sha512 } from "@agntn/hashes/sha2";
import { describe, expect, it } from "vite-plus/test";
import { defineCurve, isPrime, multiplyPoint as multiplyOnCurve } from "../src/index.ts";
import {
  addPoints,
  brainpoolP512r1,
  convertPoint,
  isOnCurve,
  liftX,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  subtractPoints,
  verify,
} from "../src/brainpoolp512r1.ts";
import {
  anyAFormulas,
  combine,
  minusThreeAFormulas,
  sec1Curve,
  zeroAFormulas,
} from "../src/core/sec1.ts";
import {
  brainpoolP512r1GeneratorMultiples,
  brainpoolP512r1PointMultiples,
  brainpoolP512r1Rfc7027,
  brainpoolP512r1Signature,
  brainpoolP512r1Vectors,
} from "./fixtures/brainpoolp512r1.ts";
import wycheproof from "./fixtures/wycheproof-brainpoolp512r1.json" with { type: "json" };
import { medians } from "./timing.ts";

const {
  g,
  gUncompressed,
  minusG,
  twoG,
  threeG,
  threeGUncompressed,
  orderMinusOne,
  xWithoutPoint,
  xThree,
} = brainpoolP512r1Vectors;
const infinity = "The result is the point at infinity";
const invalidPoint = "Invalid SEC1 brainpoolP512r1 public key";
const uncompressed = { compressed: false };
const order = BigInt(`0x${orderMinusOne}`) + 1n;
const curve = defineCurve(brainpoolP512r1);
const POINT_TWEAK = 0x1234567890abcdefn;

/* A number as the 128 hex digits of a coordinate. */
function wide(value: bigint): string {
  return value.toString(16).padStart(128, "0");
}

/* A point as uncompressed SEC1, or "infinity", so results from every path compare as text. */
function sec1Hex(point: Readonly<{ x: bigint; y: bigint }> | null | undefined): string {
  if (point === null || point === undefined) return "infinity";
  return `04${wide(point.x)}${wide(point.y)}`;
}

/* x and y of uncompressed SEC1 hex. */
function coordinates(point: string): { x: bigint; y: bigint } {
  return { x: BigInt(`0x${point.slice(2, 130)}`), y: BigInt(`0x${point.slice(130)}`) };
}

/* SHA-512 hex of the bytes of a message. */
function digestOf(message: Uint8Array): string {
  return Buffer.from(sha512(message)).toString("hex");
}

/* 1 + 16 + ... + 16^127: a multiply recodes a scalar minus this, so its neighbours are edges. */
const ones = ((1n << 512n) - 1n) / 15n;
const hashed = Array.from(
  { length: 8 },
  (_, index) => BigInt(`0x${digestOf(new Uint8Array([index]))}`) % order,
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
  1n << 508n,
  1n << 511n,
  order >> 1n,
  (order >> 1n) + 1n,
  order - 17n,
  order - 2n,
  order - 1n,
  ...hashed,
];
const other = multiplyPoint(g, 0x5eedn, uncompressed);

describe("brainpoolP512r1 domain parameters", () => {
  it("match RFC 5639, with a prime n, G on the curve and n times G at infinity", () => {
    expect(convertPoint(g, uncompressed)).toBe(gUncompressed);
    expect(sec1Hex(brainpoolP512r1.g)).toBe(gUncompressed);
    expect(isPrime(brainpoolP512r1.p)).toBe(true);
    expect(isPrime(brainpoolP512r1.n)).toBe(true);
    expect(multiplyOnCurve(curve, brainpoolP512r1.g, order)).toBeNull();
  });

  it("need the formulas for any a, since a is neither 0 nor -3, and take 128 digits", () => {
    const { a, p } = brainpoolP512r1;
    expect([0n, p - 3n]).not.toContain(a);
    expect(
      sec1Curve(brainpoolP512r1, { name: "brainpoolP512r1", formulas: anyAFormulas }).digits,
    ).toBe(128);
    for (const formulas of [zeroAFormulas, minusThreeAFormulas]) {
      expect(() => sec1Curve(brainpoolP512r1, { name: "brainpoolP512r1", formulas })).toThrow(
        "These formulas are for another a",
      );
    }
  });
});

describe("brainpoolP512r1 point math", () => {
  it("adds, subtracts and negates points", () => {
    expect(addPoints(g, g)).toBe(twoG);
    expect(subtractPoints(threeG, g)).toBe(twoG);
    expect(addPoints(gUncompressed, twoG, uncompressed)).toBe(threeGUncompressed);
    expect(negatePoint(g)).toBe(minusG);
    expect(addPoints(twoG, minusG)).toBe(g);
  });

  it("multiplies a point and the generator by a scalar", () => {
    expect(multiplyPoint(g, "3")).toBe(threeG);
    expect(multiplyPoint(g, 3n, uncompressed)).toBe(threeGUncompressed);
    expect(multiplyGenerator("03")).toBe(threeG);
    expect(multiplyGenerator(orderMinusOne)).toBe(minusG);
  });

  it("gives the multiples OpenSSL gives, and the keys and the secret RFC 7027 prints", () => {
    for (const [scalar, point] of brainpoolP512r1GeneratorMultiples) {
      expect(multiplyGenerator(scalar, uncompressed)).toBe(point);
      expect(multiplyPoint(g, BigInt(`0x${scalar}`), uncompressed)).toBe(point);
    }
    for (const [point, product] of brainpoolP512r1PointMultiples) {
      expect(multiplyPoint(point, POINT_TWEAK)).toBe(product);
    }
    const { secretA, publicKeyA, secretB, publicKeyB, shared } = brainpoolP512r1Rfc7027;
    expect(multiplyGenerator(secretA, uncompressed)).toBe(publicKeyA);
    expect(multiplyGenerator(secretB, uncompressed)).toBe(publicKeyB);
    expect(multiplyPoint(publicKeyB, secretA, uncompressed)).toBe(shared);
    expect(multiplyPoint(publicKeyA, secretB, uncompressed)).toBe(shared);
  });

  it("multiplies G and another point like the affine code, at the digit edges too", () => {
    for (const scalar of edges) {
      const product = sec1Hex(multiplyOnCurve(curve, brainpoolP512r1.g, scalar));
      expect(multiplyGenerator(scalar, uncompressed)).toBe(product);
      expect(multiplyPoint(g, scalar, uncompressed)).toBe(product);
      expect(multiplyPoint(other, scalar, uncompressed)).toBe(
        sec1Hex(multiplyOnCurve(curve, coordinates(other), scalar)),
      );
    }
  });

  /* 128 rows of 15 at 64 bytes a number: close to P-521's cost, so it takes P-521's limit. */
  it(
    "reads every entry of the comb and of the verification table right",
    { timeout: 60_000 },
    () => {
      const tables = sec1Curve(brainpoolP512r1, {
        name: "brainpoolP512r1",
        formulas: anyAFormulas,
      });
      for (let row = 0n; row < 128n; row++) {
        const base = multiplyPoint(g, 16n ** row, uncompressed);
        let multiple = base;
        for (let digit = 1n; digit < 16n && digit * 16n ** row < order; digit++) {
          expect(multiplyGenerator(digit * 16n ** row, uncompressed)).toBe(multiple);
          expect(
            sec1Hex(combine(tables, { a: digit * 16n ** row, b: 0n, point: brainpoolP512r1.g })),
          ).toBe(multiple);
          multiple = addPoints(multiple, base, uncompressed);
        }
      }
    },
  );

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

  it("refuses the point at infinity, scalars outside 1 to n - 1 and text that isn't SEC1", () => {
    expect(() => addPoints(g, minusG)).toThrow(infinity);
    expect(() => subtractPoints(g, g)).toThrow(infinity);
    for (const scalar of ["0", 0n, "0x03", "", "f".repeat(129), "f".repeat(128), order, -1n]) {
      expect(() => multiplyPoint(g, scalar)).toThrow("from 1 to the curve order minus 1");
    }
    for (const point of [`06${threeGUncompressed.slice(2)}`, g.slice(2), `0x${g}`, `${g}00`]) {
      expect(() => negatePoint(point)).toThrow(invalidPoint);
    }
  });
});

describe("brainpoolP512r1 x coordinates and SEC1 encodings", () => {
  it("lifts x to both points and refuses an x no point has", () => {
    expect(liftX(g.slice(2))).toEqual({ even: g, odd: minusG });
    expect(liftX(threeG.slice(2), uncompressed).odd).toBe(threeGUncompressed);
    expect(() => liftX(xWithoutPoint)).toThrow("No point of brainpoolP512r1 has this x");
    expect(() => liftX(wide(brainpoolP512r1.p))).toThrow("No point of brainpoolP512r1 has this x");
    expect(() => liftX("f".repeat(128))).toThrow("No point of brainpoolP512r1 has this x");
    expect(() => liftX(g)).toThrow("x must be 128 hex digits");
  });

  it("checks points against the curve, x at or above p included", () => {
    expect(isOnCurve(g)).toBe(true);
    expect(isOnCurve(xThree)).toBe(true);
    const xP = wide(brainpoolP512r1.p + 3n);
    expect(isOnCurve(`04${xP}${xThree.slice(130)}`)).toBe(false);
    expect(isOnCurve(`02${xP}`)).toBe(false);
    expect(isOnCurve(`${threeGUncompressed.slice(0, -1)}4`)).toBe(false);
    expect(isOnCurve(`02${xWithoutPoint}`)).toBe(false);
    expect(() => isOnCurve(g.slice(2))).toThrow(invalidPoint);
  });

  it("converts between compressed and uncompressed and lowercases", () => {
    expect(convertPoint(gUncompressed)).toBe(g);
    expect(convertPoint(minusG.toUpperCase())).toBe(minusG);
    expect(() => convertPoint(`02${xWithoutPoint}`)).toThrow(invalidPoint);
  });
});

describe("brainpoolP512r1 ECDSA", () => {
  it("answers every Wycheproof P1363 vector over SHA-512", () => {
    let count = 0;
    for (const { publicKey, tests } of wycheproof.sha512) {
      for (const { tcId, msg, sig, valid } of tests) {
        const digest = digestOf(Buffer.from(msg, "hex"));
        if (sig.length === 256) {
          expect(verify(sig, { digest, publicKey }), `tcId ${tcId}`).toBe(valid);
        } else {
          expect(valid, `tcId ${tcId}`).toBe(false);
          expect(() => verify(sig, { digest, publicKey }), `tcId ${tcId}`).toThrow(RangeError);
        }
        count++;
      }
    }
    expect(count).toBe(337);
  });

  it("takes a high s unless lowS asks, reads all 512 bits of a digest and calls r or s out of range invalid", () => {
    const { publicKey, digest, signature } = brainpoolP512r1Signature;
    const [r, s] = [signature.slice(0, 128), BigInt(`0x${signature.slice(128)}`)];
    const flipped = `${r}${wide(order - s)}`;
    const [high, low] = s > order >> 1n ? [signature, flipped] : [flipped, signature];
    const lastByte = (Number.parseInt(digest.slice(-2), 16) ^ 1).toString(16).padStart(2, "0");
    expect(verify(signature, { digest, publicKey })).toBe(true);
    expect(verify(high, { digest, publicKey })).toBe(true);
    expect(verify(high, { digest, publicKey, lowS: true })).toBe(false);
    expect(verify(low, { digest, publicKey, lowS: true })).toBe(true);
    expect(verify(signature, { digest: `${digest.slice(0, -2)}${lastByte}`, publicKey })).toBe(
      false,
    );
    expect(verify(signature, { digest: digest.slice(0, 96), publicKey })).toBe(false);
    expect(() => verify(signature, { digest: `${digest}ff`, publicKey })).toThrow(
      "Digest must be hex without 0x, 1 to 64 bytes",
    );
    expect(verify(signature, { digest, publicKey: twoG })).toBe(false);
    const [zero, n] = ["0".repeat(128), wide(order)];
    for (const outside of [
      zero + signature.slice(128),
      r + zero,
      n + signature.slice(128),
      r + n,
    ]) {
      expect(verify(outside, { digest, publicKey })).toBe(false);
    }
  });

  it("refuses arguments in another shape, in the caller's words", () => {
    const { publicKey, signature } = brainpoolP512r1Signature;
    const digest = "00".repeat(64);
    expect(() => verify(signature.slice(2), { digest, publicKey })).toThrow(
      "Signature must be 256 hex digits without 0x, r then s",
    );
    expect(() => verify(signature, { digest: "0x00", publicKey })).toThrow(
      "Digest must be hex without 0x, 1 to 64 bytes",
    );
    expect(() => verify(signature, { digest, publicKey: publicKey.slice(2) })).toThrow(
      invalidPoint,
    );
    expect(() => {
      Reflect.apply(verify, undefined, [signature, digest]);
    }).toThrow("Call it as verify(signature, { digest, publicKey })");
  });
});
