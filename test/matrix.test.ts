import { describe, expect, it } from "vite-plus/test";
import { determinant, matrixRank, mod, nullspace, solveLinearSystem } from "../src/index.ts";
import type { Matrix } from "../src/index.ts";
import { determinantVectors, systemVectors } from "./fixtures/matrix.ts";

/* A times x mod p, one entry per row. */
function times(matrix: Matrix, x: readonly bigint[], p: bigint): bigint[] {
  return matrix.map((row) =>
    mod(
      row.reduce((sum, value, column) => sum + value * (x[column] ?? 0n), 0n),
      p,
    ),
  );
}

/* y times A mod p, one entry per column: the left side of a certificate. */
function leftTimes(y: readonly bigint[], matrix: Matrix, p: bigint): bigint[] {
  const width = matrix[0]?.length ?? 0;
  return Array.from({ length: width }, (_, column) =>
    mod(
      matrix.reduce((sum, row, index) => sum + (y[index] ?? 0n) * (row[column] ?? 0n), 0n),
      p,
    ),
  );
}

/* Every vector of F_p^length, counted up like an odometer. The oracle tries them all. */
function everyVector(p: bigint, length: number): bigint[][] {
  let vectors: bigint[][] = [[]];
  for (let at = 0; at < length; at += 1) {
    vectors = vectors.flatMap((vector) =>
      Array.from({ length: Number(p) }, (_, digit) => [...vector, BigInt(digit)]),
    );
  }
  return vectors;
}

/* Every matrix of one shape over F_p. */
function everyMatrix(p: bigint, height: number, width: number): bigint[][][] {
  return everyVector(p, height * width).map((cells) =>
    Array.from({ length: height }, (_, row) => cells.slice(row * width, (row + 1) * width)),
  );
}

/* solution plus every combination of the kernel, as sorted text. */
function family(solution: readonly bigint[], kernel: Matrix, p: bigint): string[] {
  return everyVector(p, kernel.length)
    .map((weights) =>
      solution
        .map((value, column) =>
          mod(
            kernel.reduce(
              (sum, vector, index) => sum + (weights[index] ?? 0n) * (vector[column] ?? 0n),
              value,
            ),
            p,
          ),
        )
        .join(","),
    )
    .toSorted();
}

/* What one system gets wrong against trying every x, as text. Empty when it's right. */
function disagreement(matrix: Matrix, values: readonly bigint[], p: bigint): string[] {
  const width = matrix[0]?.length ?? 0;
  const target = values.join(",");
  const expected = everyVector(p, width)
    .filter((x) => times(matrix, x, p).join(",") === target)
    .map((x) => x.join(","))
    .toSorted();
  const result = solveLinearSystem(matrix, values, { modulus: p });
  if (!result.consistent) {
    const refutes =
      leftTimes(result.certificate, matrix, p).every((value) => value === 0n) &&
      leftTimes(
        result.certificate,
        values.map((b) => [b]),
        p,
      ).some((value) => value !== 0n);
    return expected.length === 0 && refutes ? [] : [`certificate for ${matrix.join("|")}`];
  }
  const found = family(result.solution, result.kernel, p);
  const sized = BigInt(found.length) === p ** BigInt(width - result.rank);
  return sized && found.join(";") === expected.join(";") ? [] : [`family of ${matrix.join("|")}`];
}

