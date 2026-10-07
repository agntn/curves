import { resolve } from "node:path";
import { curvesTheme } from "./shiki-theme";

/** Bundled from the checkout's sources: a deploy needs neither dist/ nor the root node_modules. */
const librarySource = resolve(import.meta.dirname, "../src");

export default defineNuxtConfig({
  extends: ["docus"],
  /** The repo root is its own pnpm workspace; Nuxt must not treat it as this site's. */
  workspaceDir: import.meta.dirname,
  alias: {
    /** The tool listings and the executor `curves mcp` serves, for the MCP server at /mcp. */
    "@agntn/curves/mcp": resolve(librarySource, "mcp.ts"),
    "@agntn/curves/secp256k1": resolve(librarySource, "secp256k1.ts"),
    "@agntn/curves/sr25519": resolve(librarySource, "sr25519.ts"),
    "@agntn/curves": resolve(librarySource, "index.ts"),
    /** The text the agent tools answer with; it imports nothing beyond the library. */
    "#tool-operations": resolve(librarySource, "tool-operations.ts"),
    /** The operations and limits the tools take, without the arithmetic. */
    "#tool-contract": resolve(librarySource, "tool-contract.ts"),
  },
  vite: {
    build: { target: "es2024" },
    resolve: {
      /** `../src` imports them; Vite would look for them from the repo root upward. */
      dedupe: ["@agntn/hashes", "@agntn/tools", "@modelcontextprotocol/server"],
    },
    /** sr25519 hashes its seeds with SHA-512 from `@agntn/hashes`, in the playground too. */
    optimizeDeps: { include: ["@agntn/hashes/sha2"] },
    server: {
      /** Dev serves the library from outside the workspace, which Vite refuses without this. */
      fs: { allow: [resolve(librarySource, "..")] },
    },
  },
  devtools: { enabled: false },
  telemetry: false,
  site: {
    url: "https://curves.agntn.dev",
    name: "@agntn/curves",
  },
  llms: {
    domain: "https://curves.agntn.dev",
    title: "@agntn/curves",
    description:
      "Arithmetic on elliptic curves: short Weierstrass curves over a prime you pick (points, orders, counts, discrete logs), secp256k1 with SEC1 points and sr25519 over ristretto255 for Polkadot keys, written from the specs, as a library, a CLI, an MCP server and Pi and OMP extensions. Computed locally.",
    sections: [
      {
        title: "MCP Server",
        description: "The tools of `curves mcp` and the page tools of this site over Streamable HTTP.",
        links: [
          {
            title: "MCP endpoint",
            href: "https://curves.agntn.dev/mcp",
            description:
              "Add it to any MCP client as an HTTP server, for example `claude mcp add --transport http curves https://curves.agntn.dev/mcp`.",
          },
        ],
      },
      {
        title: "Playground",
        description: "All three tools, in the browser.",
        links: [
          {
            title: "Playground",
            href: "https://curves.agntn.dev/playground",
            description: "The library running in the page: curves_compute, curves_secp256k1_compute and curves_sr25519_compute.",
          },
        ],
      },
    ],
  },
  /** Docus pages define their own OG images; the alt text is the one thing they leave unset. */
  ogImage: {
    defaults: {
      alt: "@agntn/curves: points, orders and discrete logs on elliptic curves, computed locally",
    },
  },
  icon: {
    clientBundle: {
      icons: [
        "lucide:archive",
        "lucide:arrow-down",
        "lucide:arrow-left",
        "lucide:arrow-right",
        "lucide:arrow-right-left",
        "lucide:arrow-up",
        "lucide:arrow-up-right",
        "lucide:book-a",
        "lucide:book-open",
        "lucide:bot",
        "lucide:check",
        "lucide:check-circle",
        "lucide:chevron-down",
        "lucide:chevron-left",
        "lucide:chevron-right",
        "lucide:chevrons-up-down",
        "lucide:circle-alert",
        "lucide:circle-check",
        "lucide:circle-x",
        "lucide:copy",
        "lucide:expand",
        "lucide:external-link",
        "lucide:file-archive",
        "lucide:flask-conical",
        "lucide:gauge",
        "lucide:globe",
        "lucide:layers",
        "lucide:library",
        "lucide:link",
        "lucide:package",
        "lucide:plus",
        "lucide:puzzle",
        "lucide:rotate-ccw",
        "lucide:scale",
        "lucide:scan-search",
        "lucide:shield-alert",
        "lucide:shield-check",
        "lucide:shuffle",
        "lucide:terminal",
        "lucide:text",
        "lucide:x",
        "lucide:zap",
        "simple-icons:cursor",
        "simple-icons:github",
        "simple-icons:npm",
        "vscode-icons:file-type-js",
        "vscode-icons:file-type-json",
        "vscode-icons:file-type-shell",
        "vscode-icons:file-type-typescript",
      ],
    },
  },
  colorMode: {
    preference: "dark",
  },
  app: {
    head: {
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/site.webmanifest" },
      ],
      meta: [
        { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#0b0d10" },
        { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#eef1f4" },
        { name: "apple-mobile-web-app-title", content: "curves" },
        { name: "author", content: "oritwoen" },
        { property: "og:locale", content: "en_US" },
      ],
    },
  },
  nitro: {
    preset: "cloudflare_module",
    /** One MCP SDK copy, or `agents` fails the toolkit's server on its `instanceof` check. */
    alias: {
      "@modelcontextprotocol/sdk": resolve(
        import.meta.dirname,
        "node_modules/@modelcontextprotocol/sdk/dist/esm",
      ),
    },
    compatibilityDate: "2026-09-03",
    /** Nitro compiles the server bundle for ES2019 unless told otherwise; the library uses BigInt. */
    esbuild: { options: { target: "es2024" } },
    prerender: {
      crawlLinks: true,
      routes: ["/", "/playground", "/sitemap.xml", "/robots.txt", "/llms.txt", "/llms-full.txt"],
    },
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
    },
  },
  compatibilityDate: "2026-09-03",
  /** Fonts live in public/fonts and app/assets/fonts.css, where nuxt-og-image reads them from. */
  css: ["~/assets/fonts.css"],
  fonts: {
    families: [
      { name: "Figtree", provider: "local", weights: [400, 500] },
      { name: "Fira Code", provider: "local", weights: [400, 500] },
    ],
  },
  content: {
    database: {
      type: "d1",
      bindingName: "DB",
    },
    build: {
      markdown: {
        highlight: {
          theme: {
            default: curvesTheme,
            light: curvesTheme,
            dark: curvesTheme,
          },
        },
      },
    },
  },
});
