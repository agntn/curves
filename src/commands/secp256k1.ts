import { defineCommand } from "citty";
import { computeSecp256k1 } from "../tool-operations.ts";
import { SECP256K1_OPERATIONS } from "../tool-contract.ts";
import { print } from "./shared.ts";

export default defineCommand({
  meta: {
    name: "secp256k1",
    description: "Point math on secp256k1 with SEC1 hex points",
  },
  args: {
    operation: {
      type: "positional",
      required: true,
      description: SECP256K1_OPERATIONS.join(", "),
    },
    point: { type: "string", description: "SEC1 hex, compressed or uncompressed" },
    other: { type: "string", description: "add and subtract: the second point" },
    scalar: { type: "string", description: "multiply: 1 to n - 1 as hex without 0x" },
    x: { type: "string", description: "lift: x as 64 hex digits" },
    uncompressed: { type: "boolean", description: "Write 65-byte SEC1 points" },
  },
  run({ args }) {
    print(() =>
      computeSecp256k1({
        operation: args.operation,
        point: args.point,
        other: args.other,
        scalar: args.scalar,
        x: args.x,
        ...(args.uncompressed === true ? { compressed: false } : {}),
      }),
    );
  },
});
