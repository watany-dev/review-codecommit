/**
 * Models the state-update pattern app.tsx uses while blob texts stream in.
 *
 * loadPullRequestDetail registers a `streamBlobTexts` callback that does
 * `setDiffTexts((prev) => new Map(prev).set(key, texts))` for every file that
 * arrives. Each of those updates produces a fresh Map identity, which
 * invalidates the `lines` useMemo in PullRequestDetail and rebuilds the whole
 * display-line array — for every file, not just the one that arrived.
 *
 * "progressive" replays that: N map copies + N full rebuilds.
 * "batched" is the same total work delivered in one update, as a reference
 * point for how much of the cost is the per-file fan-out.
 */
import type { Difference } from "@aws-sdk/client-codecommit";
import { bench, describe } from "vitest";
import { buildDisplayLines, type DisplayLine } from "../src/utils/displayLines.js";

function makeLines(count: number, prefix: string): string {
  return Array.from({ length: count }, (_, i) => `${prefix} line ${i} with some content`).join(
    "\n",
  );
}

function makeFixture(fileCount: number, linesPerFile: number) {
  const differences: Difference[] = [];
  const arrivals: Array<{ key: string; texts: { before: string; after: string } }> = [];

  for (let f = 0; f < fileCount; f++) {
    const beforeBlobId = `before-${f}`;
    const afterBlobId = `after-${f}`;
    differences.push({
      beforeBlob: { blobId: beforeBlobId, path: `src/file-${f}.ts` },
      afterBlob: { blobId: afterBlobId, path: `src/file-${f}.ts` },
      changeType: "M",
    });
    arrivals.push({
      key: `${beforeBlobId}:${afterBlobId}`,
      texts: { before: makeLines(linesPerFile, `f${f}-old`), after: makeLines(linesPerFile, `f${f}-new`) },
    });
  }

  return { differences, arrivals };
}

/** One full PR load: every blob arrives separately, each triggering a rebuild. */
function replayProgressive(
  differences: Difference[],
  arrivals: Array<{ key: string; texts: { before: string; after: string } }>,
): number {
  let diffTexts = new Map<string, { before: string; after: string }>();
  let diffTextStatus = new Map<string, "loading" | "loaded" | "error">();
  const diffCache = new Map<string, DisplayLine[]>();
  let lastLineCount = 0;

  for (const { key, texts } of arrivals) {
    // app.tsx: two functional setState updates per arriving blob
    diffTexts = new Map(diffTexts).set(key, texts);
    diffTextStatus = new Map(diffTextStatus).set(key, "loaded");
    // PullRequestDetail: `lines` useMemo re-runs because both Maps changed identity
    lastLineCount = buildDisplayLines(
      differences,
      diffTexts,
      diffTextStatus,
      new Map(),
      [],
      new Map(),
      new Map(),
      diffCache,
    ).length;
  }
  return lastLineCount;
}

/** Same end state, delivered in a single update. */
function replayBatched(
  differences: Difference[],
  arrivals: Array<{ key: string; texts: { before: string; after: string } }>,
): number {
  const diffTexts = new Map<string, { before: string; after: string }>();
  const diffTextStatus = new Map<string, "loading" | "loaded" | "error">();
  for (const { key, texts } of arrivals) {
    diffTexts.set(key, texts);
    diffTextStatus.set(key, "loaded");
  }
  return buildDisplayLines(
    differences,
    diffTexts,
    diffTextStatus,
    new Map(),
    [],
    new Map(),
    new Map(),
    new Map(),
  ).length;
}

// Fixed lines-per-file so only the file count varies: isolates how the
// per-arrival full rebuild scales with the number of files in the PR.
const scale20 = makeFixture(20, 150);
const scale40 = makeFixture(40, 150);
const scale80 = makeFixture(80, 150);

const small = makeFixture(10, 100);
const medium = makeFixture(30, 200);
const large = makeFixture(60, 300);

describe("progressive diff load (blob texts streaming in)", () => {
  bench("10 files x 100 lines — progressive", () => {
    replayProgressive(small.differences, small.arrivals);
  });
  bench("10 files x 100 lines — batched", () => {
    replayBatched(small.differences, small.arrivals);
  });

  bench("30 files x 200 lines — progressive", () => {
    replayProgressive(medium.differences, medium.arrivals);
  });
  bench("30 files x 200 lines — batched", () => {
    replayBatched(medium.differences, medium.arrivals);
  });

  bench("60 files x 300 lines — progressive", () => {
    replayProgressive(large.differences, large.arrivals);
  });
  bench("60 files x 300 lines — batched", () => {
    replayBatched(large.differences, large.arrivals);
  });
});

describe("progressive load scaling (150 lines/file, file count varies)", () => {
  bench("20 files", () => {
    replayProgressive(scale20.differences, scale20.arrivals);
  });
  bench("40 files", () => {
    replayProgressive(scale40.differences, scale40.arrivals);
  });
  bench("80 files", () => {
    replayProgressive(scale80.differences, scale80.arrivals);
  });
});
