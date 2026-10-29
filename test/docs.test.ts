import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { triage } from "../docs/scripts/typecheck.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

const read = (path: string) => readFileSync(join(root, path), "utf8");

const manifest = JSON.parse(read("package.json")) as { engines: { node: string } };

const pages = globSync("docs/content/**/*.md", { cwd: root }).map((path) => ({
  path,
  text: read(path),
}));

/** A static or dynamic import of a `node:` builtin, side effect imports included. */
const NODE_IMPORT = /(?:from|import)\s*\(?\s*["']node:/u;

/* The `description` values of a page's frontmatter, `seo.description` included. */
function descriptions(text: string): string[] {
  const frontmatter = /^---\n([\s\S]*?)\n---/u.exec(text)?.[1] ?? "";
  return [...frontmatter.matchAll(/^\s*description:\s*(.*)$/gmu)].map((match) => match[1] ?? "");
}

describe("docs content", () => {
  it("finds the pages", () => {
    expect(pages.length).toBeGreaterThan(10);
  });

  /** Quotes, a block scalar or a `#` comment would hide the text the next checks read. */
  it.each(pages)("writes each description in $path as one plain line", ({ text }) => {
    for (const description of descriptions(text)) {
      expect(description).toMatch(/^[^"'|>]/u);
      expect(description).not.toContain(" #");
    }
  });

  /** Docus 5.13 names the OG file after the description: a comma splits it, `..png` is skipped. */
  it.each(pages)(
    "keeps commas and a closing period out of the descriptions in $path",
    ({ text }) => {
      for (const description of descriptions(text)) {
        expect(description).not.toMatch(/,|\.$/u);
      }
    },
  );

  /** A `: ` in a plain YAML value starts a mapping, and the page drops out of the prerender. */
  it.each(pages)("keeps a colon and space out of the descriptions in $path", ({ text }) => {
    for (const description of descriptions(text)) {
      expect(description).not.toContain(": ");
    }
  });

  /** In a sister site, a list item opening on bold sent `/llms-full.txt` into endless recursion. */
  it.each(pages)("opens no list item in $path with bold", ({ text }) => {
    expect(text).not.toMatch(/^\s*(?:[-*]|\d+\.) \*\*/mu);
  });
});

describe("the site build", () => {
  /** Workers Builds takes Node.js from `.node-version` alone and falls back to 24 without it. */
  it("pins the Node.js major of `engines` in .node-version", () => {
    const major = /\d+/u.exec(manifest.engines.node)?.[0] ?? "none";

    expect(read(".node-version").trim()).toMatch(new RegExp(`^v?${major}\\.`, "u"));
  });

  /** The site bundles `src/` for the browser, which has no `node:` builtins to give it. */
  it("imports `node:` builtins in src/ only from the CLI and the restart guard", () => {
    const importers = globSync("src/**/*.ts", { cwd: root }).filter((path) =>
      NODE_IMPORT.test(read(path)),
    );

    expect(importers.toSorted()).toEqual(["src/cli.ts", "src/source-change.ts"]);
  });
});

describe("the docs type check", () => {
  const docus =
    "node_modules/.pnpm/docus@5.13.0_01fe9e8df02dfa02c398a1096df55021/node_modules/docus/app/composables/useSeo.ts(172,5): error TS2322: Type 'ComputedRef<A[]>' is not assignable to type 'B'.\n" +
    "  Type 'ComputedRef<A[]>' is not assignable to type 'ComputedRef<C>'.\n" +
    "    Type 'A[]' is not assignable to type 'C'.\n";
  const site =
    "app/components/content/CurvesPlayground.vue(362,29): error TS2339: Property 'point' does not exist on type 'Result'.\n";

  it("skips Docus's own source, continuation lines and all", () => {
    expect(triage(docus)).toEqual({ own: [], skipped: 1 });
  });

  it("keeps an error in the site's files", () => {
    expect(triage(docus + site)).toEqual({ own: [site.trimEnd()], skipped: 1 });
  });

  /** No file means no excuse, even when the message names a Docus path. */
  it("keeps an error that names no file", () => {
    const missing = "error TS5058: The specified path does not exist: '.nuxt/tsconfig.app.json'.\n";
    const named = "error TS6053: File '/docs/node_modules/docus/app/app.vue' not found.\n";

    expect(triage(docus + missing + named).own).toEqual([missing.trimEnd(), named.trimEnd()]);
  });
});
