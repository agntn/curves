import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import oxfmt from "@agntn/ox/oxfmt";
import oxlint from "@agntn/ox/oxlint";
import { defineConfig } from "vite-plus";

const { compilerOptions } = JSON.parse(
  readFileSync(new URL("tsconfig.json", import.meta.url), "utf8"),
) as { compilerOptions: { target?: string; verbatimModuleSyntax?: boolean } };

/** Root tsconfig for every transform: docs/tsconfig.json only points at a `.nuxt/` CI never has. */
const transformOverride: object = {
  tsconfig: {
    compilerOptions: {
      target: compilerOptions.target,
      verbatimModuleSyntax: compilerOptions.verbatimModuleSyntax,
    },
  },
};

export default defineConfig({
  oxc: { ...transformOverride },
  fmt: { ...oxfmt, ignorePatterns: ["/CHANGELOG.md", "docs"] },
  lint: { ...oxlint, rules: { ...oxlint.rules }, ignorePatterns: ["docs"] },
  test: {
    alias: {
      /** The docs site imports the MCP module by the package name, as its alias in nuxt.config.ts does. */
      "@agntn/curves/mcp": fileURLToPath(new URL("src/mcp.ts", import.meta.url)),
    },
  },
});
