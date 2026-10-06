import { defineCommand } from "citty";
import { computeCurve } from "../tool-operations.ts";
import { CURVE_OPERATIONS } from "../tool-contract.ts";
import { pointFlag, print } from "./shared.ts";

export default defineCommand({
  meta: {
    name: "compute",
    description:
      "Arithmetic on y^2 = x^3 + ax + b over a prime field: points, orders, counts and discrete logs",
  },
  args: {
    operation: {
      type: "positional",
      required: true,
      description: CURVE_OPERATIONS.join(", "),
    },
    a: {
      type: "string",
      required: true,
      description: "a, decimal or 0x hex, reduced mod p, so -3 works",
    },
    b: { type: "string", required: true, description: "b, decimal or 0x hex, reduced mod p" },
    p: { type: "string", required: true, description: "The field prime, above 3" },
    point: { type: "string", description: "x,y: the point, or the base for log" },
    other: { type: "string", description: "x,y: the second point for add, the target for log" },
    scalar: { type: "string", description: "multiply: any integer" },
    order: { type: "string", description: "points: only the points of this order" },
    limit: { type: "string", description: "points: most points to list" },
  },
  run({ args }) {
    print(() =>
      computeCurve({
        operation: args.operation,
        a: args.a,
        b: args.b,
        p: args.p,
        point: pointFlag(args.point, "point"),
        other: pointFlag(args.other, "other"),
        scalar: args.scalar,
        order: args.order,
        limit: args.limit === undefined ? undefined : Number(args.limit),
      }),
    );
  },
});
