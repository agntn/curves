/** The CLI command of each tool, which is also its name in the operation list. */
export const COMMANDS = {
  curves_compute: "compute",
  curves_secp256k1_compute: "secp256k1",
  curves_bip340_compute: "bip340",
  curves_p256_compute: "p256",
  curves_p384_compute: "p384",
  curves_p521_compute: "p521",
  curves_brainpoolp256r1_compute: "brainpoolp256r1",
  curves_brainpoolp384r1_compute: "brainpoolp384r1",
  curves_brainpoolp512r1_compute: "brainpoolp512r1",
  curves_sr25519_compute: "sr25519",
  curves_ed25519_compute: "ed25519",
  curves_ed448_compute: "ed448",
} as const;

/** A tool the playground has rows for. */
export type PlaygroundTool = keyof typeof COMMANDS;

/** An sr25519 key the operation can start from. The tool takes exactly one. */
export type KeySource = "seed" | "secret" | "publicKey";

type Field =
  | "point"
  | "other"
  | "scalar"
  | "order"
  | "limit"
  | "x"
  | "compressed"
  | "source"
  | "secret"
  | "publicKey"
  | "message"
  | "encoding"
  | "signature"
  | "digest"
  | "recovery"
  | "lowS"
  | "chainCode"
  | "hard"
  | "zip215"
  | "context"
  | "random";

export interface Operation {
  /** `compute:log`, `secp256k1:lift` or `sr25519:sign`, unique across the tools. */
  readonly key: string;
  readonly tool: PlaygroundTool;
  /** The `operation` argument. */
  readonly op: string;
  readonly takes: readonly Field[];
  /** The keys `source` picks from, the first one by default. */
  readonly sources?: readonly KeySource[];
  readonly about: string;
}

