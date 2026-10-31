# Design system

The shared rules (direction, color roles, type, the `console-*` grammar, hero, docs chrome, density, motion, checks) live in the one agntn design system document, kept with the agntn skills until it ships in the shared package. This file records only what curves owns and where it departs from the shared rules. It does not repeat them.

The instruments curves owns:

| Instrument | Where | Object |
| --- | --- | --- |
| [LandingHero.vue](app/components/content/LandingHero.vue) | landing, first screen | hero zone, circuit `multiply` into the field |
| [LandingField.vue](app/components/content/LandingField.vue) | under the hero | one small curve: every point over F_p, the walk from G to kG, and the log back |
| [LandingToolCall.vue](app/components/content/LandingToolCall.vue) | "Ask for k, get k" | one `curves_compute` log call on the walk's curve, full text in the dialog |
| [LandingSecp.vue](app/components/content/LandingSecp.vue) | "secp256k1, no noble" | one `curves_secp256k1_compute` call: 3G, half of G, lift, G + 2G, -G |
| [LandingAgents.vue](app/components/content/LandingAgents.vue) | "N tools, one executor", N from `TOOLS` | `mcp.json` with the Pi and OMP installs, as a file |
| [LandingStart.vue](app/components/content/LandingStart.vue) | last section | install, first call, the notes |
| [CurvesPlayground.vue](app/components/content/CurvesPlayground.vue) | `/playground` under the hero zone | request and response instruments for every tool |
| [Landing.takumi.vue](app/components/OgImage/Landing.takumi.vue), [Docs.takumi.vue](app/components/OgImage/Docs.takumi.vue) | OG images | the hero zone in 1200 by 600; a docs page as one instrument |

The curves come from [curves.ts](app/utils/curves.ts): a few specs (a, b, p, an optional base, a scalar, a sentence), and the library computes the rest when the module loads. Counts and limits come from `src/tool-contract.ts` through [contract.ts](app/utils/contract.ts). The samples:

- secp256k1 points from [secp.ts](app/utils/secp.ts), through the tool executor.
- BIP340 vectors from [bip340.ts](app/utils/bip340.ts).
- The RFC 6979 P-256 key from [p256.ts](app/utils/p256.ts).
- The RFC 6979 P-384 key from [p384.ts](app/utils/p384.ts).
- The RFC 6979 P-521 key from [p521.ts](app/utils/p521.ts).
- The Wycheproof brainpoolP256r1 key from [brainpoolp256r1.ts](app/utils/brainpoolp256r1.ts).
- The Wycheproof brainpoolP384r1 key from [brainpoolp384r1.ts](app/utils/brainpoolp384r1.ts).
- The Wycheproof brainpoolP512r1 key from [brainpoolp512r1.ts](app/utils/brainpoolp512r1.ts).
- sr25519 keys from [sr25519.ts](app/utils/sr25519.ts).
- Ed25519 vectors from [ed25519.ts](app/utils/ed25519.ts).

## Anatomy

- **Field.** Bar `Call multiplyPoint(curve, G, <k>n)` with the whole call in the tooltip, meta `F<p> · 01 / 05`. The subject band's left column holds the curve (reticle with the spline glyph, `Curve / F<p>`, the equation, one sentence; every sample's name block hidden in the same cell, so the band keeps one height) and under it the board: rule `Field [ every point, and the walk from G to kG ]`, then the plot and the walk side by side. The plot is a square of 100 units: one quiet square per point, x right and y up, ticks on two edges, the walk as one accent polyline drawn once per sample, G as an open square and kG filled in the accent. The walk beside it is always eight rows: the first five multiples, a gap row that counts the rest, the last two, kG in the accent. Readout: points with infinity, G, the order of G, kG in the accent, the log back (with the `discreteLog` call in the tooltip); a tick per multiple up to the order, the walked ones open. Footer: link to the groups page, previous and next.
- **Tool call.** Bar `Call curves_compute("log", p <p>)`, the full arguments in the tooltip. Subject: target reticle, `Tool / log`, the question as the heading. Readout: base, target, order, scalar in the accent. `03 Full tool response` is the tool text.
- **secp256k1.** Bar `Call curves_secp256k1_compute("<operation>")`, rolling with the landing's clock. Subject: key reticle, `secp256k1 / <operation>`, a heading and one sentence. Readout: three rows always, the arguments shortened to their ends with the whole value in a tooltip, the result in the accent.
- **Playground.** A request instrument and a response instrument.
  - Request: every operation of every tool as a lead, its count from `OPERATION_COUNT`. The fields are `UInput` with variant `none` in the readout: a, b and p for the curve tool, point fields as `x,y`.
  - Checkboxes: `compressed`, `encoding`, `hard`, and the strict rules of Ed25519 (`zip215: false`).
  - Chips, all `UButton` variant `chip`: the key an sr25519 keypair or derive starts from as a `from` row, then one per landing curve, secp256k1 sample, BIP340 vector, P-256 sample, P-384 sample, P-521 sample, brainpoolP256r1 sample, brainpoolP384r1 sample, brainpoolP512r1 sample, sr25519 sample or Ed25519 vector. CLI and tool JSON with copy.
  - Response: one subject band with a reticle by answer kind (spline, sigma, scatter, target, orbit, check, key, signature, branch, alert). The heading is the answer itself (`k = 13`, `19 points`, a point).
  - Below it: rows from the details, a points band for a listing, `03 Full tool response`, and a footer with the measured milliseconds.

