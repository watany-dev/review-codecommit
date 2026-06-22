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
