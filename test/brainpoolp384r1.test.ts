import { createHash } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { defineCurve, isPrime, multiplyPoint as multiplyOnCurve } from "../src/index.ts";
import {
  addPoints,
  brainpoolP384r1,
  convertPoint,
  isOnCurve,
  liftX,
  multiplyGenerator,
  multiplyPoint,
  negatePoint,
  subtractPoints,
  verify,
} from "../src/brainpoolp384r1.ts";
import {
  anyAFormulas,
  combine,
  minusThreeAFormulas,
  sec1Curve,
  zeroAFormulas,
} from "../src/core/sec1.ts";
import {
  brainpoolP384r1GeneratorMultiples,
  brainpoolP384r1PointMultiples,
  brainpoolP384r1Rfc7027,
  brainpoolP384r1Signature,
  brainpoolP384r1Vectors,
} from "./fixtures/brainpoolp384r1.ts";
import wycheproof from "./fixtures/wycheproof-brainpoolp384r1.json" with { type: "json" };
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
  xOne,
} = brainpoolP384r1Vectors;
const infinity = "The result is the point at infinity";
const invalidPoint = "Invalid SEC1 brainpoolP384r1 public key";
const uncompressed = { compressed: false };
const order = BigInt(`0x${orderMinusOne}`) + 1n;
const curve = defineCurve(brainpoolP384r1);
const POINT_TWEAK = 0x1234567890abcdefn;

/* A number as the 96 hex digits of a coordinate. */
function wide(value: bigint): string {
  return value.toString(16).padStart(96, "0");
}

/* A point as uncompressed SEC1, or "infinity", so results from every path compare as text. */
function sec1Hex(point: Readonly<{ x: bigint; y: bigint }> | null | undefined): string {
  if (point === null || point === undefined) return "infinity";
  return `04${wide(point.x)}${wide(point.y)}`;
}

/* x and y of uncompressed SEC1 hex. */
function coordinates(point: string): { x: bigint; y: bigint } {
  return { x: BigInt(`0x${point.slice(2, 98)}`), y: BigInt(`0x${point.slice(98)}`) };
}

/* SHA-384 hex. @agntn/hashes 0.6.7 stops at SHA-256 and SHA-512, so node:crypto stands in. */
function digestOf(message: Uint8Array): string {
  return createHash("sha384").update(message).digest("hex");
}

/* 1 + 16 + ... + 16^95: a multiply recodes a scalar minus this, so its neighbours are edges. */
const ones = ((1n << 384n) - 1n) / 15n;
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
  1n << 380n,
  1n << 383n,
  order >> 1n,
  (order >> 1n) + 1n,
  order - 17n,
  order - 2n,
  order - 1n,
  ...hashed,
];
const other = multiplyPoint(g, 0x5eedn, uncompressed);

describe("brainpoolP384r1 domain parameters", () => {
  it("match RFC 5639, with a prime n, G on the curve and n times G at infinity", () => {
    expect(convertPoint(g, uncompressed)).toBe(gUncompressed);
    expect(sec1Hex(brainpoolP384r1.g)).toBe(gUncompressed);
    expect(isPrime(brainpoolP384r1.p)).toBe(true);
    expect(isPrime(brainpoolP384r1.n)).toBe(true);
    expect(multiplyOnCurve(curve, brainpoolP384r1.g, order)).toBeNull();
  });

  it("need the formulas for any a, since a is neither 0 nor -3, and take 96 digits", () => {
    const { a, p } = brainpoolP384r1;
    expect([0n, p - 3n]).not.toContain(a);
    expect(
      sec1Curve(brainpoolP384r1, { name: "brainpoolP384r1", formulas: anyAFormulas }).digits,
    ).toBe(96);
    for (const formulas of [zeroAFormulas, minusThreeAFormulas]) {
      expect(() => sec1Curve(brainpoolP384r1, { name: "brainpoolP384r1", formulas })).toThrow(
        "These formulas are for another a",
      );
    }
  });
});

