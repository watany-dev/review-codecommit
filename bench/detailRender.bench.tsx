import type { Difference } from "@aws-sdk/client-codecommit";
import { render } from "ink-testing-library";
import React from "react";
import { bench, describe } from "vitest";
import { PullRequestDetail } from "../src/components/PullRequestDetail.js";

const noop = () => {};

function makeLines(count: number, prefix: string): string {
  return Array.from({ length: count }, (_, i) => `${prefix} line ${i} with some content`).join(
    "\n",
  );
}

function makeFixture(fileCount: number, linesPerFile: number) {
  const differences: Difference[] = [];
  const diffTexts = new Map<string, { before: string; after: string }>();
  const diffTextStatus = new Map<string, "loading" | "loaded" | "error">();

  for (let f = 0; f < fileCount; f++) {
    const beforeBlobId = `before-${f}`;
    const afterBlobId = `after-${f}`;
    differences.push({
      beforeBlob: { blobId: beforeBlobId, path: `src/file-${f}.ts` },
      afterBlob: { blobId: afterBlobId, path: `src/file-${f}.ts` },
      changeType: "M",
    });
    const key = `${beforeBlobId}:${afterBlobId}`;
    diffTexts.set(key, {
      before: makeLines(linesPerFile, `f${f}-old`),
      after: makeLines(linesPerFile, `f${f}-new`),
    });
    diffTextStatus.set(key, "loaded");
  }

  return { differences, diffTexts, diffTextStatus };
}

const pullRequest = {
  pullRequestId: "42",
  title: "perf: benchmark fixture",
  authorArn: "arn:aws:iam::123456789012:user/watany",
  pullRequestStatus: "OPEN",
  creationDate: new Date("2026-02-13T10:00:00Z"),
  pullRequestTargets: [
    {
      destinationReference: "refs/heads/main",
      sourceReference: "refs/heads/feature/perf",
    },
  ],
};

const asyncActionProps = {
  onPost: noop,
  isProcessing: false,
  error: null,
  onClearError: noop,
};

const fixture = makeFixture(10, 200);

function renderDetail() {
  return render(
    <PullRequestDetail
      pullRequest={pullRequest as never}
      differences={fixture.differences}
      commentThreads={[]}
      diffTexts={fixture.diffTexts}
      diffTextStatus={fixture.diffTextStatus}
      onBack={noop}
      onHelp={noop}
      onShowActivity={noop}
      comment={asyncActionProps}
      inlineComment={asyncActionProps}
      reply={asyncActionProps}
      approval={{
        approvals: [],
        evaluation: null,
        onApprove: noop,
        onRevoke: noop,
        isProcessing: false,
        error: null,
        onClearError: noop,
      }}
      merge={{
        onMerge: noop,
        onCheckConflicts: () =>
          Promise.resolve({ mergeable: true, conflictCount: 0, conflictFiles: [] }),
        isProcessing: false,
        error: null,
        onClearError: noop,
      }}
      close={{ onClose: noop, isProcessing: false, error: null, onClearError: noop }}
      commitView={{
        commits: [],
        differences: [],
        diffTexts: new Map(),
        isLoading: false,
        onLoad: noop,
        commitsAvailable: false,
      }}
      editComment={{ onUpdate: noop, isProcessing: false, error: null, onClearError: noop }}
      deleteComment={{ onDelete: noop, isProcessing: false, error: null, onClearError: noop }}
      reaction={{
        byComment: new Map(),
        onReact: noop,
        isProcessing: false,
        error: null,
        onClearError: noop,
      }}
    />,
  );
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("PullRequestDetail rendering (10 files x 200 lines)", () => {
  bench("initial mount + unmount", async () => {
    const instance = renderDetail();
    await flush();
    instance.unmount();
  });

  // Alternate down/up so the cursor keeps moving (a clamped cursor skips re-render)
  const navInstance = renderDetail();
  let navDown = true;
  bench("j/k keystroke (cursor move + re-render)", async () => {
    navInstance.stdin.write(navDown ? "j" : "k");
    navDown = !navDown;
    await flush();
  });

  // Unhandled key: measures stdin parsing + flush overhead without a re-render
  const noopInstance = renderDetail();
  bench("no-op keystroke (no re-render)", async () => {
    noopInstance.stdin.write("z");
    await flush();
  });

  const pageInstance = renderDetail();
  let pageDown = true;
  bench("Ctrl+d/u half-page scroll + re-render", async () => {
    pageInstance.stdin.write(pageDown ? "\x04" : "\x15");
    pageDown = !pageDown;
    await flush();
  });
});
