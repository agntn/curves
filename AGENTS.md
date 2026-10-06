# AGENTS.md

Keep AGENTS.md updated with project status.

`@agntn/curves` does arithmetic on elliptic curves: short Weierstrass curves over a prime field the caller defines (points, orders, counts, discrete logs), and secp256k1 with SEC1 points and scalars mod n. A library, the `curves` CLI, an MCP server, Pi and OMP extensions and AI SDK tools. Docs at curves.agntn.dev, from `docs/` (see `docs/AGENTS.md`).

## Domain

- Everything is written here: the generic curve code moved from `@agntn/keys` (`src/utils/curve/`, `keys_curve_compute`), secp256k1 from SEC 2 v2 section 2.4.1 and the SEC1 encodings from SEC 1 v2 sections 2.3.3 and 2.3.4. No `@noble/curves`, by design. Nothing runs in constant time, and the README says the package is not audited.
- `src/core/field.ts` holds mod, power, inverse, the integer square root, Baillie-PSW `isPrime` and trial division `primeFactors`. `src/core/arithmetic.ts` holds affine arithmetic on any curve; `defineCurve` checks p and the discriminant once and remembers the frozen result in a `WeakSet`, so a curve from it is not checked again. `src/core/group.ts` counts and lists points one x at a time, finds orders by baby step giant step over the Hasse interval and logs the same way.
- The limits live in `src/core/limits.ts`, a module without imports, so `src/tools.ts` names them without loading the arithmetic: counting and listing up to p = 2^20, listing by order up to 2^16, orders up to 2^48, logs for a base of order up to 2^36.
- `src/core/secp256k1.ts` multiplies in Jacobian coordinates (dbl-2009-l, and the general addition), one inversion per result. Points are SEC1 hex and the point at infinity is refused, as keys did. Messages match the ones keys threw (`Invalid SEC1 secp256k1 public key`, the scalar ranges), so keys can re-export these functions without changing its tests. On 2026-10-06 it agreed with `@noble/curves` 2.4.0 on 2400 random cases; one generator multiply took 0.90 ms against noble's 0.36 ms, without precomputed tables.
- Entries: the root has the generic curve code, `@agntn/curves/secp256k1` has secp256k1 only. `test/index.test.ts` pins the names of both.
- Test vectors: Paar and Pelzl's curve over F17, a curve over F23, brute force oracles for counts and orders, a 40-bit order and a 32-bit log, and secp256k1 multiples frozen from `@noble/curves` 2.4.0 in `test/fixtures/vectors.ts`. The secp256k1 code is also held to the affine code over the same parameters.

## Status