describe("brainpoolP384r1 point math", () => {
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
    for (const [scalar, point] of brainpoolP384r1GeneratorMultiples) {
      expect(multiplyGenerator(scalar, uncompressed)).toBe(point);
      expect(multiplyPoint(g, BigInt(`0x${scalar}`), uncompressed)).toBe(point);
    }
    for (const [point, product] of brainpoolP384r1PointMultiples) {
      expect(multiplyPoint(point, POINT_TWEAK)).toBe(product);
    }
    const { secretA, publicKeyA, secretB, publicKeyB, shared } = brainpoolP384r1Rfc7027;
    expect(multiplyGenerator(secretA, uncompressed)).toBe(publicKeyA);
    expect(multiplyGenerator(secretB, uncompressed)).toBe(publicKeyB);
    expect(multiplyPoint(publicKeyB, secretA, uncompressed)).toBe(shared);
    expect(multiplyPoint(publicKeyA, secretB, uncompressed)).toBe(shared);
  });

  it("multiplies G and another point like the affine code, at the digit edges too", () => {
    for (const scalar of edges) {
      const product = sec1Hex(multiplyOnCurve(curve, brainpoolP384r1.g, scalar));
      expect(multiplyGenerator(scalar, uncompressed)).toBe(product);
      expect(multiplyPoint(g, scalar, uncompressed)).toBe(product);
      expect(multiplyPoint(other, scalar, uncompressed)).toBe(
        sec1Hex(multiplyOnCurve(curve, coordinates(other), scalar)),
      );
    }
  });

  it(
    "reads every entry of the comb and of the verification table right",
    { timeout: 30_000 },
    () => {
      const tables = sec1Curve(brainpoolP384r1, {
        name: "brainpoolP384r1",
        formulas: anyAFormulas,
      });
      for (let row = 0n; row < 96n; row++) {
        const base = multiplyPoint(g, 16n ** row, uncompressed);
        let multiple = base;
        for (let digit = 1n; digit < 16n && digit * 16n ** row < order; digit++) {
          expect(multiplyGenerator(digit * 16n ** row, uncompressed)).toBe(multiple);
          expect(
            sec1Hex(combine(tables, { a: digit * 16n ** row, b: 0n, point: brainpoolP384r1.g })),
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
    for (const scalar of ["0", 0n, "0x03", "", "f".repeat(97), "f".repeat(96), order, -1n]) {
      expect(() => multiplyPoint(g, scalar)).toThrow("from 1 to the curve order minus 1");
    }
    for (const point of [`06${threeGUncompressed.slice(2)}`, g.slice(2), `0x${g}`, `${g}00`]) {
      expect(() => negatePoint(point)).toThrow(invalidPoint);
    }
  });
});

describe("brainpoolP384r1 x coordinates and SEC1 encodings", () => {
  it("lifts x to both points and refuses an x no point has", () => {
    expect(liftX(g.slice(2))).toEqual({ even: minusG, odd: g });
    expect(liftX(threeG.slice(2), uncompressed).odd).toBe(threeGUncompressed);
    expect(() => liftX(xWithoutPoint)).toThrow("No point of brainpoolP384r1 has this x");
    expect(() => liftX(wide(brainpoolP384r1.p))).toThrow("No point of brainpoolP384r1 has this x");
    expect(() => liftX("f".repeat(96))).toThrow("No point of brainpoolP384r1 has this x");
    expect(() => liftX(g)).toThrow("x must be 96 hex digits");
  });

  it("checks points against the curve, x at or above p included", () => {
    expect(isOnCurve(g)).toBe(true);
    expect(isOnCurve(xOne)).toBe(true);
    const xP = wide(brainpoolP384r1.p + 1n);
    expect(isOnCurve(`04${xP}${xOne.slice(98)}`)).toBe(false);
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

describe("brainpoolP384r1 ECDSA", () => {
  it("answers every Wycheproof P1363 vector over SHA-384", () => {
    let count = 0;
    for (const { publicKey, tests } of wycheproof.sha384) {
      for (const { tcId, msg, sig, valid } of tests) {
        const digest = digestOf(Buffer.from(msg, "hex"));
        if (sig.length === 192) {
          expect(verify(sig, { digest, publicKey }), `tcId ${tcId}`).toBe(valid);
        } else {
          expect(valid, `tcId ${tcId}`).toBe(false);
          expect(() => verify(sig, { digest, publicKey }), `tcId ${tcId}`).toThrow(RangeError);
        }
        count++;
      }
    }
    expect(count).toBe(292);
  });

  it("takes a high s unless lowS asks, reads 384 bits of a digest and calls r or s out of range invalid", () => {
    const { publicKey, digest, signature } = brainpoolP384r1Signature;
    const [r, s] = [signature.slice(0, 96), BigInt(`0x${signature.slice(96)}`)];
    const flipped = `${r}${wide(order - s)}`;
    const [high, low] = s > order >> 1n ? [signature, flipped] : [flipped, signature];
    expect(verify(signature, { digest, publicKey })).toBe(true);
    expect(verify(high, { digest, publicKey })).toBe(true);
    expect(verify(high, { digest, publicKey, lowS: true })).toBe(false);
    expect(verify(low, { digest, publicKey, lowS: true })).toBe(true);
    expect(verify(signature, { digest: `${digest}${"ff".repeat(16)}`, publicKey })).toBe(true);
    expect(verify(signature, { digest: `00${digest.slice(2)}`, publicKey })).toBe(false);
    expect(verify(signature, { digest, publicKey: twoG })).toBe(false);
    const [zero, n] = ["0".repeat(96), wide(order)];
    for (const outside of [zero + signature.slice(96), r + zero, n + signature.slice(96), r + n]) {
      expect(verify(outside, { digest, publicKey })).toBe(false);
    }
  });

  it("refuses arguments in another shape, in the caller's words", () => {
    const { publicKey, signature } = brainpoolP384r1Signature;
    const digest = "00".repeat(48);
    expect(() => verify(signature.slice(2), { digest, publicKey })).toThrow(
      "Signature must be 192 hex digits without 0x, r then s",
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
