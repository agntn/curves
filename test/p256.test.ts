import { sha256, sha512 } from "@agntn/hashes/sha2";
import { describe, expect, it } from "vite-plus/test";
import { defineCurve, isPrime, multiplyPoint as multiplyOnCurve } from "../src/index.ts";
import {
  addPoints,
  convertPoint,
  isOnCurve,
  liftX,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  p256,
  subtractPoints,
  verify,
} from "../src/p256.ts";
import { combine, minusThreeAFormulas, sec1Curve } from "../src/core/sec1.ts";
import {
  p256GeneratorMultiples,
  p256PointMultiples,
  p256Rfc6979,
  p256Vectors,
} from "./fixtures/p256.ts";
import wycheproof from "./fixtures/wycheproof-p256.json" with { type: "json" };
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
  xZero,
} = p256Vectors;
const infinity = "The result is the point at infinity";
const invalidPoint = "Invalid SEC1 P-256 public key";
const uncompressed = { compressed: false };
const order = BigInt(`0x${orderMinusOne}`) + 1n;
const curve = defineCurve(p256);
const POINT_TWEAK = 0x1234567890abcdefn;

/* A point as uncompressed SEC1, or "infinity", so results from every path compare as text. */
function sec1(point: Readonly<{ x: bigint; y: bigint }> | null | undefined): string {
  if (point === null || point === undefined) return "infinity";
  return `04${point.x.toString(16).padStart(64, "0")}${point.y.toString(16).padStart(64, "0")}`;
}

/* x and y of uncompressed SEC1 hex. */
function coordinates(point: string): { x: bigint; y: bigint } {
  return { x: BigInt(`0x${point.slice(2, 66)}`), y: BigInt(`0x${point.slice(66)}`) };
}

/* Hex of the digest a hash gives for the bytes of a message. */
function digestOf(hash: (bytes: Uint8Array) => Uint8Array, message: Uint8Array): string {
  return Buffer.from(hash(message)).toString("hex");
}

