import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { PullRequestDetail } from "./PullRequestDetail.js";

describe("PullRequestDetail", () => {
  const pullRequest = {
    pullRequestId: "42",
    title: "fix: login timeout",
    authorArn: "arn:aws:iam::123456789012:user/watany",
    pullRequestStatus: "OPEN",
    creationDate: new Date("2026-02-13T10:00:00Z"),
    pullRequestTargets: [
      {
        destinationReference: "refs/heads/main",
        sourceReference: "refs/heads/feature/login-fix",
      },
    ],
  };

  const differences = [
    {
      beforeBlob: { blobId: "b1", path: "src/auth.ts" },
      afterBlob: { blobId: "b2", path: "src/auth.ts" },
    },
  ];

  const diffTexts = new Map([
    [
      "b1:b2",
      {
        before: "line1\nline2\nline3",
        after: "line1\nmodified\nline3\nnew line",
      },
    ],
  ]);

  const comments = [
    {
      authorArn: "arn:aws:iam::123456789012:user/taro",
      content: "LGTM",
    },
  ];

  it("renders PR title and ID", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("PR #42");
    expect(output).toContain("fix: login timeout");
  });

  it("renders author and status", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("watany");
    expect(output).toContain("OPEN");
  });

  it("renders branch references", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("main");
    expect(output).toContain("feature/login-fix");
  });

  it("renders file path from diff", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("src/auth.ts");
  });

  it("renders diff content", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("line1");
  });

  it("renders comments", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("LGTM");
    expect(output).toContain("taro");
  });

  it("renders without comments", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    expect(lastFrame()).not.toContain("Comments");
  });

  it("renders with missing PR fields gracefully", () => {
    const minimalPR = {
      pullRequestId: undefined,
      title: undefined,
      authorArn: undefined,
      pullRequestStatus: undefined,
      creationDate: undefined,
      pullRequestTargets: undefined,
    };
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={minimalPR as any}
        differences={[]}
        comments={[]}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("(no title)");
  });

  it("renders unknown file when blobs are missing", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[{ beforeBlob: undefined, afterBlob: undefined }] as any}
        comments={[]}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("(unknown file)");
  });

  it("renders diff without matching blob texts", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={
          [
            {
              beforeBlob: { blobId: "x1", path: "src/other.ts" },
              afterBlob: { blobId: "x2", path: "src/other.ts" },
            },
          ] as any
        }
        comments={[]}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("src/other.ts");
  });

  it("shows navigation hints", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("scroll");
    expect(lastFrame()).toContain("back");
    expect(lastFrame()).toContain("help");
  });

  it("calls onBack on q key", () => {
    const onBack = vi.fn();
    const { stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={onBack}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    stdin.write("q");
    expect(onBack).toHaveBeenCalled();
  });

  it("calls onHelp on ? key", () => {
    const onHelp = vi.fn();
    const { stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={onHelp}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    stdin.write("?");
    expect(onHelp).toHaveBeenCalled();
  });

  it("scrolls down with j key", () => {
    const manyDiffs = Array.from({ length: 5 }, (_, i) => ({
      beforeBlob: { blobId: `a${i}`, path: `file${i}.ts` },
      afterBlob: { blobId: `b${i}`, path: `file${i}.ts` },
    }));
    const texts = new Map<string, { before: string; after: string }>();
    for (let i = 0; i < 5; i++) {
      texts.set(`a${i}:b${i}`, {
        before: Array.from({ length: 10 }, (_, j) => `old-${i}-${j}`).join("\n"),
        after: Array.from({ length: 10 }, (_, j) => `new-${i}-${j}`).join("\n"),
      });
    }

    const { stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={manyDiffs as any}
        comments={[]}
        diffTexts={texts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    stdin.write("j");
    stdin.write("j");
    // Just verify no crash on scroll
  });

  it("scrolls up with k key stays at 0", () => {
    const { stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    stdin.write("k"); // should stay at 0
    // Just verify no crash
  });

  it("shows CommentInput when c key is pressed", async () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });
  });

  it("does not scroll when in comment mode", async () => {
    const onBack = vi.fn();
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={onBack}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });
    // j/k/q should not trigger normal keybinds
    stdin.write("j");
    stdin.write("q");
    expect(onBack).not.toHaveBeenCalled();
  });

  it("shows c comment in footer hint", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("c comment");
  });

  it("auto-closes comment mode on successful post", () => {
    const { rerender, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={true}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    // Simulate posting complete (isPostingComment: true -> false, no error)
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    // Comment mode should be closed
    expect(lastFrame()).not.toContain("New Comment:");
    expect(lastFrame()).not.toContain("Posting comment...");
  });

  it("keeps comment mode open on post error", async () => {
    const { stdin, rerender, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    // Enter comment mode
    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });

    // Simulate posting start
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={true}
        commentError={null}
        onClearCommentError={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("Posting comment...");

    // Simulate posting failed
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        comments={comments as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError="Comment exceeds the 10,240 character limit."
        onClearCommentError={vi.fn()}
      />,
    );
    // Error should be shown, comment mode still open
    expect(lastFrame()).toContain("Failed to post comment:");
  });
});
