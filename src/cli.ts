#!/usr/bin/env node

import { existsSync } from "node:fs";
import { sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "@agntn/tools/cli";
import type { createMcpServer } from "./mcp.ts";
import { curvesTools } from "./tools.ts";
import { version } from "./version.ts";

/** The same file from `src/cli.ts` and `dist/cli.mjs`; the npm package ships only `dist`. */
const sourceMcp = new URL("../src/mcp.ts", import.meta.url);
const sourceMcpPath = fileURLToPath(sourceMcp);

/**
 * Narrows the module a runtime URL import returned, which TypeScript types as `any`.
 * @param value - The imported module namespace.
 * @returns {value is { createMcpServer: typeof createMcpServer }} Whether it exports the server.
 */
function isMcpModule(value: unknown): value is { createMcpServer: typeof createMcpServer } {
  return typeof value === "object" && value !== null && "createMcpServer" in value;
}

/**
 * A checkout serves the live source with its restart guard, so a change needs no `pnpm build`.
 * Node never strips types under `node_modules`, and `CURVES_DIST=1` keeps the bundle for tests.
 * @param argv - Every argument after the bin.
 * @returns {boolean} Whether the line is a bare `mcp` and the source is there to serve.
 */
function servesSource(argv: readonly string[]): boolean {
  return (
    argv.length === 1 &&
    argv[0] === "mcp" &&
    process.env["CURVES_DIST"] !== "1" &&
    !sourceMcpPath.includes(`${sep}node_modules${sep}`) &&
    existsSync(sourceMcpPath)
  );
}

/**
 * Serves `src/mcp.ts` over stdio. The URL is built at runtime, so the bundler leaves `src` out.
 * @returns {Promise<void>} Once the server is connected.
 */
async function serveSource(): Promise<void> {
  const module: unknown = await import(sourceMcp.href);
  if (!isMcpModule(module)) throw new TypeError(`${sourceMcpPath} has no createMcpServer`);
  const { StdioServerTransport } = await import("@modelcontextprotocol/server/stdio");
  await module.createMcpServer().connect(new StdioServerTransport());
}

/**
 * Every refusal the library makes is an `Error` with a message meant for the caller.
 * @param error - What a command threw.
 * @returns {boolean} Whether it prints as one line instead of a stack trace.
 */
function isRefusal(error: unknown): boolean {
  return error instanceof Error;
}

const argv = process.argv.slice(2);
if (servesSource(argv)) {
  await serveSource();
} else {
  await runCli(
    {
      name: "curves",
      version,
      description: "Arithmetic on elliptic curves: curves you define, and secp256k1",
      tools: curvesTools,
      mcp: true,
      expected: isRefusal,
    },
    argv,
  );
}
