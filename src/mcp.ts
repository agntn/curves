import { indexTools, invokeTool, ToolInputError } from "@agntn/tools";
import { createMcpServer as createToolServer, errorResult } from "@agntn/tools/mcp";
import type { Server } from "@modelcontextprotocol/server";
import { sourceChangeCheck } from "./source-change.ts";
import { curvesTools } from "./tools.ts";
import { version } from "./version.ts";

const restart = "src/ changed under this server, restart it to load the new code";

/** Taken as `src/` loads, so a server built later can't adopt a pull its cached modules missed. */
const changed = import.meta.url.endsWith(".ts")
  ? sourceChangeCheck(import.meta.dirname)
  : undefined;

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

  const byName = indexTools(curvesTools);
  server.setRequestHandler("tools/call", async (request, ctx) => {
    if (changed()) return errorResult(restart);
    const tool = byName.get(request.params.name);
    if (!tool) return errorResult(`Unknown curves tool: ${JSON.stringify(request.params.name)}`);
    try {
      const result = await invokeTool(tool, request.params.arguments ?? {}, {
        signal: ctx.mcpReq.signal,
      });
      return {
        content: result.content,
        ...(result.isError === undefined ? {} : { isError: result.isError }),
      };
    } catch (error) {
      if (changed()) return errorResult(restart);
      if (error instanceof ToolInputError) return errorResult(...error.lines);
      return errorResult(
        `${tool.name} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
  return server;
}
