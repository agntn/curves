import { existsSync } from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createMcpServer } from "../src/mcp.ts";
import { serverInfo } from "../src/server-info.ts";
import {
  computeBip340,
  computeCurve,
  computeEd25519,
  computeSecp256k1,
  computeSr25519,
} from "../src/tool-operations.ts";
import {
  nobleEdges as schnorrEdges,
  nobleSignatures as schnorrSignatures,
} from "./fixtures/bip340.ts";
import { highS, nobleEdges, nobleSignatures } from "./fixtures/ecdsa.ts";
import { rfc8032Keys, rfc8032Signatures, speccheck } from "./fixtures/ed25519.ts";
import { devAccounts, keyringPairs, scureVectors, subkeySeeds } from "./fixtures/sr25519.ts";
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
const { g, gUncompressed, twoG, threeG, minusG } = secp256k1Vectors;
const [signed] = nobleSignatures;
if (signed === undefined) throw new Error("The noble fixture lost its first signature");

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
      "curves_bip340_compute",
      "curves_sr25519_compute",
      "curves_ed25519_compute",
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
      total: "19",
      points: ["infinity", { x: "0", y: "6" }],
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

  it("names the argument that holds a point off the curve", async () => {
    const client = await connectTestClient();
    const refusal = async (name: string, args: Readonly<Record<string, unknown>>) =>
      failure(await client.callTool({ name, arguments: args }));
    const base = { x: "5", y: "1" };
    const offCurve = { x: "5", y: "2" };
    const notOnSecp256k1 = `02${"00".repeat(32)}`;

    expect(
      await refusal("curves_compute", { ...paar, operation: "add", point: base, other: offCurve }),
    ).toContain("other is not on the curve");
    expect(
      await refusal("curves_compute", { ...paar, operation: "log", point: offCurve, other: base }),
    ).toContain("point is not on the curve");
    expect(
      await refusal("curves_secp256k1_compute", {
        operation: "add",
        point: g,
        other: notOnSecp256k1,
      }),
    ).toContain("other is not a SEC1 point of secp256k1");
    expect(
      await refusal("curves_secp256k1_compute", {
        operation: "subtract",
        point: notOnSecp256k1,
        other: g,
      }),
    ).toContain("point is not a SEC1 point of secp256k1");
    expect(
      answer(
        await client.callTool({
          name: "curves_compute",
          arguments: { ...paar, operation: "check", point: offCurve },
        }),
      ),
    ).toEqual({ operation: "check", onCurve: false });
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

  it("verifies an ECDSA signature on secp256k1 and recovers the key behind it", async () => {
    const client = await connectTestClient();
    const call = async (args: Readonly<Record<string, unknown>>): Promise<unknown> =>
      answer(await client.callTool({ name: "curves_secp256k1_compute", arguments: args }));
    const refused = async (args: Readonly<Record<string, unknown>>): Promise<string> =>
      failure(await client.callTool({ name: "curves_secp256k1_compute", arguments: args }));
    const { digest, signature, recovery, publicKey } = signed;

    expect(await call({ operation: "verify", point: publicKey, digest, signature })).toEqual({
      operation: "verify",
      valid: true,
    });
    const high = { operation: "verify", point: publicKey, digest, signature: highS.signature };
    expect(await call(high)).toEqual({ operation: "verify", valid: true });
    expect(await call({ ...high, lowS: true })).toEqual({ operation: "verify", valid: false });
    expect(await call({ operation: "recover", digest, signature, recovery })).toEqual({
      operation: "recover",
      point: publicKey,
    });
    expect(await refused({ operation: "recover", digest, signature })).toContain(
      "recover needs recovery, from 0 to 3",
    );
    expect(await refused({ operation: "recover", digest, signature, recovery: 4 })).toContain(
      "Invalid arguments at /recovery",
    );
    expect(
      await refused({ operation: "verify", point: publicKey, digest, signature, recovery }),
    ).toContain("verify does not take recovery");
    expect(
      await refused({ operation: "verify", point: `02${"00".repeat(32)}`, digest, signature }),
    ).toContain("point is not a SEC1 point of secp256k1");
  });

  it("signs a digest with ECDSA on secp256k1, with the recovery id recover takes", async () => {
    const client = await connectTestClient();
    const call = async (args: Readonly<Record<string, unknown>>): Promise<unknown> =>
      answer(await client.callTool({ name: "curves_secp256k1_compute", arguments: args }));
    const refused = async (args: Readonly<Record<string, unknown>>): Promise<string> =>
      failure(await client.callTool({ name: "curves_secp256k1_compute", arguments: args }));
    const [edge] = nobleEdges;
    if (edge === undefined) throw new Error("The noble fixture lost its edges");
    const { secret, digest, signature, recovery, publicKey } = edge;

    const signedHere = { operation: "sign", signature, recovery, publicKey };
    expect(await call({ operation: "sign", secret, digest })).toEqual(signedHere);
    expect(await call({ operation: "sign", secret, digest, compressed: false })).toEqual({
      ...signedHere,
      publicKey: gUncompressed,
    });
    expect(await call({ operation: "recover", digest, signature, recovery })).toEqual({
      operation: "recover",
      point: publicKey,
    });
    expect(await refused({ operation: "sign", digest })).toContain("sign needs secret");
    expect(await refused({ operation: "sign", secret, digest, point: g })).toContain(
      "sign does not take point",
    );
    expect(await refused({ operation: "sign", secret: "0", digest })).toContain(
      "Secret must be hex without 0x or a bigint, from 1 to the curve order minus 1",
    );
  });

  it("derives an x-only key and signs by BIP340, fresh or repeatable", async () => {
    const client = await connectTestClient();
    const call = async (args: Readonly<Record<string, unknown>>): Promise<unknown> =>
      answer(await client.callTool({ name: "curves_bip340_compute", arguments: args }));
    const refused = async (args: Readonly<Record<string, unknown>>): Promise<string> =>
      failure(await client.callTool({ name: "curves_bip340_compute", arguments: args }));
    const [, oddKey] = schnorrEdges;
    if (oddKey === undefined) throw new Error("The BIP340 fixture lost its edges");
    const { secret, message, signature, publicKey } = oddKey;
    const random = "00".repeat(32);

    expect(await call({ operation: "keypair", secret })).toEqual({
      operation: "keypair",
      publicKey,
    });
    expect(await call({ operation: "sign", secret, message, random })).toEqual({
      operation: "sign",
      signature,
      publicKey,
    });
    const fresh = await call({ operation: "sign", secret, message });
    expect(fresh).toMatchObject({ operation: "sign", publicKey });
    expect(fresh).not.toMatchObject({ signature });
    const { signature: freshSignature } = fresh as { signature: string };
    expect(
      await call({ operation: "verify", publicKey, message, signature: freshSignature }),
    ).toEqual({ operation: "verify", valid: true });
    expect(await refused({ operation: "sign", secret })).toContain("sign needs message");
    expect(await refused({ operation: "keypair", secret, message })).toContain(
      "keypair does not take message",
    );
    expect(await refused({ operation: "sign", secret, message, random: "00" })).toContain(
      "Invalid arguments at /random",
    );
  });

  it("verifies a BIP340 signature, over an empty message too", async () => {
    const client = await connectTestClient();
    const call = async (args: Readonly<Record<string, unknown>>): Promise<unknown> =>
      answer(await client.callTool({ name: "curves_bip340_compute", arguments: args }));
    const refused = async (args: Readonly<Record<string, unknown>>): Promise<string> =>
      failure(await client.callTool({ name: "curves_bip340_compute", arguments: args }));
    const [first, , empty] = schnorrSignatures;
    if (first === undefined || empty === undefined) throw new Error("The BIP340 fixture shrank");
    const { message, signature, publicKey } = first;

    expect(await call({ operation: "verify", publicKey, message, signature })).toEqual({
      operation: "verify",
      valid: true,
    });
    const { valid: _valid, ...emptyMessage } = empty;
    expect(await call({ operation: "verify", ...emptyMessage })).toEqual({
      operation: "verify",
      valid: true,
    });
    expect(
      await call({ operation: "verify", publicKey: empty.publicKey, message, signature }),
    ).toEqual({ operation: "verify", valid: false });
    expect(await refused({ operation: "verify", publicKey, signature })).toContain(
      "verify needs message",
    );
    expect(await refused({ operation: "verify", publicKey, message: "abc", signature })).toContain(
      "Invalid arguments at /message",
    );
    expect(
      await refused({ operation: "verify", publicKey: `02${publicKey}`, message, signature }),
    ).toContain("Invalid arguments at /publicKey");
  });

  it("verifies an Ed25519 signature under ZIP 215, or the strict rules on request", async () => {
    const client = await connectTestClient();
    const call = async (args: Readonly<Record<string, unknown>>): Promise<unknown> =>
      answer(await client.callTool({ name: "curves_ed25519_compute", arguments: args }));
    const refused = async (args: Readonly<Record<string, unknown>>): Promise<string> =>
      failure(await client.callTool({ name: "curves_ed25519_compute", arguments: args }));
    const [empty] = rfc8032Signatures;
    const [smallOrder] = speccheck;
    if (empty === undefined || smallOrder === undefined) throw new Error("A fixture shrank");
    const { message, signature, publicKey } = smallOrder;

    const rfc = { publicKey: empty.publicKey, message: empty.message, signature: empty.signature };
    expect(await call({ operation: "verify", ...rfc })).toEqual({
      operation: "verify",
      valid: true,
    });
    expect(await call({ operation: "verify", publicKey, message, signature })).toEqual({
      operation: "verify",
      valid: true,
    });
    expect(
      await call({ operation: "verify", publicKey, message, signature, zip215: false }),
    ).toEqual({ operation: "verify", valid: false });
    expect(await refused({ operation: "verify", publicKey, signature })).toContain(
      "verify needs message",
    );
    expect(
      await refused({ operation: "verify", publicKey, message, signature, zip215: "no" }),
    ).toContain("Invalid arguments at /zip215");
    expect(
      await refused({ operation: "verify", publicKey: `00${publicKey}`, message, signature }),
    ).toContain("Invalid arguments at /publicKey");
  });

  it("derives an Ed25519 key and signs RFC 8032 test 2 byte for byte", async () => {
    const client = await connectTestClient();
    const call = async (args: Readonly<Record<string, unknown>>): Promise<unknown> =>
      answer(await client.callTool({ name: "curves_ed25519_compute", arguments: args }));
    const refused = async (args: Readonly<Record<string, unknown>>): Promise<string> =>
      failure(await client.callTool({ name: "curves_ed25519_compute", arguments: args }));
    const [, keys] = rfc8032Keys;
    const [, test2] = rfc8032Signatures;
    if (keys === undefined || test2 === undefined)
      throw new Error("The RFC 8032 fixture lost test 2");
    const [secret, publicKey] = keys;
    const { message, signature } = test2;

    expect(await call({ operation: "keypair", secret })).toEqual({
      operation: "keypair",
      publicKey,
    });
    expect(await call({ operation: "sign", secret, message })).toEqual({
      operation: "sign",
      signature,
      publicKey,
    });
    expect(await refused({ operation: "sign", secret })).toContain("sign needs message");
    expect(await refused({ operation: "keypair", secret: `${secret}${publicKey}` })).toContain(
      "Invalid arguments at /secret",
    );
    expect(await refused({ operation: "sign", secret, message, publicKey })).toContain(
      "sign does not take publicKey",
    );
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
      publicKey: scureVectors.hardPublic,
    });
    const alice = "14416c696365".padEnd(64, "0");
    expect(
      await call({ operation: "derive", seed: devAccounts.seed, chainCode: alice, hard: true }),
    ).toEqual({
      operation: "derive",
      hard: true,
      seed: subkeySeeds.alice,
      secret: keyringPairs.alice.secret,
      publicKey: devAccounts.alice,
    });
    expect(await call({ operation: "derive", seed, chainCode, random })).toEqual({
      operation: "derive",
      hard: false,
      secret: scureVectors.soft,
      publicKey: scureVectors.softPublic,
    });
    expect(
      failure(
        await client.callTool({
          name: "curves_sr25519_compute",
          arguments: { operation: "derive", publicKey: devAccounts.alice, chainCode, hard: true },
        }),
      ),
    ).toContain("A hard child needs the seed or the secret, not the public key");
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

  it("list infinity with the points, so order 1 has its point and total matches count", () => {
    const count = computeCurve({ operation: "count", ...paar }).details;
    const all = computeCurve({ operation: "points", ...paar }).details;

    expect(count).toEqual({ operation: "count", count: "19" });
    expect(all).toMatchObject({ total: "19", truncated: false });
    expect(all.operation === "points" && all.points[0]).toBe("infinity");
    expect(computeCurve({ operation: "points", ...paar, order: "1" }).details).toEqual({
      operation: "points",
      total: "1",
      points: ["infinity"],
      truncated: false,
    });
    expect(computeCurve({ operation: "points", ...paar, order: "19", limit: 1 }).details).toEqual({
      operation: "points",
      total: "18",
      points: [{ x: "0", y: "6" }],
      truncated: true,
    });
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
    expect(() => computeSecp256k1({ operation: "sign", secret: "", digest: "00" })).toThrow(
      "sign needs secret",
    );
    expect(() => computeSecp256k1({ operation: "check", point: g, compressed: false })).toThrow(
      "check does not take compressed",
    );
    expect(() => computeSecp256k1({ operation: "negate", point: g, compressed: "yes" })).toThrow(
      "Compressed must be a boolean",
    );
  });
});

