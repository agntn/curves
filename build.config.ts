import { defineBuildConfig } from "obuild/config";

export default defineBuildConfig({
  entries: [
    {
      /** One bundle, so every entry shares module-level state with the MCP server. */
      type: "bundle",
      input: [
        "./src/index.ts",
        "./src/secp256k1.ts",
        "./src/cli.ts",
        "./src/ai.ts",
        "./src/mcp.ts",
        "./src/tools.ts",
      ],
    },
  ],
});
