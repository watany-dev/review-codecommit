import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeSimpleDiff } from "./formatDiff.js";

const lineArb = fc.array(fc.constantFrom("a", "b", "c", "d", ""), { maxLength: 12 });

describe("computeSimpleDiff invariants", () => {
  it("projects delete/context lines back onto the before text in order", () => {
    fc.assert(
      fc.property(lineArb, lineArb, (before, after) => {
        const diff = computeSimpleDiff(before, after);
        const projected = diff
          .filter((l) => l.type === "delete" || l.type === "context")
          .map((l) => l.text.slice(1));
        expect(projected).toEqual(before);
      }),
    );
  });

  it("projects add/context lines back onto the after text in order", () => {
    fc.assert(
      fc.property(lineArb, lineArb, (before, after) => {
        const diff = computeSimpleDiff(before, after);
        const projected = diff
          .filter((l) => l.type === "add" || l.type === "context")
          .map((l) => l.text.slice(1));
        expect(projected).toEqual(after);
      }),
    );
  });

  it("assigns strictly increasing 1-based line numbers per side", () => {
    fc.assert(
      fc.property(lineArb, lineArb, (before, after) => {
        const diff = computeSimpleDiff(before, after);
        let expectedBefore = 1;
        let expectedAfter = 1;
        for (const line of diff) {
          if (line.type === "add") {
            expect(line.beforeLineNumber).toBeUndefined();
          } else {
            expect(line.beforeLineNumber).toBe(expectedBefore);
            expectedBefore++;
          }
          if (line.type === "delete") {
            expect(line.afterLineNumber).toBeUndefined();
          } else {
            expect(line.afterLineNumber).toBe(expectedAfter);
            expectedAfter++;
          }
        }
        expect(expectedBefore - 1).toBe(before.length);
        expect(expectedAfter - 1).toBe(after.length);
      }),
    );
  });

  it("emits only context lines for identical inputs", () => {
    fc.assert(
      fc.property(lineArb, (lines) => {
        const diff = computeSimpleDiff(lines, lines);
        expect(diff.every((l) => l.type === "context")).toBe(true);
        expect(diff).toHaveLength(lines.length);
      }),
    );
  });
});
