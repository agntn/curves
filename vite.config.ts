import { readFileSync } from "node:fs";
import oxfmt from "@agntn/ox/oxfmt";
import oxlint from "@agntn/ox/oxlint";
import { defineConfig } from "vite-plus";

const { compilerOptions } = JSON.parse(
  readFileSync(new URL("tsconfig.json", import.meta.url), "utf8"),
) as { compilerOptions: { target?: string; verbatimModuleSyntax?: boolean } };

const readonlyParams = oxlint.rules?.["typescript/prefer-readonly-parameter-types"];
if (!Array.isArray(readonlyParams)) {
  throw new TypeError("@agntn/ox no longer configures typescript/prefer-readonly-parameter-types");
}
const [severity, options] = readonlyParams;

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
  lint: {
    ...oxlint,
    rules: {
      ...oxlint.rules,
      /** Messages are Uint8Array, which has no readonly form in the TS lib. Nothing writes them. */
      "typescript/prefer-readonly-parameter-types": [
        severity,
        { ...options, allow: [...(options?.allow ?? []), { from: "lib", name: "Uint8Array" }] },
      ],
    },
    ignorePatterns: ["docs"],
  },
});
