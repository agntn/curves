import type { McpServerInfo } from "@agntn/tools/mcp";
import { version } from "./version.ts";

/** How both MCP servers introduce themselves, so a connector card isn't just a name. */
export const serverInfo = {
  name: "curves",
  version,
  description:
    "Points, orders, counts and discrete logs on any curve you bring, plus secp256k1 with SEC1 points. Beats a model doing modular inverses in its head.",
  icons: [
    { src: "https://curves.agntn.dev/favicon.svg", mimeType: "image/svg+xml", sizes: ["any"] },
    { src: "https://curves.agntn.dev/icon-512.png", mimeType: "image/png", sizes: ["512x512"] },
  ],
} satisfies McpServerInfo;
