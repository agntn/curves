import { sha256, sha512 } from "@agntn/hashes/sha2";
import { createHash } from "node:crypto";
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
  p521,
  subtractPoints,
  verify,
} from "../src/p521.ts";
import { combine, minusThreeAFormulas, sec1Curve } from "../src/core/sec1.ts";
import {
  p521GeneratorMultiples,
  p521PointMultiples,
  p521Rfc6979,
  p521Vectors,
} from "./fixtures/p521.ts";
import wycheproof from "./fixtures/wycheproof-p521.json" with { type: "json" };
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
} = p521Vectors;
const infinity = "The result is the point at infinity";
const invalidPoint = "Invalid SEC1 P-521 public key";
const uncompressed = { compressed: false };
const order = BigInt(`0x${orderMinusOne}`) + 1n;
const curve = defineCurve(p521);
const POINT_TWEAK = 0x1234567890abcdefn;

/* A number as the 132 hex digits of a P-521 coordinate. */
function wide(value: bigint): string {
  return value.toString(16).padStart(132, "0");
}

/* A point as uncompressed SEC1, or "infinity", so results from every path compare as text. */
function sec1(point: Readonly<{ x: bigint; y: bigint }> | null | undefined): string {
  if (point === null || point === undefined) return "infinity";
  return `04${wide(point.x)}${wide(point.y)}`;
}

/* x and y of uncompressed SEC1 hex. */
function coordinates(point: string): { x: bigint; y: bigint } {
  return { x: BigInt(`0x${point.slice(2, 134)}`), y: BigInt(`0x${point.slice(134)}`) };
}

/* Hex of the digest a hash gives for the bytes of a message. */
function digestOf(hash: (bytes: Uint8Array) => Uint8Array, message: Uint8Array): string {
  return Buffer.from(hash(message)).toString("hex");
}

/* SHA-384 hex. @agntn/hashes 0.6.7 stops at SHA-256 and SHA-512, so node:crypto stands in. */
function sha384(message: Uint8Array): string {
  return createHash("sha384").update(message).digest("hex");
}

/* The RFC 6979 hashes by name, each turning a message into its digest as hex. */
const DIGESTS = {
  sha256: (message: Uint8Array) => digestOf(sha256, message),
  sha384,
  sha512: (message: Uint8Array) => digestOf(sha512, message),
} as const;

/* 1 + 16 + ... + 16^131: a multiply recodes a scalar minus this, so its neighbours are edges. */
const ones = ((1n << 528n) - 1n) / 15n;
const hashed = Array.from(
  { length: 8 },
  (_, index) => BigInt(`0x${digestOf(sha512, new Uint8Array([index]))}`) % order,
);
const edges = [
  1n,
  2n,
  15n,
  16n,
  17n,
  255n,
  256n,
  ones % order,
  (ones - 1n) % order,
  (ones + 1n) % order,
  1n << 516n,
  1n << 519n,
  1n << 520n,
  order >> 1n,
  (order >> 1n) + 1n,
  order - 17n,
  order - 2n,
  order - 1n,
  ...hashed,
];
const other = multiplyPoint(g, 0x5eedn, uncompressed);

describe("P-521 domain parameters", () => {
  it("match SEC 2, with a prime n, G on the curve and n times G at infinity", () => {
    expect(p521.p).toBe((1n << 521n) - 1n);
    expect(p521.a).toBe(p521.p - 3n);
    expect(convertPoint(g, uncompressed)).toBe(gUncompressed);
    expect(sec1(p521.g)).toBe(gUncompressed);
    expect(isPrime(p521.n)).toBe(true);
    expect(multiplyOnCurve(curve, p521.g, order)).toBeNull();
  });

  it("take 132 digits and 521 bits of a digest, and a curve whose n is shorter than p is refused", () => {
    const options = { name: "P-521", formulas: minusThreeAFormulas };
    const refusal = "needs n as long as p in bits";
    const taken = sec1Curve(p521, options);
    expect(taken.digits).toBe(132);
    expect(taken.bits).toBe(521n);
    expect(() => sec1Curve({ ...p521, n: p521.n >> 1n }, options)).toThrow(refusal);
    expect(() => sec1Curve({ ...p521, h: 2n }, options)).toThrow(refusal);
    const sevenBytes = { ...p521, p: (1n << 55n) - 1n, n: (1n << 55n) - 3n };
    expect(() => sec1Curve(sevenBytes, options)).toThrow(refusal);
  });
});

