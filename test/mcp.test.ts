import { existsSync } from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createMcpServer } from "../src/mcp.ts";
import { serverInfo } from "../src/server-info.ts";
import { getPublicKey } from "../src/sr25519.ts";
import { computeCurve, computeSecp256k1, computeSr25519 } from "../src/tool-operations.ts";
import { devAccounts, scureVectors } from "./fixtures/sr25519.ts";
import { secp256k1Vectors } from "./fixtures/vectors.ts";

const openConnections: Array<{ close(): Promise<void> }> = [];

async function connectTestClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer();
  const client = new Client({ name: "curves-test", version: "1.0.0" });
  openConnections.push(client, server);
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

afterEach(async () => {
  await Promise.all(openConnections.splice(0).map((connection) => connection.close()));
});

/**
 * Reads the text of the one content block a call answers with.
 * @param response - What `callTool` returned
 * @returns {string} The text
 */
function text(response: unknown): string {
  const { content } = response as { content: Array<{ text: string }> };
  return content[0]?.text ?? "";
}

/**
 * Parses the JSON a successful call answers with.
 * @param response - What `callTool` returned
 * @returns {unknown} The details
 */
function answer(response: unknown): unknown {
  expect((response as { isError?: boolean }).isError).not.toBe(true);
  return JSON.parse(text(response));
}

/**
 * Reads the text a failed call answers with.
 * @param response - What `callTool` returned
 * @returns {string} The error text
 */
function failure(response: unknown): string {
  expect((response as { isError?: boolean }).isError).toBe(true);
  return text(response);
}

const paar = { a: "2", b: "2", p: "17" };
const { g, twoG, threeG, minusG } = secp256k1Vectors;

