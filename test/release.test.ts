import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const root = fileURLToPath(new URL("..", import.meta.url));

const read = (path: string) => readFileSync(join(root, path), "utf8");

/** The tag's test job, whose `curves mcp` checks start the built bin. */
const steps = [...read(".github/workflows/release.yml").matchAll(/^\s*- run: (.+)$/gmu)].map(
  (match) => match[1] ?? "",
);

describe("a release", () => {
  it("builds before the tests", () => {
    expect(steps).toContain("pnpm build");
    expect(steps.indexOf("pnpm build")).toBeLessThan(steps.indexOf("pnpm test"));
  });

  /** obuild's remove-comments leaves every map pointing at the wrong line, worse than no map. */
  it.skipIf(!existsSync(join(root, "dist")))("ships no source maps", () => {
    const pointers = globSync("dist/**/*.{mjs,d.mts}", { cwd: root }).filter((file) =>
      read(file).includes("sourceMappingURL"),
    );

    expect([...globSync("dist/**/*.map", { cwd: root }), ...pointers]).toEqual([]);
  });
});
