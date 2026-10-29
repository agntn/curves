# Contributing

## Setup

The README has the commands. Install both the root and docs dependencies: `pnpm install` and `pnpm --dir docs install`. `test/docs-mcp.test.ts` loads Zod, the MCP toolkit and the SDK from `docs/node_modules`.

Build before you test. The `curves mcp` checks in `test/cli.test.ts` start `dist/cli.mjs`, and three fail against the `pnpm dev` stub. `pnpm release` and the Publish workflow build first too. `test/release.test.ts` catches either order flipping.

Running `curves mcp` from a checkout? It serves `src/mcp.ts` directly. Restart the server after a change. Only an edit to `src/cli.ts` itself needs a build.

Plain Node runs `src/` as it is, so relative imports end in `.ts` and `erasableSyntaxOnly` holds. Pull while the server's running and every tool call asks for a restart: `src/ changed under this server, restart it to load the new code`.

## Math

- The math is written here from its specs. That's SEC 2 v2 and SEC 1 v2 for secp256k1, RFC 9496 for ristretto255, RFC 8032 for ed25519, and schnorrkel 0.11 for sr25519 on Substrate.
- There's no `@noble/curves` dependency. That's the point. Merlin has its own Keccak-f[1600] in `src/core/merlin.ts` because `@agntn/hashes` keeps its permutation private.
- The runtime imports are `@agntn/hashes/sha2` for sr25519's SHA-512, `@agntn/tools` and the MCP server SDK.
- edwards25519 multiplication takes the same steps for every scalar, and `test/edwards25519.test.ts` times it. Keep it that way. secp256k1 and generic curves don't run in constant time. Nothing's audited, so keep that warning up front in the README. Right answers aren't an audit.
- A new operation gets a spec vector. If another implementation exists, freeze its output in `test/fixtures/` with its name and version, as with `@noble/curves` 2.4.0 and `@scure/sr25519` 2.4.0.
- Every refusal is an `Error` with a message written for the caller. The CLI prints one line, and the MCP server sanitizes the message.
- Search limits live in `src/core/limits.ts`. It has no imports, so tool schemas can name the limits without loading the arithmetic.

## Agent tools

- Declare each tool once in `src/tools.ts`. The CLI, MCP server, both extensions, `src/ai.ts` and the site's `/mcp` serve that list, so a fix never lands on one surface only.
- `test/docs-mcp.test.ts` checks the site's answers against the stdio server's.
- An executor throws when it can't answer. It doesn't return an `isError` result.

## Docs site

- Workers Builds installs `docs/` alone. It takes Node.js from the root `.node-version`, not `engines`. Without the pin, the build runs Node.js 24. `test/docs.test.ts` checks it.
- The site bundles `../src` through aliases in `docs/nuxt.config.ts`, not `dist/`. A new npm import under `src/` needs a pin in `docs/package.json` at the root's version and an entry in `vite.resolve.dedupe`. Add it to `vite.optimizeDeps.include` too when the browser loads it. Miss one and the deploy breaks.
- Values quoted in `docs/content/` come from the library. Check a secp256k1 point against `@noble/curves` too, outside the package.
- Prose counts and limits come from the operation lists and `MAX_*` limits through `spellOut` and `powerOfTwo`. Frontmatter and `content/` can't call functions, so check limits written there against `src/core/limits.ts` by hand.
- Samples stay deterministic. No `Math.random`, no clock inside a computed. The server render and hydration have to agree.
- Whatever a visitor types in the playground renders as text. Never `v-html`, never evaluated.
- The site makes no network request for its own work. The footer promises that, so don't make it a liar.
- `public/favicon.svg` is the source. Cut the PNGs and the `.ico` from it with ImageMagick.
- `test/docs.test.ts` guards frontmatter descriptions and list items that open with bold. Docus builds OG file names from those descriptions, so they're not just decoration.
- `pnpm typecheck` checks the docs app too, `.vue` files included. Four green checks once missed a playground type error. Docus 5.13 ships TypeScript that flunks this check, so `pnpm --dir docs typecheck` skips errors in its source. Everything else fails, even an error with no file.

## Releasing

`pnpm release` builds, tests and releases in CI's order. Publish failed? Use `gh workflow run publish.yml --ref main -f tag=vX.Y.Z`, not a rerun. A rerun takes `publish.yml` from the tag's commit, so it misses any workflow fix merged since.

## Pull requests

Keep pull request and issue descriptions short and freeform. Say why the change is needed or what went wrong.
