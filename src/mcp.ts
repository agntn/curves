import {
  callTool as callListedTool,
  createMcpServer as createToolServer,
  errorResult,
  listTools,
} from "@agntn/tools/mcp";
import type { CallToolResult, Server, Tool } from "@modelcontextprotocol/server";
import { sourceChangeCheck } from "./source-change.ts";
import { serverInfo } from "./server-info.ts";
import { curvesTools } from "./tools.ts";

const restart = "src/ changed under this server, restart it to load the new code";

/** Measured from the process start, so a pull landing while this file's imports load counts too. */
const changed = import.meta.url.endsWith(".ts")
  ? sourceChangeCheck(import.meta.dirname, performance.timeOrigin)
  : undefined;

/** The `tools/list` entries `curves mcp` answers with. */
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
 * with a restart line once that tree changed, checked before the name and the schema and again
 * after the tool answers. A success isn't spared: it may come from pulled and cached modules mixed.
 *
 * @returns {Server} Unconnected MCP server.
 */
export function createMcpServer(): Server {
  const server = createToolServer(serverInfo, curvesTools);
  if (!changed) return server;

  server.setRequestHandler("tools/call", async (request, ctx) => {
    if (changed()) return errorResult(restart);
    const result = await callTool(request.params.name, request.params.arguments, {
      signal: ctx.mcpReq.signal,
    });
    return changed() ? errorResult(restart) : result;
  });
  return server;
}
