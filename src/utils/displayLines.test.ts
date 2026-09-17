import type { Difference } from "@aws-sdk/client-codecommit";
import { describe, expect, it } from "vitest";
import type { CommentThread, ReactionsByComment } from "../services/codecommit.js";
import { buildDisplayLines } from "./displayLines.js";

const NO_REACTIONS: ReactionsByComment = new Map();

function makeDiff(): {
  differences: Difference[];
  diffTexts: Map<string, { before: string; after: string }>;
  diffTextStatus: Map<string, "loading" | "loaded" | "error">;
  blobKey: string;
} {
  const differences: Difference[] = [
    {
      beforeBlob: { blobId: "b1", path: "src/a.ts" },
      afterBlob: { blobId: "a1", path: "src/a.ts" },
      changeType: "M",
    },
  ];
  const blobKey = "b1:a1";
  const diffTexts = new Map([[blobKey, { before: "old1\nold2", after: "new1\nnew2" }]]);
  const diffTextStatus = new Map<string, "loading" | "loaded" | "error">([[blobKey, "loaded"]]);
  return { differences, diffTexts, diffTextStatus, blobKey };
}

describe("buildDisplayLines inline threads", () => {
  it("anchors BEFORE-version threads and renders multiple threads on the same line", () => {
    const { differences, diffTexts, diffTextStatus } = makeDiff();
    // Two threads anchored to the same BEFORE line (filePosition 1) on the same file.
    const commentThreads: CommentThread[] = [
      {
        location: { filePath: "src/a.ts", filePosition: 1, relativeFileVersion: "BEFORE" },
        comments: [{ commentId: "c1", content: "first", authorArn: "arn:aws:iam::1:user/alice" }],
      },
      {
        location: { filePath: "src/a.ts", filePosition: 1, relativeFileVersion: "BEFORE" },
        comments: [{ commentId: "c2", content: "second", authorArn: "arn:aws:iam::1:user/bob" }],
      },
    ];

    const lines = buildDisplayLines(
      differences,
      diffTexts,
      diffTextStatus,
      new Map(),
      commentThreads,
      new Map(),
      NO_REACTIONS,
    );

    const inlineTexts = lines.filter((l) => l.type === "inline-comment").map((l) => l.text);
    expect(inlineTexts).toContain("💬 alice: first");
    expect(inlineTexts).toContain("💬 bob: second");
  });
});

describe("buildDisplayLines diff cache", () => {
  it("keeps each file's own filePath when two files share identical blob ids", () => {
    // Two empty files added in one PR have the same (empty-content) afterBlob id
    // and no beforeBlob, so their blob keys collide.
    const differences: Difference[] = [
      { afterBlob: { blobId: "E", path: "pkg/a/__init__.py" }, changeType: "A" },
      { afterBlob: { blobId: "E", path: "pkg/b/__init__.py" }, changeType: "A" },
    ];
    const diffTexts = new Map([[":E", { before: "", after: "" }]]);
    const diffTextStatus = new Map<string, "loading" | "loaded" | "error">([[":E", "loaded"]]);
    const cache = new Map();

    const lines = buildDisplayLines(
      differences,
      diffTexts,
      diffTextStatus,
      new Map(),
      [],
      new Map(),
      NO_REACTIONS,
      cache,
    );

    // Every diff line must carry the path of the header it is rendered under
    let currentHeader = "";
    let checked = 0;
    for (const line of lines) {
      if (line.type === "header") {
        currentHeader = line.text;
      } else if (line.type === "context") {
        expect(line.filePath).toBe(currentHeader);
        checked++;
      }
    }
    expect(checked).toBe(2);
  });

  it("returns stable filePath across cached rebuilds", () => {
    const differences: Difference[] = [
      { afterBlob: { blobId: "E", path: "a.txt" }, changeType: "A" },
      { afterBlob: { blobId: "E", path: "b.txt" }, changeType: "A" },
    ];
    const diffTexts = new Map([[":E", { before: "x", after: "x" }]]);
    const diffTextStatus = new Map<string, "loading" | "loaded" | "error">([[":E", "loaded"]]);
    const cache = new Map();
    const build = () =>
      buildDisplayLines(
        differences,
        diffTexts,
        diffTextStatus,
        new Map(),
        [],
        new Map(),
        NO_REACTIONS,
        cache,
      );
    const first = build()
      .filter((l) => l.type === "context")
      .map((l) => l.filePath);
    const second = build()
      .filter((l) => l.type === "context")
      .map((l) => l.filePath);
    expect(first).toEqual(["a.txt", "b.txt"]);
    expect(second).toEqual(["a.txt", "b.txt"]);
  });
});

function buildTruncated(
  before: string,
  after: string,
  limit: number,
): ReturnType<typeof buildDisplayLines> {
  const differences: Difference[] = [
    {
      beforeBlob: { blobId: "b1", path: "f.ts" },
      afterBlob: { blobId: "a1", path: "f.ts" },
      changeType: "M",
    },
  ];
  const blobKey = "b1:a1";
  return buildDisplayLines(
    differences,
    new Map([[blobKey, { before, after }]]),
    new Map([[blobKey, "loaded"]]),
    new Map([[blobKey, limit]]),
    [],
    new Map(),
    NO_REACTIONS,
  );
}

function contentLineCount(lines: ReturnType<typeof buildDisplayLines>): number {
  return lines.filter((l) => l.type === "add" || l.type === "delete" || l.type === "context")
    .length;
}

describe("buildDisplayLines slice limits", () => {
  it("emits no content lines when totalLimit is 0", () => {
    const lines = buildTruncated("old1\nold2", "new1\nnew2", 0);
    expect(contentLineCount(lines)).toBe(0);
    expect(lines.some((l) => l.type === "truncation")).toBe(true);
  });

  it("emits no content lines when totalLimit is negative", () => {
    const lines = buildTruncated("old1\nold2", "new1", -3);
    expect(contentLineCount(lines)).toBe(0);
    expect(lines.some((l) => l.type === "truncation")).toBe(true);
  });

  it("keeps the full diff when both sides fit in the limit", () => {
    const { differences, diffTexts, diffTextStatus } = makeDiff();
    const lines = buildDisplayLines(
      differences,
      diffTexts,
      diffTextStatus,
      new Map(),
      [],
      new Map(),
      NO_REACTIONS,
    );
    expect(lines.some((l) => l.type === "truncation")).toBe(false);
    expect(contentLineCount(lines)).toBeGreaterThan(0);
  });

  it("splits an over-budget diff and still shows truncation", () => {
    const before = Array.from({ length: 10 }, (_, i) => `before-${i}`).join("\n");
    const after = Array.from({ length: 2 }, (_, i) => `after-${i}`).join("\n");
    const lines = buildTruncated(before, after, 6);
    expect(lines.some((l) => l.text.includes("truncated 6/12"))).toBe(true);
    expect(contentLineCount(lines)).toBeLessThan(12);
    expect(contentLineCount(lines)).toBeGreaterThan(0);
  });

  it("gives leftover budget to the before side when after is smaller than its share", () => {
    // 10 before + 1 after, limit 8: after cannot absorb rounding remainder.
    const before = Array.from({ length: 10 }, (_, i) => `b${i}`).join("\n");
    const after = "only-after";
    const lines = buildTruncated(before, after, 8);
    expect(lines.some((l) => l.text.includes("truncated 8/11"))).toBe(true);
    expect(contentLineCount(lines)).toBeLessThan(11);
  });
});
