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

  const commentThreads = [
    {
      location: null,
      comments: [
        {
          authorArn: "arn:aws:iam::123456789012:user/taro",
          content: "LGTM",
        },
      ],
    },
  ];

  const defaultInlineCommentProps = {
    onPostInlineComment: vi.fn(),
    isPostingInlineComment: false,
    inlineCommentError: null as string | null,
    onClearInlineCommentError: vi.fn(),
  };

  const defaultReplyProps = {
    onPostReply: vi.fn(),
    isPostingReply: false,
    replyError: null as string | null,
    onClearReplyError: vi.fn(),
  };

  const defaultApprovalProps = {
    approvals: [] as any[],
    approvalEvaluation: null,
    onApprove: vi.fn(),
    onRevoke: vi.fn(),
    isApproving: false,
    approvalError: null as string | null,
    onClearApprovalError: vi.fn(),
  };

  it("renders PR title and ID", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
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
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
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
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
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
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).toContain("src/auth.ts");
  });

  it("renders diff content", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
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
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
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
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
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
        commentThreads={[]}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).toContain("(no title)");
  });

  it("renders unknown file when blobs are missing", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[{ beforeBlob: undefined, afterBlob: undefined }] as any}
        commentThreads={[]}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
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
        commentThreads={[]}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).toContain("src/other.ts");
  });

  it("shows navigation hints", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).toContain("cursor");
    expect(lastFrame()).toContain("back");
    expect(lastFrame()).toContain("help");
  });

  it("calls onBack on q key", () => {
    const onBack = vi.fn();
    const { stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={onBack}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
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
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={onHelp}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("?");
    expect(onHelp).toHaveBeenCalled();
  });

  it("shows CommentInput when c key is pressed", async () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
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
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={onBack}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
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
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).toContain("c comment");
  });

  it("auto-closes comment mode on successful post", () => {
    const { rerender, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={true}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Simulate posting complete (isPostingComment: true -> false, no error)
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
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
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
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
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={true}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).toContain("Posting comment...");

    // Simulate posting failed
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError="Comment exceeds the 10,240 character limit."
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Error should be shown, comment mode still open
    expect(lastFrame()).toContain("Failed to post comment:");
  });

  // v0.3: Approval display tests
  it("shows approvals with approver names when approvals exist", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        approvals={[{ userArn: "arn:aws:iam::123456789012:user/taro", approvalState: "APPROVE" }]}
        approvalEvaluation={null}
        onApprove={vi.fn()}
        onRevoke={vi.fn()}
        isApproving={false}
        approvalError={null}
        onClearApprovalError={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("Approvals:");
    expect(output).toContain("taro");
    expect(output).toContain("✓");
  });

  it("shows (none) when no approvals", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).toContain("Approvals:");
    expect(lastFrame()).toContain("(none)");
  });

  it("shows rules satisfied when approval evaluation exists", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        approvals={[]}
        approvalEvaluation={{
          approved: true,
          overridden: false,
          approvalRulesSatisfied: ["RequireOneApproval"],
          approvalRulesNotSatisfied: [],
        }}
        onApprove={vi.fn()}
        onRevoke={vi.fn()}
        isApproving={false}
        approvalError={null}
        onClearApprovalError={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("Rules:");
    expect(output).toContain("✓");
    expect(output).toContain("Approved");
    expect(output).toContain("1/1 rules satisfied");
  });

  it("shows rules not satisfied", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        approvals={[]}
        approvalEvaluation={{
          approved: false,
          overridden: false,
          approvalRulesSatisfied: [],
          approvalRulesNotSatisfied: ["RequireOneApproval"],
        }}
        onApprove={vi.fn()}
        onRevoke={vi.fn()}
        isApproving={false}
        approvalError={null}
        onClearApprovalError={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("Rules:");
    expect(output).toContain("✗");
    expect(output).toContain("Not approved");
    expect(output).toContain("0/1 rules satisfied");
  });

  it("does not show rules when no approval rules exist", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).not.toContain("Rules:");
  });

  // v0.3: ConfirmPrompt integration tests
  it("shows approve confirm prompt on a key", async () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request? (y/n)");
    });
  });

  it("shows revoke confirm prompt on r key", async () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Revoke your approval? (y/n)");
    });
  });

  it("does not scroll when in approval prompt mode", async () => {
    const onBack = vi.fn();
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={onBack}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });
    stdin.write("j"); // should not scroll
    stdin.write("q"); // should not go back (q doesn't cancel prompt)
    expect(onBack).not.toHaveBeenCalled();
  });

  it("shows a approve r revoke in footer", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).toContain("a approve");
    expect(lastFrame()).toContain("r revoke");
  });

  it("auto-closes approval prompt on successful approve", async () => {
    const { rerender, lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Enter approve mode
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });

    // Simulate approving (isApproving: true)
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        approvals={[]}
        approvalEvaluation={null}
        onApprove={vi.fn()}
        onRevoke={vi.fn()}
        isApproving={true}
        approvalError={null}
        onClearApprovalError={vi.fn()}
      />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approving...");
    });

    // Simulate approve success (isApproving: true -> false, no error)
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        approvals={[{ userArn: "arn:aws:iam::123456789012:user/watany", approvalState: "APPROVE" }]}
        approvalEvaluation={null}
        onApprove={vi.fn()}
        onRevoke={vi.fn()}
        isApproving={false}
        approvalError={null}
        onClearApprovalError={vi.fn()}
      />,
    );
    // Prompt should be closed, approval state updated
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Approve this pull request?");
      expect(lastFrame()).not.toContain("Approving...");
    });
  });

  it("keeps approval prompt open on error", () => {
    const { rerender, lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Enter approve mode
    stdin.write("a");

    // Simulate approving
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        approvals={[]}
        approvalEvaluation={null}
        onApprove={vi.fn()}
        onRevoke={vi.fn()}
        isApproving={true}
        approvalError={null}
        onClearApprovalError={vi.fn()}
      />,
    );

    // Simulate approve failure
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        approvals={[]}
        approvalEvaluation={null}
        onApprove={vi.fn()}
        onRevoke={vi.fn()}
        isApproving={false}
        approvalError="Access denied. Check your IAM policy."
        onClearApprovalError={vi.fn()}
      />,
    );
    // Error should be displayed in prompt
    expect(lastFrame()).toContain("Access denied. Check your IAM policy.");
    expect(lastFrame()).toContain("Press any key to return");
  });

  it("clears error and closes approval prompt on key press during error", async () => {
    const onClearApprovalError = vi.fn();
    const { rerender, lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        approvals={[]}
        approvalEvaluation={null}
        onApprove={vi.fn()}
        onRevoke={vi.fn()}
        isApproving={false}
        approvalError={null}
        onClearApprovalError={onClearApprovalError}
      />,
    );
    // Enter approve mode
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });

    // Show error state
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        approvals={[]}
        approvalEvaluation={null}
        onApprove={vi.fn()}
        onRevoke={vi.fn()}
        isApproving={false}
        approvalError="Some error"
        onClearApprovalError={onClearApprovalError}
      />,
    );
    expect(lastFrame()).toContain("Some error");

    // Press any key to clear error
    stdin.write("x");
    await vi.waitFor(() => {
      expect(onClearApprovalError).toHaveBeenCalled();
    });
  });

  it("cancels approval prompt on n key", async () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });
    stdin.write("n");
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Approve this pull request?");
      expect(lastFrame()).toContain("a approve");
    });
  });

  it("does not open approval prompt when in comment mode", async () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });
    stdin.write("a");
    // Should not show approval prompt
    expect(lastFrame()).not.toContain("Approve this pull request?");
  });

  // v0.4: Inline comment display tests
  it("displays inline comments under matching diff lines", () => {
    const inlineThreads = [
      {
        location: {
          filePath: "src/auth.ts",
          filePosition: 2,
          relativeFileVersion: "BEFORE" as const,
        },
        comments: [
          {
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "This value should come from config",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={inlineThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("💬 taro: This value should come from config");
  });

  it("displays inline comments on add lines", () => {
    const inlineThreads = [
      {
        location: {
          filePath: "src/auth.ts",
          filePosition: 2,
          relativeFileVersion: "AFTER" as const,
        },
        comments: [
          {
            authorArn: "arn:aws:iam::123456789012:user/hanako",
            content: "Good change",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={inlineThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("💬 hanako: Good change");
  });

  it("shows both inline and general comments", () => {
    const mixedThreads = [
      {
        location: {
          filePath: "src/auth.ts",
          filePosition: 1,
          relativeFileVersion: "AFTER" as const,
        },
        comments: [
          {
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "inline note",
          },
        ],
      },
      {
        location: null,
        comments: [
          {
            authorArn: "arn:aws:iam::123456789012:user/hanako",
            content: "general LGTM",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={mixedThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("💬 taro: inline note");
    expect(output).toContain("general LGTM");
    expect(output).toContain("Comments (1):");
  });

  // v0.4: Cursor navigation tests
  it("shows cursor marker on first line initially", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).toContain("> ");
  });

  it("moves cursor down with j key", () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("j");
    stdin.write("j");
    // Verify no crash, cursor still within bounds
    expect(lastFrame()).toContain("> ");
  });

  it("cursor stays at 0 when pressing k at top", () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("k");
    stdin.write("k");
    // First line should still have cursor
    expect(lastFrame()).toContain("> ");
  });

  // v0.4: Inline comment posting tests
  it("shows inline comment input on C key when cursor is on diff line", async () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Move cursor to a diff line (skip header and separator), wait for render
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      // Cursor should be on context line " line1"
      const frame = lastFrame() ?? "";
      expect(frame).toMatch(/> .*line1/);
    });
    stdin.write("C");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
    });
  });

  it("does not open inline comment input on non-diff line", () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Cursor is on header line (index 0) — no filePath/lineNumber
    stdin.write("C");
    // Should not show inline comment input
    expect(lastFrame()).not.toContain("Inline comment on");
  });

  it("opens inline comment on add line with C key", async () => {
    const diffTextsAddOnly = new Map([
      [
        "b1:b2",
        {
          before: "keep",
          after: "keep\nnew line 1",
        },
      ],
    ]);
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTextsAddOnly}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Move to add line (header=0, separator=1, context=2, add=3)
    stdin.write("j");
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*new line 1/);
    });
    stdin.write("C");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
    });
  });

  it("opens inline comment on delete line with C key", async () => {
    const diffTextsDeleteOnly = new Map([
      [
        "b1:b2",
        {
          before: "keep\nold line 1",
          after: "keep",
        },
      ],
    ]);
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTextsDeleteOnly}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Move to delete line (header=0, separator=1, context=2, delete=3)
    stdin.write("j");
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*old line 1/);
    });
    stdin.write("C");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
    });
  });

  it("cancels inline comment mode on Esc", async () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*line1/);
    });
    stdin.write("C");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
    });
    // Cancel with Esc
    stdin.write("\x1B");
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Inline comment on");
      expect(lastFrame()).toContain("R reply");
    });
  });

  it("does not open inline comment on separator line", () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Move to separator line (index 1)
    stdin.write("j");
    stdin.write("C");
    expect(lastFrame()).not.toContain("Inline comment on");
  });

  it("does not move cursor when in inline comment mode", async () => {
    const onBack = vi.fn();
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={onBack}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Move to diff line and open inline comment
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*line1/);
    });
    stdin.write("C");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
    });
    // Try to move cursor — should be blocked
    stdin.write("j");
    expect(lastFrame()).toContain("Inline comment on");
    // q should not trigger back
    stdin.write("q");
    expect(onBack).not.toHaveBeenCalled();
  });

  it("displays BEFORE inline comments on context lines", () => {
    const inlineThreads = [
      {
        location: {
          filePath: "src/auth.ts",
          filePosition: 1,
          relativeFileVersion: "BEFORE" as const,
        },
        comments: [
          {
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "before-context comment",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={inlineThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).toContain("💬 taro: before-context comment");
  });

  it("keeps inline comment mode open on post error", async () => {
    const { stdin, rerender, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*line1/);
    });
    stdin.write("C");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
    });

    // Simulate posting start
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        onPostInlineComment={vi.fn()}
        isPostingInlineComment={true}
        inlineCommentError={null}
        onClearInlineCommentError={vi.fn()}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
    });

    // Simulate post error
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        onPostInlineComment={vi.fn()}
        isPostingInlineComment={false}
        inlineCommentError="Access denied"
        onClearInlineCommentError={vi.fn()}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Should stay open with error shown
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
      expect(lastFrame()).toContain("Access denied");
    });
  });

  it("does not open inline comment on comment-header line", async () => {
    const threadWithGeneral = [
      {
        location: null,
        comments: [{ authorArn: "arn:aws:iam::123456789012:user/bob", content: "general" }],
      },
    ];
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={threadWithGeneral as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Navigate past all diff lines to comment section
    // header=0, sep=1, ctx=2, del=3, add=4, ctx=5, add=6, sep(empty)=7, sep(line)=8, comment-header=9
    for (let i = 0; i < 9; i++) {
      stdin.write("j");
    }
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*Comments/);
    });
    stdin.write("C");
    expect(lastFrame()).not.toContain("Inline comment on");
  });

  it("shows C inline in footer", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).toContain("R reply");
  });

  it("auto-closes inline comment mode on successful post", async () => {
    const { stdin, rerender, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Move to diff line and wait for render before pressing C
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*line1/);
    });
    stdin.write("C");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
    });

    // Simulate posting start
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        onPostInlineComment={vi.fn()}
        isPostingInlineComment={true}
        inlineCommentError={null}
        onClearInlineCommentError={vi.fn()}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );

    // Wait for effect to run (wasPostingInline = true)
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
    });

    // Simulate posting complete
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Inline comment mode should be closed
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Inline comment on");
    });
  });

  it("does not show rules when evaluation has zero rules", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        approvals={[]}
        approvalEvaluation={
          {
            approved: false,
            approvalRulesSatisfied: [],
            approvalRulesNotSatisfied: [],
          } as any
        }
        onApprove={vi.fn()}
        onRevoke={vi.fn()}
        isApproving={false}
        approvalError={null}
        onClearApprovalError={vi.fn()}
      />,
    );
    expect(lastFrame()).not.toContain("Rules:");
  });

  it("handles approvals with missing userArn", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        approvals={[{ approvalState: "APPROVE" }] as any}
        approvalEvaluation={null}
        onApprove={vi.fn()}
        onRevoke={vi.fn()}
        isApproving={false}
        approvalError={null}
        onClearApprovalError={vi.fn()}
      />,
    );
    const output = lastFrame();
    // Should handle missing userArn gracefully
    expect(output).toContain("Approvals:");
  });

  it("handles rules with undefined arrays", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        approvals={[]}
        approvalEvaluation={
          {
            approved: true,
            approvalRulesSatisfied: undefined,
            approvalRulesNotSatisfied: [{ approvalRuleName: "rule1" }],
          } as any
        }
        onApprove={vi.fn()}
        onRevoke={vi.fn()}
        isApproving={false}
        approvalError={null}
        onClearApprovalError={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("Rules:");
  });

  it("handles comments with missing authorArn and content", () => {
    const mixedThreads = [
      {
        location: {
          filePath: "src/auth.ts",
          filePosition: 1,
          relativeFileVersion: "AFTER" as const,
        },
        comments: [{ commentId: "c1" }],
      },
      {
        location: null,
        comments: [{ commentId: "c2" }],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={mixedThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame();
    // Should render without error, showing "unknown" for missing author
    expect(output).toContain("unknown");
  });

  // v0.5: Reply display tests
  it("displays inline reply with indent under root comment", () => {
    const threadWithReply = [
      {
        location: {
          filePath: "src/auth.ts",
          filePosition: 2,
          relativeFileVersion: "BEFORE" as const,
        },
        comments: [
          {
            commentId: "c1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "This value should come from config",
          },
          {
            commentId: "c2",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/watany",
            content: "Will fix in next PR",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={threadWithReply as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("💬 taro: This value should come from config");
    expect(output).toContain("└ watany: Will fix in next PR");
  });

  it("displays general comment reply with indent", () => {
    const threadWithReply = [
      {
        location: null,
        comments: [
          {
            commentId: "c1",
            authorArn: "arn:aws:iam::123456789012:user/watany",
            content: "Extended timeout",
          },
          {
            commentId: "c2",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "Use a constant instead?",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={threadWithReply as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("watany: Extended timeout");
    expect(output).toContain("└ taro: Use a constant instead?");
    expect(output).toContain("Comments (2):");
  });

  it("displays mixed inline and general threads with replies", () => {
    const mixedThreads = [
      {
        location: {
          filePath: "src/auth.ts",
          filePosition: 1,
          relativeFileVersion: "AFTER" as const,
        },
        comments: [
          {
            commentId: "c1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "inline root",
          },
          {
            commentId: "c2",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/watany",
            content: "inline reply",
          },
        ],
      },
      {
        location: null,
        comments: [
          {
            commentId: "c3",
            authorArn: "arn:aws:iam::123456789012:user/hanako",
            content: "general root",
          },
          {
            commentId: "c4",
            inReplyTo: "c3",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "general reply",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={mixedThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("💬 taro: inline root");
    expect(output).toContain("└ watany: inline reply");
    expect(output).toContain("hanako: general root");
    expect(output).toContain("└ taro: general reply");
  });

  it("renders thread with no replies (backward compat with v0.4)", () => {
    const singleCommentThread = [
      {
        location: null,
        comments: [
          {
            commentId: "c1",
            authorArn: "arn:aws:iam::123456789012:user/watany",
            content: "solo comment",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={singleCommentThread as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("watany: solo comment");
    expect(output).not.toContain("└");
  });

  it("displays root before reply even when comments array has reply first", () => {
    const outOfOrderThread = [
      {
        location: null,
        comments: [
          {
            commentId: "c2",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/watany",
            content: "reply",
          },
          {
            commentId: "c1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "comment",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={outOfOrderThread as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame()!;
    const rootIdx = output.indexOf("taro: comment");
    const replyIdx = output.indexOf("└ watany: reply");
    expect(rootIdx).toBeGreaterThan(-1);
    expect(replyIdx).toBeGreaterThan(-1);
    expect(rootIdx).toBeLessThan(replyIdx);
  });

  it("treats first comment as root when all comments have inReplyTo", () => {
    const allRepliesThread = [
      {
        location: null,
        comments: [
          {
            commentId: "c1",
            inReplyTo: "deleted",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "orphan1",
          },
          {
            commentId: "c2",
            inReplyTo: "deleted",
            authorArn: "arn:aws:iam::123456789012:user/watany",
            content: "orphan2",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={allRepliesThread as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame()!;
    expect(output).toContain("taro: orphan1");
    expect(output).toContain("└ watany: orphan2");
  });

  // v0.5: Thread folding tests
  it("auto-folds threads with 4+ comments on initial render", () => {
    const longThread = [
      {
        location: null,
        comments: [
          { commentId: "c1", authorArn: "arn:aws:iam::123456789012:user/a", content: "root" },
          {
            commentId: "c2",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/b",
            content: "reply1",
          },
          {
            commentId: "c3",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/c",
            content: "reply2",
          },
          {
            commentId: "c4",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/d",
            content: "reply3",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={longThread as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("a: root");
    expect(output).toContain("[+3 replies]");
    expect(output).not.toContain("reply1");
  });

  it("does not fold threads with fewer than 4 comments", () => {
    const shortThread = [
      {
        location: null,
        comments: [
          { commentId: "c1", authorArn: "arn:aws:iam::123456789012:user/a", content: "root" },
          {
            commentId: "c2",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/b",
            content: "reply1",
          },
          {
            commentId: "c3",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/c",
            content: "reply2",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={shortThread as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("a: root");
    expect(output).toContain("└ b: reply1");
    expect(output).toContain("└ c: reply2");
    expect(output).not.toContain("[+");
  });

  it("expands folded thread with o key", async () => {
    const longThread = [
      {
        location: null,
        comments: [
          { commentId: "c1", authorArn: "arn:aws:iam::123456789012:user/a", content: "root" },
          {
            commentId: "c2",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/b",
            content: "reply1",
          },
          {
            commentId: "c3",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/c",
            content: "reply2",
          },
          {
            commentId: "c4",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/d",
            content: "reply3",
          },
        ],
      },
    ];
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[]}
        commentThreads={longThread as any}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Initially folded
    expect(lastFrame()).toContain("[+3 replies]");

    // Navigate to the comment line (sep=0, comment-header=1, comment=2)
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*a: root/);
    });

    // Press o to unfold
    stdin.write("o");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("└ b: reply1");
      expect(lastFrame()).toContain("└ c: reply2");
      expect(lastFrame()).toContain("└ d: reply3");
      expect(lastFrame()).not.toContain("[+3 replies]");
    });
  });

  it("re-folds expanded thread with o key", async () => {
    const longThread = [
      {
        location: null,
        comments: [
          { commentId: "c1", authorArn: "arn:aws:iam::123456789012:user/a", content: "root" },
          {
            commentId: "c2",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/b",
            content: "reply1",
          },
          {
            commentId: "c3",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/c",
            content: "reply2",
          },
          {
            commentId: "c4",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/d",
            content: "reply3",
          },
        ],
      },
    ];
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[]}
        commentThreads={longThread as any}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );

    // Navigate to comment line
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*a: root/);
    });

    // Unfold
    stdin.write("o");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("└ b: reply1");
    });

    // Press o again to refold
    stdin.write("o");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("[+3 replies]");
      expect(lastFrame()).not.toContain("reply1");
    });
  });

  // v0.5: Reply posting tests
  it("shows reply input on R key when cursor is on comment line", async () => {
    const threadWithComment = [
      {
        location: null,
        comments: [
          {
            commentId: "c1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "Please fix this",
          },
        ],
      },
    ];
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[]}
        commentThreads={threadWithComment as any}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Navigate to comment (sep=0, comment-header=1, comment=2)
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*taro: Please fix this/);
    });
    stdin.write("R");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
    });
  });

  it("does not open reply input on non-comment line", () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Cursor is on header line
    stdin.write("R");
    expect(lastFrame()).not.toContain("Replying to");
  });

  it("does not scroll when in reply mode", async () => {
    const onBack = vi.fn();
    const threadWithComment = [
      {
        location: null,
        comments: [
          {
            commentId: "c1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "comment",
          },
        ],
      },
    ];
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[]}
        commentThreads={threadWithComment as any}
        diffTexts={new Map()}
        onBack={onBack}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*taro: comment/);
    });
    stdin.write("R");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
    });
    // j/k/q should not work
    stdin.write("j");
    stdin.write("q");
    expect(onBack).not.toHaveBeenCalled();
  });

  it("cancels reply mode on Esc", async () => {
    const threadWithComment = [
      {
        location: null,
        comments: [
          {
            commentId: "c1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "fix this",
          },
        ],
      },
    ];
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[]}
        commentThreads={threadWithComment as any}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*taro: fix this/);
    });
    stdin.write("R");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
    });
    stdin.write("\x1B");
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Replying to");
      expect(lastFrame()).toContain("R reply");
    });
  });

  it("auto-closes reply mode on successful post", async () => {
    const threadWithComment = [
      {
        location: null,
        comments: [
          {
            commentId: "c1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "fix",
          },
        ],
      },
    ];
    const { stdin, rerender, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[]}
        commentThreads={threadWithComment as any}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*taro: fix/);
    });
    stdin.write("R");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
    });

    // Simulate posting start
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[]}
        commentThreads={threadWithComment as any}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        onPostReply={vi.fn()}
        isPostingReply={true}
        replyError={null}
        onClearReplyError={vi.fn()}
        {...defaultApprovalProps}
      />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
    });

    // Simulate posting complete
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[]}
        commentThreads={threadWithComment as any}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Replying to");
    });
  });

  it("keeps reply mode open on error", async () => {
    const threadWithComment = [
      {
        location: null,
        comments: [
          {
            commentId: "c1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "fix",
          },
        ],
      },
    ];
    const { stdin, rerender, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[]}
        commentThreads={threadWithComment as any}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*taro: fix/);
    });
    stdin.write("R");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
    });

    // Simulate posting start then failure
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[]}
        commentThreads={threadWithComment as any}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        onPostReply={vi.fn()}
        isPostingReply={true}
        replyError={null}
        onClearReplyError={vi.fn()}
        {...defaultApprovalProps}
      />,
    );

    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={[]}
        commentThreads={threadWithComment as any}
        diffTexts={new Map()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        onPostReply={vi.fn()}
        isPostingReply={false}
        replyError="Reply exceeds the 10,240 character limit."
        onClearReplyError={vi.fn()}
        {...defaultApprovalProps}
      />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
      expect(lastFrame()).toContain("Reply exceeds the 10,240 character limit.");
    });
  });

  it("shows R reply and o fold in footer", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    expect(lastFrame()).toContain("R reply");
    expect(lastFrame()).toContain("o fold");
  });

  it("ignores o key on non-comment lines", () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    // Cursor is on header line (no threadIndex)
    stdin.write("o");
    // Should not crash, no visible change
    expect(lastFrame()).toContain("src/auth.ts");
  });

  it("displays multiple comments on same line as thread", () => {
    const multiCommentThread = [
      {
        location: {
          filePath: "src/auth.ts",
          filePosition: 2,
          relativeFileVersion: "BEFORE" as const,
        },
        comments: [
          {
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "first comment",
          },
          {
            authorArn: "arn:aws:iam::123456789012:user/watany",
            content: "second comment",
          },
        ],
      },
    ];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={multiCommentThread as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("💬 taro: first comment");
    expect(output).toContain("└ watany: second comment");
  });

  it("updates display when commentThreads prop changes (useMemo regression)", () => {
    const initialThreads = [
      {
        location: null,
        comments: [
          {
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "Initial comment",
          },
        ],
      },
    ];

    const { lastFrame, rerender } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={initialThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );

    expect(lastFrame()).toContain("Initial comment");

    const updatedThreads = [
      ...initialThreads,
      {
        location: null,
        comments: [
          {
            authorArn: "arn:aws:iam::123456789012:user/hanako",
            content: "New comment after reload",
          },
        ],
      },
    ];

    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={updatedThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );

    expect(lastFrame()).toContain("New comment after reload");
  });

  it("updates display when diffTexts prop changes (useMemo regression)", () => {
    const emptyDiffTexts = new Map<string, { before: string; after: string }>();

    const { lastFrame, rerender } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={commentThreads as any}
        diffTexts={emptyDiffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );

    // Before blob fetch: no diff content lines
    expect(lastFrame()).not.toContain("+new line");

    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );

    // After blob fetch: diff content appears
    expect(lastFrame()).toContain("+new line");
  });

  it("updates display when differences prop changes (useMemo regression)", () => {
    const { lastFrame, rerender } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );

    expect(lastFrame()).toContain("src/auth.ts");
    expect(lastFrame()).not.toContain("src/utils.ts");

    const newDifferences = [
      ...differences,
      {
        beforeBlob: { blobId: "b3", path: "src/utils.ts" },
        afterBlob: { blobId: "b4", path: "src/utils.ts" },
      },
    ];

    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={newDifferences as any}
        commentThreads={commentThreads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        onPostComment={vi.fn()}
        isPostingComment={false}
        commentError={null}
        onClearCommentError={vi.fn()}
        {...defaultInlineCommentProps}
        {...defaultReplyProps}
        {...defaultApprovalProps}
      />,
    );

    expect(lastFrame()).toContain("src/utils.ts");
  });
});
