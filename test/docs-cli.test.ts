import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { commandName } from "@agntn/tools/cli";
import { describe, expect, it } from "vite-plus/test";

import { curvesTools } from "../src/tools.ts";

/** A row of a command table: the backticked `curves …` cell and the text beside it. */
const ROW = /^\| `(curves [^`]+)`\s*\| (.*?)\s*\|$/gmu;

/** Every page that prints the command table. */
const PAGES = ["README.md", "docs/content/1.guide/02.cli.md"];

/** Each command beside the operations its schema lets through. */
const COMMANDS = curvesTools.map((tool): [command: string, list: string] => {
  const { operation } = tool.input.properties as { operation: { enum: readonly string[] } };

  return [commandName(tool), operation.enum.join(", ")];
});

/* The table's rows on a page, as command and text. */
function rows(page: string): [command: string, does: string][] {
  const text = readFileSync(fileURLToPath(new URL(`../${page}`, import.meta.url)), "utf8");

  return [...text.matchAll(ROW)].map((row) => [row[1] ?? "", row[2] ?? ""]);
}

describe.each(PAGES)("the command table in %s", (page) => {
  const table = new Map(rows(page));

  it("has one row per command, in the tools' order, and the server last", () => {
    const commands = COMMANDS.map(([command]) => `curves ${command} <operation>`);

    expect([...table.keys()]).toEqual([...commands, "curves mcp"]);
  });

  /** The guide says where the operations run, after the list. */
  it.each(COMMANDS)("lists every operation of `curves %s`", (command, list) => {
    const does = table.get(`curves ${command} <operation>`) ?? "";

    expect(does.startsWith(`${list} `) ? list : does).toBe(list);
  });
});
