import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { DisplayLine } from "../utils/formatDiff.js";
import * as highlightCodeModule from "../utils/highlightCode.js";
import { renderDiffLine } from "./DiffLine.js";

function renderLine(line: DisplayLine, isCursor = false): string {
  const { lastFrame } = render(<>{renderDiffLine(line, isCursor)}</>);
  return lastFrame() ?? "";
}

describe("renderDiffLine with syntax highlighting", () => {
  it("highlights add line with known language", () => {
    const line: DisplayLine = {
      type: "add",
      text: "+const x = 42;",
      filePath: "src/index.ts",
    };
    const output = renderLine(line);
    expect(output).toContain("+");
    expect(output).toContain("const");
    expect(output).toContain("42");
  });

  it("highlights delete line with known language", () => {
    const line: DisplayLine = {
      type: "delete",
      text: "-let y = 0;",
      filePath: "src/index.ts",
    };
    const output = renderLine(line);
    expect(output).toContain("-");
    expect(output).toContain("let");
  });

  it("highlights context line with known language", () => {
    const line: DisplayLine = {
      type: "context",
      text: " return x;",
      filePath: "src/index.ts",
    };
    const output = renderLine(line);
    expect(output).toContain("return");
  });

  it("falls back for unknown file extensions", () => {
    const line: DisplayLine = {
      type: "add",
      text: "+some data",
      filePath: "data.xyz",
    };
    const output = renderLine(line);
    expect(output).toContain("+some data");
  });

  it("falls back when no filePath", () => {
    const line: DisplayLine = {
      type: "add",
      text: "+hello",
    };
    const output = renderLine(line);
    expect(output).toContain("+hello");
  });

  it("applies bold when cursor is active", () => {
    const line: DisplayLine = {
      type: "add",
      text: "+const x = 1;",
      filePath: "src/app.ts",
    };
    const output = renderLine(line, true);
    expect(output).toContain("const");
  });

  it("renders context line without prefixColor", () => {
    const line: DisplayLine = {
      type: "context",
      text: " const y = 2;",
      filePath: "src/app.ts",
    };
    const output = renderLine(line);
    expect(output).toContain("const");
    expect(output).toContain("2");
  });

  it("handles empty content after prefix", () => {
    const line: DisplayLine = {
      type: "add",
      text: "+",
      filePath: "src/app.ts",
    };
    const output = renderLine(line);
    expect(output).toContain("+");
  });

  it("highlights Python code", () => {
    const line: DisplayLine = {
      type: "add",
      text: "+def hello():",
      filePath: "main.py",
    };
    const output = renderLine(line);
    expect(output).toContain("def");
  });

  it("highlights JSON", () => {
    const line: DisplayLine = {
      type: "context",
      text: ' "name": "test"',
      filePath: "package.json",
    };
    const output = renderLine(line);
    expect(output).toContain("name");
  });

  it("renders segments with bold and dim attributes", () => {
    const line: DisplayLine = {
      type: "add",
      text: "+import React from 'react';",
      filePath: "src/app.tsx",
    };
    const output = renderLine(line);
    expect(output).toContain("import");
    expect(output).toContain("React");
  });

  it("renders non-highlighted line types unchanged", () => {
    const header: DisplayLine = { type: "header", text: "src/auth.ts" };
    expect(renderLine(header)).toContain("src/auth.ts");

    const sep: DisplayLine = { type: "separator", text: "──────" };
    expect(renderLine(sep)).toContain("──────");

    const trunc: DisplayLine = { type: "truncation", text: "[t] show more" };
    expect(renderLine(trunc)).toContain("[t] show more");
  });

  it("renders segments with bold, dim, and italic attributes", () => {
    const spy = vi.spyOn(highlightCodeModule, "highlightLine").mockReturnValueOnce([
      { text: "/* ", dim: true },
      { text: "important", bold: true },
      { text: "comment", italic: true },
      { text: " */", dim: true },
    ]);
    const line: DisplayLine = {
      type: "context",
      text: " /* comment */",
      filePath: "src/index.ts",
    };
    const output = renderLine(line);
    expect(output).toContain("comment");
    spy.mockRestore();
  });

  it("renders single plain segment without wrapping", () => {
    const spy = vi
      .spyOn(highlightCodeModule, "highlightLine")
      .mockReturnValueOnce([{ text: "plain text" }]);
    const line: DisplayLine = {
      type: "add",
      text: "+plain text",
      filePath: "src/index.ts",
    };
    const output = renderLine(line);
    expect(output).toContain("plain text");
    spy.mockRestore();
  });
});
