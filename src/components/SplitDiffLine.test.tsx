import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it } from "vitest";
import type { SplitRow } from "../utils/splitDiff.js";
import { SplitDiffLine } from "./SplitDiffLine.js";

describe("SplitDiffLine", () => {
  it("renders full-width row using renderDiffLine", () => {
    const row: SplitRow = {
      kind: "full-width",
      line: { type: "header", text: "src/auth.ts" },
      sourceIndex: 0,
    };
    const { lastFrame } = render(<SplitDiffLine row={row} isCursor={false} paneWidth={50} />);
    expect(lastFrame()).toContain("src/auth.ts");
  });

  it("renders split context line with both sides and divider", () => {
    const row: SplitRow = {
      kind: "split",
      left: { type: "context", lineNumber: 10, text: "const x = 1;" },
      right: { type: "context", lineNumber: 10, text: "const x = 1;" },
      sourceIndex: 0,
      fullWidthLines: [],
    };
    const { lastFrame } = render(<SplitDiffLine row={row} isCursor={false} paneWidth={50} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("const x = 1;");
    expect(output).toContain("│");
  });

  it("renders split delete+add pair", () => {
    const row: SplitRow = {
      kind: "split",
      left: { type: "delete", lineNumber: 5, text: "old value" },
      right: { type: "add", lineNumber: 5, text: "new value" },
      sourceIndex: 0,
      fullWidthLines: [],
    };
    const { lastFrame } = render(<SplitDiffLine row={row} isCursor={false} paneWidth={50} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("old value");
    expect(output).toContain("new value");
    expect(output).toContain("│");
  });

  it("renders empty cell as dim spaces", () => {
    const row: SplitRow = {
      kind: "split",
      left: { type: "delete", lineNumber: 1, text: "removed" },
      right: { type: "empty", text: "" },
      sourceIndex: 0,
      fullWidthLines: [],
    };
    const { lastFrame } = render(<SplitDiffLine row={row} isCursor={false} paneWidth={50} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("removed");
    expect(output).toContain("│");
  });

  it("renders line numbers right-aligned in 4 digits", () => {
    const row: SplitRow = {
      kind: "split",
      left: { type: "context", lineNumber: 42, text: "hello" },
      right: { type: "context", lineNumber: 42, text: "hello" },
      sourceIndex: 0,
      fullWidthLines: [],
    };
    const { lastFrame } = render(<SplitDiffLine row={row} isCursor={false} paneWidth={50} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("  42");
  });

  it("renders cursor indicator on active row", () => {
    const row: SplitRow = {
      kind: "split",
      left: { type: "context", lineNumber: 1, text: "hello" },
      right: { type: "context", lineNumber: 1, text: "hello" },
      sourceIndex: 0,
      fullWidthLines: [],
    };
    const { lastFrame: withCursor } = render(
      <SplitDiffLine row={row} isCursor={true} paneWidth={50} />,
    );
    expect(withCursor()).toContain("> ");

    const { lastFrame: withoutCursor } = render(
      <SplitDiffLine row={row} isCursor={false} paneWidth={50} />,
    );
    expect(withoutCursor()).not.toMatch(/^>/);
  });

  it("renders fullWidthLines below split row", () => {
    const row: SplitRow = {
      kind: "split",
      left: { type: "context", lineNumber: 1, text: "code" },
      right: { type: "context", lineNumber: 1, text: "code" },
      sourceIndex: 0,
      fullWidthLines: [
        { type: "inline-comment", text: "💬 taro: LGTM", threadIndex: 0, commentId: "c1" },
      ],
    };
    const { lastFrame } = render(<SplitDiffLine row={row} isCursor={false} paneWidth={50} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("taro: LGTM");
  });

  it("truncates long text to fit pane width", () => {
    const row: SplitRow = {
      kind: "split",
      left: { type: "context", lineNumber: 1, text: "a".repeat(100) },
      right: { type: "context", lineNumber: 1, text: "b".repeat(100) },
      sourceIndex: 0,
      fullWidthLines: [],
    };
    const { lastFrame } = render(<SplitDiffLine row={row} isCursor={false} paneWidth={20} />);
    const output = lastFrame() ?? "";
    // paneWidth=20, codeWidth=15, text should be truncated
    expect(output).not.toContain("a".repeat(100));
  });

  it("renders cell without line number", () => {
    const row: SplitRow = {
      kind: "split",
      left: { type: "context", text: "no-num" },
      right: { type: "context", text: "no-num" },
      sourceIndex: 0,
      fullWidthLines: [],
    };
    const { lastFrame } = render(<SplitDiffLine row={row} isCursor={false} paneWidth={50} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("no-num");
  });

  it("renders fullWidthLines without commentId using text as key", () => {
    const row: SplitRow = {
      kind: "split",
      left: { type: "context", lineNumber: 1, text: "code" },
      right: { type: "context", lineNumber: 1, text: "code" },
      sourceIndex: 0,
      fullWidthLines: [{ type: "fold-indicator", text: "[+3 replies]", threadIndex: 0 }],
    };
    const { lastFrame } = render(<SplitDiffLine row={row} isCursor={false} paneWidth={50} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("[+3 replies]");
  });
});
