import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vite-plus/test";
import pkg from "../package.json" with { type: "json" };
import { serverInfo } from "../src/server-info.ts";
import {
  nobleEdges as schnorrEdges,
  nobleSignatures as schnorrSignatures,
} from "./fixtures/bip340.ts";
import { highS, nobleEdges, nobleSignatures } from "./fixtures/ecdsa.ts";
import { rfc8032Keys, rfc8032Signatures, speccheck } from "./fixtures/ed25519.ts";
import { p256Rfc6979 } from "./fixtures/p256.ts";
import { p384Rfc6979 } from "./fixtures/p384.ts";
import { p521Rfc6979, p521Vectors } from "./fixtures/p521.ts";
import { brainpoolP256r1Signature, brainpoolP256r1Vectors } from "./fixtures/brainpoolp256r1.ts";
import { brainpoolP384r1Signature, brainpoolP384r1Vectors } from "./fixtures/brainpoolp384r1.ts";

const [signed] = nobleSignatures;
if (signed === undefined) throw new Error("The noble fixture lost its first signature");

const switches = new Set([
  "CI",
  "FORCE_COLOR",
  "NO_COLOR",
  "NODE_DISABLE_COLORS",
  "CURVES_DIST",
  "TEST",
]);
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !switches.has(key))),
  TERM: "xterm-256color",
};

function run(...args: readonly string[]) {
  const { status, stderr, stdout } = spawnSync(process.execPath, ["src/cli.ts", ...args], {
    encoding: "utf8",
    env,
  });
  return { code: status, stderr, stdout };
}

