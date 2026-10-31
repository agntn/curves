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
- 🪝 **Lift an x.** Both points above it, on a curve of any size. A compressed point from a CTF stops being half a point.
- 🔢 **Counting and listing.** Every point of a small curve, or just the ones of one order.
- 📏 **Point orders.** Baby step giant step over the Hasse interval, fields up to 2⁴⁸.
- 🕵️ **Discrete logs.** The smallest k, one prime of the order at a time. A 40-bit order made of small primes? About 20 ms. Only a prime above 2³⁶ stops it. No k? You get `undefined`, not a guess.
- 🔑 **secp256k1 with SEC1 points.** Add, subtract, multiply, lift an x, convert between 33 and 65 bytes.
- 🔍 **ECDSA signing, verification and recovery.** RFC 6979 picks the nonce, so a key and a digest always sign the same way. Low s and a recovery id come with it. The block 170 signature that paid Hal Finney 10 BTC? Checks out. Recovery hands back Satoshi's key.
- ✍️ **BIP340 signatures.** Taproot and Nostr, signed and checked against 32-byte x-only keys. It lives in `@agntn/curves/bip340`. Fresh aux_rand by default, or yours. One BIP vector signs pi's hex digits with a key made of e's. Same bytes here.
- 🟢 **P-256 with SEC1 points.** Also called secp256r1 and prime256v1, it's the curve of passkeys, ES256 tokens and TLS. `@agntn/curves/p256` does point math and verifies ECDSA over a digest you hashed. All 262 Wycheproof vectors for P-256 with SHA-256 pass. A familiar name isn't proof. That's 262 witnesses.
- 🔵 **P-384 with SEC1 points.** Also called secp384r1. ES384 tokens, TLS certificates and CNSA suites run on it. `@agntn/curves/p384` handles point math and verifies ECDSA over a digest you hashed. All 280 Wycheproof P-384 SHA-384 vectors pass. That's more convincing than a curve name.
- 🟤 **P-521 with SEC1 points.** Also called secp521r1. ES512 tokens, OpenPGP keys and TLS certificates use it. `@agntn/curves/p521` handles point math and verifies ECDSA over a digest you hashed. All 318 Wycheproof P-521 SHA-512 vectors pass. That's 318 reasons to look past the name.
- 🌱 **brainpoolP256r1 with SEC1 points.** Brainpool took the scenic route with its parameters. `@agntn/curves/brainpoolp256r1` handles point math and ECDSA verification over a digest you hashed. All 261 Wycheproof SHA-256 vectors pass. No signing here.
- 🌳 **brainpoolP512r1 with SEC1 points.** The one Brainpool curve with no twin by length, so its points give it away. `@agntn/curves/brainpoolp512r1` handles point math and ECDSA verification over a digest. SHA-512 fits n to the bit, and all 337 Wycheproof vectors pass. No signing.
- 🍃 **brainpoolP384r1 with SEC1 points.** Same point lengths as P-384, different curve. Your length check won't notice. `@agntn/curves/brainpoolp384r1` handles point math and ECDSA verification over a digest. All 292 Wycheproof SHA-384 vectors pass in P1363 form. No signing.
- 🟣 **sr25519 for Polkadot.** Keys from a seed, signatures, `//hard` and `/soft` children. `//Alice` comes out right.
- 🟠 **ed25519 for Monero.** Add, multiply, reduce a scalar like `sc_reduce32`. A point of order 8 decodes fine, and `isTorsionFree` still says no.
- 🔏 **Ed25519 signatures.** Sign and verify in `@agntn/curves/ed25519`. One secret, one message, one signature. RFC 8032's own, to the byte. ZIP 215 by default, strict on request.
- 🧾 **Written from the specs.** SEC 2 and SEC 1 for secp256k1, P-256, P-384 and P-521, RFC 5639 for brainpoolP256r1, brainpoolP384r1 and brainpoolP512r1, plus RFC 6979 nonces. BIP340 for Schnorr, RFC 9496 for ristretto255, RFC 8032 for ed25519. No `@noble/curves`.
- 🤖 **Agent tools.** Curves you define, secp256k1, BIP340, P-256, P-384, P-521, brainpoolP256r1, brainpoolP384r1, brainpoolP512r1, sr25519 and Ed25519. MCP, Pi, OMP and the AI SDK get the lot.

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

