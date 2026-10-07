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
| [CurvesPlayground.vue](app/components/content/CurvesPlayground.vue) | `/playground` under the hero zone | request and response instruments for all three tools |
| [Landing.takumi.vue](app/components/OgImage/Landing.takumi.vue), [Docs.takumi.vue](app/components/OgImage/Docs.takumi.vue) | OG images | the hero zone in 1200 by 600; a docs page as one instrument |

The curves come from [curves.ts](app/utils/curves.ts): a few specs (a, b, p, an optional base, a scalar, a sentence), and the library computes the rest when the module loads. The secp256k1 samples come from [secp.ts](app/utils/secp.ts) through the tool executor, the sr25519 ones from [sr25519.ts](app/utils/sr25519.ts). Counts and limits come from `src/tool-contract.ts` through [contract.ts](app/utils/contract.ts).

## Anatomy

- **Field.** Bar `Call multiplyPoint(curve, G, <k>n)` with the whole call in the tooltip, meta `F<p> · 01 / 05`. The subject band's left column holds the curve (reticle with the spline glyph, `Curve / F<p>`, the equation, one sentence; every sample's name block hidden in the same cell, so the band keeps one height) and under it the board: rule `Field [ every point, and the walk from G to kG ]`, then the plot and the walk side by side. The plot is a square of 100 units: one quiet square per point, x right and y up, ticks on two edges, the walk as one accent polyline drawn once per sample, G as an open square and kG filled in the accent. The walk beside it is always eight rows: the first five multiples, a gap row that counts the rest, the last two, kG in the accent. Readout: points with infinity, G, the order of G, kG in the accent, the log back (with the `discreteLog` call in the tooltip); a tick per multiple up to the order, the walked ones open. Footer: link to the groups page, previous and next.
- **Tool call.** Bar `Call curves_compute("log", p <p>)`, the full arguments in the tooltip. Subject: target reticle, `Tool / log`, the question as the heading. Readout: base, target, order, scalar in the accent. `03 Full tool response` is the tool text.
- **secp256k1.** Bar `Call curves_secp256k1_compute("<operation>")`, rolling with the landing's clock. Subject: key reticle, `secp256k1 / <operation>`, a heading and one sentence. Readout: three rows always, the arguments shortened to their ends with the whole value in a tooltip, the result in the accent.
- **Playground.** Request: every operation of the three tools as a lead (19), the fields as `UInput` with variant `none` in the readout (a, b and p for the curve tool, point fields as `x,y`), `compressed`, `encoding` and `hard` as checkboxes, the key an sr25519 keypair or derive starts from as a `from` row of chips, one chip per landing curve, secp256k1 sample or sr25519 sample as `UButton` variant `chip`, CLI and tool JSON with copy. Response: one subject band with a reticle by answer kind (spline, sigma, scatter, target, orbit, check, key, signature, branch, alert), the heading the answer itself (`k = 13`, `19 points`, a point), rows from the details, a points band for a listing, `03 Full tool response`, footer with the measured milliseconds.

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
- Two docs sections, Guide with four pages and Math with five. No roster: the package has no registry of entries, only three tools.
- No network call anywhere: every instrument computes in the browser from the library, and every footer that names locality says so.
- The version comes from the root `package.json`; there's no data version.
- The OG images ship local Figtree and Fira Code TTFs, the keys mechanism.
- There's no `public/image.png`, since `package.json` points Pi at no image.

## Checks

Beyond the shared checks: `/`, `/math/groups`, `/math/secp256k1` and `/playground` with a deep link for each tool (`?op=compute:log&a=2&b=2&p=17&point=5,1&other=16,4`, `?op=secp256k1:multiply&point=0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798&scalar=3&uncompressed=true`, `?op=sr25519:verify&publicKey=d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d&message=hello&signature=dcd271ee89206ca33f53e56e69947f54bc4642c5088eb13a55520f38f89ffd1236edd2fc8bcb13d8fab81a455fbd2f0d86d05bd805ea42299e2a75cd346f5885`) at 1440, 1024 and 390 px, every landing curve through previous and next, no horizontal scroll at 320 px, and `/llms-full.txt` answering 200.