describe("BIP340 executor", () => {
  const [signedMessage] = schnorrSignatures;
  if (signedMessage === undefined) throw new Error("The BIP340 fixture lost its first signature");
  const { message, signature, publicKey } = signedMessage;

  it("reads a blank random as fresh bytes and a blank secret as missing", () => {
    const [edge] = schnorrEdges;
    if (edge === undefined) throw new Error("The BIP340 fixture lost its edges");
    const { secret } = edge;
    const fresh = computeBip340({ operation: "sign", secret, message, random: "" }).details;
    if (fresh.operation !== "sign") throw new Error("sign answered another operation");
    const check = { operation: "verify", publicKey: fresh.publicKey, message };
    expect(computeBip340({ ...check, signature: fresh.signature }).details).toEqual({
      operation: "verify",
      valid: true,
    });
    expect(() => computeBip340({ operation: "sign", secret: "", message })).toThrow(
      "sign needs secret",
    );
  });

  it("reads a blank message as the empty one and a blank key as missing", () => {
    const empty = { operation: "verify", publicKey, message: "", signature };
    expect(computeBip340(empty).details).toEqual({ operation: "verify", valid: false });
    expect(() => computeBip340({ operation: "verify", publicKey: "", message, signature })).toThrow(
      "verify needs publicKey",
    );
    expect(() => computeBip340({ operation: "verify", publicKey, message })).toThrow(
      "verify needs signature",
    );
  });

  it("guards the contract even when a host skips schema validation", () => {
    const call = { operation: "verify", publicKey, message, signature };
    expect(() => computeBip340({ ...call, operation: "recover" })).toThrow(
      "operation must be one of keypair, sign, verify",
    );
    expect(() => computeBip340({ ...call, message: 7 })).toThrow("message must be a string");
    expect(() => computeBip340({ ...call, message: "00".repeat(4097) })).toThrow(
      "message must be at most 8192 characters",
    );
    expect(() => computeBip340({ ...call, message: "0x00" })).toThrow(
      "Message must be hex without 0x",
    );
  });
});

