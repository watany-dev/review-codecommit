/**
 * CPU cost of PullRequestDetail interactions that rebuild display lines.
 *
 * - remount: Help (`?`) and Activity (`A`) replace PullRequestDetail in App,
 *   so returning remounts it with an empty diffCacheRef (cold rebuild).
 * - `t` expansion: every press changes the cache key (displayLimit), so the
 *   file is re-diffed from line 0 and the previous entry stays in the cache.
 * - warm rebuild: even with every diff cached, buildDisplayLines rescans each
 *   file's full text with countLines on every rebuild (fold toggle, reaction
 *   arrival, comment reload).
 * - commit view: buildDisplayLines is called without a diffCache.
 */
import type { Difference } from "@aws-sdk/client-codecommit";
import { render } from "ink-testing-library";
import React from "react";
import { bench, describe } from "vitest";
import { PullRequestDetail } from "../src/components/PullRequestDetail.js";
import { buildDisplayLines, countLines } from "../src/utils/displayLines.js";
import type { DisplayLine } from "../src/utils/formatDiff.js";

const noop = () => {};

/** A realistic edit: `lines` context lines with a 5→8 line change every 250 lines. */
function makeEditedFile(lines: number, prefix: string) {
  const before = Array.from({ length: lines }, (_, i) => `${prefix} line ${i} with some content`);
  const after = [...before];
  for (let at = lines - 250; at > 0; at -= 250) {
    after.splice(
      at,
      5,
      ...Array.from({ length: 8 }, (_, i) => `${prefix} edited ${at}-${i}`),
    );
  }
  return { before: before.join("\n"), after: after.join("\n") };
}

function makeFixture(fileCount: number, linesPerFile: number) {
  const differences: Difference[] = [];
  const diffTexts = new Map<string, { before: string; after: string }>();
  const diffTextStatus = new Map<string, "loading" | "loaded" | "error">();
  for (let f = 0; f < fileCount; f++) {
    differences.push({
      beforeBlob: { blobId: `b${f}`, path: `src/file-${f}.ts` },
      afterBlob: { blobId: `a${f}`, path: `src/file-${f}.ts` },
      changeType: "M",
    });
    diffTexts.set(`b${f}:a${f}`, makeEditedFile(linesPerFile, `f${f}`));
    diffTextStatus.set(`b${f}:a${f}`, "loaded");
  }
  return { differences, diffTexts, diffTextStatus };
}

function build(
  fx: ReturnType<typeof makeFixture>,
  limits: Map<string, number> = new Map(),
  cache?: Map<string, DisplayLine[]>,
  collapsed: Map<string, boolean> = new Map(),
) {
  return buildDisplayLines(
    fx.differences,
    fx.diffTexts,
    fx.diffTextStatus,
    limits,
    [],
    collapsed,
    new Map(),
    cache,
  );
}

const asyncActionProps = { isProcessing: false, error: null, execute: noop, clearError: noop };
const pullRequest = {
  pullRequestId: "42",
  title: "perf",
  authorArn: "arn:aws:iam::123456789012:user/watany",
  pullRequestStatus: "OPEN",
  pullRequestTargets: [{ destinationReference: "refs/heads/main", sourceReference: "refs/heads/x" }],
};

function renderDetail(fx: ReturnType<typeof makeFixture>) {
  return render(
    <PullRequestDetail
      pullRequest={pullRequest as never}
      differences={fx.differences}
      commentThreads={[]}
      diffTexts={fx.diffTexts}
      diffTextStatus={fx.diffTextStatus}
      onBack={noop}
      onHelp={noop}
      onShowActivity={noop}
      comment={asyncActionProps}
      inlineComment={asyncActionProps}
      reply={asyncActionProps}
      approval={{ ...asyncActionProps, approvals: [], evaluation: null }}
      merge={{
        ...asyncActionProps,
        onCheckConflicts: () =>
          Promise.resolve({ mergeable: true, conflictCount: 0, conflictFiles: [] }),
      }}
      close={asyncActionProps}
      commitView={{
        commits: [],
        differences: [],
        diffTexts: new Map(),
        isLoading: false,
        onLoad: noop,
        commitsAvailable: false,
      }}
      editComment={asyncActionProps}
      deleteComment={asyncActionProps}
      reaction={{ ...asyncActionProps, byComment: new Map() }}
    />,
  );
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

// 40 files x 700 lines: below LARGE_DIFF_THRESHOLD per file, so nothing is truncated.
const mid = makeFixture(40, 700);

describe("return from Help/Activity (PullRequestDetail remount, 40 files x 700 lines)", () => {
  bench("remount: mount + first frame (cold diffCache)", async () => {
    const inst = renderDetail(mid);
    await flush();
    inst.unmount();
  });

  const warmCache = new Map<string, DisplayLine[]>();
  build(mid, new Map(), warmCache);
  bench("buildDisplayLines cold (what remount pays)", () => {
    build(mid, new Map(), new Map());
  });
  bench("buildDisplayLines warm (what staying mounted would pay)", () => {
    build(mid, new Map(), warmCache);
  });
});

// One 8000-line file: 16k lines total -> truncated to 300, +300 per `t`.
const huge = makeFixture(1, 8000);
const hugeKey = "b0:a0";
const hugeTotal = countLines(huge.diffTexts.get(hugeKey)!.before) * 2;

describe("`t` expansion on one 8000-line file", () => {
  bench("one `t` press at 3000 shown lines (re-diffs from line 0)", () => {
    build(huge, new Map([[hugeKey, 3300]]), new Map());
  });
  bench("one `t` press at 9000 shown lines", () => {
    build(huge, new Map([[hugeKey, 9300]]), new Map());
  });
  bench("press `t` until fully expanded (shared cache, as in the component)", () => {
    const cache = new Map<string, DisplayLine[]>();
    for (let limit = 300; limit < hugeTotal; limit += 300) {
      build(huge, new Map([[hugeKey, limit]]), cache);
    }
  });
});

// 30 files x 6000 lines: every file truncated to 300 lines, so the diff work
// is small but countLines still scans ~11 MB of text on every rebuild.
const truncated = makeFixture(30, 6000);
const truncatedCache = new Map<string, DisplayLine[]>();
build(truncated, new Map(), truncatedCache);

describe("warm rebuild on a truncated large PR (30 files x 6000 lines)", () => {
  let toggle = false;
  bench("warm buildDisplayLines (e.g. `o` fold toggle / reaction arrival)", () => {
    toggle = !toggle;
    build(truncated, new Map(), truncatedCache, new Map([["x", toggle]]));
  });
  bench("countLines over all texts alone", () => {
    for (const { before, after } of truncated.diffTexts.values()) {
      countLines(before);
      countLines(after);
    }
  });
});

// Commit view calls buildDisplayLines without a diffCache.
const commitFx = makeFixture(20, 700);
const commitCache = new Map<string, DisplayLine[]>();
build(commitFx, new Map(), commitCache);

describe("commit view rebuild on unrelated prop change (20 files x 700 lines)", () => {
  bench("current: no diffCache", () => {
    build(commitFx);
  });
  bench("with diffCache", () => {
    build(commitFx, new Map(), commitCache);
  });
});
