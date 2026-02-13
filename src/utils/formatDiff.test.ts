import { describe, it, expect } from "vitest";
import fc from "fast-check";
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

// --- Property-Based Tests ---

const textLine = fc.stringOf(
  fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789 _-=+"),
  { minLength: 0, maxLength: 40 },
);
const textContent = fc.array(textLine, { minLength: 0, maxLength: 15 }).map((lines) => lines.join("\n"));

describe("computeUnifiedDiff (property-based)", () => {
  it("identical content always produces empty hunks", () => {
    fc.assert(
      fc.property(textContent, (content) => {
        const result = computeUnifiedDiff(content, content, "test.ts");
        expect(result.hunks).toHaveLength(0);
      }),
    );
  });

  it("delete lines only contain content from before", () => {
    fc.assert(
      fc.property(textContent, textContent, (before, after) => {
        const result = computeUnifiedDiff(before, after, "test.ts");
        const beforeLines = before.split("\n");
        const deleteContents = result.hunks
          .flatMap((h) => h.lines)
          .filter((l) => l.type === "delete")
          .map((l) => l.content.slice(1));
        for (const content of deleteContents) {
          expect(beforeLines).toContainEqual(content);
        }
      }),
    );
  });

  it("add lines only contain content from after", () => {
    fc.assert(
      fc.property(textContent, textContent, (before, after) => {
        const result = computeUnifiedDiff(before, after, "test.ts");
        const afterLines = after.split("\n");
        const addContents = result.hunks
          .flatMap((h) => h.lines)
          .filter((l) => l.type === "add")
          .map((l) => l.content.slice(1));
        for (const content of addContents) {
          expect(afterLines).toContainEqual(content);
        }
      }),
    );
  });

  it("different content always produces at least one hunk", () => {
    fc.assert(
      fc.property(textContent, textContent, (before, after) => {
        fc.pre(before !== after);
        const result = computeUnifiedDiff(before, after, "test.ts");
        expect(result.hunks.length).toBeGreaterThanOrEqual(1);
      }),
    );
  });

  it("swapping before/after swaps add and delete counts", () => {
    fc.assert(
      fc.property(textContent, textContent, (before, after) => {
        const forward = computeUnifiedDiff(before, after, "test.ts");
        const backward = computeUnifiedDiff(after, before, "test.ts");
        const fwdLines = forward.hunks.flatMap((h) => h.lines);
        const bwdLines = backward.hunks.flatMap((h) => h.lines);
        const fwdAdds = fwdLines.filter((l) => l.type === "add").length;
        const fwdDels = fwdLines.filter((l) => l.type === "delete").length;
        const bwdAdds = bwdLines.filter((l) => l.type === "add").length;
        const bwdDels = bwdLines.filter((l) => l.type === "delete").length;
        expect(fwdAdds).toBe(bwdDels);
        expect(fwdDels).toBe(bwdAdds);
      }),
    );
  });

  it("hunk headers match @@ format", () => {
    fc.assert(
      fc.property(textContent, textContent, (before, after) => {
        const result = computeUnifiedDiff(before, after, "test.ts");
        for (const hunk of result.hunks) {
          expect(hunk.header).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/);
        }
      }),
    );
  });

  it("hunk header counts match actual line counts", () => {
    fc.assert(
      fc.property(textContent, textContent, (before, after) => {
        const result = computeUnifiedDiff(before, after, "test.ts");
        for (const hunk of result.hunks) {
          const match = hunk.header.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/);
          if (!match) continue;
          const delCount = parseInt(match[2], 10);
          const addCount = parseInt(match[4], 10);
          const actualDel = hunk.lines.filter((l) => l.type === "delete" || l.type === "context").length;
          const actualAdd = hunk.lines.filter((l) => l.type === "add" || l.type === "context").length;
          expect(actualDel).toBe(delCount);
          expect(actualAdd).toBe(addCount);
        }
      }),
    );
  });

  it("line content prefix matches line type", () => {
    fc.assert(
      fc.property(textContent, textContent, (before, after) => {
        const result = computeUnifiedDiff(before, after, "test.ts");
        for (const hunk of result.hunks) {
          for (const line of hunk.lines) {
            if (line.type === "add") expect(line.content[0]).toBe("+");
            if (line.type === "delete") expect(line.content[0]).toBe("-");
            if (line.type === "context") expect(line.content[0]).toBe(" ");
          }
        }
      }),
    );
  });
});