describe("curves CLI", () => {
  it("prints the usage and its errors without colors into a pipe", () => {
    const help = run("--help");
    const usage = run("compute", "--help");
    const unknown = run("nope");

    expect(help.stdout).toContain("USAGE curves <command> [OPTIONS]");
    expect(help.stdout).toMatch(/^ {2}secp256k1 {8}Point math/m);
    expect(help.stdout).toMatch(/^ {2}bip340 {11}BIP340 Schnorr keys and signatures/m);
    expect(help.stdout).toMatch(/^ {2}p256 {13}Point math on NIST P-256/m);
    expect(help.stdout).toMatch(/^ {2}p384 {13}Point math on NIST P-384/m);
    expect(help.stdout).toMatch(/^ {2}p521 {13}Point math on NIST P-521/m);
    expect(help.stdout).toMatch(/^ {2}brainpoolp256r1 {2}Point math on brainpoolP256r1/m);
    expect(help.stdout).toMatch(/^ {2}brainpoolp384r1 {2}Point math on brainpoolP384r1/m);
    expect(help.stdout).toMatch(/^ {2}sr25519 {10}sr25519 keys/m);
    expect(help.stdout).toMatch(/^ {2}ed25519 {10}Ed25519 keys and signatures/m);
    expect(usage.stdout).toContain("USAGE curves compute [OPTIONS] <OPERATION>");
    expect(unknown).toMatchObject({
      code: 1,
      stderr: 'Unknown command "nope"\nRun curves --help for the commands\n',
    });
    for (const output of [help, usage, unknown]) {
      expect(output.stdout + output.stderr).not.toContain("\u001B");
    }
  });

  it("computes with the executors the tools use", () => {
    const paar = ["--a", "2", "--b", "2", "--p", "17"];
    const point = ["--point", '{"x":"5","y":"1"}'];
    expect(run("compute", "multiply", ...paar, ...point, "--scalar", "2")).toMatchObject({
      code: 0,
      stderr: "",
      stdout: '{"operation":"multiply","point":{"x":"6","y":"3"}}\n',
    });
    const count = '{\n  "operation": "count",\n  "count": "106"\n}\n';
    for (const a of [["--a", "-3"], ["--a=-3"], ["--a", "98"]]) {
      expect(run("compute", "count", ...a, "--b", "5", "--p", "101", "--json")).toMatchObject({
        code: 0,
        stdout: count,
      });
    }

    const g = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
    const negated = run("secp256k1", "negate", "--point", g, "--no-compressed", "--json");
    expect(negated).toMatchObject({ code: 0, stderr: "" });
    expect(JSON.parse(negated.stdout)).toEqual({
      operation: "negate",
      point:
        "0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" +
        "b7c52588d95c3b9aa25b0403f1eef75702e84bb7597aabe663b82f6f04ef2777",
    });
  });

  it("verifies an ECDSA signature and recovers its key from flags", () => {
    const { digest, signature, recovery, publicKey } = signed;
    const signedDigest = ["--digest", digest, "--signature", signature];
    expect(run("secp256k1", "verify", "--point", publicKey, ...signedDigest)).toMatchObject({
      code: 0,
      stdout: '{"operation":"verify","valid":true}\n',
    });
    const high = ["--point", publicKey, "--digest", digest, "--signature", highS.signature];
    expect(run("secp256k1", "verify", ...high, "--low-s")).toMatchObject({
      code: 0,
      stdout: '{"operation":"verify","valid":false}\n',
    });
    expect(
      run("secp256k1", "recover", ...signedDigest, "--recovery", String(recovery)),
    ).toMatchObject({ code: 0, stdout: `{"operation":"recover","point":"${publicKey}"}\n` });
    expect(run("secp256k1", "recover", ...signedDigest, "--recovery", "2")).toMatchObject({
      code: 1,
      stderr: "No point of secp256k1 has x = r + n, so recovery 2 fails\n",
    });
  });

  it("verifies RFC 6979's P-256 signature from flags and names the curve in a refusal", () => {
    const { publicKey, signatures } = p256Rfc6979;
    const [{ signature }] = signatures;
    const digest = "af2bdbe1aa9b6ec1e2ade1d694f41fc71a831d0268e9891562113d8a62add1bf";
    const flags = ["--point", publicKey, "--digest", digest, "--signature", signature];
    expect(run("p256", "verify", ...flags)).toMatchObject({
      code: 0,
      stdout: '{"operation":"verify","valid":true}\n',
    });
    expect(run("p256", "lift", "--x", "01".padStart(64, "0"))).toMatchObject({
      code: 1,
      stderr: "No point of P-256 has this x\n",
    });
  });

  it("verifies RFC 6979's P-384 signature over SHA-384 and wants 96 hex digits of x", () => {
    const { publicKey, signatures } = p384Rfc6979;
    const [, { signature }] = signatures;
    const digest =
      "9a9083505bc92276aec4be312696ef7bf3bf603f4bbd381196a029f340585312313bca4a9b5b890efee42c77b1ee25fe";
    const flags = ["--point", publicKey, "--digest", digest, "--signature", signature];
    expect(run("p384", "verify", ...flags)).toMatchObject({
      code: 0,
      stdout: '{"operation":"verify","valid":true}\n',
    });
    expect(run("p384", "lift", "--x", "01".padStart(96, "0"))).toMatchObject({
      code: 1,
      stderr: "No point of P-384 has this x\n",
    });
  });

  it("verifies RFC 6979's P-521 signature over SHA-512 and wants 132 hex digits of x", () => {
    const { publicKey, signatures } = p521Rfc6979;
    const { signature } = signatures[5];
    const digest =
      "ee26b0dd4af7e749aa1a8ee3c10ae9923f618980772e473f8819a5d4940e0db27ac185f8a0e1d5f84f88bc887fd67b143732c304cc5fa9ad8e6f57f50028a8ff";
    const flags = ["--point", publicKey, "--digest", digest, "--signature", signature];
    expect(run("p521", "verify", ...flags)).toMatchObject({
      code: 0,
      stdout: '{"operation":"verify","valid":true}\n',
    });
    expect(run("p521", "lift", "--x", p521Vectors.xWithoutPoint)).toMatchObject({
      code: 1,
      stderr: "No point of P-521 has this x\n",
    });
    expect(run("p521", "lift", "--x", "03".padStart(96, "0")).code).toBe(1);
  });

  it("verifies Wycheproof's brainpoolP256r1 signature and finds no point at x = 0", () => {
    const { publicKey, digest, signature } = brainpoolP256r1Signature;
    const flags = ["--point", publicKey, "--digest", digest, "--signature", signature];
    expect(run("brainpoolp256r1", "verify", ...flags)).toMatchObject({
      code: 0,
      stdout: '{"operation":"verify","valid":true}\n',
    });
    expect(
      run("brainpoolp256r1", "lift", "--x", brainpoolP256r1Vectors.xWithoutPoint),
    ).toMatchObject({ code: 1, stderr: "No point of brainpoolP256r1 has this x\n" });
  });

  it("verifies Wycheproof's brainpoolP384r1 signature and finds no point at x = 0", () => {
    const { publicKey, digest, signature } = brainpoolP384r1Signature;
    const flags = ["--point", publicKey, "--digest", digest, "--signature", signature];
    expect(run("brainpoolp384r1", "verify", ...flags)).toMatchObject({
      code: 0,
      stdout: '{"operation":"verify","valid":true}\n',
    });
    expect(
      run("brainpoolp384r1", "lift", "--x", brainpoolP384r1Vectors.xWithoutPoint),
    ).toMatchObject({ code: 1, stderr: "No point of brainpoolP384r1 has this x\n" });
  });

  it("signs a digest with ECDSA from flags, the way @noble/curves 2.4.0 did", () => {
    for (const { secret, digest, signature, recovery, publicKey } of nobleEdges) {
      expect(
        run("secp256k1", "sign", "--secret", secret, "--digest", digest),
        digest,
      ).toMatchObject({
        code: 0,
        stdout: `{"operation":"sign","signature":"${signature}","recovery":${recovery},"publicKey":"${publicKey}"}\n`,
      });
    }
  });

  it("derives an x-only key and signs by BIP340 from flags, with aux_rand fixed", () => {
    for (const { secret, message, signature, publicKey } of schnorrEdges) {
      expect(run("bip340", "keypair", "--secret", secret)).toMatchObject({
        code: 0,
        stdout: `{"operation":"keypair","publicKey":"${publicKey}"}\n`,
      });
      const flags = ["--secret", secret, "--message", message, "--random", "00".repeat(32)];
      expect(run("bip340", "sign", ...flags), message).toMatchObject({
        code: 0,
        stdout: `{"operation":"sign","signature":"${signature}","publicKey":"${publicKey}"}\n`,
      });
    }
  });

  it("verifies a BIP340 signature from flags, over no bytes too", () => {
    for (const { message, signature, publicKey } of schnorrSignatures.slice(0, 3)) {
      const flags = ["--public-key", publicKey, "--message", message, "--signature", signature];
      expect(run("bip340", "verify", ...flags), message).toMatchObject({
        code: 0,
        stdout: '{"operation":"verify","valid":true}\n',
      });
    }
  });

  it("verifies an Ed25519 signature from flags, and --no-zip215 turns the rules strict", () => {
    for (const { message, signature, publicKey } of rfc8032Signatures.slice(0, 3)) {
      const flags = ["--public-key", publicKey, "--message", message, "--signature", signature];
      expect(run("ed25519", "verify", ...flags), message).toMatchObject({
        code: 0,
        stdout: '{"operation":"verify","valid":true}\n',
      });
    }
    const [smallOrder] = speccheck;
    if (smallOrder === undefined) throw new Error("The speccheck fixture lost case 0");
    const { message, signature, publicKey } = smallOrder;
    const flags = ["--public-key", publicKey, "--message", message, "--signature", signature];
    expect(run("ed25519", "verify", ...flags).stdout).toBe('{"operation":"verify","valid":true}\n');
    expect(run("ed25519", "verify", ...flags, "--no-zip215").stdout).toBe(
      '{"operation":"verify","valid":false}\n',
    );
  });

  it("signs RFC 8032 test 3 from flags and derives its key", () => {
    const [, , keys] = rfc8032Keys;
    const [, , test3] = rfc8032Signatures;
    if (keys === undefined || test3 === undefined)
      throw new Error("The RFC 8032 fixture lost test 3");
    const [secret, publicKey] = keys;
    const { message, signature } = test3;
    expect(run("ed25519", "keypair", "--secret", secret)).toMatchObject({
      code: 0,
      stdout: `{"operation":"keypair","publicKey":"${publicKey}"}\n`,
    });
    expect(run("ed25519", "sign", "--secret", secret, "--message", message)).toMatchObject({
      code: 0,
      stdout: `{"operation":"sign","signature":"${signature}","publicKey":"${publicKey}"}\n`,
    });
  });

  it("makes an sr25519 key pair and verifies a hex message", () => {
    const seed = "fac7959dbfe72f052e5a0c3c8d6530f202b02fd8f9f5ca3580ec8deb7797479e";
    const keypair = run("sr25519", "keypair", "--seed", seed, "--json");
    expect(keypair).toMatchObject({ code: 0, stderr: "" });
    const { secret, publicKey } = JSON.parse(keypair.stdout) as Record<string, string>;
    expect(publicKey).toBe("46ebddef8cd9bb167dc30878d7113b7e168e6f0646beffd77d69d39bad76b47a");
    const signed = run("sr25519", "sign", "--secret", secret ?? "", "--message", "c0ffee");
    const { signature } = JSON.parse(signed.stdout) as Record<string, string>;
    const verify = ["--public-key", publicKey ?? "", "--signature", signature ?? ""];
    expect(run("sr25519", "verify", ...verify, "--message", "c0ffee")).toMatchObject({
      code: 0,
      stdout: '{"operation":"verify","valid":true}\n',
    });
    expect(
      run("sr25519", "verify", ...verify, "--message", "c0ffee", "--encoding", "hex"),
    ).toMatchObject({ code: 0, stdout: '{"operation":"verify","valid":false}\n' });
  });

  it("prints a refusal of the library as one line with exit code 1", () => {
    expect(run("compute", "count", "--a", "0", "--b", "0", "--p", "17")).toMatchObject({
      code: 1,
      stdout: "",
      stderr: "The curve is singular: 4a^3 + 27b^2 is 0 mod p\n",
    });
    const paar = ["--a", "2", "--b", "2", "--p", "17"];
    expect(run("compute", "double", ...paar, "--point", "5,1")).toMatchObject({
      code: 1,
      stderr: "Invalid arguments at --point: must be JSON\n",
    });
  });

  it("refuses an option the command doesn't take in one line", () => {
    const takes = "takes --a, --b, --p, --point, --other, --scalar, --x, --order, --limit, --json";

    expect(run("-_8")).toMatchObject({
      code: 1,
      stdout: "",
      stderr: 'Unknown command "-_8"\nRun curves --help for the commands\n',
    });
    expect(run("compute", "--nmae", "x")).toMatchObject({
      code: 1,
      stdout: "",
      stderr: `Invalid arguments: unknown option "--nmae"; ${takes}\n`,
    });
    expect(run("compute", "add", "--version")).toMatchObject({
      code: 1,
      stdout: "",
      stderr: `Invalid arguments: unknown option "--version"; ${takes}\n`,
    });
    expect(run("compute", "add", "-hh")).toMatchObject({
      code: 1,
      stderr: `Invalid arguments: unknown option "-hh"; ${takes}\n`,
    });
    expect(run("mcp", "--stdio")).toMatchObject({
      code: 1,
      stdout: "",
      stderr: 'Invalid arguments: unknown option "--stdio"; takes no options\n',
    });
    expect(run("--version")).toMatchObject({ code: 0, stdout: `${pkg.version}\n` });
  });
});

