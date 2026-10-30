import { defineBuildConfig } from "obuild/config";

export default defineBuildConfig({
  entries: [
    {
      /** One bundle, so every entry shares module-level state with the MCP server. */
      type: "bundle",
      input: [
        "./src/index.ts",
        "./src/secp256k1.ts",
        "./src/bip340.ts",
        "./src/p256.ts",
        "./src/p384.ts",
        "./src/ristretto255.ts",
        "./src/ed25519.ts",
        "./src/sr25519.ts",
        "./src/cli.ts",
        "./src/ai.ts",
        "./src/mcp.ts",
        "./src/tools.ts",
      ],
      /** No maps. remove-comments throws the JS ones off, the type ones want an unshipped src/. */
      dts: { sourcemap: false },
    },
  ],
});