| Command                              | Does                                                                  |
| ------------------------------------ | --------------------------------------------------------------------- |
| `curves compute <operation>`         | add, double, negate, multiply, lift, check, order, count, points, log |
| `curves secp256k1 <operation>`       | add, subtract, negate, multiply, lift, check, sign, verify, recover   |
| `curves bip340 <operation>`          | keypair, sign, verify                                                 |
| `curves p256 <operation>`            | add, subtract, negate, multiply, lift, check, verify                  |
| `curves p384 <operation>`            | add, subtract, negate, multiply, lift, check, verify                  |
| `curves p521 <operation>`            | add, subtract, negate, multiply, lift, check, verify                  |
| `curves brainpoolp256r1 <operation>` | add, subtract, negate, multiply, lift, check, verify                  |
| `curves brainpoolp384r1 <operation>` | add, subtract, negate, multiply, lift, check, verify                  |
| `curves brainpoolp512r1 <operation>` | add, subtract, negate, multiply, lift, check, verify                  |
| `curves sr25519 <operation>`         | keypair, sign, verify, derive                                         |
| `curves ed25519 <operation>`         | keypair, sign, verify                                                 |
| `curves mcp`                         | MCP server over stdio                                                 |

Points go in as JSON for `compute`, the same `{"x":…,"y":…}` the tool takes. SEC1 hex goes to `secp256k1`, `p256`, `p384`, `p521`, `brainpoolp256r1`, `brainpoolp384r1` and `brainpoolp512r1`. `--a -3` works, it's reduced mod p. The output is the line a model reads, `--json` makes it pretty.

Every flag comes from the tool schema through `runCli` of [`@agntn/tools`](https://tools.agntn.dev/guide/cli), so `curves <command> --help` never lies about what a command takes.

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

That's most of it, really. Generic curves take bigints and give `null` for the point at infinity. secp256k1 takes and gives hex, and so does `@agntn/curves/sr25519`. `@agntn/curves/ed25519` writes points as hex and takes scalars as bigints, since its bytes read little-endian. A point off the curve throws, never a silent wrong answer. More in [curves and points](https://curves.agntn.dev/math/curves), [orders and logs](https://curves.agntn.dev/math/groups), [secp256k1](https://curves.agntn.dev/math/secp256k1), [sr25519](https://curves.agntn.dev/math/sr25519) and [ed25519](https://curves.agntn.dev/math/ed25519).

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

Tools: `curves_compute`, `curves_secp256k1_compute`, `curves_bip340_compute`, `curves_p256_compute`, `curves_p384_compute`, `curves_p521_compute`, `curves_brainpoolp256r1_compute`, `curves_brainpoolp384r1_compute`, `curves_brainpoolp512r1_compute`, `curves_sr25519_compute` and `curves_ed25519_compute`. The AI SDK versions sit in `@agntn/curves/ai`. Integers travel as decimal or `0x` strings. Infinity comes back as `"infinity"`.

## 🚫 What this does not do

Mnemonics and addresses. That's [@agntn/keys](https://github.com/agntn/keys). Your own curves don't run in constant time either. And a log over a real 256-bit group? Not happening, here or anywhere else.

## 🛠️ Development

```bash
pnpm install     # installs the library and the docs site
pnpm build       # dist/, the CLI and the secp256k1, bip340, p256, p384, p521, brainpoolp256r1, brainpoolp384r1, brainpoolp512r1, ristretto255, sr25519 and ed25519 subpaths
pnpm test        # textbook curves, brute force oracles, Wycheproof, BIP340, RFC 6979, RFC 7027, RFC 9496, RFC 8032 and speccheck, frozen secp256k1, P-256, P-384, P-521, brainpoolP256r1, brainpoolP384r1, brainpoolP512r1, sr25519 and Ed25519 vectors
pnpm lint        # vp lint and vp fmt --check
pnpm typecheck   # src, the extensions, the tests and the docs app, including .vue files
```

The math takes its orders from the specs, and the rest of the house rules live in [CONTRIBUTING.md](CONTRIBUTING.md).

## 💛 Thanks

Made with a lot of help from [Claude for Open Source](https://claude.com/contact-sales/claude-for-oss) and [Codex for Open Source](https://developers.openai.com/community/codex-for-oss). Small packages like this one exist because of them. Thank you.

## 📄 License

[MIT](./LICENSE)
