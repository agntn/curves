#!/usr/bin/env node

import { existsSync } from "node:fs";
import { sep } from "node:path";
import { fileURLToPath } from "node:url";
import { cittyAnswers, shownArgument, undeclaredOption } from "./cli-args.ts";
import type McpCommand from "./commands/mcp.ts";
import { version } from "./version.ts";

/**
 * citty colors its usage and its errors even into a pipe, takes `NO_COLOR` only as `1`, and decides
 * once, as it loads, so `curves --help | less`, a file or an agent's transcript gets the escapes.
 * The terminal decides here, before citty loads: colors only when both streams citty writes to are
 * terminals that take them, and `hasColors()` already honors any `NO_COLOR` and `TERM=dumb`.
 */
const { stderr, stdout } = process;
if (!(stdout.isTTY && stdout.hasColors() && stderr.isTTY && stderr.hasColors())) {
  process.env["NO_COLOR"] = "1";
}
const { defineCommand, runMain } = await import("citty");

/** The same file from `src/cli.ts` and `dist/cli.mjs`; the npm package ships only `dist`. */
const sourceMcpCommand = new URL("../src/commands/mcp.ts", import.meta.url);
const sourceMcpCommandPath = fileURLToPath(sourceMcpCommand);

/**
 * Narrows the module a runtime URL import returned, which TypeScript types as `any`.
 * @param value - The imported module namespace.
 * @returns {value is { default: typeof McpCommand }} Whether it exports a default command.
 */
function isCommandModule(value: unknown): value is { default: typeof McpCommand } {
  return typeof value === "object" && value !== null && "default" in value;
}

/**
 * Loads the MCP command. A built bin inside a checkout runs the live source, like the Pi and OMP
 * extensions, so a local server needs a restart after a change instead of `pnpm build`. Node
 * never strips types under `node_modules`, so an installed copy keeps the bundle, and
 * `CURVES_DIST=1` keeps it everywhere, for tests of the built output. The URL is built at
 * runtime so the bundler leaves `src` out.
 * @returns {Promise<typeof McpCommand>} The citty command that starts the stdio server.
 */
async function loadMcpCommand(): Promise<typeof McpCommand> {
  const fromSource =
    !import.meta.url.endsWith(".ts") &&
    process.env["CURVES_DIST"] !== "1" &&
    !sourceMcpCommandPath.includes(`${sep}node_modules${sep}`) &&
    existsSync(sourceMcpCommandPath);
  if (!fromSource) return (await import("./commands/mcp.ts")).default;
  const module: unknown = await import(sourceMcpCommand.href);
  if (!isCommandModule(module)) {
    throw new TypeError(`${sourceMcpCommandPath} has no default command`);
  }
  return module.default;
}

const subCommands = {
  compute: () => import("./commands/compute.ts").then((m) => m.default),
  secp256k1: () => import("./commands/secp256k1.ts").then((m) => m.default),
  mcp: loadMcpCommand,
};

const main = defineCommand({
  meta: {
    name: "curves",
    version,
    description: "Arithmetic on elliptic curves: curves you define, and secp256k1",
  },
  subCommands,
});

const rawArgs = process.argv.slice(2);
const [name] = rawArgs;
const sub = await Object.entries(subCommands).find(([key]) => key === name)?.[1]();
const args = await sub?.args;
const defs = typeof args === "function" ? await args() : args;
const dashed = cittyAnswers(rawArgs)
  ? undefined
  : undeclaredOption(sub ? rawArgs.slice(1) : rawArgs, defs ?? {});
if (dashed === undefined) {
  await runMain(main);
} else {
  const where = sub ? ` for ${name}` : "";
  stderr.write(
    `Unknown option ${shownArgument(dashed)}${where}. Text that starts with - goes after --, which ends the options.\n`,
  );
  process.exitCode = 1;
}