describe("solveLinearSystem", () => {
  it("solves a system and hands back the kernel next to one solution", () => {
    const result = solveLinearSystem(
      [
        [1n, 2n, 3n],
        [2n, 4n, 6n],
      ],
      [1n, 2n],
      { modulus: 7n },
    );
    expect(result).toEqual({
      consistent: true,
      rank: 1,
      solution: [1n, 0n, 0n],
      kernel: [
        [5n, 1n, 0n],
        [4n, 0n, 1n],
      ],
    });
  });

  it("proves x + y can't be 0 and 1 at once over F_2, with the rows it added", () => {
    const stuck = [
      [1n, 1n],
      [1n, 1n],
    ];
    expect(solveLinearSystem(stuck, [0n, 1n], { modulus: 2n })).toEqual({
      consistent: false,
      rank: 1,
      certificate: [1n, 1n],
    });
  });

  it(
    "agrees with trying every x, on every small matrix over F_2 and F_3",
    { timeout: 120_000 },
    () => {
      const shapes: readonly (readonly [bigint, number, number])[] = [
        [2n, 1, 1],
        [2n, 2, 2],
        [2n, 2, 3],
        [2n, 3, 2],
        [2n, 3, 3],
        [3n, 2, 2],
        [3n, 2, 3],
        [3n, 3, 2],
      ];
      for (const [p, height, width] of shapes) {
        const wrong = everyMatrix(p, height, width).flatMap((matrix) =>
          everyVector(p, height).flatMap((values) => disagreement(matrix, values, p)),
        );
        expect(wrong).toEqual([]);
      }
    },
  );

  it("matches PARI/GP on rank and on whether a solution exists, up to the secp256k1 prime", () => {
    for (const { modulus, matrix, values, rank, consistent } of systemVectors) {
      const result = solveLinearSystem(matrix, values, { modulus });
      const width = matrix[0]?.length ?? 0;
      expect(result.rank).toBe(rank);
      expect(result.consistent).toBe(consistent);
      if (!result.consistent) {
        expect(leftTimes(result.certificate, matrix, modulus)).toEqual(
          Array.from({ length: width }, () => 0n),
        );
        expect(
          leftTimes(
            result.certificate,
            values.map((b) => [b]),
            modulus,
          ),
        ).not.toEqual([0n]);
        continue;
      }
      expect(times(matrix, result.solution, modulus)).toEqual(values.map((b) => mod(b, modulus)));
      expect(result.kernel).toHaveLength(width - rank);
      expect(matrixRank(result.kernel, { modulus })).toBe(width - rank);
      for (const vector of result.kernel) {
        expect(times(matrix, vector, modulus)).toEqual(matrix.map(() => 0n));
      }
    }
  });

  it("keeps every answer in 0 to p minus 1 and leaves the input alone", () => {
    const matrix = Object.freeze([Object.freeze([-1n, 9n]), Object.freeze([8n, -2n])]);
    const values = Object.freeze([-3n, 10n]);
    expect(solveLinearSystem(matrix, values, { modulus: 7n })).toEqual({
      consistent: true,
      rank: 1,
      solution: [3n, 0n],
      kernel: [[2n, 1n]],
    });
    expect(matrix).toEqual([
      [-1n, 9n],
      [8n, -2n],
    ]);
  });

  it("treats no rows as no columns, and rows without columns as 0 = b", () => {
    expect(solveLinearSystem([], [], { modulus: 7n })).toEqual({
      consistent: true,
      rank: 0,
      solution: [],
      kernel: [],
    });
    expect(solveLinearSystem([[], []], [0n, 7n], { modulus: 7n })).toEqual({
      consistent: true,
      rank: 0,
      solution: [],
      kernel: [],
    });
    expect(solveLinearSystem([[], []], [0n, 1n], { modulus: 7n })).toEqual({
      consistent: false,
      rank: 0,
      certificate: [0n, 1n],
    });
  });

  it("refuses values that don't line up with the rows", () => {
    expect(() => solveLinearSystem([[1n], [2n]], [1n], { modulus: 7n })).toThrow(
      new RangeError("2 rows need 2 values, not 1"),
    );
    expect(() => {
      Reflect.apply(solveLinearSystem, undefined, [[[1n]], "1", { modulus: 7n }]);
    }).toThrow(new TypeError("The values are an array of bigints"));
    expect(() => {
      Reflect.apply(solveLinearSystem, undefined, [[[1n]], [1], { modulus: 7n }]);
    }).toThrow(new TypeError("Every value must be a bigint"));
  });
});