- Node.js 26 is the minimum and the only version CI tests and releases on.
- Not published yet. Trusted publishing needs the package on npm first, so the first release goes out by hand; after that, `pnpm release` and the Publish workflow use GitHub Actions OIDC trusted publishing without a long-lived registry token.
- A failed Publish run is recovered with `gh workflow run publish.yml --ref main -f tag=vX.Y.Z`, not a rerun: a rerun takes `publish.yml` from the tag's commit, so a workflow fix merged since never reaches it. The dispatch checks out `refs/tags/<tag>`, so a branch name typed as the tag fails the checkout instead of publishing `main` under the bumped version. `test/release.test.ts` pins that ref.
- The Pi peer range is `>=0.84.2 <2`, and the tests run on Pi 1.x. Pi 1.0 hands `execute` an `ExtensionToolContext`, so the Pi test host builds one with `runner.createToolContext`, which 0.x doesn't have. CI no longer sees the 0.84.2 floor: it was last checked by hand on 2026-10-06, extension tests green with that one line swapped back to `createContext`.
- `pnpm typecheck` covers `test/` through `test/tsconfig.json`, after the build, since tests import the extensions and their `dist` types. Vitest only strips types, so nothing checked the tests before.
- The OMP extension imports nothing from `@oh-my-pi/pi-coding-agent` at runtime: `@agntn/tools/omp` draws the status line with the host `theme` and the `Text` the host hands over as `pi.pi.Text`. Compiled OMP injects no `/tui`, so `renderStatusLine` from there stopped the extension loading; the unit test still throws on that import.
- Each tool is declared once in `src/tools.ts` with `defineTool` from `@agntn/tools`, and the MCP server, both extensions and `src/ai.ts` take that list through its adapters. The executors in `src/tool-operations.ts` load on the first call, so the extensions register without loading the library. Schemas take `Type` from `@agntn/tools`, never from `typebox`: OMP rewrites a bare `typebox` import to its own facade, and `Value.Check` then accepts anything.
- The manifest has no `typebox`, zod or `@modelcontextprotocol/sdk` 1.x left. MCP runs on `@modelcontextprotocol/server` 2.x, and Pi 0.99 stopped warning about `typebox` in `dependencies`.
- A tool executor throws when it can't answer, and its `ToolResult` has no `isError`. The Pi adapter keeps its default `failures: "throw"`, since Pi up to 0.98 records every returned value as a successful call. The MCP adapter turns the throw into a sanitized `isError` result.
- MCP error text and OMP renderer text go through `sanitizeLine` from `@agntn/tools`, which replaces `[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]` with spaces. U+2028 and U+2029 are not `Cc`, `JSON.stringify` leaves them literal, and most renderers still break a line on them. `Cf` covers bidi overrides and isolates, zero-width characters and tag characters, which make a line read differently from its bytes; it handles a single line, so dropping ZWJ and ZWNJ costs nothing there.
- A local MCP server needs a restart, not `pnpm build`: inside a checkout `dist/cli.mjs` serves `src/mcp.ts` (see Conventions). `test/cli.test.ts` proves both modes and each guard. Its load hook writes the module list to a file: stderr written in an exit handler stops at about 146 KB in a pipe, so a long checkout path cut the JSON.
- A server running `src/` answers every `tools/call` with `src/ changed under this server, restart it to load the new code` once anything under `src/` changed since it started. `src/mcp.ts` puts its own `tools/call` handler in front for that, so the check comes before the name and the schema: a tool or a schema the pull added would otherwise get a stale `Unknown tool` or `Invalid arguments`. A tool that fails checks again, so a pull landing mid-call gets the restart line instead of the error it caused; a call that succeeds keeps its answer, and the next one refuses. The server's ESM cache keeps the modules it already loaded, so after a pull a lazy import met an old export and failed with `does not provide an export named` on a tool the pull never touched (keys, 2026-10-02). `src/source-change.ts` compares the newest ctime under `src/` before each call, about 5 ms over the 614 files of puzzles; ctime catches a copy that kept an old mtime, and a parent's ctime catches a removed file. The snapshot is taken when `src/mcp.ts` loads, not when a server is built, and a scan that fails because a checkout took the tree away counts as a change. The bundle can't mix versions and stays unguarded. A sibling whose `src/` imports a tree beside it (hashes: `packages/shared/`) guards that tree too.
- Extension tests go through `test/fixtures/`: Pi's own loader and runner for Pi, a strict OMP host double that throws by name on any member the test did not stub. The OMP package root ships TypeScript inside `node_modules`, so Node cannot load its real loader.
- `pnpm release` and the Publish workflow build before `pnpm test`, as CI does. The `mcp` checks in `test/cli.test.ts` start `dist/cli.mjs`, so testing first ran them against a stale build, or skipped them on a clean runner. `test/release.test.ts` fails when either order flips.
- The CLI is `runCli` from `@agntn/tools/cli` over `curvesTools`, with `mcp: true`. Flags come from the schemas. The `cli` hint on each tool names the command (`compute`, `secp256k1`), makes `operation` positional and gives the command list a short line. The default output is the tool's model text and `--json` prints `details`. Points go in as JSON objects, and secp256k1 takes `--no-compressed` for 65-byte points. A thrown `Error` prints as one line with exit code 1, since every refusal of the library is one. No colors and no CLI library: citty, consola and scule left with the hand written commands.
- Linting and formatting consume the shared `@agntn/ox` policy.
- `renovate.json` extends the shared `local>agntn/_renovate` preset. Renovate runs on the org install without it, just on Mend's defaults, so a package scaffolded from here would skip the pins, the three-day wait and the Monday batch until somebody noticed.
- `vp fmt` skips the root `CHANGELOG.md`. changelogen writes two spaces after the ⚠️ of a breaking entry and oxfmt wants one, so the check failed after every breaking release. The pattern is anchored, so a nested `CHANGELOG.md` is still formatted.
- `src/mcp.ts` exports `toolListings` and `callTool` over `listTools` and `callTool` from `@agntn/tools/mcp` (0.2.0); the docs site serves both tools at `/mcp` through them, and `test/docs-mcp.test.ts` holds the site's answers to the stdio server's. That test imports from `docs/node_modules`, so every workflow installs `docs/` too, and `vite.config.ts` aliases `@agntn/curves/mcp` to `src/mcp.ts` for it.
- `pnpm-workspace.yaml` exempts `@agntn/*` from `minimumReleaseAge`. A clean frozen install rejects a lockfile entry younger than a day, so CI failed for a day after every sibling release. The scope pattern also covers the next package and version, which an exact entry does not.
- The toolchain runs on Vite+ 1.0 for lint, fmt and test, and CI installs through `voidzero-dev/setup-vp`. The build went back to obuild, like `@agntn/puzzles`, `@agntn/keys` and `@agntn/hashes`: the same `dist/` files and exports as `vp pack`, with less JS.

