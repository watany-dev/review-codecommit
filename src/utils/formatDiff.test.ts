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

  it("generates multiple hunks for distant changes", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line${i}`);
    const before = lines.join("\n");
    const afterLines = [...lines];
    afterLines[2] = "changed-line2";
    afterLines[25] = "changed-line25";
    const after = afterLines.join("\n");
    const result = computeUnifiedDiff(before, after, "multi.ts");
    expect(result.hunks.length).toBeGreaterThanOrEqual(1);
    const allLines = result.hunks.flatMap((h) => h.lines);
    expect(allLines.some((l) => l.type === "add" && l.content.includes("changed-line2"))).toBe(true);
    expect(allLines.some((l) => l.type === "add" && l.content.includes("changed-line25"))).toBe(true);
  });

  it("includes context lines around changes", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i}`);
    const before = lines.join("\n");
    const afterLines = [...lines];
    afterLines[10] = "modified";
    const after = afterLines.join("\n");
    const result = computeUnifiedDiff(before, after, "ctx.ts");
    expect(result.hunks.length).toBeGreaterThanOrEqual(1);
    const allContent = result.hunks.flatMap((h) => h.lines).map((l) => l.content);
    expect(allContent.some((c) => c.includes("line9") || c.includes("line11"))).toBe(true);
  });

  it("handles hunk header format", () => {
    const before = "a\nb\nc";
    const after = "a\nx\nc";
    const result = computeUnifiedDiff(before, after, "hdr.ts");
    expect(result.hunks.length).toBeGreaterThanOrEqual(1);
    expect(result.hunks[0].header).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/);
  });

  it("handles completely different content", () => {
    const before = "alpha\nbeta\ngamma";
    const after = "one\ntwo\nthree";
    const result = computeUnifiedDiff(before, after, "diff.ts");
    expect(result.hunks.length).toBeGreaterThanOrEqual(1);
    const allLines = result.hunks.flatMap((h) => h.lines);
    expect(allLines.filter((l) => l.type === "delete").length).toBe(3);
    expect(allLines.filter((l) => l.type === "add").length).toBe(3);
  });

  it("handles empty before content (new file)", () => {
    const result = computeUnifiedDiff("", "new content\nline2", "new.ts");
    expect(result.hunks.length).toBeGreaterThanOrEqual(1);
    const allLines = result.hunks.flatMap((h) => h.lines);
    expect(allLines.some((l) => l.type === "add")).toBe(true);
  });

  it("handles empty after content (deleted file)", () => {
    const result = computeUnifiedDiff("old content\nline2", "", "del.ts");
    expect(result.hunks.length).toBeGreaterThanOrEqual(1);
    const allLines = result.hunks.flatMap((h) => h.lines);
    expect(allLines.some((l) => l.type === "delete")).toBe(true);
  });

  it("produces separate hunks for widely separated changes", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `unchanged-${i}`);
    const before = lines.join("\n");
    const afterLines = [...lines];
    afterLines[3] = "CHANGED-3";
    afterLines[46] = "CHANGED-46";
    const after = afterLines.join("\n");

    const result = computeUnifiedDiff(before, after, "wide.ts");
    expect(result.hunks.length).toBe(2);
    expect(result.hunks[0].header).toContain("@@");
    expect(result.hunks[1].header).toContain("@@");
  });

  it("merges close hunks together", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line-${i}`);
    const before = lines.join("\n");
    const afterLines = [...lines];
    afterLines[5] = "CHANGED-5";
    afterLines[10] = "CHANGED-10";
    const after = afterLines.join("\n");

    const result = computeUnifiedDiff(before, after, "close.ts");
    // Changes are close enough to be in 1 hunk
    expect(result.hunks.length).toBe(1);
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

  it("formats multiple sections", () => {
    const sections = [
      computeUnifiedDiff("a", "b", "first.ts"),
      computeUnifiedDiff("x", "y", "second.ts"),
    ];
    const output = formatDiffForDisplay(sections);
    expect(output).toContain("first.ts");
    expect(output).toContain("second.ts");
  });

  it("handles empty sections", () => {
    const output = formatDiffForDisplay([]);
    expect(output).toBe("");
  });
});