## Motion

| Change | Motion |
| --- | --- |
| landing sample advances (6 s, paused on hover and focus) | ruler cursor once, scan and reticle arcs, the walk draws over 1.6 s, readout and walk rows slide in, gauge ticks rise, circuit runs once |
| playground answer changes | cursor and scan once per answer text, 250 ms after the form stops changing |
| reduced motion | no walk and no drawing; the polyline is there whole, manual previous and next still work |

## Differences

Departures from the shared rules, recorded for the shared package:

- The hero instrument draws the group, not a record dossier: the domain is points on a grid, so the first screen shows all of them and the path a scalar takes through them.
- The readout labels keep their case. a, b, p, G and kG are names in an equation, and an uppercase A is a different thing from a.
- Two docs sections, Guide with four pages and Math with eleven. No roster: the package has no registry of entries, only its tools.
- No network call anywhere: every instrument computes in the browser from the library, and every footer that names locality says so.
- The version comes from the root `package.json`; there's no data version.
- The OG images ship local Figtree and Fira Code TTFs, the keys mechanism.
- There's no `public/image.png`, since `package.json` points Pi at no image.

## Checks

Beyond the shared checks: `/`, `/math/groups`, `/math/secp256k1` and `/playground` with a deep link for each tool (`?op=compute:log&a=2&b=2&p=17&point=5,1&other=16,4`, `?op=secp256k1:multiply&point=0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798&scalar=3&uncompressed=true`, `?op=secp256k1:sign&secret=1&digest=7a05c6145f10101e9d6325494245adf1297d80f8f38d4d576d57cdba220bcb19`, `?op=bip340:verify&publicKey=dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659&message=243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89&signature=6896bd60eeae296db48a229ff71dfe071bde413e6d43f917dc8dcf8c78de33418906d11ac976abccb20b091292bff4ea897efcb639ea871cfa95f6de339e4b0a`, `?op=bip340:sign&secret=b7e151628aed2a6abf7158809cf4f3c762e7160f38b4da56a784d9045190cfef&message=243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89&random=0000000000000000000000000000000000000000000000000000000000000001`, `?op=p256:verify&point=0460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299&digest=af2bdbe1aa9b6ec1e2ade1d694f41fc71a831d0268e9891562113d8a62add1bf&signature=efd48b2aacb6a8fd1140dd9cd45e81d69d2c877b56aaf991c34d0ea84eaf3716f7cb1c942d657c41d436c7a1b6e29f65f3e900dbb9aff4064dc4ab2f843acda8`, `?op=p384:verify&point=04ec3a4e415b4e19a4568618029f427fa5da9a8bc4ae92e02e06aae5286b300c64def8f0ea9055866064a254515480bc138015d9b72d7d57244ea8ef9ac0c621896708a59367f9dfb9f54ca84b3f1c9db1288b231c3ae0d4fe7344fd2533264720&digest=9a9083505bc92276aec4be312696ef7bf3bf603f4bbd381196a029f340585312313bca4a9b5b890efee42c77b1ee25fe&signature=94edbb92a5ecb8aad4736e56c691916b3f88140666ce9fa73d64c4ea95ad133c81a648152e44acf96e36dd1e80fabe4699ef4aeb15f178cea1fe40db2603138f130e740a19624526203b6351d0a3a94fa329c145786e679e7b82c71a38628ac8`, `?op=sr25519:verify&publicKey=d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d&message=hello&signature=dcd271ee89206ca33f53e56e69947f54bc4642c5088eb13a55520f38f89ffd1236edd2fc8bcb13d8fab81a455fbd2f0d86d05bd805ea42299e2a75cd346f5885`, `?op=ed25519:verify&publicKey=c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa&message=8c93255d71dcab10e8f379c26200f3c7bd5f09d9bc3068d3ef4edeb4853022b6&signature=c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a0000000000000000000000000000000000000000000000000000000000000000&zip215=false`, `?op=ed25519:sign&secret=4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb&message=72`) at 1440, 1024 and 390 px, every landing curve through previous and next, the secp256k1 panel at one height through all its samples, no horizontal scroll at 320 px, and `/llms-full.txt` answering 200.
