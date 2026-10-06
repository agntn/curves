import oxfmt from "@agntn/ox/oxfmt";
import oxlint from "@agntn/ox/oxlint";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: { ...oxfmt, ignorePatterns: ["/CHANGELOG.md"] },
  lint: { ...oxlint, rules: { ...oxlint.rules }, ignorePatterns: [] },
});
