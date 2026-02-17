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
    onPost: vi.fn(),
    isProcessing: false,
    error: null as string | null,
    onClearError: vi.fn(),
  };

  const defaultReplyProps = {
    onPost: vi.fn(),
    isProcessing: false,
    error: null as string | null,
    onClearError: vi.fn(),
  };

  const defaultApprovalProps = {
    approvals: [] as any[],
    evaluation: null,
    onApprove: vi.fn(),
    onRevoke: vi.fn(),
    isProcessing: false,
    error: null as string | null,
    onClearError: vi.fn(),
  };

  const defaultMergeProps = {
    onMerge: vi.fn(),
    onCheckConflicts: vi
      .fn()
      .mockResolvedValue({ mergeable: true, conflictCount: 0, conflictFiles: [] }),
    isProcessing: false,
    error: null as string | null,
    onClearError: vi.fn(),
  };

  const defaultCloseProps = {
    onClose: vi.fn(),
    isProcessing: false,
    error: null as string | null,
    onClearError: vi.fn(),
  };

  const defaultCommitProps = {
    commits: [] as any[],
    differences: [] as any[],
    diffTexts: new Map<string, { before: string; after: string }>(),
    isLoading: false,
    onLoad: vi.fn(),
    commitsAvailable: false,
  };

  const defaultEditCommentProps = {
    onUpdate: vi.fn(),
    isProcessing: false,
    error: null as string | null,
    onClearError: vi.fn(),
  };

  const defaultDeleteCommentProps = {
    onDelete: vi.fn(),
    isProcessing: false,
    error: null as string | null,
    onClearError: vi.fn(),
  };

  const defaultReactionProps = {
    byComment: new Map() as any,
    onReact: vi.fn(),
    isProcessing: false,
    error: null as string | null,
    onClearError: vi.fn(),
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("LGTM");
    expect(output).toContain("taro");
  });

  it("skips empty comment thread", () => {
    const emptyThread = [{ location: null, comments: [] }];
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={emptyThread as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    expect(lastFrame()).toBeDefined();
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    expect(lastFrame()).toContain("↑↓");
    expect(lastFrame()).toContain("q");
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: true, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: true, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{
          onPost: vi.fn(),
          isProcessing: false,
          error: "Comment exceeds the 10,240 character limit.",
          onClearError: vi.fn(),
        }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        approval={{
          approvals: [{ userArn: "arn:aws:iam::123456789012:user/taro", approvalState: "APPROVE" }],
          evaluation: null,
          onApprove: vi.fn(),
          onRevoke: vi.fn(),
          isProcessing: false,
          error: null,
          onClearError: vi.fn(),
        }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
        reply={defaultReplyProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        approval={{
          approvals: [],
          evaluation: {
            approved: true,
            overridden: false,
            approvalRulesSatisfied: ["RequireOneApproval"],
            approvalRulesNotSatisfied: [],
          },
          onApprove: vi.fn(),
          onRevoke: vi.fn(),
          isProcessing: false,
          error: null,
          onClearError: vi.fn(),
        }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
        reply={defaultReplyProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        approval={{
          approvals: [],
          evaluation: {
            approved: false,
            overridden: false,
            approvalRulesSatisfied: [],
            approvalRulesNotSatisfied: ["RequireOneApproval"],
          },
          onApprove: vi.fn(),
          onRevoke: vi.fn(),
          isProcessing: false,
          error: null,
          onClearError: vi.fn(),
        }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
        reply={defaultReplyProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    expect(lastFrame()).toContain("a/r approve");
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        approval={{
          approvals: [],
          evaluation: null,
          onApprove: vi.fn(),
          onRevoke: vi.fn(),
          isProcessing: true,
          error: null,
          onClearError: vi.fn(),
        }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
        reply={defaultReplyProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        approval={{
          approvals: [
            { userArn: "arn:aws:iam::123456789012:user/watany", approvalState: "APPROVE" },
          ],
          evaluation: null,
          onApprove: vi.fn(),
          onRevoke: vi.fn(),
          isProcessing: false,
          error: null,
          onClearError: vi.fn(),
        }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
        reply={defaultReplyProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        approval={{
          approvals: [],
          evaluation: null,
          onApprove: vi.fn(),
          onRevoke: vi.fn(),
          isProcessing: true,
          error: null,
          onClearError: vi.fn(),
        }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
        reply={defaultReplyProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        approval={{
          approvals: [],
          evaluation: null,
          onApprove: vi.fn(),
          onRevoke: vi.fn(),
          isProcessing: false,
          error: "Access denied. Check your IAM policy.",
          onClearError: vi.fn(),
        }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
        reply={defaultReplyProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        approval={{
          approvals: [],
          evaluation: null,
          onApprove: vi.fn(),
          onRevoke: vi.fn(),
          isProcessing: false,
          error: null,
          onClearError: onClearApprovalError,
        }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
        reply={defaultReplyProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        approval={{
          approvals: [],
          evaluation: null,
          onApprove: vi.fn(),
          onRevoke: vi.fn(),
          isProcessing: false,
          error: "Some error",
          onClearError: onClearApprovalError,
        }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
        reply={defaultReplyProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });
    stdin.write("n");
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Approve this pull request?");
      expect(lastFrame()).toContain("a/r approve");
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("j");
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    // Move cursor to a diff line (skip header and separator), wait for render
    stdin.write("j");
    await vi.waitFor(() => {
      const frame = lastFrame() ?? "";
      expect(frame).toMatch(/> .*─/);
    });
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
    stdin.write("\u001B");
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Inline comment on");
    });
  });

  it("shows truncation notice for large diffs and expands on t", async () => {
    const beforeLines = Array.from({ length: 1200 }, (_, i) => `before ${i + 1}`).join("\n");
    const afterLines = Array.from({ length: 1200 }, (_, i) => `after ${i + 1}`).join("\n");
    const largeDiffTexts = new Map([
      [
        "b1:b2",
        {
          before: beforeLines,
          after: afterLines,
        },
      ],
    ]);
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={largeDiffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );

    stdin.write("G");
    stdin.write("k");
    stdin.write("k");
    stdin.write("k");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("... truncated 300/2400 lines");
      expect(lastFrame()).toContain("[t] show next 300 lines");
    });

    stdin.write("G");
    for (let i = 0; i < 6; i++) stdin.write("k");
    stdin.write("t");
    // Wait for re-render after expansion (before 300 only visible after expansion)
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("-before 300");
    });
    stdin.write("G");
    stdin.write("k");
    stdin.write("k");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("... truncated 600/2400 lines");
    });
  });

  it("handles asymmetric large diff (many before, few after lines)", async () => {
    const beforeLines = Array.from({ length: 1500 }, (_, i) => `old ${i + 1}`).join("\n");
    const afterLines = "new line 1\nnew line 2";
    const asymmetricDiffTexts = new Map([["b1:b2", { before: beforeLines, after: afterLines }]]);
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={asymmetricDiffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    // Navigate to the truncation area at the bottom
    stdin.write("G");
    stdin.write("k");
    stdin.write("k");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("truncated");
    });
  });

  it("t key does nothing on small diff", () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    // Move to a diff line
    stdin.write("j");
    stdin.write("j");
    const before = lastFrame();
    stdin.write("t");
    expect(lastFrame()).toBe(before);
  });

  it("t key does nothing on non-diff line", () => {
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    // Stay on header line (no diffKey)
    const before = lastFrame();
    stdin.write("t");
    expect(lastFrame()).toBe(before);
  });

  it("t key does nothing in commit view", async () => {
    const sampleCommits = [
      {
        commitId: "abc1234567",
        shortId: "abc1234",
        message: "feat: add login",
        authorName: "alice",
        authorDate: new Date("2026-02-13T10:00:00Z"),
        parentIds: ["base123"],
      },
    ] as any;
    const { stdin, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={{ ...defaultCommitProps, commits: sampleCommits }}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("\t");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("[Commit 1/1]");
    });
    const before = lastFrame();
    stdin.write("t");
    expect(lastFrame()).toBe(before);
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={{ onPost: vi.fn(), isProcessing: true, error: null, onClearError: vi.fn() }}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={{
          onPost: vi.fn(),
          isProcessing: false,
          error: "Access denied",
          onClearError: vi.fn(),
        }}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    // Jump to bottom where comment header is rendered
    stdin.write("G");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Comments (1):");
    });
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("bob: general");
    });
    stdin.write("k");
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={{ onPost: vi.fn(), isProcessing: true, error: null, onClearError: vi.fn() }}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        approval={{
          approvals: [],
          evaluation: {
            approved: false,
            approvalRulesSatisfied: [],
            approvalRulesNotSatisfied: [],
          } as any,
          onApprove: vi.fn(),
          onRevoke: vi.fn(),
          isProcessing: false,
          error: null,
          onClearError: vi.fn(),
        }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
        reply={defaultReplyProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        approval={{
          approvals: [{ approvalState: "APPROVE" }] as any,
          evaluation: null,
          onApprove: vi.fn(),
          onRevoke: vi.fn(),
          isProcessing: false,
          error: null,
          onClearError: vi.fn(),
        }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
        reply={defaultReplyProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        approval={{
          approvals: [],
          evaluation: {
            approved: true,
            approvalRulesSatisfied: undefined,
            approvalRulesNotSatisfied: [{ approvalRuleName: "rule1" }],
          } as any,
          onApprove: vi.fn(),
          onRevoke: vi.fn(),
          isProcessing: false,
          error: null,
          onClearError: vi.fn(),
        }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
        reply={defaultReplyProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    // Initially folded
    expect(lastFrame()).toContain("[+3 replies]");

    // Navigate to the comment line (sep=0, comment-header=1, comment=2)
    stdin.write("G");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("a: root");
    });
    stdin.write("k");
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={{ onPost: vi.fn(), isProcessing: true, error: null, onClearError: vi.fn() }}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={{ onPost: vi.fn(), isProcessing: true, error: null, onClearError: vi.fn() }}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={{
          onPost: vi.fn(),
          isProcessing: false,
          error: "Reply exceeds the 10,240 character limit.",
          onClearError: vi.fn(),
        }}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
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
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );

    expect(lastFrame()).toContain("src/utils.ts");
  });

  // v0.6: Merge integration tests
  it("shows merge strategy selector on m key", async () => {
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
      expect(lastFrame()).toContain("Fast-forward");
      expect(lastFrame()).toContain("Squash");
      expect(lastFrame()).toContain("Three-way merge");
    });
  });

  it("shows merge confirmation after strategy selection and conflict check", async () => {
    const onCheckConflicts = vi.fn().mockResolvedValue({
      mergeable: true,
      conflictCount: 0,
      conflictFiles: [],
    });
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{ ...defaultMergeProps, onCheckConflicts: onCheckConflicts }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r"); // select fast-forward
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fast-forward");
      expect(lastFrame()).toContain("(y/n)");
    });
  });

  it("calls onMerge with selected strategy on confirm", async () => {
    const onMerge = vi.fn();
    const onCheckConflicts = vi.fn().mockResolvedValue({
      mergeable: true,
      conflictCount: 0,
      conflictFiles: [],
    });
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{ ...defaultMergeProps, onMerge: onMerge, onCheckConflicts: onCheckConflicts }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r"); // select fast-forward
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });
    stdin.write("y");
    expect(onMerge).toHaveBeenCalledWith("fast-forward");
  });

  it("shows conflict details when merge has conflicts", async () => {
    const onCheckConflicts = vi.fn().mockResolvedValue({
      mergeable: false,
      conflictCount: 2,
      conflictFiles: ["src/auth.ts", "src/config.ts"],
    });
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{ ...defaultMergeProps, onCheckConflicts: onCheckConflicts }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r"); // select fast-forward
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Cannot merge: 2 conflicting files");
      expect(lastFrame()).toContain("src/auth.ts");
      expect(lastFrame()).toContain("src/config.ts");
      expect(lastFrame()).toContain("Resolve conflicts before merging.");
    });
  });

  it("dismisses conflict display on key press", async () => {
    const onCheckConflicts = vi.fn().mockResolvedValue({
      mergeable: false,
      conflictCount: 1,
      conflictFiles: ["src/auth.ts"],
    });
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{ ...defaultMergeProps, onCheckConflicts: onCheckConflicts }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Cannot merge");
    });
    stdin.write(" "); // any key to dismiss
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Cannot merge");
      expect(lastFrame()).toContain("m merge");
    });
  });

  it("cancels merge strategy selection on Esc", async () => {
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\u001B"); // Esc
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Select merge strategy:");
      expect(lastFrame()).toContain("m merge");
    });
  });

  it("shows checking for conflicts message", async () => {
    let resolveConflictCheck: (value: any) => void;
    const onCheckConflicts = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveConflictCheck = resolve;
      }),
    );
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{ ...defaultMergeProps, onCheckConflicts: onCheckConflicts }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Checking for conflicts...");
    });
    // Resolve to complete
    resolveConflictCheck!({ mergeable: true, conflictCount: 0, conflictFiles: [] });
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });
  });

  it("shows merge error on failure", async () => {
    const onCheckConflicts = vi.fn().mockResolvedValue({
      mergeable: true,
      conflictCount: 0,
      conflictFiles: [],
    });
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{
          ...defaultMergeProps,
          error: "Conflicts detected. Cannot auto-merge.",
          onCheckConflicts: onCheckConflicts,
        }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Conflicts detected. Cannot auto-merge.");
    });
  });

  it("selects squash strategy via j+Enter", async () => {
    const onMerge = vi.fn();
    const onCheckConflicts = vi.fn().mockResolvedValue({
      mergeable: true,
      conflictCount: 0,
      conflictFiles: [],
    });
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{ ...defaultMergeProps, onMerge: onMerge, onCheckConflicts: onCheckConflicts }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("j"); // move to Squash
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> Squash");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("squash");
      expect(lastFrame()).toContain("(y/n)");
    });
    stdin.write("y");
    expect(onMerge).toHaveBeenCalledWith("squash");
  });

  it("selects three-way strategy via j+j+Enter", async () => {
    const onMerge = vi.fn();
    const onCheckConflicts = vi.fn().mockResolvedValue({
      mergeable: true,
      conflictCount: 0,
      conflictFiles: [],
    });
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{ ...defaultMergeProps, onMerge: onMerge, onCheckConflicts: onCheckConflicts }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("j");
    stdin.write("j"); // move to Three-way
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> Three-way merge");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("three-way merge");
      expect(lastFrame()).toContain("(y/n)");
    });
    stdin.write("y");
    expect(onMerge).toHaveBeenCalledWith("three-way");
  });

  // v0.6: Close PR tests
  it("shows close confirmation on x key", async () => {
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("x");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Close this pull request without merging?");
    });
  });

  it("calls onClosePR on close confirmation", async () => {
    const onClosePR = vi.fn();
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={{ ...defaultCloseProps, onClose: onClosePR }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("x");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Close this pull request without merging?");
    });
    stdin.write("y");
    expect(onClosePR).toHaveBeenCalled();
  });

  it("cancels close on n key", async () => {
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("x");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Close this pull request without merging?");
    });
    stdin.write("n");
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Close this pull request");
      expect(lastFrame()).toContain("m merge");
    });
  });

  it("shows close error on failure", async () => {
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={{ ...defaultCloseProps, error: "Pull request is already closed." }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("x");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Pull request is already closed.");
    });
  });

  it("shows m merge and x close in footer bar", () => {
    const { lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    expect(lastFrame()).toContain("m merge");
    expect(lastFrame()).toContain("close");
    expect(lastFrame()).toContain("g react");
  });

  it("shows merging indicator", async () => {
    const onCheckConflicts = vi.fn().mockResolvedValue({
      mergeable: true,
      conflictCount: 0,
      conflictFiles: [],
    });
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{ ...defaultMergeProps, isProcessing: true, onCheckConflicts: onCheckConflicts }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Merging...");
    });
  });

  it("shows closing indicator", async () => {
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={{ ...defaultCloseProps, isProcessing: true }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("x");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Closing...");
    });
  });

  it("resets merge step on successful merge completion", () => {
    const { rerender, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{ ...defaultMergeProps, isProcessing: true }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    // Simulate merge complete (isProcessing: true -> false, no error)
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{ ...defaultMergeProps, isProcessing: false }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    expect(lastFrame()).not.toContain("Merging...");
    expect(lastFrame()).not.toContain("Select merge strategy:");
  });

  it("resets close state on successful close completion", () => {
    const { rerender, lastFrame } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={{ ...defaultCloseProps, isProcessing: true }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    // Simulate close complete (isProcessing: true -> false, no error)
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={{ ...defaultCloseProps, isProcessing: false }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    expect(lastFrame()).not.toContain("Closing...");
    expect(lastFrame()).not.toContain("Close this pull request?");
  });

  it("cancels comment mode on Esc", async () => {
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });
    stdin.write("\x1B");
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("New Comment:");
    });
  });

  it("ignores m and x keys when in other modes", async () => {
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    // Enter comment mode
    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });
    // m and x should be ignored in comment mode (typing them)
    // They will just be input text in the comment input, not trigger merge/close
    expect(lastFrame()).not.toContain("Select merge strategy:");
    expect(lastFrame()).not.toContain("Close this pull request");
  });

  // Coverage: exercise inline comment cancel callback
  it("cancels inline comment on Esc", async () => {
    const onClearInlineCommentError = vi.fn();
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={{ ...defaultInlineCommentProps, onClearError: onClearInlineCommentError }}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    // Move cursor to an actual diff line (index 2 = context " line1")
    stdin.write("j"); // move to separator (index 1)
    stdin.write("j"); // move to context line (index 2)
    await vi.waitFor(() => {
      const frame = lastFrame() ?? "";
      expect(frame).toMatch(/> .* line1/);
    });
    stdin.write("C");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
    });
    stdin.write("\u001B"); // Esc to cancel
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Inline comment on");
    });
  });

  // Coverage: exercise reply cancel callback
  it("cancels reply on Esc", async () => {
    const onClearReplyError = vi.fn();
    const threads = [
      {
        location: null,
        comments: [
          {
            commentId: "c1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "LGTM",
          },
        ],
      },
    ];
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={threads as any}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={{ ...defaultReplyProps, onClearError: onClearReplyError }}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    // Navigate to the comment (header, separator, 5 diff lines, separator, separator, comment-header, comment)
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("taro: LGTM");
    });
    // Press j 10 times to reach the comment line at index 10
    for (let i = 0; i < 10; i++) {
      stdin.write("j");
    }
    await vi.waitFor(() => {
      const frame = lastFrame() ?? "";
      expect(frame).toMatch(/> .*taro: LGTM/);
    });
    stdin.write("R");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
    });
    stdin.write("\u001B"); // Esc to cancel
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Replying to");
      expect(onClearReplyError).toHaveBeenCalled();
    });
  });

  // Coverage: exercise close PR error clear callback
  it("clears close error on dismiss", async () => {
    const onClearClosePRError = vi.fn();
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={defaultMergeProps}
        close={{ ...defaultCloseProps, error: "Some error", onClearError: onClearClosePRError }}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("x");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Some error");
    });
    // Press enter or key to clear the error
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(onClearClosePRError).toHaveBeenCalled();
    });
  });

  // Coverage: exercise approval error clear callback
  it("clears approval error on dismiss", async () => {
    const onClearApprovalError = vi.fn();
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={{
          ...defaultApprovalProps,
          error: "Cannot approve own PR",
          onClearError: onClearApprovalError,
        }}
        merge={defaultMergeProps}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Cannot approve own PR");
    });
    stdin.write("x"); // dismiss error
    await vi.waitFor(() => {
      expect(onClearApprovalError).toHaveBeenCalled();
    });
  });

  // Coverage: exercise handleStrategySelect catch block
  it("returns to normal when conflict check throws", async () => {
    const onCheckConflicts = vi.fn().mockRejectedValue(new Error("network error"));
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{ ...defaultMergeProps, onCheckConflicts: onCheckConflicts }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    // After the error, merge should be cancelled and we're back to normal
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("m merge");
      expect(lastFrame()).not.toContain("Select merge strategy:");
      expect(lastFrame()).not.toContain("Checking for conflicts...");
    });
  });

  // Coverage: exercise merge cancel callback (onCancel at confirm stage)
  it("cancels merge at confirm stage on n key", async () => {
    const onClearMergeError = vi.fn();
    const onCheckConflicts = vi.fn().mockResolvedValue({
      mergeable: true,
      conflictCount: 0,
      conflictFiles: [],
    });
    const { lastFrame, stdin } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{
          ...defaultMergeProps,
          onClearError: onClearMergeError,
          onCheckConflicts: onCheckConflicts,
        }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });
    stdin.write("n"); // cancel merge
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("(y/n)");
      expect(lastFrame()).toContain("m merge");
      expect(onClearMergeError).toHaveBeenCalled();
    });
  });

  // Coverage: exercise merge error clear callback
  it("clears merge error on dismiss", async () => {
    const onClearMergeError = vi.fn();
    const onCheckConflicts = vi.fn().mockResolvedValue({
      mergeable: true,
      conflictCount: 0,
      conflictFiles: [],
    });
    const { lastFrame, stdin, rerender } = render(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{
          ...defaultMergeProps,
          error: null,
          onClearError: onClearMergeError,
          onCheckConflicts: onCheckConflicts,
        }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });
    rerender(
      <PullRequestDetail
        pullRequest={pullRequest as any}
        differences={differences as any}
        commentThreads={[]}
        diffTexts={diffTexts}
        onBack={vi.fn()}
        onHelp={vi.fn()}
        comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
        inlineComment={defaultInlineCommentProps}
        reply={defaultReplyProps}
        approval={defaultApprovalProps}
        merge={{
          ...defaultMergeProps,
          error: "Merge failed",
          onClearError: onClearMergeError,
          onCheckConflicts: onCheckConflicts,
        }}
        close={defaultCloseProps}
        commitView={defaultCommitProps}
        editComment={defaultEditCommentProps}
        deleteComment={defaultDeleteCommentProps}
        reaction={defaultReactionProps}
      />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Merge failed");
    });
    stdin.write("x"); // dismiss error
    await vi.waitFor(() => {
      expect(onClearMergeError).toHaveBeenCalled();
    });
  });

  const sampleCommits = [
    {
      commitId: "aaa1234567",
      shortId: "aaa1234",
      message: "Fix input validation",
      authorName: "watany",
      authorDate: new Date("2026-02-13T10:00:00Z"),
      parentIds: ["base123"],
    },
    {
      commitId: "bbb5678901",
      shortId: "bbb5678",
      message: "Add error handling",
      authorName: "taro",
      authorDate: new Date("2026-02-13T11:00:00Z"),
      parentIds: ["aaa1234567"],
    },
    {
      commitId: "ccc9012345",
      shortId: "ccc9012",
      message: "Update tests",
      authorName: "watany",
      authorDate: new Date("2026-02-13T12:00:00Z"),
      parentIds: ["bbb5678901"],
    },
  ];

  describe("commit view - tab header", () => {
    it("does not show tab header when commits is empty", () => {
      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      expect(lastFrame()).not.toContain("[All changes]");
      expect(lastFrame()).not.toContain("Commits");
    });

    it("shows [All changes] and Commits (N) when commits exist", () => {
      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{ ...defaultCommitProps, commits: sampleCommits, commitsAvailable: true }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      expect(lastFrame()).toContain("[All changes]");
      expect(lastFrame()).toContain("Commits (3)");
    });
  });

  describe("commit view - Tab/Shift+Tab navigation", () => {
    it("Tab switches to first commit view", async () => {
      const onLoadCommitDiff = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{
            ...defaultCommitProps,
            commits: sampleCommits,
            commitsAvailable: true,
            onLoad: onLoadCommitDiff,
          }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("\t");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[Commit 1/3]");
      });
      expect(lastFrame()).toContain("aaa1234");
      expect(lastFrame()).toContain("Fix input validation");
      expect(onLoadCommitDiff).toHaveBeenCalledWith(0);
    });

    it("Tab wraps from last commit to All changes", async () => {
      const onLoadCommitDiff = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{
            ...defaultCommitProps,
            commits: sampleCommits,
            commitsAvailable: true,
            onLoad: onLoadCommitDiff,
          }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      // Tab 4 times: All changes -> Commit 1 -> Commit 2 -> Commit 3 -> All changes
      stdin.write("\t");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[Commit 1/3]");
      });
      stdin.write("\t");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[Commit 2/3]");
      });
      stdin.write("\t");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[Commit 3/3]");
      });
      stdin.write("\t");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[All changes]");
      });
      expect(onLoadCommitDiff).toHaveBeenCalledTimes(3);
    });

    it("Shift+Tab wraps from All changes to last commit", async () => {
      const onLoadCommitDiff = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{
            ...defaultCommitProps,
            commits: sampleCommits,
            commitsAvailable: true,
            onLoad: onLoadCommitDiff,
          }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("\u001b[Z"); // Shift+Tab
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[Commit 3/3]");
      });
      expect(lastFrame()).toContain("ccc9012");
      expect(onLoadCommitDiff).toHaveBeenCalledWith(2);
    });

    it("Shift+Tab goes from commit 2 to commit 1 (non-wrapping)", async () => {
      const onLoadCommitDiff = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{
            ...defaultCommitProps,
            commits: sampleCommits,
            commitsAvailable: true,
            onLoad: onLoadCommitDiff,
          }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      // Go to commit 2
      stdin.write("\t");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[Commit 1/3]");
      });
      stdin.write("\t");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[Commit 2/3]");
      });
      // Shift+Tab back to commit 1
      stdin.write("\u001b[Z");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[Commit 1/3]");
      });
    });

    it("Tab does nothing when commits are empty", async () => {
      const onLoadCommitDiff = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("\t");
      // Wait a tick for async processing
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(lastFrame()).not.toContain("[Commit");
      expect(onLoadCommitDiff).not.toHaveBeenCalled();
    });

    it("Tab triggers lazy load when commitsAvailable but commits empty", async () => {
      const onLoadCommitDiff = vi.fn();
      const { stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{ ...defaultCommitProps, commitsAvailable: true, onLoad: onLoadCommitDiff }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("\t");
      await vi.waitFor(() => {
        expect(onLoadCommitDiff).toHaveBeenCalledWith(0);
      });
    });
  });

  describe("commit view - comment keys disabled", () => {
    it("c key is disabled in commit view", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{ ...defaultCommitProps, commits: sampleCommits, commitsAvailable: true }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("\t"); // switch to commit view
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[Commit 1/3]");
      });
      stdin.write("c"); // try to comment
      expect(lastFrame()).not.toContain("Comment:");
    });

    it("C key is disabled in commit view", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{ ...defaultCommitProps, commits: sampleCommits, commitsAvailable: true }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("\t"); // switch to commit view
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[Commit 1/3]");
      });
      stdin.write("C"); // try to inline comment
      expect(lastFrame()).not.toContain("Inline comment on");
    });
  });

  describe("commit view - loading indicator", () => {
    it("shows loading when isLoadingCommitDiff is true and in commit view", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{
            ...defaultCommitProps,
            commits: sampleCommits,
            commitsAvailable: true,
            isLoading: true,
          }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("\t"); // switch to commit view
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Loading commit diff...");
      });
    });

    it("does not show loading in All changes view", () => {
      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{
            ...defaultCommitProps,
            commits: sampleCommits,
            commitsAvailable: true,
            isLoading: true,
          }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      expect(lastFrame()).not.toContain("Loading commit diff...");
    });
  });

  describe("commit view - footer", () => {
    it("shows Tab switch view in All changes when commits exist", () => {
      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{ ...defaultCommitProps, commits: sampleCommits, commitsAvailable: true }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      expect(lastFrame()).toContain("Tab view");
    });

    it("shows Tab next Shift+Tab prev in commit view", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{ ...defaultCommitProps, commits: sampleCommits, commitsAvailable: true }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("\t"); // switch to commit view
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Tab next");
      });
      expect(lastFrame()).toContain("Shift+Tab prev");
    });

    it("does not show Tab in footer when no commits", () => {
      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      expect(lastFrame()).not.toContain("Tab switch");
      expect(lastFrame()).not.toContain("Tab next");
    });
  });

  describe("commit view - commit diff display", () => {
    it("shows commit diff data when in commit view", async () => {
      const commitDiffTexts = new Map([
        [
          "cb1:cb2",
          {
            before: "old line",
            after: "new line",
          },
        ],
      ]);
      const commitDifferences = [
        {
          beforeBlob: { blobId: "cb1", path: "src/validators.ts" },
          afterBlob: { blobId: "cb2", path: "src/validators.ts" },
        },
      ];

      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
          commitView={{
            commits: sampleCommits,
            differences: commitDifferences as any,
            diffTexts: commitDiffTexts,
            isLoading: false,
            onLoad: vi.fn(),
            commitsAvailable: true,
          }}
        />,
      );
      stdin.write("\t"); // switch to commit view
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("src/validators.ts");
      });
    });
  });

  describe("commit view - cursor reset", () => {
    it("resets cursor to 0 when switching views", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{ ...defaultCommitProps, commits: sampleCommits, commitsAvailable: true }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      // Move cursor down
      stdin.write("j");
      stdin.write("j");
      // Switch to commit view - cursor should reset
      stdin.write("\t");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[Commit 1/3]");
      });
    });
  });

  describe("commit view - PR-level actions still work", () => {
    it("a key works in commit view", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={{ ...defaultCommitProps, commits: sampleCommits, commitsAvailable: true }}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("\t"); // switch to commit view
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("[Commit 1/3]");
      });
      stdin.write("a"); // approve
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Approve this pull request?");
      });
    });
  });

  describe("v0.7: comment edit/delete", () => {
    const commentThreadsWithId = [
      {
        location: null,
        comments: [
          {
            commentId: "c-1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "LGTM",
          },
        ],
      },
    ];

    it("opens edit CommentInput when e is pressed on a comment line", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("taro");
      });
      // Jump to the comment section and select the comment line
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("e");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Edit Comment:");
      });
    });

    it("does nothing when e is pressed on a non-comment line", () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("e");
      expect(lastFrame()).not.toContain("Edit Comment:");
    });

    it("submits edit via onUpdateComment", async () => {
      const onUpdateComment = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={{ ...defaultEditCommentProps, onUpdate: onUpdateComment }}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("e");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Edit Comment:");
      });
      stdin.write("\r");
      await vi.waitFor(() => {
        expect(onUpdateComment).toHaveBeenCalledWith("c-1", "LGTM");
      });
    });

    it("cancels edit with Esc", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("e");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Edit Comment:");
      });
      stdin.write("\u001B");
      await vi.waitFor(() => {
        expect(lastFrame()).not.toContain("Edit Comment:");
      });
    });

    it("shows update error", async () => {
      const { lastFrame, stdin, rerender } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comments (1):");
      });
      stdin.write("j");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro");
      });
      stdin.write("e");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Edit Comment:");
      });
      rerender(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={{
            ...defaultEditCommentProps,
            error: "You can only edit your own comments.",
          }}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      expect(lastFrame()).toContain("You can only edit your own comments.");
    });

    it("opens delete confirmation when d is pressed on a comment line", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("d");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Delete this comment?");
      });
    });

    it("does nothing when d is pressed on a non-comment line", () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("d");
      expect(lastFrame()).not.toContain("Delete this comment?");
    });

    it("confirms delete via onDeleteComment", async () => {
      const onDeleteComment = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={{ ...defaultDeleteCommentProps, onDelete: onDeleteComment }}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("d");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Delete this comment?");
      });
      stdin.write("y");
      expect(onDeleteComment).toHaveBeenCalledWith("c-1");
    });

    it("cancels delete with n", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("d");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Delete this comment?");
      });
      stdin.write("n");
      await vi.waitFor(() => {
        expect(lastFrame()).not.toContain("Delete this comment?");
      });
    });

    it("shows delete error", async () => {
      const { lastFrame, stdin, rerender } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comments (1):");
      });
      stdin.write("j");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro");
      });
      stdin.write("d");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Delete this comment?");
      });
      rerender(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={{
            ...defaultDeleteCommentProps,
            error: "Comment has already been deleted.",
          }}
          reaction={defaultReactionProps}
        />,
      );
      expect(lastFrame()).toContain("Comment has already been deleted.");
    });

    it("ignores other keys during edit mode", async () => {
      const onBack = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={onBack}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("e");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Edit Comment:");
      });
      stdin.write("d");
      expect(lastFrame()).not.toContain("Delete this comment?");
    });

    it("ignores other keys during delete mode", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("d");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Delete this comment?");
      });
      stdin.write("e");
      expect(lastFrame()).not.toContain("Edit Comment:");
    });

    it("shows e edit and d delete in footer", () => {
      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      expect(lastFrame()).toContain("e edit");
      expect(lastFrame()).toContain("d del");
    });

    it("does not open edit when commentId is missing", async () => {
      const threadsWithoutId = [
        {
          location: null,
          comments: [
            {
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "Mismatch",
            },
          ],
        },
      ];
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={threadsWithoutId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comments (1):");
      });
      stdin.write("j");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro");
      });
      stdin.write("e");
      await vi.waitFor(() => {
        expect(lastFrame()).not.toContain("Edit Comment:");
      });
    });

    it("clears update error on cancel", async () => {
      const onClearUpdateCommentError = vi.fn();
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={{ ...defaultEditCommentProps, onClearError: onClearUpdateCommentError }}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comments (1):");
      });
      stdin.write("j");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro");
      });
      stdin.write("e");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Edit Comment:");
      });
      stdin.write("\u001B"); // Esc to cancel
      await vi.waitFor(() => {
        expect(onClearUpdateCommentError).toHaveBeenCalled();
      });
    });

    it("clears delete error on cancel", async () => {
      const onClearDeleteCommentError = vi.fn();
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={{ ...defaultDeleteCommentProps, onClearError: onClearDeleteCommentError }}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comments (1):");
      });
      stdin.write("j");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro");
      });
      stdin.write("d");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Delete this comment?");
      });
      stdin.write("n");
      await vi.waitFor(() => {
        expect(onClearDeleteCommentError).toHaveBeenCalled();
      });
    });

    it("clears delete error via error dismiss", async () => {
      const onClearDeleteCommentError = vi.fn();
      const { stdin, rerender, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={{ ...defaultDeleteCommentProps, onClearError: onClearDeleteCommentError }}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comments (1):");
      });
      stdin.write("j");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro");
      });
      stdin.write("d");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Delete this comment?");
      });
      // Simulate error
      rerender(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={{
            ...defaultDeleteCommentProps,
            onClearError: onClearDeleteCommentError,
            error: "Some error",
          }}
          reaction={defaultReactionProps}
        />,
      );
      expect(lastFrame()).toContain("Some error");
      // Dismiss the error
      stdin.write("\r");
      await vi.waitFor(() => {
        expect(onClearDeleteCommentError).toHaveBeenCalled();
      });
    });

    it("auto-closes edit when update completes successfully", async () => {
      const { lastFrame, stdin, rerender } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("e");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Edit Comment:");
      });
      rerender(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={{ ...defaultEditCommentProps, isProcessing: true }}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      rerender(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={{ ...defaultEditCommentProps, isProcessing: false }}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      await vi.waitFor(() => {
        expect(lastFrame()).not.toContain("Edit Comment:");
      });
    });

    it("auto-closes delete when delete completes successfully", async () => {
      const { lastFrame, stdin, rerender } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("d");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Delete this comment?");
      });
      rerender(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={{ ...defaultDeleteCommentProps, isProcessing: true }}
          reaction={defaultReactionProps}
        />,
      );
      rerender(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithId as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={{ ...defaultDeleteCommentProps, isProcessing: false }}
          reaction={defaultReactionProps}
        />,
      );
      await vi.waitFor(() => {
        expect(lastFrame()).not.toContain("Delete this comment?");
      });
    });
  });

  describe("v0.2.0: reaction badge display", () => {
    const commentThreadsWithReactableComments = [
      {
        location: null,
        comments: [
          {
            commentId: "comment-r1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "LGTM",
          },
          {
            commentId: "reply-r1",
            authorArn: "arn:aws:iam::123456789012:user/hanako",
            content: "Agreed",
            inReplyTo: "comment-r1",
          },
        ],
      },
    ];

    it("displays reaction badges on comment lines", () => {
      const reactionsByComment = new Map([
        [
          "comment-r1",
          [
            { emoji: "👍", shortCode: ":thumbsup:", count: 2, userArns: [] },
            { emoji: "🎉", shortCode: ":hooray:", count: 1, userArns: [] },
          ],
        ],
      ]);

      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithReactableComments as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={{ ...defaultReactionProps, byComment: reactionsByComment }}
        />,
      );
      const output = lastFrame() ?? "";
      expect(output).toContain("👍×2");
      expect(output).toContain("🎉×1");
    });

    it("displays reaction badges on reply lines", () => {
      const reactionsByComment = new Map([
        ["reply-r1", [{ emoji: "❤️", shortCode: ":heart:", count: 3, userArns: [] }]],
      ]);

      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithReactableComments as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={{ ...defaultReactionProps, byComment: reactionsByComment }}
        />,
      );
      const output = lastFrame() ?? "";
      expect(output).toContain("❤️×3");
    });

    it("shows no badge when comment has no reactions", () => {
      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithReactableComments as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      const output = lastFrame() ?? "";
      expect(output).not.toContain("×");
    });

    it("opens ReactionPicker when g is pressed on a comment line", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithReactableComments as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      // Jump to the comment section and select the comment line
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comments (2):");
      });
      // G lands on hanako (last line), confirm cursor is there
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">    └ hanako: Agreed");
      });
      stdin.write("k");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("g");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("React to comment:");
      });
    });

    it("does not open ReactionPicker on non-comment lines", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithReactableComments as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      // Stay on the first line (a header/diff line)
      stdin.write("g");
      const output = lastFrame() ?? "";
      expect(output).not.toContain("React to comment:");
    });

    it("calls onReact when emoji is selected", async () => {
      const onReact = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithReactableComments as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={{ ...defaultReactionProps, onReact: onReact }}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comments (2):");
      });
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("taro: LGTM");
      });
      stdin.write("k");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("g");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("React to comment:");
      });
      stdin.write("\r"); // select first emoji (thumbsup)
      expect(onReact).toHaveBeenCalledWith("comment-r1", ":thumbsup:");
    });

    it("closes ReactionPicker when q is pressed", async () => {
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithReactableComments as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comments (2):");
      });
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("taro: LGTM");
      });
      stdin.write("k");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("g");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("React to comment:");
      });
      stdin.write("q");
      await vi.waitFor(() => {
        expect(lastFrame()).not.toContain("React to comment:");
      });
    });

    it("auto-closes ReactionPicker when reaction completes successfully", async () => {
      const { lastFrame, stdin, rerender } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithReactableComments as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comments (2):");
      });
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("taro: LGTM");
      });
      stdin.write("k");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("g");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("React to comment:");
      });
      // Simulate isReacting=true (reaction in progress)
      rerender(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithReactableComments as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={{ ...defaultReactionProps, isProcessing: true }}
        />,
      );
      // Simulate isReacting=false (reaction completed successfully, no error)
      rerender(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithReactableComments as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={{ ...defaultReactionProps, isProcessing: false }}
        />,
      );
      await vi.waitFor(() => {
        expect(lastFrame()).not.toContain("React to comment:");
      });
    });

    it("shows reaction error and clears on any key", async () => {
      const onClearReactionError = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={commentThreadsWithReactableComments as any}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={{
            ...defaultReactionProps,
            error: "Comment deleted.",
            onClearError: onClearReactionError,
          }}
        />,
      );
      stdin.write("G");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comments (2):");
      });
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("taro: LGTM");
      });
      stdin.write("k");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain(">  taro: LGTM");
      });
      stdin.write("g");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Failed to add reaction: Comment deleted.");
      });
      stdin.write("x"); // any key to clear
      expect(onClearReactionError).toHaveBeenCalled();
    });
  });

  // Page scroll keybindings
  describe("page scroll keybindings", () => {
    // 50-line diff for testing half-page scroll
    const manyLines = Array.from({ length: 50 }, (_, i) => `line${i + 1}`).join("\n");
    const manyLinesDiffTexts = new Map([
      ["b1:b2", { before: manyLines, after: manyLines.replace("line25", "modified25") }],
    ]);

    it("moves cursor half page down with Ctrl+d", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={manyLinesDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      // Initial cursor at line 0 (file header)
      // Ctrl+d moves halfPage (15) lines down
      stdin.write("\x04");
      await vi.waitFor(() => {
        const frame = lastFrame() ?? "";
        const lines = frame.split("\n");
        const cursorLine = lines.find((l) => l.includes("> "));
        expect(cursorLine).toBeDefined();
        // Cursor should not be on file header anymore (moved down)
        expect(cursorLine).not.toContain("src/auth.ts");
      });
    });

    it("does not scroll past last line with Ctrl+d", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      // halfPage (15) > total lines (~7), should clamp to last line
      stdin.write("\x04");
      stdin.write("\x04");
      await vi.waitFor(() => {
        // Should not crash, cursor still exists
        expect(lastFrame()).toContain("> ");
      });
    });

    it("moves cursor half page up with Ctrl+u", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={manyLinesDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      // First move down with Ctrl+d
      stdin.write("\x04");
      await vi.waitFor(() => {
        const frame = lastFrame() ?? "";
        const lines = frame.split("\n");
        const cursorLine = lines.find((l) => l.includes("> "));
        expect(cursorLine).not.toContain("src/auth.ts");
      });
      // Then move back up with Ctrl+u
      stdin.write("\x15");
      await vi.waitFor(() => {
        const frame = lastFrame() ?? "";
        const lines = frame.split("\n");
        const cursorLine = lines.find((l) => l.includes("> "));
        expect(cursorLine).toBeDefined();
        // Cursor should be back at file header
        expect(cursorLine).toContain("src/auth.ts");
      });
    });

    it("does not scroll past first line with Ctrl+u", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      // At top, Ctrl+u should keep cursor at 0
      stdin.write("\x15");
      stdin.write("\x15");
      await vi.waitFor(() => {
        const frame = lastFrame() ?? "";
        const lines = frame.split("\n");
        const cursorLine = lines.find((l) => l.includes("> "));
        expect(cursorLine).toBeDefined();
        // Cursor stays on file header
        expect(cursorLine).toContain("src/auth.ts");
      });
    });

    it("jumps to last line with G key", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={manyLinesDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      // G jumps to last line (with 50+ display lines, bottom area is visible)
      stdin.write("G");
      await vi.waitFor(() => {
        const frame = lastFrame() ?? "";
        // After G, viewport scrolls to show the end of the diff
        expect(frame).toContain("line50");
        // File header should no longer be visible (scrolled past)
        expect(frame).not.toContain("src/auth.ts");
      });
    });

    it("does not scroll with Ctrl+d when comment modal is open", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={manyLinesDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      // Open comment modal
      stdin.write("c");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comment:");
      });
      // Ctrl+d should be ignored during modal
      stdin.write("\x04");
      // Modal should still be open
      expect(lastFrame()).toContain("Comment:");
    });

    it("does not jump with G when comment modal is open", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={diffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      // Open comment modal
      stdin.write("c");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Comment:");
      });
      // G should be ignored during modal
      stdin.write("G");
      // Modal should still be open
      expect(lastFrame()).toContain("Comment:");
    });
  });

  describe("per-file diff cache", () => {
    const twoFileDifferences = [
      {
        beforeBlob: { blobId: "a1", path: "src/file1.ts" },
        afterBlob: { blobId: "a2", path: "src/file1.ts" },
      },
      {
        beforeBlob: { blobId: "b1", path: "src/file2.ts" },
        afterBlob: { blobId: "b2", path: "src/file2.ts" },
      },
    ];

    it("renders correctly when diffTexts load incrementally", () => {
      // Start with only file1 loaded
      const diffTexts1 = new Map([["a1:a2", { before: "old1", after: "new1" }]]);

      const { lastFrame, rerender } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={diffTexts1}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      expect(lastFrame()).toContain("src/file1.ts");
      expect(lastFrame()).toContain("new1");
      expect(lastFrame()).toContain("Loading file content...");

      // Now file2 also loads
      const diffTexts2 = new Map([
        ["a1:a2", { before: "old1", after: "new1" }],
        ["b1:b2", { before: "old2", after: "new2" }],
      ]);

      rerender(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={diffTexts2}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      // Both files should now be rendered
      expect(lastFrame()).toContain("new1");
      expect(lastFrame()).toContain("new2");
      expect(lastFrame()).not.toContain("Loading file content...");
    });
  });

  describe("file navigation (n/N keys)", () => {
    const twoFileDifferences = [
      {
        beforeBlob: { blobId: "a1", path: "src/alpha.ts" },
        afterBlob: { blobId: "a2", path: "src/alpha.ts" },
      },
      {
        beforeBlob: { blobId: "b1", path: "src/beta.ts" },
        afterBlob: { blobId: "b2", path: "src/beta.ts" },
      },
    ];

    const twoFileDiffTexts = new Map([
      ["a1:a2", { before: "line1", after: "line1\nnewline" }],
      ["b1:b2", { before: "hello", after: "hello\nworld" }],
    ]);

    it("n moves cursor to next file header", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={twoFileDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      // Cursor starts at first line (src/alpha.ts header)
      expect(lastFrame()).toMatch(/> .*src\/alpha\.ts/);

      // Press n to jump to next file header
      stdin.write("n");
      await vi.waitFor(() => {
        expect(lastFrame()).toMatch(/> .*src\/beta\.ts/);
      });
    });

    it("n wraps from last file to first file", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={twoFileDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      // Jump to second file
      stdin.write("n");
      await vi.waitFor(() => {
        expect(lastFrame()).toMatch(/> .*src\/beta\.ts/);
      });

      // Jump again should wrap to first file
      stdin.write("n");
      await vi.waitFor(() => {
        expect(lastFrame()).toMatch(/> .*src\/alpha\.ts/);
      });
    });

    it("N moves cursor to previous file header", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={twoFileDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      // Move to second file first
      stdin.write("n");
      await vi.waitFor(() => {
        expect(lastFrame()).toMatch(/> .*src\/beta\.ts/);
      });

      // N goes back to first file
      stdin.write("N");
      await vi.waitFor(() => {
        expect(lastFrame()).toMatch(/> .*src\/alpha\.ts/);
      });
    });

    it("N wraps from first file to last file", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={twoFileDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      // Cursor starts at first header, N should wrap to last file
      stdin.write("N");
      await vi.waitFor(() => {
        expect(lastFrame()).toMatch(/> .*src\/beta\.ts/);
      });
    });
  });

  describe("file position indicator", () => {
    const twoFileDifferences = [
      {
        beforeBlob: { blobId: "a1", path: "src/alpha.ts" },
        afterBlob: { blobId: "a2", path: "src/alpha.ts" },
      },
      {
        beforeBlob: { blobId: "b1", path: "src/beta.ts" },
        afterBlob: { blobId: "b2", path: "src/beta.ts" },
      },
    ];

    const twoFileDiffTexts = new Map([
      ["a1:a2", { before: "line1", after: "line1\nnewline" }],
      ["b1:b2", { before: "hello", after: "hello\nworld" }],
    ]);

    it("shows File 1/2 when cursor is on first file", () => {
      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={twoFileDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      expect(lastFrame()).toContain("File 1/2");
    });

    it("shows File 2/2 when cursor moves to second file", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={twoFileDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      // Jump to second file
      stdin.write("n");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("File 2/2");
      });
    });
  });

  describe("file list mode (f key)", () => {
    const twoFileDifferences = [
      {
        beforeBlob: { blobId: "a1", path: "src/alpha.ts" },
        afterBlob: { blobId: "a2", path: "src/alpha.ts" },
      },
      {
        beforeBlob: { blobId: "b1", path: "src/beta.ts" },
        afterBlob: { blobId: "b2", path: "src/beta.ts" },
      },
    ];

    const twoFileDiffTexts = new Map([
      ["a1:a2", { before: "line1", after: "line1\nnewline" }],
      ["b1:b2", { before: "hello", after: "hello\nworld" }],
    ]);

    it("shows file list overlay when f is pressed", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={twoFileDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      stdin.write("f");
      await vi.waitFor(() => {
        const output = lastFrame()!;
        expect(output).toContain("Files");
        expect(output).toContain("src/alpha.ts");
        expect(output).toContain("src/beta.ts");
      });
    });

    it("navigates file list with j/k and jumps with Enter", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={twoFileDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      // Open file list
      stdin.write("f");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Files");
      });

      // Move cursor down to second file
      stdin.write("j");
      await vi.waitFor(() => {
        expect(lastFrame()).toMatch(/> .*src\/beta\.ts/);
      });

      // Select with Enter - should jump to that file and close the list
      stdin.write("\r");
      await vi.waitFor(() => {
        expect(lastFrame()).not.toContain("j/k move");
        expect(lastFrame()).toMatch(/> .*src\/beta\.ts/);
      });
    });

    it("closes file list with Esc", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={twoFileDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      stdin.write("f");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Files");
      });

      stdin.write("\u001B"); // Esc
      await vi.waitFor(() => {
        expect(lastFrame()).not.toContain("Files (2)");
      });
    });

    it("closes file list with f key", async () => {
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={twoFileDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      stdin.write("f");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Files");
      });

      stdin.write("f");
      await vi.waitFor(() => {
        expect(lastFrame()).not.toContain("Files (2)");
      });
    });

    it("does not process other keys while file list is open", async () => {
      const onBack = vi.fn();
      const { stdin, lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={twoFileDifferences as any}
          commentThreads={[]}
          diffTexts={twoFileDiffTexts}
          onBack={onBack}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );

      stdin.write("f");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Files");
      });

      // q should close file list, not trigger onBack
      stdin.write("q");
      await vi.waitFor(() => {
        expect(onBack).not.toHaveBeenCalled();
      });
    });
  });

  describe("diff with swapped lines (no infinite loop)", () => {
    it("renders diff when lines are swapped (A,B -> B,A)", () => {
      const swapDiffTexts = new Map([["b1:b2", { before: "A\nB", after: "B\nA" }]]);
      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={swapDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      const output = lastFrame();
      expect(output).toBeDefined();
      expect(output).toContain("A");
      expect(output).toContain("B");
    });

    it("renders diff with nearby duplicate lines within 5-line window", () => {
      const nearbyDupDiffTexts = new Map([
        [
          "b1:b2",
          {
            before: "X\nY\nZ\nX\nW",
            after: "Y\nX\nW\nZ\nX",
          },
        ],
      ]);
      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={nearbyDupDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      const output = lastFrame();
      expect(output).toBeDefined();
      expect(output).toContain("src/auth.ts");
    });

    it("renders diff with import-like line reordering", () => {
      const importSwapDiffTexts = new Map([
        [
          "b1:b2",
          {
            before:
              'import { foo } from "foo";\nimport { bar } from "bar";\nimport { baz } from "baz";',
            after:
              'import { bar } from "bar";\nimport { baz } from "baz";\nimport { foo } from "foo";',
          },
        ],
      ]);
      const { lastFrame } = render(
        <PullRequestDetail
          pullRequest={pullRequest as any}
          differences={differences as any}
          commentThreads={[]}
          diffTexts={importSwapDiffTexts}
          onBack={vi.fn()}
          onHelp={vi.fn()}
          comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
          inlineComment={defaultInlineCommentProps}
          reply={defaultReplyProps}
          approval={defaultApprovalProps}
          merge={defaultMergeProps}
          close={defaultCloseProps}
          commitView={defaultCommitProps}
          editComment={defaultEditCommentProps}
          deleteComment={defaultDeleteCommentProps}
          reaction={defaultReactionProps}
        />,
      );
      const output = lastFrame();
      expect(output).toBeDefined();
      expect(output).toContain("foo");
      expect(output).toContain("bar");
      expect(output).toContain("baz");
    });
  });
});
