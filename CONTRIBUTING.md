# Contributing

## Setup

The README has the commands. Run `pnpm install` at the root. That one install covers the library and the docs site, `docs/node_modules` included, where `test/docs-mcp.test.ts` finds Zod, the MCP toolkit and the SDK. The old two-install dance can retire.

Build before you test. The `curves mcp` checks in `test/cli.test.ts` start `dist/cli.mjs`, and three fail against the `pnpm dev` stub. `pnpm release` and the Publish workflow build first too. `test/release.test.ts` catches either order flipping.

Running `curves mcp` from a checkout? It serves `src/mcp.ts` directly. Restart the server after a change. Only an edit to `src/cli.ts` itself needs a build.

Plain Node runs `src/` as it is, so relative imports end in `.ts` and `erasableSyntaxOnly` holds. Pull while the server's running and every tool call asks for a restart: `src/ changed under this server, restart it to load the new code`.

## Math

- The math is written here from its specs. That's SEC 2 v2 and SEC 1 v2 for secp256k1, P-256, P-384 and P-521, and RFC 5639 for brainpoolP256r1, brainpoolP384r1 and brainpoolP512r1. Then RFC 9496 for ristretto255, RFC 8032 and ZIP 215 for ed25519, and schnorrkel 0.11 for sr25519 on Substrate. The complete additions come from Renes, Costello and Batina (2016).
- There's no `@noble/curves` dependency. That's the point. Merlin has its own Keccak-f[1600] in `src/core/merlin.ts` because `@agntn/hashes` keeps its permutation private.
- The runtime imports are `@agntn/hashes/sha2` for SHA-512 in sr25519 and Ed25519 and SHA-256 in BIP340, `@agntn/hashes/hmac` for the RFC 6979 nonces, `@agntn/tools` and the MCP server SDK.
- secp256k1, P-256, P-384, P-521, brainpoolP256r1, brainpoolP384r1 and brainpoolP512r1 share the functions in `src/core/sec1.ts`. Each width comes from the curve. Hex lengths and digits do. So do the comb, the verification table and the cut of a digest. A wider curve needs its numbers, not a copy.
- Each curve module wraps the shared code in functions of its own. That's how every export keeps its JSDoc in the types.
- Multiplying by a secret on edwards25519, secp256k1, P-256, P-384, P-521, brainpoolP256r1, brainpoolP384r1 and brainpoolP512r1 takes the same steps for every scalar. `test/edwards25519.test.ts`, `test/secp256k1.test.ts`, `test/p256.test.ts`, `test/p384.test.ts`, `test/p521.test.ts`, `test/brainpoolp256r1.test.ts`, `test/brainpoolp384r1.test.ts` and `test/brainpoolp512r1.test.ts` time it. Keep it that way.
- secp256k1, P-256, P-384, P-521, brainpoolP256r1, brainpoolP384r1 and brainpoolP512r1 verification read G from a faster table, since their scalars are public. Never hand that path a secret. Generic curves don't run in constant time. Nothing's audited, so keep that warning up front in the README. Right answers aren't an audit.
- A new operation gets a spec vector. If another implementation exists, freeze its output in `test/fixtures/` with its name and version, as with `@noble/curves` 2.4.0 and `@scure/sr25519` 2.4.0. noble has no Brainpool. OpenSSL stands in.
- Every refusal is an `Error` with a message written for the caller. The CLI prints one line, and the MCP server sanitizes the message.
- Search limits live in `src/core/limits.ts`. It has no imports, so tool schemas can name the limits without loading the arithmetic.

## Agent tools

- Declare each tool once in `src/tools.ts`. The CLI, MCP server, both extensions, `src/ai.ts` and the site's `/mcp` serve that list, so a fix never lands on one surface only.
- `test/docs-mcp.test.ts` checks the site's answers against the stdio server's.
- An executor throws when it can't answer. It doesn't return an `isError` result.

## Docs site

- Workers Builds installs `docs/` alone. It takes Node.js from the root `.node-version`, not `engines`. Without the pin, the build runs Node.js 24. `test/docs.test.ts` checks it.
- The site bundles `../src` through aliases in `docs/nuxt.config.ts`, not `dist/`. A new npm import under `src/` resolves from the root, so `docs/package.json` doesn't need it. `vite.resolve.dedupe` still does, and so does `vite.optimizeDeps.include` when the browser loads it.
- Packages the site imports itself go in `docs/package.json`, since nothing is hoisted. `test/docs-dependencies.test.ts` catches a missing one, which beats finding it at deploy time.
- Values quoted in `docs/content/` come from the library. Check a secp256k1 point against `@noble/curves` too, outside the package.
- Prose counts and limits come from the operation lists and `MAX_*` limits through `spellOut` and `powerOfTwo`. Frontmatter and `content/` can't call functions, so check limits written there against `src/core/limits.ts` by hand.
- Samples stay deterministic. No `Math.random`, no clock inside a computed. The server render and hydration have to agree.
- Whatever a visitor types in the playground renders as text. Never `v-html`, never evaluated.
- The site makes no network request for its own work. The footer promises that, so don't make it a liar.
- `public/favicon.svg` is the source. Cut the PNGs and the `.ico` from it with ImageMagick.
- `test/docs.test.ts` guards descriptions and list items. A `: ` in a description is a YAML mapping, and the page falls out of prerender. A bold list opener once sent a sister site's `/llms-full.txt` into endless recursion. Commas and a closing period are fine now. Docus 5.15 hashes OG filenames.
- Put each Vue page under `docs/app/pages/` in `PAGES` in `docs/server/api/__sitemap__/pages.ts`. Docus only lists `content/`, so the sitemap misses it otherwise. Add it to `agentDiscovery.excludePrefixes` in `docs/nuxt.config.ts` too. Drop the markdown link that `useSeo` adds, as `playground.vue` does. Otherwise agents chase a `.md` twin that doesn't exist. That's a 404, not a discovery.
- Run `pnpm typecheck`. It checks the docs app and `.vue` files too. Four green checks once missed a playground type error. Docus 5.13 shipped TypeScript that failed this check. Docus 5.15 passes clean. `pnpm --dir docs typecheck` still skips Docus source errors, so a layer release can't block you with those. Everything else fails, even an error without a file.

## Releasing

`pnpm release` builds, tests and releases in CI's order. Publish failed? Use `gh workflow run publish.yml --ref main -f tag=vX.Y.Z`, not a rerun. A rerun takes `publish.yml` from the tag's commit, so it misses any workflow fix merged since.

## Pull requests

Keep pull request and issue descriptions short and freeform. Say why the change is needed or what went wrong.