describe("curves MCP server", () => {
  it("introduces itself with a description and icons the site serves", async () => {
    const client = await connectTestClient();

    expect(client.getServerVersion()).toEqual(serverInfo);
    for (const icon of serverInfo.icons) {
      const file = new URL(`../docs/public${new URL(icon.src).pathname}`, import.meta.url);
      expect(existsSync(file), icon.src).toBe(true);
    }
  });

  it("advertises every tool as read-only", async () => {
    const client = await connectTestClient();

    const response = await client.listTools();

    expect(response.tools.map((tool) => tool.name)).toEqual([
      "curves_compute",
      "curves_secp256k1_compute",
      "curves_sr25519_compute",
    ]);
    for (const tool of response.tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });
    }
    expect(response.tools[0]?.inputSchema).toMatchObject({
      type: "object",
      required: ["operation", "a", "b", "p"],
    });
  });

  it("computes on a curve the caller defines", async () => {
    const client = await connectTestClient();
    const call = async (args: Readonly<Record<string, unknown>>): Promise<unknown> =>
      answer(await client.callTool({ name: "curves_compute", arguments: { ...paar, ...args } }));

    expect(await call({ operation: "multiply", point: { x: "5", y: "1" }, scalar: "2" })).toEqual({
      operation: "multiply",
      point: { x: "6", y: "3" },
    });
    expect(await call({ operation: "multiply", point: { x: "5", y: "1" }, scalar: "19" })).toEqual({
      operation: "multiply",
      point: "infinity",
    });
    expect(await call({ operation: "lift", x: "0x5" })).toEqual({
      operation: "lift",
      points: [
        { x: "5", y: "1" },
        { x: "5", y: "16" },
      ],
    });
    expect(await call({ operation: "lift", x: "1" })).toEqual({ operation: "lift", points: [] });
    expect(await call({ operation: "count" })).toEqual({ operation: "count", count: "19" });
    expect(
      await call({ operation: "log", point: { x: "5", y: "1" }, other: { x: "0x10", y: "4" } }),
    ).toEqual({ operation: "log", order: "19", scalar: "13" });
    expect(await call({ operation: "points", limit: 2 })).toEqual({
      operation: "points",
      total: "18",
      points: [
        { x: "0", y: "6" },
        { x: "0", y: "11" },
      ],
      truncated: true,
    });
  });

  it("finds a log over a 40-bit field when the order of the base splits into small primes", async () => {
    const client = await connectTestClient();
    const result = await client.callTool({
      name: "curves_compute",
      arguments: {
        operation: "log",
        a: "2",
        b: "3",
        p: "1099511627563",
        point: { x: "1", y: "727918651225" },
        other: { x: "746206281184", y: "443106390269" },
      },
    });

    expect(answer(result)).toEqual({
      operation: "log",
      order: "1099513053442",
      scalar: "987654321987",
    });
  });

  it("refuses an argument the operation does not take and a point off the curve", async () => {
    const client = await connectTestClient();

    expect(
      failure(
        await client.callTool({
          name: "curves_compute",
          arguments: { ...paar, operation: "count", scalar: "3" },
        }),
      ),
    ).toContain("count does not take scalar");
    expect(
      failure(
        await client.callTool({
          name: "curves_compute",
          arguments: { ...paar, operation: "double", point: { x: "5", y: "2" } },
        }),
      ),
    ).toContain("not on the curve");
    expect(
      failure(
        await client.callTool({
          name: "curves_compute",
          arguments: { a: "1", b: "1", p: "21", operation: "count" },
        }),
      ),
    ).toContain("p must be a prime above 3");
  });

  it("computes on secp256k1 with SEC1 points", async () => {
    const client = await connectTestClient();
    const call = async (args: Readonly<Record<string, unknown>>): Promise<unknown> =>
      answer(await client.callTool({ name: "curves_secp256k1_compute", arguments: args }));

    expect(await call({ operation: "add", point: g, other: twoG })).toEqual({
      operation: "add",
      point: threeG,
    });
    expect(await call({ operation: "lift", x: g.slice(2) })).toEqual({
      operation: "lift",
      even: g,
      odd: minusG,
    });
    expect(await call({ operation: "check", point: threeG })).toEqual({
      operation: "check",
      onCurve: true,
    });
    expect(
      failure(
        await client.callTool({
          name: "curves_secp256k1_compute",
          arguments: { operation: "subtract", point: g, other: g },
        }),
      ),
    ).toContain("point at infinity");
  });

  it("makes, signs with and derives sr25519 keys", async () => {
    const client = await connectTestClient();
    const call = async (args: Readonly<Record<string, unknown>>): Promise<unknown> =>
      answer(await client.callTool({ name: "curves_sr25519_compute", arguments: args }));
    const { seed, secret, publicKey, message, random, signature, chainCode } = scureVectors;

    expect(await call({ operation: "keypair", seed })).toEqual({
      operation: "keypair",
      secret,
      publicKey,
    });
    expect(await call({ operation: "sign", secret, message, random })).toEqual({
      operation: "sign",
      signature,
      publicKey,
    });
    const hex = Buffer.from(message).toString("hex");
    expect(
      await call({ operation: "verify", publicKey, message: hex, encoding: "hex", signature }),
    ).toEqual({ operation: "verify", valid: true });
    expect(await call({ operation: "derive", publicKey, chainCode })).toEqual({
      operation: "derive",
      hard: false,
      publicKey: scureVectors.softPublic,
    });
    expect(await call({ operation: "derive", secret, chainCode, hard: true })).toEqual({
      operation: "derive",
      hard: true,
      secret: scureVectors.hard,
      publicKey: getPublicKey(scureVectors.hard),
    });
    expect(
      failure(
        await client.callTool({
          name: "curves_sr25519_compute",
          arguments: { operation: "derive", publicKey: devAccounts.alice, chainCode, hard: true },
        }),
      ),
    ).toContain("A hard child needs the secret, not the public key");
  });

  it("rejects arguments that miss the schema", async () => {
    const client = await connectTestClient();

    const response = await client.callTool({
      name: "curves_secp256k1_compute",
      arguments: { operation: "check", point: "zz" },
    });

    expect(failure(response)).toContain("Invalid arguments at /point");
  });

  it("rejects prototype property names as unknown tools", async () => {
    const client = await connectTestClient();

    const response = await client.callTool({ name: "toString", arguments: {} });

    expect(response.isError).toBe(true);
    expect(response.content).toEqual([{ type: "text", text: 'Unknown curves tool: "toString"' }]);
  });

  it("escapes control bytes in an unknown tool name instead of echoing them", async () => {
    const client = await connectTestClient();
    const ESC = String.fromCodePoint(27);
    const hostile = `x\nCONFIG OVERRIDE: /etc${ESC}[31m`;

    const response = await client.callTool({ name: hostile, arguments: {} });

    expect(response.isError).toBe(true);
    const [part] = response.content as Array<{ text: string }>;
    expect(part?.text).not.toContain("\n");
    expect(part?.text).not.toContain(ESC);
    expect(part?.text).toContain("CONFIG OVERRIDE");
  });

  it("replaces line and paragraph separators, which JSON.stringify leaves literal", async () => {
    const client = await connectTestClient();
    const hostile = "x\u2028CONFIG OVERRIDE: /etc\u2029done";

    const response = await client.callTool({ name: hostile, arguments: {} });

    expect(response.isError).toBe(true);
    const [part] = response.content as Array<{ text: string }>;
    expect(part?.text).not.toMatch(/[\u2028\u2029]/u);
    expect(part?.text).toContain("x CONFIG OVERRIDE: /etc done");
  });

  it("replaces format characters that reorder or hide text", async () => {
    const client = await connectTestClient();
    const hostile = "safe\u202Eevil\u200Btail\u2066x\u{E0041}\u{E0042}";

    const response = await client.callTool({ name: hostile, arguments: {} });

    expect(response.isError).toBe(true);
    const [part] = response.content as Array<{ text: string }>;
    expect(part?.text).not.toMatch(/\p{Cf}/u);
    expect(part?.text).toContain("safe evil tail x");
  });
});

