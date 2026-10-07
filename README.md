# @agntn/curves

[![npm version](https://npmx.dev/api/registry/badge/version/@agntn/curves)](https://npmx.dev/package/@agntn/curves)
[![npm downloads](https://npmx.dev/api/registry/badge/downloads/@agntn/curves)](https://npmx.dev/package/@agntn/curves)
[![license](https://npmx.dev/api/registry/badge/license/@agntn/curves)](https://npmx.dev/package/@agntn/curves)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/agntn/curves)

📈 Elliptic curve math for puzzles and agents. Bring your own a, b and p, or just use secp256k1. You ask for 13 times a point, you get 13 times a point.

> [!CAUTION]
> **Not audited.** This code has never had a security audit. Do not use it in production, with real funds or with sensitive data. It is meant for agents, puzzles and local experiments only. It comes as is, without warranty of any kind, and the authors are not liable for any loss, as the MIT license states. Anything that matters wants an audited library.

## Why?

A CTF gives you a curve over a 40-bit prime and two points. Find k. A model will happily do the modular inverse in its head. It will also get it wrong, around step three. This package does the counting, the orders and the logs, so the model only has to pick the attack.

The guide and a playground that runs in your tab: [curves.agntn.dev](https://curves.agntn.dev).

## ✨ Features

- 🧮 **Any short Weierstrass curve.** y² = x³ + ax + b over a prime you pass. `a = -3` works too.
- 🔁 **Add, double, negate, multiply.** Negative scalars multiply the negation.
- 🔢 **Counting and listing.** Every point of a small curve, or just the ones of one order.
- 📏 **Point orders.** Baby step giant step over the Hasse interval, fields up to 2⁴⁸.
- 🕵️ **Discrete logs.** The smallest k, one prime of the order at a time. A 40-bit order made of small primes? About 20 ms. Only a prime above 2³⁶ stops it. No k? You get `undefined`, not a guess.
- 🔑 **secp256k1 with SEC1 points.** Add, subtract, multiply, lift an x, convert between 33 and 65 bytes.
- 🧾 **Written from the specs.** SEC 2 for the domain parameters, SEC 1 for the encodings. No `@noble/curves`.
- 🤖 **Agent tools.** One for curves you define, one for secp256k1. MCP, Pi, OMP and the AI SDK all get both.

## 📦 Install

```bash
pnpm add @agntn/curves
```

Node.js 26 or newer.

## 🚀 First call

```bash
npx @agntn/curves compute log --a 2 --b 2 --p 17 --point '{"x":"5","y":"1"}' --other '{"x":"16","y":"4"}'
```

```
{"operation":"log","order":"19","scalar":"13"}
```

That's the textbook curve from Paar and Pelzl. (16, 4) is 13 times (5, 1). Below it's plain `curves`. In a project that means `pnpm exec curves`. Or run `pnpm add -g @agntn/curves` once and forget about it.

Now something bigger. What's half of G on secp256k1?

```bash
curves secp256k1 multiply --point 0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798 --scalar 7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a1 --json
```

```
{
  "operation": "multiply",
  "point": "0200000000000000000000003b78ce563f89a0ed9414f5aa28ad0d96d6795f9c63"
}
```

The scalar is the inverse of 2 mod n. Look at all those zeros in x. Funny, right? No key, no config, no network.

### Commands

| Command                        | Does                                                            |
| ------------------------------ | --------------------------------------------------------------- |
| `curves compute <operation>`   | add, double, negate, multiply, check, order, count, points, log |
| `curves secp256k1 <operation>` | add, subtract, negate, multiply, lift, check                    |
| `curves mcp`                   | MCP server over stdio                                           |

Points go in as JSON for `compute`, the same `{"x":…,"y":…}` the tool takes, and as SEC1 hex for `secp256k1`. `--a -3` works, it's reduced mod p. The output is the line a model reads, `--json` makes it pretty. Every flag comes from the tool schema through `runCli` of [`@agntn/tools`](https://tools.agntn.dev/guide/cli), so `curves <command> --help` never lies about what a command takes.

## 🧠 Library

```ts
import { countPoints, defineCurve, discreteLog, multiplyPoint } from "@agntn/curves";
import { liftX, multiplyGenerator } from "@agntn/curves/secp256k1";

const curve = defineCurve({ a: 2n, b: 2n, p: 17n });
countPoints(curve); // 19n
multiplyPoint(curve, { x: 5n, y: 1n }, 2n); // { x: 6n, y: 3n }
discreteLog(curve, { x: 5n, y: 1n }, { x: 16n, y: 4n }); // 13n

multiplyGenerator("03"); // 02f9308a…36f9
liftX("79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798").odd; // 0379be66…1798
```

That's most of it, really. Generic curves take bigints and give `null` for the point at infinity. secp256k1 takes and gives hex. A point off the curve throws, never a silent wrong answer. More in [curves and points](https://curves.agntn.dev/math/curves), [orders and logs](https://curves.agntn.dev/math/groups) and [secp256k1](https://curves.agntn.dev/math/secp256k1).

## 🤖 Agents

```bash
pi install npm:@agntn/curves
omp install @agntn/curves
```

```json
{
  "mcpServers": {
    "curves": { "command": "npx", "args": ["-y", "@agntn/curves", "mcp"] }
  }
}
```

Two tools: `curves_compute` and `curves_secp256k1_compute`. The AI SDK versions sit in `@agntn/curves/ai`. Integers travel as decimal or `0x` strings. Infinity comes back as `"infinity"`.

## 🚫 What this does not do

Keys, addresses and signatures. That's [@agntn/keys](https://github.com/agntn/keys). Nothing here runs in constant time either. And a log over a real 256-bit group? Not happening, here or anywhere else.

## 🛠️ Development

```bash
pnpm install
pnpm --dir docs install   # the /mcp test borrows Zod, the toolkit and the SDK from here
pnpm build       # dist/, the CLI and the secp256k1 subpath
pnpm test        # textbook curves, brute force oracles, frozen secp256k1 vectors
pnpm lint        # vp lint and vp fmt --check
pnpm typecheck   # src, the extensions and the tests
```

## 💛 Thanks

Made with a lot of help from [Claude for Open Source](https://claude.com/contact-sales/claude-for-oss) and [Codex for Open Source](https://developers.openai.com/community/codex-for-oss). Small packages like this one exist because of them. Thank you.

## 📄 License

[MIT](./LICENSE)
