import { describe, expect, it } from "vite-plus/test";
import { cittyAnswers, shownArgument, undeclaredOption } from "../src/cli-args.ts";

const defs = {
  input: { type: "positional" },
  key: { type: "string", alias: "k" },
  blockSize: { type: "string" },
  page_size: { type: "string" },
  verbose: { type: "boolean", alias: "v" },
} as const;

describe("undeclaredOption", () => {
  it("catches the argument that crashes citty", () => {
    expect(undeclaredOption(["-_8"], {})).toBe("-_8");
    expect(undeclaredOption(["hi", "-_8"], defs)).toBe("-_8");
  });

  it("catches a typo citty would drop without a word", () => {
    expect(undeclaredOption(["--kye", "x"], defs)).toBe("--kye");
    expect(undeclaredOption(["-AA="], defs)).toBe("-AA=");
    expect(undeclaredOption(["--constructor"], defs)).toBe("--constructor");
  });

  it("lets every spelling of a declared option through", () => {
    expect(
      undeclaredOption(
        ["--block-size", "160", "--blockSize=8", "--key=-ab", "-kx", "--no-verbose", "hi"],
        defs,
      ),
    ).toBeUndefined();
    expect(undeclaredOption(["--page-size", "2", "--pageSize", "3"], defs)).toBeUndefined();
  });

  it("knows no help or version of its own, since citty only takes their exact tokens", () => {
    expect(undeclaredOption(["--help=x"], {})).toBe("--help=x");
    expect(undeclaredOption(["-hh"], {})).toBe("-hh");
    expect(undeclaredOption(["--version", "compute"], {})).toBe("--version");
  });

  it("gives a dashed value to the option that takes it", () => {
    expect(undeclaredOption(["--key", "-lemon", "hi"], defs)).toBeUndefined();
    expect(undeclaredOption(["-k", "-_8"], defs)).toBeUndefined();
  });

  it("reads a short group as parseArgs does, a value-taking letter ending it", () => {
    expect(undeclaredOption(["-vkx", "hi"], defs)).toBeUndefined();
    expect(undeclaredOption(["-vk", "x", "hi"], defs)).toBeUndefined();
    expect(undeclaredOption(["-vx"], defs)).toBe("-vx");
  });

  it("leaves a lone dash and everything after -- alone", () => {
    expect(undeclaredOption(["-"], defs)).toBeUndefined();
    expect(undeclaredOption(["--", "-_8", "--kye"], defs)).toBeUndefined();
  });
});

describe("cittyAnswers", () => {
  it("matches the tokens citty's runMain answers before parsing", () => {
    expect(cittyAnswers(["compute", "-h"])).toBe(true);
    expect(cittyAnswers(["-_8", "--help"])).toBe(true);
    expect(cittyAnswers(["-v"])).toBe(true);
    expect(cittyAnswers(["--version", "compute"])).toBe(false);
    expect(cittyAnswers(["compute", "--help=x"])).toBe(false);
  });
});

describe("shownArgument", () => {
  it("escapes control, format and separator characters", () => {
    expect(shownArgument("-\u001B]8;;x\u0007\u009B31m  ‮")).toBe(
      '"-\\u001b]8;;x\\u0007\\u{9b}31m\\u{2028}\\u{2029}\\u{202e}"',
    );
  });

  it("cuts a long argument to 40 graphemes", () => {
    expect(shownArgument(`-${"😀".repeat(50)}`)).toBe(`"-${"😀".repeat(39)}…"`);
  });
});