/** Every operation of every tool, in the order the tools list them. */
export const OPERATIONS: readonly Operation[] = [
  { key: "compute:add", tool: "curves_compute", op: "add", takes: ["point", "other"], about: "Add two points of the curve." },
  { key: "compute:double", tool: "curves_compute", op: "double", takes: ["point"], about: "Twice a point, infinity for a point with y = 0." },
  { key: "compute:negate", tool: "curves_compute", op: "negate", takes: ["point"], about: "Same x, the other y." },
  { key: "compute:multiply", tool: "curves_compute", op: "multiply", takes: ["point", "scalar"], about: "A point times any integer, a negative one multiplies the negation." },
  { key: "compute:lift", tool: "curves_compute", op: "lift", takes: ["x"], about: "Every point above an x, smaller y first. A compressed point is just x and a parity bit." },
  { key: "compute:check", tool: "curves_compute", op: "check", takes: ["point"], about: "Whether a point lies on the curve." },
  { key: "compute:order", tool: "curves_compute", op: "order", takes: ["point"], about: "The smallest n with n times the point at infinity." },
  { key: "compute:count", tool: "curves_compute", op: "count", takes: [], about: "How many points the curve has, infinity included." },
  { key: "compute:points", tool: "curves_compute", op: "points", takes: ["order", "limit"], about: "Infinity, then the points by x then y. With an order, only the points of that order." },
  { key: "compute:log", tool: "curves_compute", op: "log", takes: ["point", "other"], about: "The smallest k with k times the base equal to the target." },
  { key: "secp256k1:add", tool: "curves_secp256k1_compute", op: "add", takes: ["point", "other", "compressed"], about: "The sum of two secp256k1 points." },
  { key: "secp256k1:subtract", tool: "curves_secp256k1_compute", op: "subtract", takes: ["point", "other", "compressed"], about: "The offset between two known points." },
  { key: "secp256k1:negate", tool: "curves_secp256k1_compute", op: "negate", takes: ["point", "compressed"], about: "Same x, the other y. Only the prefix changes." },
  { key: "secp256k1:multiply", tool: "curves_secp256k1_compute", op: "multiply", takes: ["point", "scalar", "compressed"], about: "A point times a scalar from 1 to n - 1. G times a private key is its public key." },
  { key: "secp256k1:lift", tool: "curves_secp256k1_compute", op: "lift", takes: ["x", "compressed"], about: "Both points above an x. The even one is what a BIP340 key stands for." },
  { key: "secp256k1:check", tool: "curves_secp256k1_compute", op: "check", takes: ["point"], about: "Whether a SEC1 point lies on secp256k1." },
  { key: "secp256k1:sign", tool: "curves_secp256k1_compute", op: "sign", takes: ["secret", "digest", "compressed"], about: "Sign a digest with ECDSA. RFC 6979 picks k from the key and the digest, so the bytes never change. Low s, recovery id included." },
  { key: "secp256k1:nonce", tool: "curves_secp256k1_compute", op: "nonce", takes: ["secret", "digest"], about: "Read the secp256k1 signing nonce. It belongs in test vectors, not public logs. Anyone with it and the signature can walk away with the key." },
  { key: "secp256k1:verify", tool: "curves_secp256k1_compute", op: "verify", takes: ["point", "digest", "signature", "lowS"], about: "Check whether a key signed a digest. G didn't. The block 170 chip loads Satoshi's key, which did." },
  { key: "secp256k1:recover", tool: "curves_secp256k1_compute", op: "recover", takes: ["digest", "signature", "recovery", "compressed"], about: "Recover a verifying key from a digest, signature and id. For block 170, ids 0 and 1 both verify, but only 1 is Satoshi's." },
  { key: "bip340:keypair", tool: "curves_bip340_compute", op: "keypair", takes: ["secret"], about: "A 32-byte secret in, the x-only key out. y doesn't make the trip, it's whichever one is even." },
  { key: "bip340:sign", tool: "curves_bip340_compute", op: "sign", takes: ["secret", "message", "random"], about: "Sign the BIP340 way. Leave random empty and fresh bytes go in, so every signature differs and all of them verify." },
  { key: "bip340:verify", tool: "curves_bip340_compute", op: "verify", takes: ["publicKey", "message", "signature"], about: "The pi message comes with a signature. Flip a bit and see what verify says." },
  { key: "p256:add", tool: "curves_p256_compute", op: "add", takes: ["point", "other", "compressed"], about: "The sum of two P-256 points." },
  { key: "p256:subtract", tool: "curves_p256_compute", op: "subtract", takes: ["point", "other", "compressed"], about: "The offset between two P-256 points." },
  { key: "p256:negate", tool: "curves_p256_compute", op: "negate", takes: ["point", "compressed"], about: "Same x, the other y. Only the SEC1 prefix changes." },
  { key: "p256:multiply", tool: "curves_p256_compute", op: "multiply", takes: ["point", "scalar", "compressed"], about: "A point times a scalar from 1 to n - 1. G times a private key is its public key." },
  { key: "p256:lift", tool: "curves_p256_compute", op: "lift", takes: ["x", "compressed"], about: "Both points above an x. Try x = 1. Nobody's home." },
  { key: "p256:check", tool: "curves_p256_compute", op: "check", takes: ["point"], about: "Check a SEC1 point on P-256. secp256k1's G is on the wrong curve." },
  { key: "p256:sign", tool: "curves_p256_compute", op: "sign", takes: ["secret", "digest", "compressed"], about: "Sign a digest on P-256. The RFC's r matches, but its high s gets flipped low." },
  { key: "p256:nonce", tool: "curves_p256_compute", op: "nonce", takes: ["secret", "digest"], about: "Read the P-256 nonce k. The RFC sample's starts a6e3c57d. Keep k secret. With the signature, it's enough to compute the key." },
  { key: "p256:verify", tool: "curves_p256_compute", op: "verify", takes: ["point", "digest", "signature", "lowS"], about: "Check ECDSA over a digest. The default signature doesn't verify with G. The RFC 6979 key chip loads the key that does." },
  { key: "p256:recover", tool: "curves_p256_compute", op: "recover", takes: ["digest", "signature", "recovery", "compressed"], about: "Recover a P-256 public key from a signature and id. Id 0 finds the RFC key. Id 1 finds a stranger." },
  { key: "p384:add", tool: "curves_p384_compute", op: "add", takes: ["point", "other", "compressed"], about: "Add two P-384 points. The coordinates brought 48 bytes each." },
  { key: "p384:subtract", tool: "curves_p384_compute", op: "subtract", takes: ["point", "other", "compressed"], about: "Subtract one P-384 point from another. The result is another point." },
  { key: "p384:negate", tool: "curves_p384_compute", op: "negate", takes: ["point", "compressed"], about: "Same x, opposite y. In compressed form, only the prefix changes. Efficient, frankly." },
  { key: "p384:multiply", tool: "curves_p384_compute", op: "multiply", takes: ["point", "scalar", "compressed"], about: "Multiply by a scalar from 1 to n - 1. The default is 3." },
  { key: "p384:lift", tool: "curves_p384_compute", op: "lift", takes: ["x", "compressed"], about: "Find both points above an x, even and odd. At x = 1, neither shows up." },
  { key: "p384:check", tool: "curves_p384_compute", op: "check", takes: ["point"], about: "Check whether a SEC1 point lies on P-384. A P-256 point is 16 bytes short." },
  { key: "p384:sign", tool: "curves_p384_compute", op: "sign", takes: ["secret", "digest", "compressed"], about: "Give P-384 a secret and digest to sign. The RFC's r stays put, but its high s doesn't." },
  { key: "p384:nonce", tool: "curves_p384_compute", op: "nonce", takes: ["secret", "digest"], about: "Find the P-384 nonce k. The RFC sample's starts 94ed910d. It's a secret. Hand over k and the signature and the key follows." },
  { key: "p384:verify", tool: "curves_p384_compute", op: "verify", takes: ["point", "digest", "signature", "lowS"], about: "Check ECDSA over a digest. G didn't sign this one. The RFC 6979 key chip loads the key that did." },
  { key: "p384:recover", tool: "curves_p384_compute", op: "recover", takes: ["digest", "signature", "recovery", "compressed"], about: "Try a P-384 signature with a recovery id. Id 1 finds the RFC key. On P-256, that id finds another." },
  { key: "p521:add", tool: "curves_p521_compute", op: "add", takes: ["point", "other", "compressed"], about: "Add two P-521 points. Each coordinate gets 66 bytes." },
  { key: "p521:subtract", tool: "curves_p521_compute", op: "subtract", takes: ["point", "other", "compressed"], about: "Subtract one P-521 point from another. Order matters." },
  { key: "p521:negate", tool: "curves_p521_compute", op: "negate", takes: ["point", "compressed"], about: "Keep x and flip y. The compressed prefix does the talking." },
  { key: "p521:multiply", tool: "curves_p521_compute", op: "multiply", takes: ["point", "scalar", "compressed"], about: "Multiply a point by a scalar. The default is 3." },
  { key: "p521:lift", tool: "curves_p521_compute", op: "lift", takes: ["x", "compressed"], about: "Find both points above an x. 0, 1 and 2 all have some. Knock on 3 and nobody answers." },
  { key: "p521:check", tool: "curves_p521_compute", op: "check", takes: ["point"], about: "Check whether a SEC1 point lies on P-521. A compressed P-384 point is 18 bytes short." },
  { key: "p521:sign", tool: "curves_p521_compute", op: "sign", takes: ["secret", "digest", "compressed"], about: "Ask P-521 to sign a digest. All 132 bytes match the RFC. Its s was already low." },
  { key: "p521:nonce", tool: "curves_p521_compute", op: "nonce", takes: ["secret", "digest"], about: "Meet the P-521 nonce k. The RFC sample's starts 01dae2ea. Treat k as a secret. It and the signature give away the key." },
  { key: "p521:verify", tool: "curves_p521_compute", op: "verify", takes: ["point", "digest", "signature", "lowS"], about: "Check ECDSA over a digest. The default signature doesn't verify with G. The RFC 6979 key chip loads the key that did." },
  { key: "p521:recover", tool: "curves_p521_compute", op: "recover", takes: ["digest", "signature", "recovery", "compressed"], about: "Use an id to recover a P-521 public key. Id 0 finds the RFC key. Id 1 still verifies with another." },
  { key: "brainpoolp256r1:add", tool: "curves_brainpoolp256r1_compute", op: "add", takes: ["point", "other", "compressed"], about: "Add two brainpoolP256r1 points. G and 2G gives you a start." },
  { key: "brainpoolp256r1:subtract", tool: "curves_brainpoolp256r1_compute", op: "subtract", takes: ["point", "other", "compressed"], about: "Take one brainpoolP256r1 point away from another. Order matters." },
  { key: "brainpoolp256r1:negate", tool: "curves_brainpoolp256r1_compute", op: "negate", takes: ["point", "compressed"], about: "Flip y while keeping x. The compressed prefix changes." },
  { key: "brainpoolp256r1:multiply", tool: "curves_brainpoolp256r1_compute", op: "multiply", takes: ["point", "scalar", "compressed"], about: "Multiply a brainpoolP256r1 point by a scalar. That's repeated addition, not coordinate multiplication." },
  { key: "brainpoolp256r1:lift", tool: "curves_brainpoolp256r1_compute", op: "lift", takes: ["x", "compressed"], about: "Find points above an x. Zero has none, one has a point." },
  { key: "brainpoolp256r1:check", tool: "curves_brainpoolp256r1_compute", op: "check", takes: ["point"], about: "Check a SEC1 point on brainpoolP256r1. P-256's compressed generator passes too, so appearances aren't enough." },
  { key: "brainpoolp256r1:sign", tool: "curves_brainpoolp256r1_compute", op: "sign", takes: ["secret", "digest", "compressed"], about: "Put a digest through brainpoolP256r1 signing. Secret 1 gives public key G. That's a secret anyone can guess." },
  { key: "brainpoolp256r1:nonce", tool: "curves_brainpoolp256r1_compute", op: "nonce", takes: ["secret", "digest"], about: "See the brainpoolP256r1 nonce k for the given secret and digest. Guard k as a secret. With the signature, it gives away the key." },
  { key: "brainpoolp256r1:verify", tool: "curves_brainpoolp256r1_compute", op: "verify", takes: ["point", "digest", "signature", "lowS"], about: "Verify ECDSA over a digest. The default G fails. Load Wycheproof key for a matching key." },
  { key: "brainpoolp256r1:recover", tool: "curves_brainpoolp256r1_compute", op: "recover", takes: ["digest", "signature", "recovery", "compressed"], about: "Pick an id to recover a brainpoolP256r1 public key. Id 0 finds the Wycheproof key. Id 1 finds another that verifies." },
  { key: "brainpoolp384r1:add", tool: "curves_brainpoolp384r1_compute", op: "add", takes: ["point", "other", "compressed"], about: "Add brainpoolP384r1 points. Try G and 2G for a start." },
  { key: "brainpoolp384r1:subtract", tool: "curves_brainpoolp384r1_compute", op: "subtract", takes: ["point", "other", "compressed"], about: "Subtract one brainpoolP384r1 point from another. The order matters." },
  { key: "brainpoolp384r1:negate", tool: "curves_brainpoolp384r1_compute", op: "negate", takes: ["point", "compressed"], about: "Keep x, flip y. The compressed prefix flips between 02 and 03." },
  { key: "brainpoolp384r1:multiply", tool: "curves_brainpoolp384r1_compute", op: "multiply", takes: ["point", "scalar", "compressed"], about: "Multiply a point by a scalar. It's repeated addition, not coordinate multiplication." },
  { key: "brainpoolp384r1:lift", tool: "curves_brainpoolp384r1_compute", op: "lift", takes: ["x", "compressed"], about: "Try x = 0, 1, 2, 3. No point, point, no point, point." },
  { key: "brainpoolp384r1:check", tool: "curves_brainpoolp384r1_compute", op: "check", takes: ["point"], about: "P-384's 2G passes this check. Same length doesn't mean same curve." },
  { key: "brainpoolp384r1:sign", tool: "curves_brainpoolp384r1_compute", op: "sign", takes: ["secret", "digest", "compressed"], about: "Start brainpoolP384r1 signing with secret 1 and a digest. The public key is G. Secret 1 isn't exactly hard to guess." },
  { key: "brainpoolp384r1:nonce", tool: "curves_brainpoolp384r1_compute", op: "nonce", takes: ["secret", "digest"], about: "Check the 48 byte brainpoolP384r1 nonce k. Keep it secret. Anyone with k and the signature can compute the secret key." },
  { key: "brainpoolp384r1:verify", tool: "curves_brainpoolp384r1_compute", op: "verify", takes: ["point", "digest", "signature", "lowS"], about: "The default G fails verification. Wycheproof key gives the signature its matching key." },
  { key: "brainpoolp384r1:recover", tool: "curves_brainpoolp384r1_compute", op: "recover", takes: ["digest", "signature", "recovery", "compressed"], about: "Test a brainpoolP384r1 signature with a recovery id. The Wycheproof key appears at 0. A different verifying key appears at 1." },
  { key: "brainpoolp512r1:add", tool: "curves_brainpoolp512r1_compute", op: "add", takes: ["point", "other", "compressed"], about: "Add brainpoolP512r1 points. G and 2G make a good starting pair." },
  { key: "brainpoolp512r1:subtract", tool: "curves_brainpoolp512r1_compute", op: "subtract", takes: ["point", "other", "compressed"], about: "Order matters here. Swap the points and you change the subtraction." },
  { key: "brainpoolp512r1:negate", tool: "curves_brainpoolp512r1_compute", op: "negate", takes: ["point", "compressed"], about: "Flip y, keep x. The compressed prefix switches between 02 and 03." },
  { key: "brainpoolp512r1:multiply", tool: "curves_brainpoolp512r1_compute", op: "multiply", takes: ["point", "scalar", "compressed"], about: "A scalar repeats point addition. It doesn't multiply the coordinates." },
  { key: "brainpoolp512r1:lift", tool: "curves_brainpoolp512r1_compute", op: "lift", takes: ["x", "compressed"], about: "Zero, one, two miss. At x = 3, you finally get two points." },
  { key: "brainpoolp512r1:check", tool: "curves_brainpoolp512r1_compute", op: "check", takes: ["point"], about: "No other curve here shares this point width. A matching length still isn't enough." },
  { key: "brainpoolp512r1:sign", tool: "curves_brainpoolp512r1_compute", op: "sign", takes: ["secret", "digest", "compressed"], about: "Let brainpoolP512r1 sign a digest with secret 1. Its public key is G. Everybody knows this secret." },
  { key: "brainpoolp512r1:nonce", tool: "curves_brainpoolp512r1_compute", op: "nonce", takes: ["secret", "digest"], about: "Look at the 64 byte brainpoolP512r1 nonce k. k must stay secret. Pair it with the signature to compute the key." },
  { key: "brainpoolp512r1:verify", tool: "curves_brainpoolp512r1_compute", op: "verify", takes: ["point", "digest", "signature", "lowS"], about: "G fails with the default signature. The Wycheproof key gets a true." },
  { key: "brainpoolp512r1:recover", tool: "curves_brainpoolp512r1_compute", op: "recover", takes: ["digest", "signature", "recovery", "compressed"], about: "Find a brainpoolP512r1 public key from a signature and id. Id 0 gets the Wycheproof key. Id 1 gets a different key." },
  { key: "sr25519:keypair", tool: "curves_sr25519_compute", op: "keypair", takes: ["source"], sources: ["seed", "secret"], about: "A 32-byte seed grows into a secret and a public key. A secret alone gives back its public key." },
  { key: "sr25519:sign", tool: "curves_sr25519_compute", op: "sign", takes: ["secret", "message", "encoding"], about: "Sign under the substrate context. Fresh randomness each time, so the bytes change and both still verify." },
  { key: "sr25519:verify", tool: "curves_sr25519_compute", op: "verify", takes: ["publicKey", "message", "encoding", "signature"], about: "Whether the key signed these bytes. A wrong signature is a plain false, not an error." },
  { key: "sr25519:derive", tool: "curves_sr25519_compute", op: "derive", takes: ["source", "chainCode", "hard"], sources: ["seed", "secret", "publicKey"], about: "A child as Substrate HDKD makes it. Hard needs the seed or secret. Soft follows from the public key too." },
  { key: "ed25519:keypair", tool: "curves_ed25519_compute", op: "keypair", takes: ["secret"], about: "32 bytes of secret in, the public key out. SHA-512 and a clamp sit in between." },
  { key: "ed25519:sign", tool: "curves_ed25519_compute", op: "sign", takes: ["secret", "message"], about: "Sign as RFC 8032 does. Same secret, same message, same bytes, every single time." },
  { key: "ed25519:verify", tool: "curves_ed25519_compute", op: "verify", takes: ["publicKey", "message", "signature", "zip215"], about: "Check an Ed25519 signature. An order 8 key can pass ZIP 215. Tick strict and watch it fail." },
  { key: "ed448:verify", tool: "curves_ed448_compute", op: "verify", takes: ["publicKey", "message", "signature", "context"], about: "Check an Ed448 signature. The context is part of what got signed, so the wrong one fails." },
];
