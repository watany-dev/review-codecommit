import { describe, expect, it } from "vitest";
import type { DisplayLine } from "./formatDiff.js";
import { buildSplitRows } from "./splitDiff.js";

describe("buildSplitRows", () => {
  it("converts context line to split row with both sides", () => {
    const lines: DisplayLine[] = [
      { type: "context", text: " hello", beforeLineNumber: 1, afterLineNumber: 1 },
    ];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "split",
      left: { type: "context", text: "hello", lineNumber: 1 },
      right: { type: "context", text: "hello", lineNumber: 1 },
      sourceIndex: 0,
    });
  });

  it("converts delete line to split row with empty right", () => {
    const lines: DisplayLine[] = [{ type: "delete", text: "-removed", beforeLineNumber: 5 }];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "split",
      left: { type: "delete", text: "removed", lineNumber: 5 },
      right: { type: "empty", text: "" },
    });
  });

  it("converts add line to split row with empty left", () => {
    const lines: DisplayLine[] = [{ type: "add", text: "+added", afterLineNumber: 3 }];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "split",
      left: { type: "empty", text: "" },
      right: { type: "add", text: "added", lineNumber: 3 },
    });
  });

  it("pairs consecutive delete and add lines", () => {
    const lines: DisplayLine[] = [
      { type: "delete", text: "-old1", beforeLineNumber: 1 },
      { type: "delete", text: "-old2", beforeLineNumber: 2 },
      { type: "add", text: "+new1", afterLineNumber: 1 },
      { type: "add", text: "+new2", afterLineNumber: 2 },
    ];
    const rows = buildSplitRows(lines);
    const splitRows = rows.filter((r) => r.kind === "split");
    expect(splitRows).toHaveLength(2);
    expect(splitRows[0]).toMatchObject({
      left: { type: "delete", text: "old1", lineNumber: 1 },
      right: { type: "add", text: "new1", lineNumber: 1 },
    });
    expect(splitRows[1]).toMatchObject({
      left: { type: "delete", text: "old2", lineNumber: 2 },
      right: { type: "add", text: "new2", lineNumber: 2 },
    });
  });

  it("handles more deletes than adds with empty right cells", () => {
    const lines: DisplayLine[] = [
      { type: "delete", text: "-old1", beforeLineNumber: 1 },
      { type: "delete", text: "-old2", beforeLineNumber: 2 },
      { type: "delete", text: "-old3", beforeLineNumber: 3 },
      { type: "add", text: "+new1", afterLineNumber: 1 },
    ];
    const rows = buildSplitRows(lines);
    const splitRows = rows.filter((r) => r.kind === "split");
    expect(splitRows).toHaveLength(3);
    expect(splitRows[0]).toMatchObject({
      left: { type: "delete", text: "old1" },
      right: { type: "add", text: "new1" },
    });
    expect(splitRows[1]).toMatchObject({
      left: { type: "delete", text: "old2" },
      right: { type: "empty" },
    });
    expect(splitRows[2]).toMatchObject({
      left: { type: "delete", text: "old3" },
      right: { type: "empty" },
    });
  });

  it("handles more adds than deletes with empty left cells", () => {
    const lines: DisplayLine[] = [
      { type: "delete", text: "-old1", beforeLineNumber: 1 },
      { type: "add", text: "+new1", afterLineNumber: 1 },
      { type: "add", text: "+new2", afterLineNumber: 2 },
      { type: "add", text: "+new3", afterLineNumber: 3 },
    ];
    const rows = buildSplitRows(lines);
    const splitRows = rows.filter((r) => r.kind === "split");
    expect(splitRows).toHaveLength(3);
    expect(splitRows[0]).toMatchObject({
      left: { type: "delete", text: "old1" },
      right: { type: "add", text: "new1" },
    });
    expect(splitRows[1]).toMatchObject({
      left: { type: "empty" },
      right: { type: "add", text: "new2" },
    });
    expect(splitRows[2]).toMatchObject({
      left: { type: "empty" },
      right: { type: "add", text: "new3" },
    });
  });

  it("converts header and separator to full-width rows", () => {
    const lines: DisplayLine[] = [
      { type: "header", text: "src/auth.ts" },
      { type: "separator", text: "─".repeat(50) },
    ];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "full-width", sourceIndex: 0 });
    expect(rows[1]).toMatchObject({ kind: "full-width", sourceIndex: 1 });
  });

  it("attaches inline comment to previous split row fullWidthLines", () => {
    const lines: DisplayLine[] = [
      { type: "context", text: " code", beforeLineNumber: 1, afterLineNumber: 1 },
      { type: "inline-comment", text: "💬 taro: looks good", threadIndex: 0, commentId: "c1" },
      { type: "inline-reply", text: "└ watany: thanks", threadIndex: 0, commentId: "c2" },
    ];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("split");
    if (rows[0]!.kind === "split") {
      expect(rows[0]!.fullWidthLines).toHaveLength(2);
      expect(rows[0]!.fullWidthLines[0]!.type).toBe("inline-comment");
      expect(rows[0]!.fullWidthLines[1]!.type).toBe("inline-reply");
    }
  });

  it("returns empty array for empty input", () => {
    expect(buildSplitRows([])).toEqual([]);
  });

  it("removes leading +/-/space prefix from text", () => {
    const lines: DisplayLine[] = [
      { type: "delete", text: "-const x = 1;", beforeLineNumber: 1 },
      { type: "add", text: "+const x = 2;", afterLineNumber: 1 },
      { type: "context", text: " return x;", beforeLineNumber: 2, afterLineNumber: 2 },
    ];
    const rows = buildSplitRows(lines);
    const splitRows = rows.filter((r) => r.kind === "split");
    expect(splitRows[0]).toMatchObject({
      left: { text: "const x = 1;" },
      right: { text: "const x = 2;" },
    });
    expect(splitRows[1]).toMatchObject({
      left: { text: "return x;" },
      right: { text: "return x;" },
    });
  });

  it("flushes pending deletes before comment line", () => {
    const lines: DisplayLine[] = [
      { type: "delete", text: "-old", beforeLineNumber: 1 },
      { type: "inline-comment", text: "💬 note", threadIndex: 0, commentId: "c1" },
    ];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("split");
    if (rows[0]!.kind === "split") {
      expect(rows[0]!.left).toMatchObject({ type: "delete", text: "old" });
      expect(rows[0]!.right).toMatchObject({ type: "empty" });
      expect(rows[0]!.fullWidthLines).toHaveLength(1);
    }
  });

  it("treats comment as full-width when no previous split row", () => {
    const lines: DisplayLine[] = [
      { type: "inline-comment", text: "💬 orphan comment", threadIndex: 0, commentId: "c1" },
    ];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "full-width" });
  });

  it("flushes pending deletes before full-width line", () => {
    const lines: DisplayLine[] = [
      { type: "delete", text: "-old", beforeLineNumber: 1 },
      { type: "header", text: "next-file.ts" },
    ];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.kind).toBe("split");
    expect(rows[1]).toMatchObject({ kind: "full-width" });
  });

  it("flushes pending deletes before context line", () => {
    const lines: DisplayLine[] = [
      { type: "delete", text: "-old", beforeLineNumber: 1 },
      { type: "context", text: " same", beforeLineNumber: 2, afterLineNumber: 1 },
    ];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(2);
    if (rows[0]!.kind === "split") {
      expect(rows[0]!.left).toMatchObject({ type: "delete", text: "old" });
      expect(rows[0]!.right).toMatchObject({ type: "empty" });
    }
    if (rows[1]!.kind === "split") {
      expect(rows[1]!.left).toMatchObject({ type: "context", text: "same" });
    }
  });

  it("handles empty text without prefix removal", () => {
    const lines: DisplayLine[] = [
      { type: "context", text: "", beforeLineNumber: 1, afterLineNumber: 1 },
    ];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(1);
    if (rows[0]!.kind === "split") {
      expect(rows[0]!.left.text).toBe("");
      expect(rows[0]!.right.text).toBe("");
    }
  });

  it("omits lineNumber for context line without beforeLineNumber/afterLineNumber", () => {
    const lines: DisplayLine[] = [{ type: "context", text: " hello" }];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(1);
    if (rows[0]!.kind === "split") {
      expect(rows[0]!.left).toEqual({ type: "context", text: "hello" });
      expect(rows[0]!.right).toEqual({ type: "context", text: "hello" });
    }
  });

  it("omits lineNumber for standalone add without afterLineNumber", () => {
    const lines: DisplayLine[] = [{ type: "add", text: "+new" }];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(1);
    if (rows[0]!.kind === "split") {
      expect(rows[0]!.left).toEqual({ type: "empty", text: "" });
      expect(rows[0]!.right).toEqual({ type: "add", text: "new" });
    }
  });

  it("omits lineNumber for paired delete/add without line numbers", () => {
    const lines: DisplayLine[] = [
      { type: "delete", text: "-old" },
      { type: "add", text: "+new" },
    ];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(1);
    if (rows[0]!.kind === "split") {
      expect(rows[0]!.left).toEqual({ type: "delete", text: "old" });
      expect(rows[0]!.right).toEqual({ type: "add", text: "new" });
    }
  });

  it("handles fold-indicator in fullWidthLines", () => {
    const lines: DisplayLine[] = [
      { type: "context", text: " code", beforeLineNumber: 1, afterLineNumber: 1 },
      { type: "fold-indicator", text: "[+3 replies]", threadIndex: 0 },
    ];
    const rows = buildSplitRows(lines);
    expect(rows).toHaveLength(1);
    if (rows[0]!.kind === "split") {
      expect(rows[0]!.fullWidthLines).toHaveLength(1);
      expect(rows[0]!.fullWidthLines[0]!.type).toBe("fold-indicator");
    }
  });
});
