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
  secp256k1,
  subtractPoints,
  subtractScalars,
} from "../src/secp256k1.ts";
import {
  curveVectors,
  generatorMultiples,
  POINT_TWEAK,
  pointMultiples,
  secp256k1Vectors,
} from "./fixtures/vectors.ts";

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
} = secp256k1Vectors;
const infinity = "The result is the point at infinity";
const invalidPoint = "Invalid SEC1 secp256k1 public key";
const pHex = secp256k1.p.toString(16);

describe("secp256k1 domain parameters", () => {
  it("match the generic curve code: G lies on it and n times G is infinity", () => {
    const curve = defineCurve(secp256k1);
    expect(curve).toEqual({ a: 0n, b: 7n, p: secp256k1.p });
    expect(multiplyOnCurve(curve, secp256k1.g, secp256k1.n)).toBeNull();
    expect(multiplyOnCurve(curve, secp256k1.g, 3n)).toEqual(curveVectors.secp256k1.threeG);
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

  it("refuses the point at infinity instead of encoding it", () => {
    expect(() => addPoints(g, minusG)).toThrow(infinity);
    expect(() => subtractPoints(g, g)).toThrow(infinity);
  });

  it("refuses scalars outside 1 to n minus 1 and encodings that are not SEC1", () => {
    for (const scalar of ["0", 0n, "0x03", "", "f".repeat(65)]) {
      expect(() => multiplyPoint(g, scalar)).toThrow(RangeError);
    }
    const order = (BigInt(`0x${orderMinusOne}`) + 1n).toString(16);
    expect(() => multiplyGenerator(order)).toThrow("from 1 to the curve order minus 1");
    expect(() => multiplyGenerator(-1n)).toThrow(RangeError);
    for (const point of [`06${threeGUncompressed.slice(2)}`, g.slice(2), `0x${g}`]) {
      expect(() => negatePoint(point)).toThrow(invalidPoint);
    }
  });

  it("refuses coordinates at or above p, as SEC 1 section 2.3.4 asks", () => {
    const y = gUncompressed.slice(66);
    expect(() => negatePoint(`02${pHex}`)).toThrow(invalidPoint);
    expect(() => negatePoint(`04${pHex}${y}`)).toThrow(invalidPoint);
    const x = gUncompressed.slice(2, 66);
    const yAboveP = (secp256k1.p + 1n).toString(16);
    expect(isOnCurve(`04${x}${yAboveP}`)).toBe(false);
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
    const order = (BigInt(`0x${orderMinusOne}`) + 1n).toString(16);
    expect(() => addScalars(order, "1")).toThrow("Scalar a must be hex");
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