describe("matrixRank and nullspace", () => {
  it("count what's independent and span what's left", () => {
    const matrix = [
      [1n, 2n, 3n],
      [4n, 5n, 6n],
      [7n, 8n, 9n],
    ];
    expect(matrixRank(matrix, { modulus: 11n })).toBe(2);
    expect(nullspace(matrix, { modulus: 11n })).toEqual([[1n, 9n, 1n]]);
    expect(matrixRank(matrix, { modulus: 3n })).toBe(1);
    expect(nullspace(matrix, { modulus: 3n })).toEqual([
      [1n, 1n, 0n],
      [0n, 0n, 1n],
    ]);
  });

  it("give the kernel solveLinearSystem gives, on every PARI/GP matrix", () => {
    for (const { modulus, matrix, rank } of systemVectors) {
      const zeros = matrix.map(() => 0n);
      const solved = solveLinearSystem(matrix, zeros, { modulus });
      expect(matrixRank(matrix, { modulus })).toBe(rank);
      expect(solved.consistent && solved.kernel).toEqual(nullspace(matrix, { modulus }));
    }
  });

  it("find nothing in an empty matrix", () => {
    expect(matrixRank([], { modulus: 2n })).toBe(0);
    expect(nullspace([], { modulus: 2n })).toEqual([]);
    expect(matrixRank([[], []], { modulus: 2n })).toBe(0);
    expect(nullspace([[0n, 0n]], { modulus: 2n })).toEqual([
      [1n, 0n],
      [0n, 1n],
    ]);
  });

  it("refuse a composite modulus, even when every pivot would invert", () => {
    expect(() => matrixRank([[1n]], { modulus: 15n })).toThrow(
      new RangeError("The modulus must be a prime"),
    );
    expect(() => nullspace([[1n]], { modulus: 1n })).toThrow(RangeError);
    expect(() => solveLinearSystem([[1n]], [1n], { modulus: 15n })).toThrow(RangeError);
    expect(() => nullspace([], { modulus: 15n })).toThrow(RangeError);
    expect(() => solveLinearSystem([], [], { modulus: 15n })).toThrow(RangeError);
    expect(() => matrixRank([[1n]], { modulus: -7n })).toThrow(
      new RangeError("The modulus must be 1 or more"),
    );
  });

  it("refuse a modulus passed bare and a matrix that isn't one", () => {
    expect(() => {
      Reflect.apply(matrixRank, undefined, [[[1n]], 7n]);
    }).toThrow(new TypeError("matrixRank takes the modulus as { modulus }"));
    expect(() => {
      Reflect.apply(nullspace, undefined, [[[1n]]]);
    }).toThrow(new TypeError("nullspace takes the modulus as { modulus }"));
    for (const matrix of ["12", null, [new BigInt64Array(2)], [[1n], "2"]]) {
      expect(() => {
        Reflect.apply(matrixRank, undefined, [matrix, { modulus: 7n }]);
      }).toThrow(new TypeError("A matrix is an array of rows of bigints"));
    }
    for (const matrix of [[[1, 2]], [[Number.NaN]], [Object.assign([], { length: 1 })]]) {
      expect(() => {
        Reflect.apply(matrixRank, undefined, [matrix, { modulus: 7n }]);
      }).toThrow(new TypeError("Every matrix entry must be a bigint"));
    }
  });

  it("refuse rows of different lengths, and say which one", () => {
    expect(() => matrixRank([[1n, 2n], [3n]], { modulus: 7n })).toThrow(
      new RangeError("Row 1 has length 1, row 0 has length 2"),
    );
    expect(() => nullspace([[], [3n]], { modulus: 7n })).toThrow(RangeError);
  });
});

describe("determinant", () => {
  it("gets 1 for a 3 by 3 without leaving the integers", () => {
    expect(
      determinant([
        [2n, 0n, 1n],
        [0n, 1n, 1n],
        [1n, 1n, 2n],
      ]),
    ).toBe(1n);
  });

  it("matches PARI/GP, zero corners and dependent rows included", () => {
    for (const { matrix, determinant: expected } of determinantVectors) {
      expect(determinant(matrix)).toBe(expected);
    }
  });

  it("flips its sign for a row swap and stays exact past 2^53", () => {
    expect(
      determinant([
        [0n, 1n],
        [1n, 0n],
      ]),
    ).toBe(-1n);
    expect(
      determinant([
        [2n ** 70n, 1n],
        [1n, 2n ** 70n],
      ]),
    ).toBe(2n ** 140n - 1n);
    expect(determinant([[-5n]])).toBe(-5n);
  });

  it("calls the empty product 1 and wants a square for anything else", () => {
    expect(determinant([])).toBe(1n);
    expect(() => determinant([[]])).toThrow(
      new RangeError("A determinant needs a square matrix, not 1 by 0"),
    );
    expect(() => determinant([[1n, 2n]])).toThrow(RangeError);
    expect(() => {
      Reflect.apply(determinant, undefined, [[[1.5]]]);
    }).toThrow(new TypeError("Every matrix entry must be a bigint"));
  });
});
