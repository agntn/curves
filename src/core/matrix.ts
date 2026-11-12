import { invert, mod } from "./field.ts";

/** A matrix as rows of the same length. */
export type Matrix = readonly (readonly bigint[])[];

/** Rows in reduced echelon form, with the column each pivot row leads. */
interface Echelon {
  readonly rows: Matrix;
  readonly pivots: readonly number[];
}

/** Where one elimination step stands. */
interface Step {
  readonly column: number;
  readonly top: number;
  readonly p: bigint;
}

/** Where one Bareiss step stands. */
interface BareissStep {
  readonly corner: number;
  readonly found: number;
  readonly previous: bigint;
}

/** A system that has solutions: one of them, and a basis for the rest. */
export interface SolvedSystem {
  readonly consistent: true;
  readonly rank: number;
  readonly solution: bigint[];
  readonly kernel: bigint[][];
}

/** A system with none, and the row combination that proves it. */
export interface RefutedSystem {
  readonly consistent: false;
  readonly rank: number;
  readonly certificate: bigint[];
}

/**
 * Read one entry, with 0 past the end.
 * @param row - Any row
 * @param index - The column
 * @returns {bigint} The entry
 */
function entry(row: readonly bigint[] | undefined, index: number): bigint {
  return row?.[index] ?? 0n;
}

/**
 * Find the first row from `top` down that can lead a column.
 * @param rows - The matrix so far
 * @param column - The column to lead
 * @param top - The first row still free
 * @returns {number} Its index, or -1 when the column is all zeros there
 */
function findPivot(rows: Matrix, column: number, top: number): number {
  return rows.findIndex((row, index) => index >= top && entry(row, column) !== 0n);
}

/**
 * Clear one column: swap a pivot row up, scale it to 1 and subtract it from every other row.
 * @param rows - The matrix so far, reduced mod p
 * @param step - The column, the first free row and the prime
 * @returns {Matrix | undefined} The next matrix, or undefined when the column has no pivot
 */
function clearColumn(rows: Matrix, step: Step): Matrix | undefined {
  const { column, top, p } = step;
  const found = findPivot(rows, column, top);
  if (found === -1) return undefined;
  const scale = invert(entry(rows[found], column), p);
  const pivot = (rows[found] ?? []).map((value) => (value * scale) % p);
  return rows.map((row, index) => {
    if (index === top) return pivot;
    const source = index === found ? (rows[top] ?? []) : row;
    const factor = entry(source, column);
    if (factor === 0n) return source;
    return source.map((value, at) => mod(value - factor * entry(pivot, at), p));
  });
}

/**
 * Reduce the first `width` columns to reduced row echelon form. Later columns ride along.
 * @param matrix - Rows of one length
 * @param width - How many columns to reduce
 * @param p - A prime
 * @returns {Echelon} The reduced rows and their pivot columns
 */
function reduce(matrix: Matrix, width: number, p: bigint): Echelon {
  let rows: Matrix = matrix.map((row) => row.map((value) => mod(value, p)));
  const pivots: number[] = [];
  for (let column = 0; column < width && pivots.length < rows.length; column += 1) {
    const next = clearColumn(rows, { column, top: pivots.length, p });
    if (next === undefined) continue;
    rows = next;
    pivots.push(column);
  }
  return { rows, pivots };
}

/**
 * Read a kernel basis off reduced rows, one vector per column without a pivot.
 * @param echelon - Reduced rows and their pivots
 * @param width - The number of unknowns
 * @param p - The prime
 * @returns {bigint[][]} The basis, each vector with a 1 in its own free column
 */
function kernelOf(echelon: Echelon, width: number, p: bigint): bigint[][] {
  const { rows, pivots } = echelon;
  const led = new Set(pivots);
  const free = Array.from({ length: width }, (_, column) => column).filter(
    (column) => !led.has(column),
  );
  return free.map((column) => {
    const vector = Array.from({ length: width }, () => 0n);
    vector[column] = 1n;
    for (const [index, pivot] of pivots.entries()) {
      vector[pivot] = mod(-entry(rows[index], column), p);
    }
    return vector;
  });
}

/**
 * The rank of a matrix over F_p.
 * @param matrix - Rows of one length
 * @param width - The number of columns
 * @param p - A prime
 * @returns {number} The number of independent rows
 */
export function rank(matrix: Matrix, width: number, p: bigint): number {
  return reduce(matrix, width, p).pivots.length;
}

/**
 * A basis of every x with A x = 0 over F_p.
 * @param matrix - Rows of one length
 * @param width - The number of columns
 * @param p - A prime
 * @returns {bigint[][]} width minus rank vectors
 */
export function kernel(matrix: Matrix, width: number, p: bigint): bigint[][] {
  return kernelOf(reduce(matrix, width, p), width, p);
}

/**
 * Solve A x = b over F_p. Each row drags a unit vector along to remember where it came from.
 * @param matrix - Rows of one length
 * @param values - One b per row
 * @param p - A prime
 * @returns {SolvedSystem | RefutedSystem} A solution with the kernel, or the certificate
 */
export function solve(
  matrix: Matrix,
  values: readonly bigint[],
  p: bigint,
): SolvedSystem | RefutedSystem {
  const width = matrix[0]?.length ?? 0;
  const tagged = matrix.map((row, index) => [
    ...row,
    entry(values, index),
    ...matrix.map((_, other) => (other === index ? 1n : 0n)),
  ]);
  const echelon = reduce(tagged, width, p);
  const count = echelon.pivots.length;
  const stuck = echelon.rows.find((row, index) => index >= count && entry(row, width) !== 0n);
  if (stuck !== undefined) {
    return { consistent: false, rank: count, certificate: stuck.slice(width + 1) };
  }
  const solution = Array.from({ length: width }, () => 0n);
  for (const [index, pivot] of echelon.pivots.entries()) {
    solution[pivot] = entry(echelon.rows[index], width);
  }
  return { consistent: true, rank: count, solution, kernel: kernelOf(echelon, width, p) };
}

/**
 * One Bareiss step. The division by the previous pivot always comes out even.
 * @param rows - The matrix so far
 * @param step - The corner, the pivot row and the previous pivot
 * @returns {Matrix} The next matrix
 */
function crossMultiply(rows: Matrix, step: BareissStep): Matrix {
  const { corner, found, previous } = step;
  const pivot = rows[found] ?? [];
  const lead = entry(pivot, corner);
  return rows.map((row, index) => {
    if (index < corner) return row;
    if (index === corner) return pivot;
    const source = index === found ? (rows[corner] ?? []) : row;
    const factor = entry(source, corner);
    return source.map((value, at) => (value * lead - factor * entry(pivot, at)) / previous);
  });
}

/**
 * The determinant of a square integer matrix by Bareiss elimination, with no fractions.
 * @param matrix - Rows as long as the matrix is tall
 * @returns {bigint} The exact determinant, 1 for the empty matrix
 */
export function determinant(matrix: Matrix): bigint {
  let rows = matrix;
  let previous = 1n;
  let sign = 1n;
  for (let corner = 0; corner < matrix.length; corner += 1) {
    const found = findPivot(rows, corner, corner);
    if (found === -1) return 0n;
    if (found !== corner) sign = -sign;
    rows = crossMultiply(rows, { corner, found, previous });
    previous = entry(rows[corner], corner);
  }
  return sign * previous;
}
