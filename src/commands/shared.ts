import type { ToolResult } from "../tool-operations.ts";

/**
 * Prints what an executor answers, the same JSON the tools return, or its error as one line.
 * Every refusal the library makes is an `Error` with a message meant for the caller.
 *
 * @param compute - Runs the executor.
 */
export function print(compute: () => ToolResult<unknown>): void {
  try {
    process.stdout.write(`${JSON.stringify(compute().details, undefined, 2)}\n`);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

/**
 * Reads a point given as `x,y` for the curve tool.
 *
 * @param text - The flag value, or nothing.
 * @param name - The flag, for the error.
 * @returns {{ x: string; y: string } | undefined} The coordinates as the tool takes them.
 */
export function pointFlag(text: unknown, name: string): { x: string; y: string } | undefined {
  if (text === undefined || text === "") return undefined;
  if (typeof text !== "string") throw new TypeError(`--${name} takes x,y`);
  const parts = text.split(",");
  const [x, y] = parts;
  if (parts.length !== 2 || x === undefined || y === undefined) {
    throw new TypeError(`--${name} takes x,y`);
  }
  return { x: x.trim(), y: y.trim() };
}