describe("P-521 point math", () => {
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
    for (const [scalar, point] of p521GeneratorMultiples) {
      expect(multiplyGenerator(scalar, uncompressed)).toBe(point);
      expect(multiplyPoint(g, BigInt(`0x${scalar}`), uncompressed)).toBe(point);
    }
    for (const [point, product] of p521PointMultiples) {
      expect(multiplyPoint(point, POINT_TWEAK)).toBe(product);
    }
    expect(multiplyGenerator(p521Rfc6979.secret, uncompressed)).toBe(p521Rfc6979.publicKey);
  });

  /* One case per edge: all of them in one test took 3.4 s of the 5 s limit on four cores. */
  it.each(edges)(
    "multiplies G and another point like the affine code, at digit edge %#",
    (scalar) => {
      const product = sec1(multiplyOnCurve(curve, p521.g, scalar));
      expect(multiplyGenerator(scalar, uncompressed)).toBe(product);
      expect(multiplyPoint(g, scalar, uncompressed)).toBe(product);
      expect(multiplyPoint(other, scalar, uncompressed)).toBe(
        sec1(multiplyOnCurve(curve, coordinates(other), scalar)),
      );
    },
  );

  /* Each entry below n, 130 rows of 15 and then 16^130 alone: several seconds, hence the limit. */
  it(
    "reads every entry of the comb and of the verification table right",
    { timeout: 60_000 },
    () => {
      const tables = sec1Curve(p521, { name: "P-521", formulas: minusThreeAFormulas });
      for (let row = 0n; row < 131n; row++) {
        const base = multiplyPoint(g, 16n ** row, uncompressed);
        let multiple = base;
        for (let digit = 1n; digit < 16n && digit * 16n ** row < order; digit++) {
          expect(multiplyGenerator(digit * 16n ** row, uncompressed)).toBe(multiple);
          expect(sec1(combine(tables, { a: digit * 16n ** row, b: 0n, point: p521.g }))).toBe(
            multiple,
          );
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
    for (const scalar of ["0", 0n, "0x03", "", "f".repeat(133), "f".repeat(132), order, -1n]) {
      expect(() => multiplyPoint(g, scalar)).toThrow("from 1 to the curve order minus 1");
    }
    for (const point of [`06${threeGUncompressed.slice(2)}`, g.slice(2), `0x${g}`, `${g}00`]) {
      expect(() => negatePoint(point)).toThrow(invalidPoint);
    }
  });
});

describe("P-521 x coordinates and SEC1 encodings", () => {
  it("lifts x to both points and refuses an x no point has", () => {
    expect(liftX(g.slice(2))).toEqual({ even: g, odd: minusG });
    expect(liftX(threeG.slice(2), uncompressed).odd).toBe(threeGUncompressed);
    expect(() => liftX(xWithoutPoint)).toThrow("No point of P-521 has this x");
    expect(() => liftX(wide(p521.p))).toThrow("No point of P-521 has this x");
    expect(() => liftX("f".repeat(132))).toThrow("No point of P-521 has this x");
    expect(() => liftX(g)).toThrow("x must be 132 hex digits");
  });

  it("checks points against the curve, x at or above p included", () => {
    expect(isOnCurve(g)).toBe(true);
    expect(isOnCurve(xZero)).toBe(true);
    expect(isOnCurve(`04${wide(p521.p)}${xZero.slice(134)}`)).toBe(false);
    expect(isOnCurve(`02${wide(p521.p)}`)).toBe(false);
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

describe("P-521 ECDSA", () => {
  it("answers every Wycheproof P1363 vector over SHA-512", () => {
    let count = 0;
    for (const { publicKey, tests } of wycheproof.sha512) {
      for (const { tcId, msg, sig, valid } of tests) {
        const digest = digestOf(sha512, Buffer.from(msg, "hex"));
        if (sig.length === 264) {
          expect(verify(sig, { digest, publicKey }), `tcId ${tcId}`).toBe(valid);
        } else {
          expect(valid, `tcId ${tcId}`).toBe(false);
          expect(() => verify(sig, { digest, publicKey }), `tcId ${tcId}`).toThrow(RangeError);
        }
        count++;
      }
    }
    expect(count).toBe(318);
  });

  it("verifies RFC 6979's signatures and reads every digest whole, SHA-512 included", () => {
    const { publicKey, signatures } = p521Rfc6979;
    for (const { hash, message, signature } of signatures) {
      const digest = DIGESTS[hash](Buffer.from(message));
      expect(verify(signature, { digest, publicKey }), `${hash} ${message}`).toBe(true);
      expect(verify(signature, { digest: digest.slice(0, -2), publicKey })).toBe(false);
      expect(verify(signature, { digest: `00${digest.slice(2)}`, publicKey })).toBe(false);
      expect(verify(signature, { digest, publicKey: twoG })).toBe(false);
      if (hash !== "sha512")
        expect(verify(signature, { digest: `00${digest}`, publicKey })).toBe(true);
    }
  });

  it("takes a high s unless lowS asks for a low one, and calls r or s out of range invalid", () => {
    const { publicKey, signatures } = p521Rfc6979;
    const [{ message, signature }] = signatures;
    const digest = digestOf(sha256, Buffer.from(message));
    const [r, s] = [signature.slice(0, 132), BigInt(`0x${signature.slice(132)}`)];
    const low = s <= order >> 1n;
    const flipped = `${r}${wide(order - s)}`;
    const [high, lowS] = low ? [flipped, signature] : [signature, flipped];
    expect(verify(high, { digest, publicKey })).toBe(true);
    expect(verify(high, { digest, publicKey, lowS: true })).toBe(false);
    expect(verify(lowS, { digest, publicKey })).toBe(true);
    expect(verify(lowS, { digest, publicKey, lowS: true })).toBe(true);
    const [zero, n] = ["0".repeat(132), wide(order)];
    for (const outside of [
      zero + signature.slice(132),
      r + zero,
      n + signature.slice(132),
      r + n,
    ]) {
      expect(verify(outside, { digest, publicKey })).toBe(false);
    }
  });

  it("refuses arguments in another shape, in the caller's words", () => {
    const { publicKey, signatures } = p521Rfc6979;
    const [{ signature }] = signatures;
    const digest = "00".repeat(64);
    expect(() => verify(signature.slice(2), { digest, publicKey })).toThrow(
      "Signature must be 264 hex digits without 0x, r then s",
    );
    expect(() => verify(signature, { digest: "00".repeat(65), publicKey })).toThrow(
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