/* 1 + 16 + ... + 16^63: a multiply recodes a scalar minus this, so its neighbours are edges. */
const ones = ((1n << 256n) - 1n) / 15n;
const hashed = Array.from({ length: 8 }, (_, index) =>
  BigInt(`0x${digestOf(sha256, new Uint8Array([index]))}`),
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

describe("P-256 domain parameters", () => {
  it("match SEC 2, with a prime n, G on the curve and n times G at infinity", () => {
    expect(p256.a).toBe(p256.p - 3n);
    expect(convertPoint(g, uncompressed)).toBe(gUncompressed);
    expect(sec1(p256.g)).toBe(gUncompressed);
    expect(isPrime(p256.n)).toBe(true);
    expect(multiplyOnCurve(curve, p256.g, order)).toBeNull();
  });
});

describe("P-256 point math", () => {
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

  it("gives the multiples @noble/curves 2.4.0 gives, and the key RFC 6979 prints", () => {
    for (const [scalar, point] of p256GeneratorMultiples) {
      expect(multiplyGenerator(scalar, uncompressed)).toBe(point);
      expect(multiplyPoint(g, BigInt(`0x${scalar}`), uncompressed)).toBe(point);
    }
    for (const [point, product] of p256PointMultiples) {
      expect(multiplyPoint(point, POINT_TWEAK)).toBe(product);
    }
    expect(multiplyGenerator(p256Rfc6979.secret, uncompressed)).toBe(p256Rfc6979.publicKey);
  });

  it("multiplies G and another point like the affine code, at the digit edges too", () => {
    for (const scalar of edges) {
      const product = sec1(multiplyOnCurve(curve, p256.g, scalar));
      expect(multiplyGenerator(scalar, uncompressed)).toBe(product);
      expect(multiplyPoint(g, scalar, uncompressed)).toBe(product);
      expect(multiplyPoint(other, scalar, uncompressed)).toBe(
        sec1(multiplyOnCurve(curve, coordinates(other), scalar)),
      );
    }
  });

  it("reads every entry of the comb and of the verification table right", () => {
    const tables = sec1Curve(p256, { name: "P-256", formulas: minusThreeAFormulas });
    for (let row = 0n; row < 64n; row++) {
      const base = multiplyPoint(g, 16n ** row, uncompressed);
      let multiple = base;
      for (let digit = 1n; digit < 16n; digit++) {
        expect(multiplyGenerator(digit * 16n ** row, uncompressed)).toBe(multiple);
        expect(sec1(combine(tables, { a: digit * 16n ** row, b: 0n, point: p256.g }))).toBe(
          multiple,
        );
        multiple = addPoints(multiple, base, uncompressed);
      }
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

  it("refuses the point at infinity, scalars outside 1 to n - 1 and text that isn't SEC1", () => {
    expect(() => addPoints(g, minusG)).toThrow(infinity);
    expect(() => subtractPoints(g, g)).toThrow(infinity);
    for (const scalar of ["0", 0n, "0x03", "", "f".repeat(65), order, -1n]) {
      expect(() => multiplyPoint(g, scalar)).toThrow("from 1 to the curve order minus 1");
    }
    for (const point of [`06${threeGUncompressed.slice(2)}`, g.slice(2), `0x${g}`]) {
      expect(() => negatePoint(point)).toThrow(invalidPoint);
    }
  });
});

describe("P-256 x coordinates and SEC1 encodings", () => {
  it("lifts x to both points and refuses an x no point has", () => {
    expect(liftX(g.slice(2))).toEqual({ even: minusG, odd: g });
    expect(liftX(threeG.slice(2), uncompressed).even).toBe(threeGUncompressed);
    expect(() => liftX(xWithoutPoint)).toThrow("No point of P-256 has this x");
    expect(() => liftX("f".repeat(64))).toThrow("No point of P-256 has this x");
    expect(() => liftX(g)).toThrow("x must be 64 hex digits");
  });

  it("checks points against the curve, x at or above p included", () => {
    expect(isOnCurve(g)).toBe(true);
    expect(isOnCurve(xZero)).toBe(true);
    const xP = p256.p.toString(16);
    expect(isOnCurve(`04${xP}${xZero.slice(66)}`)).toBe(false);
    expect(isOnCurve(`${threeGUncompressed.slice(0, -1)}3`)).toBe(false);
    expect(isOnCurve(`02${xWithoutPoint}`)).toBe(false);
    expect(() => isOnCurve(g.slice(2))).toThrow(invalidPoint);
  });

  it("converts between compressed and uncompressed and lowercases", () => {
    expect(convertPoint(gUncompressed)).toBe(g);
    expect(convertPoint(minusG.toUpperCase())).toBe(minusG);
    expect(() => convertPoint(`02${xWithoutPoint}`)).toThrow(invalidPoint);
  });
});

describe("P-256 ECDSA", () => {
  it("answers every Wycheproof P1363 vector over SHA-256", () => {
    let count = 0;
    for (const { publicKey, tests } of wycheproof.sha256) {
      for (const { tcId, msg, sig, valid } of tests) {
        const digest = digestOf(sha256, Buffer.from(msg, "hex"));
        if (sig.length === 128) {
          expect(verify(sig, { digest, publicKey }), `tcId ${tcId}`).toBe(valid);
        } else {
          expect(valid, `tcId ${tcId}`).toBe(false);
          expect(() => verify(sig, { digest, publicKey }), `tcId ${tcId}`).toThrow(RangeError);
        }
        count++;
      }
    }
    expect(count).toBe(262);
  });

  it("verifies RFC 6979's signatures, over SHA-512 through the leftmost 256 bits too", () => {
    const { publicKey, signatures } = p256Rfc6979;
    for (const { hash, message, signature } of signatures) {
      const digest = digestOf(hash === "sha256" ? sha256 : sha512, Buffer.from(message));
      expect(verify(signature, { digest, publicKey }), `${hash} ${message}`).toBe(true);
      expect(verify(signature, { digest: digest.slice(0, 64), publicKey })).toBe(true);
      expect(verify(signature, { digest: `00${digest.slice(2)}`, publicKey })).toBe(false);
      expect(verify(signature, { digest, publicKey: twoG })).toBe(false);
    }
  });

  it("takes a high s unless lowS asks for a low one, and calls r or s out of range invalid", () => {
    const { publicKey, signatures } = p256Rfc6979;
    const [{ message, signature }] = signatures;
    const digest = digestOf(sha256, Buffer.from(message));
    const [r, s] = [signature.slice(0, 64), BigInt(`0x${signature.slice(64)}`)];
    const flipped = `${r}${(order - s).toString(16).padStart(64, "0")}`;
    expect(s > order >> 1n).toBe(true);
    expect(verify(signature, { digest, publicKey, lowS: true })).toBe(false);
    expect(verify(flipped, { digest, publicKey })).toBe(true);
    expect(verify(flipped, { digest, publicKey, lowS: true })).toBe(true);
    const [zero, n] = ["0".repeat(64), order.toString(16)];
    for (const outside of [zero + signature.slice(64), r + zero, n + signature.slice(64), r + n]) {
      expect(verify(outside, { digest, publicKey })).toBe(false);
    }
  });

  it("refuses arguments in another shape, in the caller's words", () => {
    const { publicKey, signatures } = p256Rfc6979;
    const [{ signature }] = signatures;
    const digest = "00".repeat(32);
    expect(() => verify(signature.slice(2), { digest, publicKey })).toThrow(
      "Signature must be 128 hex digits without 0x, r then s",
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
