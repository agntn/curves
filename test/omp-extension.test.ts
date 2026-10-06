import { ToolInputError, wireSchema } from "@agntn/tools";
import type { ToolDefinition } from "@oh-my-pi/pi-coding-agent";
import { describe, expect, it, vi } from "vite-plus/test";

/** Compiled OMP injects no TUI barrel, so loading it has to fail the test. */
vi.mock("@oh-my-pi/pi-coding-agent/tui", () => {
  throw new Error("The OMP host does not inject the TUI barrel");
});

import curvesExtension from "../packages/omp/extensions/curves.ts";
import { computeTool, secp256k1ComputeTool } from "../src/tools.ts";
import {
  ompTestTheme as theme,
  ompToolContext,
  registerOmpExtension,
} from "./fixtures/omp-host.ts";

const CONTROL_BYTES = /[\u0000-\u001F\u007F-\u009F]/;

async function registerComputeTool(): Promise<ToolDefinition> {
  return (await registerOmpExtension(curvesExtension)).tool("curves_compute");
}

const paar = { a: "2", b: "2", p: "17" };

function renderedText(component: unknown): string {
  return (component as { text: string }).text;
}

describe("omp curves extension", () => {
  it("registers both tools as read-approval tools with the shared schemas", async () => {
    const host = await registerOmpExtension(curvesExtension);

    expect([...host.tools.keys()]).toEqual(["curves_compute", "curves_secp256k1_compute"]);
    expect(host.labels).toEqual(["Curves"]);
    const compute = host.tool("curves_compute");
    expect(compute.label).toBe("Compute on a Curve");
    expect(compute.approval).toBe("read");
    expect(compute.parameters).toEqual(wireSchema(computeTool));
    expect(host.tool("curves_secp256k1_compute").parameters).toEqual(
      wireSchema(secp256k1ComputeTool),
    );
  });

  it("refuses what the shared schema rejects", async () => {
    const tool = await registerComputeTool();

    await expect(
      tool.execute(
        "call-1",
        { operation: "count", a: "2", b: "2", p: "1.5" },
        undefined,
        undefined,
        ompToolContext,
      ),
    ).rejects.toThrow(ToolInputError);
  });

  it("executes against the library and returns structured details", async () => {
    const tool = await registerComputeTool();

    const result = await tool.execute(
      "call-1",
      { operation: "count", ...paar },
      undefined,
      undefined,
      ompToolContext,
    );

    expect(result.content[0]?.type).toBe("text");
    expect(result.details).toEqual({ operation: "count", count: "19" });
  });

  it.each([
    [false, undefined, "success:status.done"],
    [true, undefined, "muted:status.pending"],
    [true, 3, "frame-1"],
  ] as const)(
    "draws the call status with the host theme (partial=%s, frame=%s)",
    async (isPartial, spinnerFrame, icon) => {
      const tool = await registerComputeTool();

      const text = renderedText(
        tool.renderCall?.(
          { operation: "my-app" },
          { expanded: false, isPartial, spinnerFrame },
          theme,
        ),
      );

      expect(text).toBe(`${icon} accent(Compute on a Curve): muted(my-app)`);
    },
  );

  it("sanitizes model arguments in renderCall", async () => {
    const tool = await registerComputeTool();
    const hostile = { operation: "\u001B]0;evil\u0007app\u001B[31mname\nnext" };

    const text = renderedText(
      tool.renderCall?.(hostile, { expanded: false, isPartial: false }, theme),
    );

    expect(text).not.toMatch(CONTROL_BYTES);
    expect(text).toBe("success:status.done accent(Compute on a Curve): muted(appname next)");
  });

  it("replaces line separators and format characters in renderCall", async () => {
    const tool = await registerComputeTool();
    const hostile = { operation: "safe\u2028forged\u2029line\u202Eevil\u200Btail\u{E0041}" };

    const text = renderedText(
      tool.renderCall?.(hostile, { expanded: false, isPartial: false }, theme),
    );

    expect(text).toBe(
      "success:status.done accent(Compute on a Curve): muted(safe forged line evil tail)",
    );
  });

  it("cuts a long argument before sanitizing it", async () => {
    const tool = await registerComputeTool();
    const started = performance.now();

    tool.renderCall?.(
      { operation: "\u001B]".repeat(100_000) },
      { expanded: false, isPartial: true },
      theme,
    );

    expect(performance.now() - started).toBeLessThan(500);
  });

  it("survives a numeric argument that violates the declared schema type", async () => {
    const tool = await registerComputeTool();

    const text = renderedText(
      tool.renderCall?.({ operation: 42 }, { expanded: false, isPartial: true }, theme),
    );

    expect(text).toBe("muted:status.pending accent(Compute on a Curve): muted(42)");
  });

  it("sanitizes result data in renderResult and keeps the read badge", async () => {
    const tool = await registerComputeTool();
    const result = {
      content: [{ type: "text" as const, text: "ok" }],
      details: { operation: "order", order: "19\u001B]8;;https://evil\u0007", note: "\u009Bx" },
    };

    const text = renderedText(
      tool.renderResult?.(result, { expanded: false, isPartial: false }, theme),
    );

    expect(text).not.toMatch(CONTROL_BYTES);
    expect(text).toBe(
      "success:status.done accent(Compute on a Curve) accent([read]) dim(order 19 | note x)",
    );
  });

  it("marks an error result with the error icon and no meta", async () => {
    const tool = await registerComputeTool();
    const result = { content: [{ type: "text" as const, text: "boom" }], isError: true };

    const text = renderedText(
      tool.renderResult?.(result, { expanded: false, isPartial: false }, theme),
    );

    expect(text).toBe("error:status.error accent(Compute on a Curve) accent([read])");
  });
});
