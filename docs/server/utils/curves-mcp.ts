import { callTool, toolListings } from "@agntn/curves/mcp";
import {
  defineMcpTool,
  type McpToolDefinition,
  type McpToolDefinitionListItem,
} from "@nuxtjs/mcp-toolkit/server";
import { z } from "zod";

/**
 * A `curves mcp` tool for Docus: its own schema in `tools/list`, its own checks on the call.
 *
 * @param {string} name - The tool's name, such as `curves_compute`.
 * @returns {McpToolDefinitionListItem} The tool definition for `server/mcp/tools/`.
 */
export function curvesMcpTool(name: string): McpToolDefinitionListItem {
  const listing = toolListings.find((candidate) => candidate.name === name);
  if (listing === undefined) {
    throw new Error(`Unknown curves tool: ${name}`);
  }
  /** Any object passes Zod, so `callTool` refuses a bad one in the words of stdio. */
  const schema = z.looseObject({});
  schema._zod.toJSONSchema = () => ({ ...listing.inputSchema });
  /** The SDK hands Zod a missing `arguments` as is, so read it as the `{}` stdio gets. */
  const run = schema._zod.run.bind(schema._zod);
  schema._zod.run = (payload, context) =>
    run(payload.value === undefined ? { ...payload, value: {} } : payload, context);
  /** The toolkit types a raw shape only; the SDK it feeds takes an object too. */
  const inputSchema = schema as unknown as NonNullable<McpToolDefinition["inputSchema"]>;
  return defineMcpTool({
    name: listing.name,
    title: listing.title,
    description: listing.description,
    annotations: listing.annotations,
    inputSchema,
    handler: (args: Readonly<Record<string, unknown>>, extra) =>
      callTool(name, args, { signal: extra.signal }),
  });
}