describe("Ed25519 executor", () => {
  const [signed] = rfc8032Signatures;
  if (signed === undefined) throw new Error("The RFC 8032 fixture lost test 1");
  const { publicKey, message, signature } = signed;
  const call = { operation: "verify", publicKey, message, signature };

  it("reads a blank message as the empty one, and a null zip215 as the default", () => {
    expect(computeEd25519({ ...call, message: "" }).details).toEqual({
      operation: "verify",
      valid: true,
    });
    const [smallOrder] = speccheck;
    if (smallOrder === undefined) throw new Error("The speccheck fixture lost case 0");
    const order8 = {
      operation: "verify",
      publicKey: smallOrder.publicKey,
      message: smallOrder.message,
      signature: smallOrder.signature,
    };
    expect(computeEd25519({ ...order8, zip215: null }).details).toEqual({
      operation: "verify",
      valid: true,
    });
    expect(computeEd25519({ ...order8, zip215: false }).details).toEqual({
      operation: "verify",
      valid: false,
    });
    expect(() => computeEd25519({ ...call, publicKey: "" })).toThrow("verify needs publicKey");
  });

  it("guards the contract even when a host skips schema validation", () => {
    expect(() => computeEd25519({ ...call, operation: "derive" })).toThrow(
      "operation must be one of keypair, sign, verify",
    );
    expect(() => computeEd25519({ ...call, zip215: "false" })).toThrow("zip215 must be a boolean");
    expect(() => computeEd25519({ ...call, message: "00".repeat(4097) })).toThrow(
      "message must be at most 8192 characters",
    );
    expect(() => computeEd25519({ ...call, message: "0x00" })).toThrow(
      "Message must be hex without 0x",
    );
  });
});