const root = fileURLToPath(new URL("..", import.meta.url));

/* Writes the module URLs the child loaded to `file` on exit; stderr cuts them at about 146 KB. */
function recordLoads(file: string) {
  return `data:text/javascript,${encodeURIComponent(`
  import { writeFileSync } from "node:fs";
  import { registerHooks } from "node:module";
  const loaded = [];
  registerHooks({
    load(url, context, nextLoad) {
      loaded.push(url);
      return nextLoad(url, context);
    },
  });
  process.on("exit", () => writeFileSync(${JSON.stringify(file)}, JSON.stringify(loaded)));
`)}`;
}

const initialize = `${JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "curves-test", version: "1.0.0" },
  },
})}\n`;

/**
 * Runs `mcp` from a built bin, answers one initialize request and tells where the server came
 * from. stdin closes after the request, so the server exits on its own.
 * @param base - Package root the bin sits in.
 * @param extraEnv - Environment on top of the shared one.
 * @returns {{ code: number | null, from: string, info: unknown, stderr: string }} The exit code,
 * where the server came from, the `serverInfo` of the reply and stderr.
 */
function serve(base: string, extraEnv: Readonly<Record<string, string>> = {}) {
  const record = mkdtempSync(join(tmpdir(), "curves-loaded-"));
  const file = join(record, "loaded.json");
  let child;
  let loaded: unknown = [];
  try {
    child = spawnSync(
      process.execPath,
      ["--import", recordLoads(file), join(base, "dist/cli.mjs"), "mcp"],
      { encoding: "utf8", env: { ...env, ...extraEnv }, input: initialize, timeout: 20_000 },
    );
    if (existsSync(file)) loaded = JSON.parse(readFileSync(file, "utf8"));
  } finally {
    rmSync(record, { recursive: true, force: true });
  }
  const { status, stderr, stdout } = child;
  const urls = Array.isArray(loaded) ? loaded.filter((url) => typeof url === "string") : [];
  const source = urls.includes(pathToFileURL(join(base, "src/mcp.ts")).href);
  const bundle = urls.some((url) => url.endsWith("/node_modules/@agntn/tools/dist/mcp.mjs"));
  let from: "bundle" | "source" | "unknown" = "unknown";
  if (source) from = "source";
  else if (bundle) from = "bundle";
  const [line = "{}"] = stdout.split("\n");
  const reply = JSON.parse(line) as { result?: { serverInfo?: unknown } };
  return { code: status, from, info: reply.result?.serverInfo, stderr };
}

