import { describe, expect, it } from "vitest";
import { detectLanguage, highlightLine, parseAnsiSegments } from "./highlightCode.js";

describe("detectLanguage", () => {
  it("detects TypeScript by .ts extension", () => {
    expect(detectLanguage("src/utils/helper.ts")).toBe("typescript");
  });

  it("detects TypeScript by .tsx extension", () => {
    expect(detectLanguage("components/App.tsx")).toBe("typescript");
  });

  it("detects JavaScript by .js extension", () => {
    expect(detectLanguage("lib/index.js")).toBe("javascript");
  });

  it("detects Python by .py extension", () => {
    expect(detectLanguage("scripts/build.py")).toBe("python");
  });

  it("detects Makefile by filename", () => {
    expect(detectLanguage("Makefile")).toBe("makefile");
    expect(detectLanguage("src/Makefile")).toBe("makefile");
  });

  it("detects Dockerfile as bash", () => {
    expect(detectLanguage("Dockerfile")).toBe("bash");
  });

  it("returns undefined for unknown extensions", () => {
    expect(detectLanguage("data.xyz")).toBeUndefined();
  });

  it("returns undefined for files without extension", () => {
    expect(detectLanguage("LICENSE")).toBeUndefined();
  });

  it("detects language from various extensions", () => {
    const cases: [string, string][] = [
      ["style.css", "css"],
      ["config.json", "json"],
      ["deploy.yaml", "yaml"],
      ["setup.yml", "yaml"],
      ["main.go", "go"],
      ["App.java", "java"],
      ["lib.rs", "rust"],
      ["script.sh", "bash"],
      ["query.sql", "sql"],
      ["page.html", "xml"],
      ["schema.graphql", "graphql"],
      ["config.ini", "ini"],
    ];
    for (const [file, expected] of cases) {
      expect(detectLanguage(file)).toBe(expected);
    }
  });
});

describe("parseAnsiSegments", () => {
  it("returns plain text when no ANSI codes", () => {
    const segments = parseAnsiSegments("hello world");
    expect(segments).toEqual([{ text: "hello world" }]);
  });

  it("parses foreground color codes", () => {
    // green "const" then reset
    const ansi = "\x1b[32mconst\x1b[39m x";
    const segments = parseAnsiSegments(ansi);
    expect(segments).toEqual([{ text: "const", color: "green" }, { text: " x" }]);
  });

  it("parses multiple color segments", () => {
    const ansi = "\x1b[32mconst\x1b[39m \x1b[33mx\x1b[39m = \x1b[36m42\x1b[39m;";
    const segments = parseAnsiSegments(ansi);
    expect(segments).toEqual([
      { text: "const", color: "green" },
      { text: " " },
      { text: "x", color: "yellow" },
      { text: " = " },
      { text: "42", color: "cyan" },
      { text: ";" },
    ]);
  });

  it("parses bold attribute", () => {
    const ansi = "\x1b[1mhello\x1b[22m world";
    const segments = parseAnsiSegments(ansi);
    expect(segments).toEqual([{ text: "hello", bold: true }, { text: " world" }]);
  });

  it("parses dim attribute", () => {
    const ansi = "\x1b[2mfaded\x1b[22m normal";
    const segments = parseAnsiSegments(ansi);
    expect(segments).toEqual([{ text: "faded", dim: true }, { text: " normal" }]);
  });

  it("parses italic attribute", () => {
    const ansi = "\x1b[3mitalic\x1b[23m normal";
    const segments = parseAnsiSegments(ansi);
    expect(segments).toEqual([{ text: "italic", italic: true }, { text: " normal" }]);
  });

  it("handles combined SGR codes", () => {
    const ansi = "\x1b[1;32mbold green\x1b[0m rest";
    const segments = parseAnsiSegments(ansi);
    expect(segments).toEqual([
      { text: "bold green", color: "green", bold: true },
      { text: " rest" },
    ]);
  });

  it("handles reset code (0)", () => {
    const ansi = "\x1b[32m\x1b[1mhello\x1b[0m world";
    const segments = parseAnsiSegments(ansi);
    expect(segments).toEqual([{ text: "hello", color: "green", bold: true }, { text: " world" }]);
  });

  it("returns empty array for empty string", () => {
    expect(parseAnsiSegments("")).toEqual([]);
  });

  it("parses bright color codes", () => {
    const ansi = "\x1b[90mgray\x1b[39m";
    const segments = parseAnsiSegments(ansi);
    expect(segments).toEqual([{ text: "gray", color: "gray" }]);
  });

  it("ignores unrecognized SGR codes", () => {
    // Code 48 (background color) is not handled, should be ignored
    const ansi = "\x1b[48mtext\x1b[0m rest";
    const segments = parseAnsiSegments(ansi);
    expect(segments).toEqual([{ text: "text" }, { text: " rest" }]);
  });
});

describe("highlightLine", () => {
  it("highlights TypeScript code", () => {
    const segments = highlightLine("const x = 42;", "typescript");
    expect(segments.length).toBeGreaterThan(1);

    const text = segments.map((s) => s.text).join("");
    expect(text).toBe("const x = 42;");

    const hasColor = segments.some((s) => s.color !== undefined);
    expect(hasColor).toBe(true);
  });

  it("highlights Python code", () => {
    const segments = highlightLine("def hello():", "python");
    const text = segments.map((s) => s.text).join("");
    expect(text).toBe("def hello():");
    expect(segments.some((s) => s.color !== undefined)).toBe(true);
  });

  it("returns plain text for empty input", () => {
    const segments = highlightLine("", "typescript");
    expect(segments).toEqual([{ text: "" }]);
  });

  it("preserves original text content", () => {
    const code = '  const greeting: string = "Hello, World!";';
    const segments = highlightLine(code, "typescript");
    const reconstructed = segments.map((s) => s.text).join("");
    expect(reconstructed).toBe(code);
  });

  it("handles code with special characters", () => {
    const code = "arr.map((x) => x * 2);";
    const segments = highlightLine(code, "javascript");
    const reconstructed = segments.map((s) => s.text).join("");
    expect(reconstructed).toBe(code);
  });

  it("returns plain text for unknown language", () => {
    const code = "hello world";
    const segments = highlightLine(code, "nonexistent_language_xyz");
    expect(segments).toEqual([{ text: code }]);
  });
});
