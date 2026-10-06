import {
  callTool as callListedTool,
  createMcpServer as createToolServer,
  errorResult,
  listTools,
} from "@agntn/tools/mcp";
import type { CallToolResult, Server, Tool } from "@modelcontextprotocol/server";
import { sourceChangeCheck } from "./source-change.ts";
import { curvesTools } from "./tools.ts";
import { version } from "./version.ts";

const restart = "src/ changed under this server, restart it to load the new code";

/** Taken as `src/` loads, so a server built later can't adopt a pull its cached modules missed. */
const changed = import.meta.url.endsWith(".ts")
  ? sourceChangeCheck(import.meta.dirname)
  : undefined;

/** The `tools/list` entries shared by `curves mcp` and the MCP server of the docs site. */
export const toolListings: readonly Tool[] = listTools(curvesTools);

/** What a host running the tools for someone else can add to a call. */
export interface CallToolOptions {
  /** Passed to the tool as is; the executors are synchronous and stop at their limits. */
  readonly signal?: Readonly<AbortSignal>;
}

/**
 * Runs one tool as `tools/call` of `curves mcp` does: errors as results, never a throw.
 *
 * @param {string} name - The tool's name, such as `curves_compute`.
 * @param {unknown} args - The arguments the client sent.
 * @param {CallToolOptions} [options] - A signal.
 * @returns {Promise<CallToolResult>} The tool's text, or the sanitized error.
 */
export function callTool(
  name: string,
  args: unknown,
  options: Readonly<CallToolOptions> = {},
): Promise<CallToolResult> {
  return callListedTool(
    { name: "curves" },
    curvesTools,
    name,
    args,
    options.signal === undefined ? {} : { signal: options.signal },
  );
}

/**
 * Creates an unconnected MCP server exposing the curve tools. Run from `src/`, it answers a call
 * with a restart line once that tree changed, checked before the name and the schema and again when
 * the tool fails. A call that succeeds while a pull lands keeps its answer; the next one refuses.
 *
 * @returns {Server} Unconnected MCP server.
 */
export function createMcpServer(): Server {
  const server = createToolServer({ name: "curves", version }, curvesTools);
  if (!changed) return server;

  server.setRequestHandler("tools/call", async (request, ctx) => {
    if (changed()) return errorResult(restart);
    const result = await callTool(request.params.name, request.params.arguments, {
      signal: ctx.mcpReq.signal,
    });
    return result.isError === true && changed() ? errorResult(restart) : result;
  });
  return server;
}