/**
 * A run that answered the initialize request.
 * @param from - Where the server has to come from.
 * @returns {{ code: number, from: string, info: object }} The fields `serve` has to match.
 */
function served(from: "bundle" | "source") {
  return { code: 0, from, info: serverInfo };
}

const refused = {
  isError: true,
  content: [
    { type: "text", text: "src/ changed under this server, restart it to load the new code" },
  ],
};

/**
 * Starts `mcp` from the built bin of a checkout copy and connects a client to it.
 * @param patch - Rewrites files under `src/`, keyed by name, before the server starts.
 * @param reuse - A copy made by an earlier call, served again as it stands.
 * @returns {Promise<{ checkout: string, client: Client }>} The copy and the connected client.
 */
async function checkoutServer(
  patch: Readonly<Record<string, (source: string) => string>> = {},
  reuse?: string,
) {
  const checkout = reuse ?? mkdtempSync(join(tmpdir(), "curves-cli-"));
  if (reuse === undefined) {
    for (const entry of ["dist", "src", "package.json"]) {
      cpSync(join(root, entry), join(checkout, entry), { recursive: true });
    }
    symlinkSync(join(root, "node_modules"), join(checkout, "node_modules"), "dir");
  }
  for (const [file, rewrite] of Object.entries(patch)) {
    const path = join(checkout, "src", file);
    writeFileSync(path, rewrite(readFileSync(path, "utf8")));
  }
  const client = new Client({ name: "curves-test", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [join(checkout, "dist/cli.mjs"), "mcp"],
      env,
      stderr: "ignore",
    }),
  );
  return { checkout, client };
}

