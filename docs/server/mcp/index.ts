import { toToolkitTools } from "@agntn/tools/toolkit";
import { defineMcpHandler, getMcpTools } from "@nuxtjs/mcp-toolkit/server";
import { serverInfo } from "../../../src/server-info.ts";
import { curvesTools } from "../../../src/tools.ts";

const curveTools = toToolkitTools(serverInfo, curvesTools);

/**
 * Introduces itself like `curves mcp`, and serves its tools after the Docus page tools. Workers
 * Logs keep the invocation, not the body, so tool arguments stay out of every `console` call.
 */
export default defineMcpHandler({
  ...serverInfo,
  tools: async (event) => [...(await getMcpTools({ event })), ...curveTools],
});
