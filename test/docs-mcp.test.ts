import { readdirSync, readFileSync } from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { Client as SiteClient } from "../docs/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { InMemoryTransport as SiteTransport } from "../docs/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js";
import { McpServer } from "../docs/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js";
import type { CallToolResult } from "../docs/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { callTool, createMcpServer, toolListings } from "../src/mcp.ts";

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

const G = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const paar = { a: "2", b: "2", p: "17" };
const SEED = "fac7959dbfe72f052e5a0c3c8d6530f202b02fd8f9f5ca3580ec8deb7797479e";

/** Calls that cover a plain answer, a refusal of the library, a schema miss and an unknown tool. */
const CALLS: ReadonlyArray<[string, Record<string, unknown>]> = [
  [
    "curves_compute",
    { ...paar, operation: "log", point: { x: "5", y: "1" }, other: { x: "16", y: "4" } },
  ],
  ["curves_compute", { ...paar, operation: "double", point: { x: "5", y: "2" } }],
  ["curves_compute", { ...paar, operation: "count", scalre: "3" }],
  ["curves_secp256k1_compute", { operation: "lift", x: G.slice(2) }],
  ["curves_secp256k1_compute", { operation: "subtract", point: G, other: G }],
  ["curves_sr25519_compute", { operation: "keypair", seed: SEED }],
  ["curves_sr25519_compute", { operation: "derive", publicKey: SEED, chainCode: SEED, hard: true }],
  ["curves_nope", {}],
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

  it("lists and answers exactly as the stdio server does", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer();
    const client = new Client({ name: "curves-docs-test", version: "1.0.0" });
    openConnections.push(client, server);
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    expect(toolListings).toEqual(tools);
    for (const [name, args] of CALLS) {
      const viaServer = await client.callTool({ name, arguments: args });
      expect(await callTool(name, args), name).toEqual(viaServer);
    }
  });

  it("answers through the site's tools as stdio does, a call without arguments included", async () => {
    const client = await siteClient();
    for (const [name, args] of CALLS.filter(([name]) => name !== "curves_nope")) {
      expect(await client.callTool({ name, arguments: args }), name).toEqual(
        await callTool(name, args),
      );
    }
    const bare = await client.callTool({ name: "curves_compute" });
    expect(bare.isError).toBe(true);
    expect(bare.content).toEqual((await callTool("curves_compute", {})).content);
  });
});
