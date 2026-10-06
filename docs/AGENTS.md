# docs/

Docus site for `@agntn/curves` at curves.agntn.dev. Markdown lives in `content/`. The playground is a Vue page that imports the library into the browser. The one route that answers at request time is `/mcp`, the Docus MCP server with both tools of `curves mcp` beside its own `list-pages` and `get-page`.

## Layout

```
docs/
├── DESIGN.md                      # the instruments this site owns and where it departs from the agntn design system
├── nuxt.config.ts                 # extends: ['docus'], cloudflare_module preset (Workers), @agntn/curves, its /secp256k1 and /mcp, #tool-operations and #tool-contract aliased to ../src
├── shiki-theme.ts                 # code block theme, every colour a --shiki-token-* variable from app.css
├── app/app.config.ts              # title, github, theme, the Nuxt UI variants in the instrument grammar
├── app/app.css                    # theme tokens, the shared `console-*` and `hero-*` grammar, `curves-*` classes
├── app/components/                # Docus overrides: header, tabs, sidebar, table of contents, page links, surround, callout
├── app/components/content/        # MDC components (`::landing-home`), the landing instruments, Prose* overrides, CurvesPlayground
├── app/components/OgImage/        # Docs.takumi and Landing.takumi override the Docus OG templates
├── app/assets/fonts.css           # @font-face for the TTFs served from public/fonts (site and OG images)
├── app/composables/               # useLandingSample (one clock for every live panel), useSubNavigation, useCopied
├── app/utils/                     # curves (the landing's curves, computed by the library), secp (the secp256k1 samples), contract (counts and limits), tools (the executors), tokens, formatting
├── app/pages/playground.vue       # playground, own route outside the docs layout, its own useSeo and OG image
├── server/routes/sitemap.xml.ts   # Docus sitemap plus the Vue pages it cannot see
├── server/mcp/index.ts            # the Docus MCP handler at /mcp, named and versioned like `curves mcp`
├── server/mcp/tools/              # one file per tool, each `curvesMcpTool("<name>")`
├── server/utils/curves-mcp.ts     # a tool from `@agntn/curves/mcp` for the toolkit
├── public/                        # fonts, favicon.svg and the icons and manifest cut from it
├── content/index.md               # landing
├── content/1.guide/               # getting started, CLI, agents, playground
└── content/2.math/                # overview, curves and points, orders and logs, secp256k1
```

## Commands

```bash
pnpm install          # from docs/, the repo root needs no install or build first
pnpm dev              # http://localhost:3000
pnpm build            # Cloudflare Workers output in .output/, content routes prerendered
pnpm deploy           # build, then wrangler deploy to curves.agntn.dev
```

Deployment: Workers Builds with root directory `docs`. It installs `docs/` and nothing else, and that's enough, because the library comes from `../src` (next paragraph). Nitro preset `cloudflare_module`. Nuxt Content wants a D1 binding named `DB`. `wrangler.jsonc` carries it plus the `NUXT_SITE_URL` var. The database `agntn-curves` lives in the EU jurisdiction, which is set at creation; the binding names it by id alone. Pull request previews get their own database, `agntn-curves-preview`, also EU, through the `previews` block, so a preview build never writes to production. No KV binding. Nothing is fetched, so nothing is cached.

`@agntn/curves` is an alias in `nuxt.config.ts` for `../src/index.ts`, with `@agntn/curves/secp256k1`, `#tool-operations` and `#tool-contract` beside it. Vite bundles the checkout's sources for the browser and Nitro gets the same alias for the prerender, so `dist/` and the root `node_modules` are never touched. Nothing those four modules load imports an npm package or `node:*`, so the site needs no dedupe or optimizeDeps entry for the library. A new npm import under them needs one in `docs/package.json`, `vite.resolve.dedupe` and `vite.optimizeDeps.include`, or it breaks the deploy.

The root `.node-version` is the only place Workers Builds takes Node.js 26 from. Its build image reads `NODE_VERSION`, `.nvmrc` or `.node-version`, never `engines` in `package.json`, and falls back to Node.js 24 without them. Keep it.

`pnpm-workspace.yaml` exempts `@agntn/*` from `minimumReleaseAge`, since a clean frozen install rejects a sibling released less than a day ago.

Two resolution traps, both because the repo root is its own pnpm workspace:

- `pnpm-workspace.yaml` sets `shamefullyHoist: true`. Without it `docs/node_modules` holds only direct dependencies, Node walks up to the root `node_modules`, and the server bundle can end up with a second copy of Vue.
- `nuxt.config.ts` pins `workspaceDir` to `docs/`, disables devtools and telemetry, and adds the repo to `vite.server.fs.allow`, since `pnpm dev` couldn't load the library otherwise.

## MCP