describe("Ed25519 signing executor", () => {
  const [keys] = rfc8032Keys;
  const [empty] = rfc8032Signatures;
  if (keys === undefined || empty === undefined)
    throw new Error("The RFC 8032 fixture lost test 1");
  const [secret, publicKey] = keys;

  it("signs a blank message as the empty one and hands back the key", () => {
    expect(computeEd25519({ operation: "sign", secret, message: "" }).details).toEqual({
      operation: "sign",
      signature: empty.signature,
      publicKey,
    });
    expect(computeEd25519({ operation: "keypair", secret }).details).toEqual({
      operation: "keypair",
      publicKey,
    });
  });

  it("refuses what keypair and sign don't take, in the caller's words", () => {
    expect(() => computeEd25519({ operation: "keypair" })).toThrow("keypair needs secret");
    expect(() => computeEd25519({ operation: "sign", message: "" })).toThrow("sign needs secret");
    expect(() => computeEd25519({ operation: "keypair", secret, message: "00" })).toThrow(
      "keypair does not take message",
    );
    expect(() => computeEd25519({ operation: "sign", secret, message: "", zip215: false })).toThrow(
      "sign does not take zip215",
    );
    expect(() => computeEd25519({ operation: "verify", ...empty, secret })).toThrow(
      "verify does not take secret",
    );
    expect(() => computeEd25519({ operation: "sign", secret: 7, message: "" })).toThrow(
      "secret must be a string",
    );
    expect(() => computeEd25519({ operation: "sign", secret: "00", message: "" })).toThrow(
      "Secret must be 64 hex digits without 0x, the 32 bytes RFC 8032 hashes",
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
    const derive = { operation: "derive", seed: "", secret, publicKey: "", chainCode, hard: true };
    expect(computeSr25519(derive).details).toEqual({
      operation: "derive",
      hard: true,
      secret: scureVectors.hard,
      publicKey: scureVectors.hardPublic,
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
    for (const keys of [{}, { seed, secret }, { secret, publicKey }, { seed, publicKey }]) {
      expect(() => computeSr25519({ operation: "derive", ...keys, chainCode })).toThrow(
        "derive needs seed, secret or publicKey, one of them",
      );
    }
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
      computeSr25519({ operation: "derive", seed, chainCode, hard: true, random: chainCode }),
    ).toThrow("A hard child takes no random");
    expect(() =>
      computeSr25519({ operation: "sign", secret, message: "x", context: "c".repeat(257) }),
    ).toThrow("context must be at most 256 characters");
  });
});
