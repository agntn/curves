/** Exact linear algebra over a prime field, plus a determinant over the integers. */

import {
  determinant as determinantCore,
  kernel as kernelCore,
  rank as rankCore,
  solve as solveCore,
} from "./core/matrix.ts";
import type { Matrix, RefutedSystem, SolvedSystem } from "./core/matrix.ts";
import { checkBigint, isPrime, readModulus } from "./field.ts";

export type { Matrix, RefutedSystem, SolvedSystem } from "./core/matrix.ts";

/** The prime whose field the matrix lives in. Baillie-PSW vets it: no known liar, no proof. */
export interface MatrixOptions {
  readonly modulus: bigint;
}

/**
 * Check a list of bigints, holes included.
 * @param list - What the caller passed
 * @param name - What one item is called, for the message
 * @returns {bigint[]} A fresh copy, read once
 */
function readBigints(list: unknown, name: string): bigint[] {
  if (!Array.isArray(list)) throw new TypeError("A matrix is an array of rows of bigints");
  const items: readonly unknown[] = list;
  return Array.from(items, (item) => {
    checkBigint(item, name);
    return item;
  });
}

/**
 * Check a matrix: an array of rows, every row as long as the first.
 * @param matrix - What the caller passed
 * @returns {bigint[][]} A fresh copy, read once
 */
function readMatrix(matrix: unknown): bigint[][] {
  if (!Array.isArray(matrix)) throw new TypeError("A matrix is an array of rows of bigints");
  const list: readonly unknown[] = matrix;
  const rows = Array.from(list, (row) => readBigints(row, "Every matrix entry"));
  const width = widthOf(rows);
  const ragged = rows.findIndex((row) => row.length !== width);
  if (ragged !== -1) {
    throw new RangeError(
      `Row ${ragged} has length ${rows[ragged]?.length}, row 0 has length ${width}`,
    );
  }
  return rows;
}

/**
 * Count the columns. A matrix with no rows has none.
 * @param rows - A checked matrix
 * @returns {number} The length of the first row, or 0
 */
function widthOf(rows: Matrix): number {
  return rows[0]?.length ?? 0;
}

/**
 * Read `{ modulus }` and insist on a prime, since Z/mZ is no field and has no rank to report.
 * @param options - What the caller passed
 * @param name - The function, for the message
 * @returns {bigint} The checked prime
 */
function readPrime(options: MatrixOptions, name: string): bigint {
  const modulus = readModulus(options, name);
  if (!isPrime(modulus)) throw new RangeError("The modulus must be a prime");
  return modulus;
}

/**
 * The rank of a matrix over F_p.
 * @param matrix - Rows of bigints, all one length. No rows means no columns
 * @param options - The prime modulus
 * @returns {number} The number of independent rows
 * @throws {RangeError} When rows differ in length or the modulus is not a prime
 */
export function matrixRank(matrix: Matrix, options: MatrixOptions): number {
  const rows = readMatrix(matrix);
  return rankCore(rows, widthOf(rows), readPrime(options, "matrixRank"));
}

/**
 * A basis of the nullspace over F_p: every x with A x = 0 is one combination of these.
 * @param matrix - Rows of bigints, all one length. No rows means no columns
 * @param options - The prime modulus
 * @returns {bigint[][]} Columns minus rank vectors, none when only 0 solves it
 * @throws {RangeError} When rows differ in length or the modulus is not a prime
 */
export function nullspace(matrix: Matrix, options: MatrixOptions): bigint[][] {
  const rows = readMatrix(matrix);
  return kernelCore(rows, widthOf(rows), readPrime(options, "nullspace"));
}

/**
 * Solve A x = b over F_p. With rank r and n unknowns, the answers are `solution` plus any
 * combination of `kernel`, p^(n - r) of them. With none, `certificate` is a y with y A = 0 and
 * y b != 0, one weight per row you passed.
 * @param matrix - Rows of bigints, all one length. No rows means no columns
 * @param values - One b per row
 * @param options - The prime modulus
 * @returns {SolvedSystem | RefutedSystem} The family of solutions, or the proof there is none
 * @throws {RangeError} When the shapes don't match or the modulus is not a prime
 */
export function solveLinearSystem(
  matrix: Matrix,
  values: readonly bigint[],
  options: MatrixOptions,
): SolvedSystem | RefutedSystem {
  const rows = readMatrix(matrix);
  if (!Array.isArray(values)) throw new TypeError("The values are an array of bigints");
  const right = readBigints(values, "Every value");
  if (right.length !== rows.length) {
    throw new RangeError(`${rows.length} rows need ${rows.length} values, not ${right.length}`);
  }
  return solveCore(rows, right, readPrime(options, "solveLinearSystem"));
}

/**
 * The exact determinant of a square integer matrix, by Bareiss elimination. No floats, no mod.
 * @param matrix - Rows of bigints, as many entries in each as there are rows
 * @returns {bigint} The determinant, 1 for the empty matrix
 * @throws {RangeError} When the matrix is not square
 */
export function determinant(matrix: Matrix): bigint {
  const rows = readMatrix(matrix);
  if (widthOf(rows) !== rows.length) {
    throw new RangeError(
      `A determinant needs a square matrix, not ${rows.length} by ${widthOf(rows)}`,
    );
  }
  return determinantCore(rows);
}