describe.skipIf(!existsSync(join(root, "dist/cli.mjs")))("curves mcp from the built bin", () => {
  it("serves the live source inside a checkout", () => {
    expect(serve(root)).toMatchObject(served("source"));
  });

  it("keeps the bundle under CURVES_DIST=1", () => {
    expect(serve(root, { CURVES_DIST: "1" })).toMatchObject(served("bundle"));
  });

  it("keeps the bundle when the package sits under node_modules", () => {
    // Node refuses to strip types there, so a copy that ships `src` still takes the bundle.
    const cache = join(root, "node_modules/.cache");
    mkdirSync(cache, { recursive: true });
    const nested = mkdtempSync(join(cache, "curves-cli-"));
    try {
      for (const entry of ["dist", "src", "package.json"]) {
        cpSync(join(root, entry), join(nested, entry), { recursive: true });
      }
      expect(serve(nested)).toMatchObject(served("bundle"));
    } finally {
      rmSync(nested, { recursive: true, force: true });
    }
  });

  it("keeps the bundle in a package that ships no src", () => {
    const packaged = mkdtempSync(join(tmpdir(), "curves-cli-"));
    try {
      for (const entry of ["dist", "extensions", "package.json"]) {
        cpSync(join(root, entry), join(packaged, entry), { recursive: true });
      }
      symlinkSync(join(root, "node_modules"), join(packaged, "node_modules"), "dir");
      expect(serve(packaged)).toMatchObject(served("bundle"));
    } finally {
      rmSync(packaged, { recursive: true, force: true });
    }
  });

  it("refuses a call after a pull instead of mixing old and new modules", async () => {
    const { checkout, client } = await checkoutServer();
    try {
      await client.listTools();
      /** The incident in keys: a loaded module gains an export, a lazy one starts importing it. */
      const contract = join(checkout, "src/tool-contract.ts");
      const operations = join(checkout, "src/tool-operations.ts");
      writeFileSync(contract, `${readFileSync(contract, "utf8")}export const ADDED = 1;\n`);
      writeFileSync(
        operations,
        readFileSync(operations, "utf8").replace(
          "  SECP256K1_OPERATIONS,\n",
          "  SECP256K1_OPERATIONS,\n  ADDED,\n",
        ),
      );

      /** A tool or a schema the pull brought in is news to the old server too. */
      for (const [name, args] of [
        ["curves_compute", { operation: "count", a: "2", b: "2", p: "17" }],
        ["curves_compute", { operation: "count", a: "2" }],
        ["curves_added", {}],
      ] as const) {
        expect(await client.callTool({ name, arguments: args })).toMatchObject(refused);
      }
    } finally {
      await client.close();
      rmSync(checkout, { recursive: true, force: true });
    }
  });

  it("refuses calls when a pull lands while src/ is still loading", async () => {
    /** A module of the static graph writes into `src/` as it loads, the way a pull would. */
    const { checkout, client } = await checkoutServer({
      "server-info.ts": (info) =>
        `import { writeFileSync } from "node:fs";\n` +
        `writeFileSync(new URL("./pulled.ts", import.meta.url), "export {};\\n");\n${info}`,
    });
    try {
      expect(
        await client.callTool({
          name: "curves_compute",
          arguments: { operation: "count", a: "2", b: "2", p: "17" },
        }),
      ).toMatchObject(refused);
    } finally {
      await client.close();
      rmSync(checkout, { recursive: true, force: true });
    }
  });

  it("refuses whatever a call returns once a pull lands mid-call", async () => {
    /** The executor writes into `src/` on every call, and p = 13 makes it throw. */
    const { checkout, client } = await checkoutServer({
      "tool-operations.ts": (operations) =>
        `import { writeFileSync } from "node:fs";\n${operations.replace(
          '  const operation = oneOf(args["operation"], "operation", CURVE_OPERATIONS);',
          `  writeFileSync(new URL(\`./pulled-\${String(args["p"])}.ts\`, import.meta.url), "export {};\\n");
  if (args["p"] === "13") throw new Error("boom");
  const operation = oneOf(args["operation"], "operation", CURVE_OPERATIONS);`,
        )}`,
    });
    try {
      /** A lazy import may mix pulled and cached modules, so even a success is refused. */
      expect(
        await client.callTool({
          name: "curves_compute",
          arguments: { operation: "count", a: "2", b: "2", p: "17" },
        }),
      ).toMatchObject(refused);

      const fresh = await checkoutServer({}, checkout);
      try {
        expect(
          await fresh.client.callTool({
            name: "curves_compute",
            arguments: { operation: "count", a: "2", b: "2", p: "13" },
          }),
        ).toMatchObject(refused);
      } finally {
        await fresh.client.close();
      }
    } finally {
      await client.close();
      rmSync(checkout, { recursive: true, force: true });
    }
  });
});
