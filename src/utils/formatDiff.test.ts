import { describe, it, expect } from "vitest";
import { computeUnifiedDiff, formatDiffForDisplay } from "./formatDiff.js";

describe("computeUnifiedDiff", () => {
  it("detects added lines", () => {
    const before = "line1\nline2";
    const after = "line1\nline2\nline3";
    const result = computeUnifiedDiff(before, after, "test.ts");
    expect(result.filePath).toBe("test.ts");
    const allLines = result.hunks.flatMap((h) => h.lines);
    expect(allLines.some((l) => l.type === "add" && l.content.includes("line3"))).toBe(true);
  });

  it("detects deleted lines", () => {
    const before = "line1\nline2\nline3";
    const after = "line1\nline2";
    const result = computeUnifiedDiff(before, after, "test.ts");
    const allLines = result.hunks.flatMap((h) => h.lines);
    expect(allLines.some((l) => l.type === "delete" && l.content.includes("line3"))).toBe(true);
  });

  it("detects modified lines", () => {
    const before = "const timeout = 3000;";
    const after = "const timeout = 10000;";
    const result = computeUnifiedDiff(before, after, "config.ts");
    const allLines = result.hunks.flatMap((h) => h.lines);
    expect(allLines.some((l) => l.type === "delete")).toBe(true);
    expect(allLines.some((l) => l.type === "add")).toBe(true);
  });

  it("returns empty hunks for identical content", () => {
    const content = "line1\nline2";
    const result = computeUnifiedDiff(content, content, "same.ts");
    expect(result.hunks).toHaveLength(0);
  });
});

describe("formatDiffForDisplay", () => {
  it("formats diff sections as text", () => {
    const sections = [
      computeUnifiedDiff("a\nb", "a\nc", "file.ts"),
    ];
    const output = formatDiffForDisplay(sections);
    expect(output).toContain("--- a/file.ts");
    expect(output).toContain("+++ b/file.ts");
    expect(output).toContain("@@");
  });
});
