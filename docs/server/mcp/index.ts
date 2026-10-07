import { serverInfo } from "../../../src/server-info.ts";

/** Introduces itself like `curves mcp`, plus the Docus page tools. */
export default defineMcpHandler({ ...serverInfo });
