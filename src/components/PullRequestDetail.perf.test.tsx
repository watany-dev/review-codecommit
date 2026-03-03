import { render } from "ink-testing-library";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PullRequestDetail } from "./PullRequestDetail.js";

// --- renderDiffLine call counter via module mock ---
const counter = { value: 0 };

vi.mock("./DiffLine.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./DiffLine.js")>();
  return {
    ...mod,
    renderDiffLine: (...args: Parameters<typeof mod.renderDiffLine>) => {
      counter.value++;
      return mod.renderDiffLine(...args);
    },
  };
});

// --- Test data generators ---

function generateDiffData(fileCount: number, linesPerFile: number) {
  const differences = [];
  const diffTexts = new Map<string, { before: string; after: string }>();

  for (let f = 0; f < fileCount; f++) {
    const filePath = `src/module${f}/index.ts`;
    const blobKey = `before${f}:after${f}`;
    differences.push({
      beforeBlob: { blobId: `before${f}`, path: filePath },
      afterBlob: { blobId: `after${f}`, path: filePath },
    });

    const beforeLines = Array.from({ length: linesPerFile }, (_, i) => `const val${i} = ${i};`);
    const afterLines = Array.from({ length: linesPerFile }, (_, i) =>
      i % 5 === 0 ? `const val${i} = ${i + 100}; // updated` : `const val${i} = ${i};`,
    );
    diffTexts.set(blobKey, {
      before: beforeLines.join("\n"),
      after: afterLines.join("\n"),
    });
  }

  return { differences, diffTexts };
}

// --- Default props (same pattern as PullRequestDetail.test.tsx) ---

const pullRequest = {
  pullRequestId: "99",
  title: "perf: benchmark scroll",
  authorArn: "arn:aws:iam::123456789012:user/dev",
  pullRequestStatus: "OPEN",
  creationDate: new Date("2026-03-01T00:00:00Z"),
  pullRequestTargets: [
    {
      destinationReference: "refs/heads/main",
      sourceReference: "refs/heads/feature/perf",
    },
  ],
};

const noop = vi.fn();
const noopAsync = vi
  .fn()
  .mockResolvedValue({ mergeable: true, conflictCount: 0, conflictFiles: [] });

function makeProps(overrides: { differences: any[]; diffTexts: Map<string, any> }) {
  return {
    pullRequest: pullRequest as any,
    differences: overrides.differences as any,
    commentThreads: [] as any[],
    diffTexts: overrides.diffTexts,
    onBack: noop,
    onHelp: noop,
    onShowActivity: noop,
    comment: { onPost: noop, isProcessing: false, error: null, onClearError: noop },
    inlineComment: { onPost: noop, isProcessing: false, error: null, onClearError: noop },
    reply: { onPost: noop, isProcessing: false, error: null, onClearError: noop },
    approval: {
      approvals: [],
      evaluation: null,
      onApprove: noop,
      onRevoke: noop,
      isProcessing: false,
      error: null,
      onClearError: noop,
    },
    merge: {
      onMerge: noop,
      onCheckConflicts: noopAsync,
      isProcessing: false,
      error: null,
      onClearError: noop,
    },
    close: { onClose: noop, isProcessing: false, error: null, onClearError: noop },
    commitView: {
      commits: [],
      differences: [],
      diffTexts: new Map(),
      isLoading: false,
      onLoad: noop,
      commitsAvailable: false,
    },
    editComment: { onUpdate: noop, isProcessing: false, error: null, onClearError: noop },
    deleteComment: { onDelete: noop, isProcessing: false, error: null, onClearError: noop },
    reaction: {
      byComment: new Map(),
      onReact: noop,
      isProcessing: false,
      error: null,
      onClearError: noop,
    },
  };
}

// --- Benchmark tests ---

describe("PullRequestDetail scroll rendering", () => {
  // 3 files × 40 lines = enough to scroll through
  const { differences, diffTexts } = generateDiffData(3, 40);

  beforeEach(() => {
    counter.value = 0;
  });

  it("baseline: renderDiffLine calls on initial render", () => {
    const props = makeProps({ differences, diffTexts });
    render(<PullRequestDetail {...props} />);

    const initialCalls = counter.value;
    console.log(`[perf] initial render: renderDiffLine called ${initialCalls} times`);
    expect(initialCalls).toBeGreaterThan(0);
  });

  it("baseline: renderDiffLine calls per single j-press (after warmup)", async () => {
    const props = makeProps({ differences, diffTexts });
    const { stdin, lastFrame } = render(<PullRequestDetail {...props} />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("src/module0/index.ts");
    });

    // Warmup: first press absorbs one-time React effect settling cost
    const warmupFrame = lastFrame();
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).not.toBe(warmupFrame);
    });

    // Measured press
    const frameBefore = lastFrame();
    counter.value = 0;

    stdin.write("j");

    await vi.waitFor(() => {
      expect(lastFrame()).not.toBe(frameBefore);
    });

    const callsPerKeystroke = counter.value;
    console.log(
      `[perf] single j-press (after warmup): renderDiffLine called ${callsPerKeystroke} times`,
    );

    // Before optimization: 30 (all visible lines re-render)
    // After optimization: ≤5 (only cursor-changed + new scroll-in lines)
    expect(callsPerKeystroke).toBeLessThanOrEqual(5);
  });

  it("baseline: renderDiffLine calls for 20 consecutive j-presses", async () => {
    const props = makeProps({ differences, diffTexts });
    const { stdin, lastFrame } = render(<PullRequestDetail {...props} />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("src/module0/index.ts");
    });

    counter.value = 0;

    const KEYSTROKES = 20;
    for (let i = 0; i < KEYSTROKES; i++) {
      const prev = lastFrame();
      stdin.write("j");
      await vi.waitFor(() => {
        expect(lastFrame()).not.toBe(prev);
      });
    }

    const totalCalls = counter.value;
    const avgPerKeystroke = totalCalls / KEYSTROKES;

    console.log(`[perf] ${KEYSTROKES} j-presses: renderDiffLine called ${totalCalls} total`);
    console.log(`[perf] average per keystroke: ${avgPerKeystroke.toFixed(1)}`);

    // Before optimization: 600 total (30 × 20)
    // After optimization: ≤100 total (≤5 × 20)
    expect(avgPerKeystroke).toBeLessThanOrEqual(5);
  });

  it("baseline: SplitDiffLine renders for j-press in split mode", async () => {
    const props = makeProps({ differences, diffTexts });
    const { stdin, lastFrame } = render(<PullRequestDetail {...props} terminalWidth={120} />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("src/module0/index.ts");
    });

    // Switch to split mode
    const beforeSplit = lastFrame();
    stdin.write("s");
    await vi.waitFor(() => {
      expect(lastFrame()).not.toBe(beforeSplit);
    });

    counter.value = 0;

    const prev = lastFrame();
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).not.toBe(prev);
    });

    const callsPerKeystroke = counter.value;
    console.log(
      `[perf] split-mode single j-press: renderDiffLine called ${callsPerKeystroke} times`,
    );
    expect(callsPerKeystroke).toBeGreaterThan(0);
  });
});
