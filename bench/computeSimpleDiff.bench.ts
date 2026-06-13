import { bench, describe } from "vitest";
import { computeSimpleDiff } from "../src/utils/formatDiff.js";

function makeLines(count: number, prefix: string): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix} line ${i} with some content`);
}

// Identical files: pure context path
const identical2k = makeLines(2000, "same");

// Fully rewritten file: every before-line is deleted, every after-line is added.
// Worst case for unbounded lookahead scans.
const rewrittenBefore2k = makeLines(2000, "old");
const rewrittenAfter2k = makeLines(2000, "new");

// Realistic edit: large file with several small change blocks
const editedBefore = makeLines(3000, "ctx");
const editedAfter = (() => {
  const lines = [...editedBefore];
  for (let block = 0; block < 10; block++) {
    const at = 250 + block * 250;
    lines.splice(at, 5, ...makeLines(8, `edit${block}`));
  }
  return lines;
})();

// Reordered blocks: triggers the 5-line lookahead match path
const reorderedBefore = makeLines(1000, "blk");
const reorderedAfter = (() => {
  const lines = [...reorderedBefore];
  for (let i = 0; i < lines.length - 3; i += 7) {
    const tmp = lines[i]!;
    lines[i] = lines[i + 3]!;
    lines[i + 3] = tmp;
  }
  return lines;
})();

describe("computeSimpleDiff", () => {
  bench("identical 2000-line files", () => {
    computeSimpleDiff(identical2k, identical2k);
  });

  bench("fully rewritten 2000-line file", () => {
    computeSimpleDiff(rewrittenBefore2k, rewrittenAfter2k);
  });

  bench("3000-line file with 10 edit blocks", () => {
    computeSimpleDiff(editedBefore, editedAfter);
  });

  bench("1000-line file with reordered blocks", () => {
    computeSimpleDiff(reorderedBefore, reorderedAfter);
  });
});