## Stack

- **Runtime**: Node.js >= 26
- **Language**: TypeScript (strict)
- **Toolchain**: Vite+ (`vp`), one `vite.config.ts` for test, lint and fmt
- **Build**: obuild from `build.config.ts`, one bundle for all six entries, chunks under `dist/_chunks/` with stable names
- **Test**: `vp test` (bundled Vitest, API from `vite-plus/test`)
- **Lint**: `vp lint` + `vp fmt` (Oxlint + Oxfmt) through `@agntn/ox`
- **Typecheck**: tsc (native TypeScript 7)
- **Release**: changelogen
- **Package manager**: pnpm

## Scripts

- `pnpm dev` - `obuild --stub`, so `dist` re-exports `src`. The three `mcp` bundle checks in `test/cli.test.ts` fail against it; run them after a real build
- `pnpm build` - production build
- `pnpm test` - run tests once
- `pnpm test:watch` - run tests in watch mode
- `pnpm lint` - lint + format check
- `pnpm fmt` - auto-fix lint + format
- `pnpm typecheck` - type checking
- `pnpm release` - build, test against that build, and release, in CI's order

## Structure

```
src/core/                - field, arithmetic, group walks, limits, secp256k1
src/secp256k1.ts         - the secp256k1 subpath
src/tools.ts             - the tool definitions; tool-operations.ts runs them, tool-contract.ts holds the contract
src/cli.ts               - the curves bin: runCli over the tools, `mcp` from source in a checkout
test/                    - tests
test/fixtures/           - typed Pi and OMP extension test hosts, curve and secp256k1 vectors
packages/omp/extensions/ - OMP extension sources shipped with the package
packages/pi/extensions/  - Pi extension sources shipped with the package
dist/                    - build output (generated)
```

## Conventions

- ESM only (`"type": "module"`)
- Exports use `.d.mts` / `.mjs` extensions
- Strict TypeScript (all strict checks enabled)
- Nothing under `src/` outside `src/cli.ts` and `src/source-change.ts` imports `node:*`
- No `as any`, `@ts-ignore`, or `@ts-expect-error`
- Local MCP from source: for a bare `curves mcp`, `src/cli.ts` imports `createMcpServer` from a runtime URL of `src/mcp.ts` when `CURVES_DIST` is not `1`, the path has no `node_modules` segment (Node refuses to strip types there) and the file exists (the npm package ships only `dist`). That server carries the restart guard. Otherwise `runCli` serves its own `mcp` from the bundle. Every runtime import on that path is a `dependency`, so no devDependency guard. Only an edit to `src/cli.ts` itself still needs a build. Relative imports end in `.ts` and `erasableSyntaxOnly` holds, or plain Node cannot run `src/`.

## Status

- Pull requests and issues use short, freeform descriptions focused on why a change is needed or what went wrong.