`@agntn/curves/mcp` is one more alias, for `../src/mcp.ts`. Its `toolListings` and `callTool` come from `listTools` and `callTool` of `@agntn/tools/mcp`. A file in `server/mcp/tools/` names one tool and nothing else: `curvesMcpTool()` takes the name, prose, schema and annotations from `toolListings` and runs `callTool()` from there, so a tool changed in `src/` changes here without an edit. A new tool in `src/tools.ts` needs one more file here, and `test/docs-mcp.test.ts` fails until it has one.

`@nuxtjs/mcp-toolkit` wants Zod and validates with it before the handler runs. A Zod error echoes the client's keys as they came and reads differently from `curves mcp`. So the Zod schema is `z.looseObject({})`, which passes any object, and its `_zod.toJSONSchema` hook returns the wire schema from `toolListings`, so `tools/list` still shows the real one. `callTool` then checks the arguments the way stdio does. A call with no `arguments` at all reaches Zod as `undefined`, so the schema's `run` reads it as `{}` first. `test/docs-mcp.test.ts` calls the tools through the SDK copy in `docs/node_modules` with Zod and the toolkit from there, so every workflow that lints, typechecks or tests installs `docs/` too.

`src/mcp.ts` imports `@agntn/tools` and `@modelcontextprotocol/server`. Both are dependencies here, pinned to the root's versions and listed in `vite.resolve.dedupe`. They run on the worker only, so they stay out of `optimizeDeps`. On the `cloudflare_module` preset the toolkit hands its server to `createMcpHandler` from `agents`, which tells an SDK v1 server apart with `instanceof`. `nitro.alias` points every import of the SDK at the copy in `docs/node_modules`, so the toolkit and `agents` share one.

The worker computes whatever an MCP client sends it and keeps none of it. The work is bounded by the library's limits: the slowest call, a log for a base of order near 2^36, takes under half a second. Workers Logs record the invocation, not the body; keep it that way, no `console` call with tool arguments.

## Live values

- Every value on the landing comes from the library at render time. `CURVES` in `app/utils/curves.ts` runs `listPoints`, `pointOrder`, `multiplyPoint` and `discreteLog` over each spec when the module loads. A spec names a, b, p, a scalar below the order and one sentence; without a base, the first point of the largest order is taken.
- The secp256k1 samples in `app/utils/secp.ts` run through `computeSecp256k1` from `src/tool-operations.ts`, so their dialogs show exactly the tool text.
- Counts in prose (the hero, the OG image, the SEO description, the playground) come from `CURVE_OPERATIONS`, `SECP256K1_OPERATIONS`, `TOOLS` and the `MAX_*` limits through `spellOut` and `powerOfTwo`. Frontmatter and `content/` can't call a function, so a limit written there is checked against `src/core/limits.ts` by hand.
- The samples are deterministic, so SSR and the client agree and hydration doesn't flicker. Keep it that way. No `Math.random`, no clock inside a computed.
- `CurvesPlayground.vue` reads the deep link through a `watch(route.query)` registered in `onMounted` that fires once. A prerendered page hydrates with an empty `route.query` and Nuxt restores the address only afterwards. It writes state back with `router.replace` on every change and runs a call 250 ms after the form stops changing.
- The playground catches the `Error` an executor throws and shows its message, the way `callTool` would.

## SEO

- `seo.schema` in `app/app.config.ts` emits the landing JSON-LD: `WebSite`, the agntn `Organization` as publisher, and a free `SoftwareApplication` with `sameAs` on GitHub and npm.
- `server/routes/sitemap.xml.ts` wraps the Docus sitemap and appends the Vue pages listed in `PAGES`; a new page under `app/pages/` goes there too.
- `public/favicon.svg` is the source, the PNGs and the `.ico` are cut from it with ImageMagick.

## OG images

- `app/components/OgImage/Docs.takumi.vue` and `Landing.takumi.vue` override the Docus templates and are rendered by Takumi at build time. Takumi has no CSS variables, so the theme colours are repeated there as literals.
- `app/assets/fonts.css` declares the Figtree and Fira Code TTFs in `public/fonts`, which is where nuxt-og-image reads them.
- Descriptions go without commas and without a trailing period: Docus puts them in the OG file name, where a comma is a separator and `..png` is skipped without a word. A `: ` in a frontmatter description is a YAML mapping and the page vanishes from the prerender.

## Constraints

- Text a visitor types into the playground is rendered as text, through interpolation or a `<pre>`. Never `v-html`, never evaluate.
- The sidebar takes a page's icon from `NAV_ICONS` in `app/composables/useSubNavigation.ts`, not from its frontmatter, so a new page goes there too.
- Every value quoted in `content/` came out of the library in `src/`. Check a new one the same way, and against `@noble/curves` where it's a secp256k1 point.
- No bold run at the start of a list item in `content/`: the `/llms-full.txt` serializer recursed until the stack ran out on that shape in a sister site. Check `curl -s -o /dev/null -w '%{http_code}' localhost:<port>/llms-full.txt` after adding emphasis to a list.
- The site makes no network request for its own work and stays that way. The footer says so.
