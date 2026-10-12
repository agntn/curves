import { readdirSync, readFileSync } from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { Client as SiteClient } from "../docs/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { InMemoryTransport as SiteTransport } from "../docs/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js";
import { McpServer } from "../docs/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js";
import type { CallToolResult } from "../docs/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createMcpServer, toolListings } from "../src/mcp.ts";
import { devAccounts } from "./fixtures/sr25519.ts";
import { secp256k1Vectors } from "./fixtures/vectors.ts";

/* The toolkit's entry pulls in Nitro, and `defineMcpTool` only hands its input back. */
vi.mock(
  "../docs/node_modules/@nuxtjs/mcp-toolkit/dist/runtime/server/mcp/definitions/index.js",
  () => ({
    defineMcpTool: (definition: unknown) => definition,
  }),
);

const toolsDir = new URL("../docs/server/mcp/tools/", import.meta.url);

const openConnections: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(openConnections.splice(0).map((connection) => connection.close()));
});

/**
 * Connects an SDK client to every docs tool, through the same SDK copy the worker runs.
 * @returns {Promise<SiteClient>} The connected client.
 */
async function siteClient(): Promise<SiteClient> {
  const { curvesMcpTool } = await import("../docs/server/utils/curves-mcp.ts");
  const server = new McpServer({ name: "curves-docs", version: "0.0.0" });
  for (const listing of toolListings) {
    const tool = curvesMcpTool(listing.name);
    const handler = tool.handler as (
      args: Readonly<Record<string, unknown>>,
    ) => Promise<CallToolResult>;
    server.registerTool(listing.name, tool, handler);
  }
  const [clientTransport, serverTransport] = SiteTransport.createLinkedPair();
  const client = new SiteClient({ name: "curves-docs-test", version: "0.0.0" });
  openConnections.push(client, server);
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

const { g } = secp256k1Vectors;
const { seed } = devAccounts;
const paar = { a: "2", b: "2", p: "17" };

/** Calls that cover a plain answer, a refusal of the library and a schema miss. */
const CALLS: ReadonlyArray<[string, Record<string, unknown>]> = [
  [
    "curves_compute",
    { ...paar, operation: "log", point: { x: "5", y: "1" }, other: { x: "16", y: "4" } },
  ],
  ["curves_compute", { ...paar, operation: "double", point: { x: "5", y: "2" } }],
  ["curves_compute", { ...paar, operation: "count", scalre: "3" }],
  ["curves_secp256k1_compute", { operation: "lift", x: g.slice(2) }],
  ["curves_secp256k1_compute", { operation: "subtract", point: g, other: g }],
  ["curves_sr25519_compute", { operation: "keypair", seed }],
  ["curves_sr25519_compute", { operation: "derive", publicKey: seed, chainCode: seed, hard: true }],
];

describe("docs MCP tools", () => {
  it("serves every tool `curves mcp` lists, one file each", () => {
    const files = readdirSync(toolsDir).toSorted();
    expect(files).toEqual(
      toolListings.map((tool) => `${tool.name.replaceAll("_", "-")}.ts`).toSorted(),
    );
    for (const file of files) {
      const name = file.slice(0, -".ts".length).replaceAll("-", "_");
      expect(readFileSync(new URL(file, toolsDir), "utf8")).toBe(
        `export default curvesMcpTool(${JSON.stringify(name)});\n`,
      );
    }
  });

  it("answer like stdio, built from what stdio lists, bare calls too", async () => {
    const site = await siteClient();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer();
    const stdio = new Client({ name: "curves-docs-test", version: "1.0.0" });
    openConnections.push(stdio, server);
    await Promise.all([server.connect(serverTransport), stdio.connect(clientTransport)]);

    expect((await stdio.listTools()).tools).toEqual(toolListings);
    for (const [name, args] of CALLS) {
      expect(await site.callTool({ name, arguments: args }), name).toEqual(
        await stdio.callTool({ name, arguments: args }),
      );
    }
    const bare = await site.callTool({ name: "curves_compute" });
    expect(bare.isError).toBe(true);
    expect(bare).toEqual(await stdio.callTool({ name: "curves_compute" }));
  });
});