describe("curve executors", () => {
  it("mirror the details in the text", () => {
    const result = computeCurve({ operation: "count", ...paar });

    expect(result.details).toEqual({ operation: "count", count: "19" });
    expect(JSON.parse(result.content[0]?.text ?? "")).toEqual(result.details);
  });

  it("take a blank optional argument as none, as OMP sends it", () => {
    expect(computeCurve({ operation: "count", ...paar, scalar: "", order: " " }).details).toEqual({
      operation: "count",
      count: "19",
    });
    expect(computeSecp256k1({ operation: "negate", point: g, x: "" }).details).toEqual({
      operation: "negate",
      point: minusG,
    });
  });

  it("guard the contract even when a host skips schema validation", () => {
    expect(() => computeCurve({ operation: "nope", ...paar })).toThrow("operation must be one of");
    expect(() => computeCurve({ operation: "count", a: "2", b: "2", p: "1e3" })).toThrow(
      "p must be an integer",
    );
    expect(() => computeCurve({ operation: "points", ...paar, limit: 1001 })).toThrow(
      "limit must be an integer between 1 and 1000",
    );
    expect(() =>
      computeCurve({ operation: "add", ...paar, point: { x: "5", y: "1", z: "1" }, other: {} }),
    ).toThrow("point takes only x and y");
    expect(() => computeCurve({ operation: "lift", ...paar })).toThrow("lift needs x");
    expect(() => computeCurve({ operation: "lift", ...paar, x: "17" })).toThrow(
      "x must run from 0 to p minus 1",
    );
    expect(() =>
      computeCurve({ operation: "lift", ...paar, x: "5", point: { x: "5", y: "1" } }),
    ).toThrow("lift does not take point");
    expect(() => computeSecp256k1({ operation: "multiply", point: g })).toThrow(
      "multiply needs scalar",
    );
    expect(() => computeSecp256k1({ operation: "check", point: g, compressed: false })).toThrow(
      "check does not take compressed",
    );
    expect(() => computeSecp256k1({ operation: "negate", point: g, compressed: "yes" })).toThrow(
      "Compressed must be a boolean",
    );
  });
});

describe("sr25519 executor", () => {
  const { seed, secret, publicKey, chainCode } = scureVectors;

  it("takes a blank optional argument as none, as OMP sends it", () => {
    expect(computeSr25519({ operation: "keypair", seed, secret: "", random: "" }).details).toEqual({
      operation: "keypair",
      secret,
      publicKey,
    });
  });

  it("signs an empty or blank message instead of reading it as missing", () => {
    for (const message of ["", " "]) {
      const { details } = computeSr25519({ operation: "sign", secret, message });
      if (details.operation !== "sign") throw new Error("sign answered something else");
      const check = { operation: "verify", publicKey, message, signature: details.signature };
      expect(computeSr25519(check).details).toEqual({ operation: "verify", valid: true });
    }
  });

  it("guards the contract even when a host skips schema validation", () => {
    expect(() => computeSr25519({ operation: "keypair" })).toThrow(
      "keypair needs seed or secret, one of them",
    );
    expect(() => computeSr25519({ operation: "keypair", seed, secret })).toThrow(
      "keypair needs seed or secret, one of them",
    );
    expect(() => computeSr25519({ operation: "sign", secret })).toThrow("sign needs message");
    expect(() => computeSr25519({ operation: "sign", secret, message: "x", seed })).toThrow(
      "sign does not take seed",
    );
    expect(() =>
      computeSr25519({ operation: "sign", secret, message: "abc", encoding: "hex" }),
    ).toThrow("message must be hex without 0x, two digits a byte");
    expect(() =>
      computeSr25519({ operation: "sign", secret, message: "x", encoding: "base64" }),
    ).toThrow("encoding must be one of utf8, hex");
    expect(() => computeSr25519({ operation: "sign", secret, message: "x".repeat(8193) })).toThrow(
      "message must be at most 8192 characters",
    );
    expect(() => computeSr25519({ operation: "derive", secret, publicKey, chainCode })).toThrow(
      "derive needs secret or publicKey, one of them",
    );
    expect(() => computeSr25519({ operation: "derive", secret, chainCode, hard: "yes" })).toThrow(
      "hard must be a boolean",
    );
    expect(() =>
      computeSr25519({ operation: "derive", publicKey, chainCode, random: "00".repeat(32) }),
    ).toThrow("derive from publicKey does not take random");
    expect(() =>
      computeSr25519({ operation: "derive", secret, chainCode, hard: true, random: chainCode }),
    ).toThrow("A hard child takes no random");
    expect(() =>
      computeSr25519({ operation: "sign", secret, message: "x", context: "c".repeat(257) }),
    ).toThrow("context must be at most 256 characters");
  });
});
