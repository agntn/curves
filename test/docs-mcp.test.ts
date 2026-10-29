import type { ToolkitTool } from "@agntn/tools/toolkit";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { Client as SiteClient } from "../docs/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { InMemoryTransport as SiteTransport } from "../docs/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js";
import { McpServer } from "../docs/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js";
import type { CallToolResult } from "../docs/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createMcpServer, toolListings } from "../src/mcp.ts";
import { speccheck } from "./fixtures/ed25519.ts";
import { devAccounts } from "./fixtures/sr25519.ts";
import { secp256k1Vectors } from "./fixtures/vectors.ts";

/* The toolkit's entry pulls in Nitro, so the handler gets its page tools and options here. */
vi.mock(
  "../docs/node_modules/@nuxtjs/mcp-toolkit/dist/runtime/server/mcp/definitions/index.js",
  () => ({
    defineMcpHandler: (options: unknown) => options,
    getMcpTools: async () => [{ name: "list-pages" }, { name: "get-page" }],
  }),
);

const openConnections: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(openConnections.splice(0).map((connection) => connection.close()));
});

/**
 * What `docs/server/mcp/index.ts` serves for one request, Docus page tools included.
 * @returns {Promise<readonly ToolkitTool[]>} The tools in the order the toolkit gets them.
 */
async function docsTools(): Promise<readonly ToolkitTool[]> {
  const { default: handler } = await import("../docs/server/mcp/index.ts");
  const { tools } = handler;
  if (typeof tools !== "function") throw new TypeError("the handler should resolve its tools");
  return (await tools(undefined as never)) as ToolkitTool[];
}

/**
 * Connects an SDK client to every curve tool, through the same SDK copy the worker runs.
 * @returns {Promise<SiteClient>} The connected client.
 */
async function siteClient(): Promise<SiteClient> {
  const server = new McpServer({ name: "curves-docs", version: "0.0.0" });
  for (const tool of await docsTools()) {
    if (!tool.name.startsWith("curves_")) continue;
    const handler = tool.handler as (args: unknown) => Promise<CallToolResult>;
    server.registerTool(tool.name, tool as never, handler);
  }
  const [clientTransport, serverTransport] = SiteTransport.createLinkedPair();
  const client = new SiteClient({ name: "curves-docs-test", version: "0.0.0" });
  openConnections.push(client, server);
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/**
 * Connects a client to `curves mcp` as stdio serves it.
 * @returns {Promise<Client>} The connected client.
 */
async function stdioClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer();
  const client = new Client({ name: "curves-docs-test", version: "1.0.0" });
  openConnections.push(client, server);
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

const { g } = secp256k1Vectors;
const { seed } = devAccounts;
const paar = { a: "2", b: "2", p: "17" };
/** r = 1 and s = 1: false under G as the key, while recover still lifts x = 1 to some key. */
const SIGNATURE = `${"1".padStart(64, "0")}${"1".padStart(64, "0")}`;
const [caseZero] = speccheck;
if (caseZero === undefined) throw new Error("The speccheck fixture lost case 0");
/** Speccheck case 0, a key of order 8: true under ZIP 215, false once zip215 is false. */
const smallOrder = {
  publicKey: caseZero.publicKey,
  message: caseZero.message,
  signature: caseZero.signature,
};

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
  [
    "curves_secp256k1_compute",
    { operation: "verify", point: g, digest: "01", signature: SIGNATURE },
  ],
  [
    "curves_secp256k1_compute",
    { operation: "recover", digest: "01", signature: SIGNATURE, recovery: 1 },
  ],
  [
    "curves_bip340_compute",
    { operation: "verify", publicKey: seed, message: "", signature: SIGNATURE },
  ],
  ["curves_sr25519_compute", { operation: "keypair", seed }],
  ["curves_sr25519_compute", { operation: "derive", publicKey: seed, chainCode: seed, hard: true }],
  ["curves_ed25519_compute", { operation: "verify", ...smallOrder, zip215: false }],
  ["curves_ed25519_compute", { operation: "verify", ...smallOrder, signature: "00" }],
];

describe("docs MCP tools", () => {
  it("serves every tool `curves mcp` lists after the Docus page tools", async () => {
    expect((await docsTools()).map((tool) => tool.name)).toEqual([
      "list-pages",
      "get-page",
      ...toolListings.map((tool) => tool.name),
    ]);
    const listed = (await (await siteClient()).listTools()).tools;
    /* SDK v1 adds `execution` and a `$schema`; the rest is what stdio lists, field for field. */
    expect(
      listed.map(({ inputSchema, ...tool }) => ({
        ...tool,
        execution: undefined,
        inputSchema: { ...inputSchema, $schema: undefined },
      })),
    ).toEqual((await (await stdioClient()).listTools()).tools);
  });

  it("answer like stdio, bare calls too", async () => {
    const site = await siteClient();
    const stdio = await stdioClient();
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
