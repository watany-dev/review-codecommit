import type { Approval, Difference, Evaluation, PullRequest } from "@aws-sdk/client-codecommit";
import { Box, Text, useInput } from "ink";
import React, { useMemo, useState } from "react";
import { useAsyncDismiss } from "../hooks/useAsyncDismiss.js";
import type {
  CommentThread,
  CommitInfo,
  ConflictSummary,
  MergeStrategy,
  ReactionsByComment,
} from "../services/codecommit.js";
import {
  buildDisplayLines,
  COMMENT_LINE_TYPES,
  type DisplayLine,
  FOLD_THRESHOLD,
  findCommentContent,
  getCommentIdFromLine,
  getLocationFromLine,
  getReplyTargetFromLine,
} from "../utils/displayLines.js";
import { extractAuthorName, formatRelativeDate } from "../utils/formatDate.js";
import { CommentInput } from "./CommentInput.js";
import { ConfirmPrompt } from "./ConfirmPrompt.js";
import { MergeStrategySelector } from "./MergeStrategySelector.js";
import { ReactionPicker } from "./ReactionPicker.js";

interface Props {
  pullRequest: PullRequest;
  differences: Difference[];
  commentThreads: CommentThread[];
  diffTexts: Map<string, { before: string; after: string }>;
  onBack: () => void;
  onHelp: () => void;
  onPostComment: (content: string) => void;
  isPostingComment: boolean;
  commentError: string | null;
  onClearCommentError: () => void;
  onPostInlineComment: (
    content: string,
    location: {
      filePath: string;
      filePosition: number;
      relativeFileVersion: "BEFORE" | "AFTER";
    },
  ) => void;
  isPostingInlineComment: boolean;
  inlineCommentError: string | null;
  onClearInlineCommentError: () => void;
  onPostReply: (inReplyTo: string, content: string) => void;
  isPostingReply: boolean;
  replyError: string | null;
  onClearReplyError: () => void;
  approvals: Approval[];
  approvalEvaluation: Evaluation | null;
  onApprove: () => void;
  onRevoke: () => void;
  isApproving: boolean;
  approvalError: string | null;
  onClearApprovalError: () => void;
  onMerge: (strategy: MergeStrategy) => void;
  isMerging: boolean;
  mergeError: string | null;
  onClearMergeError: () => void;
  onCheckConflicts: (strategy: MergeStrategy) => Promise<ConflictSummary>;
  onClosePR: () => void;
  isClosingPR: boolean;
  closePRError: string | null;
  onClearClosePRError: () => void;
  commits: CommitInfo[];
  commitDifferences: Difference[];
  commitDiffTexts: Map<string, { before: string; after: string }>;
  isLoadingCommitDiff: boolean;
  onLoadCommitDiff: (commitIndex: number) => void;
  onUpdateComment: (commentId: string, content: string) => void;
  isUpdatingComment: boolean;
  updateCommentError: string | null;
  onClearUpdateCommentError: () => void;
  onDeleteComment: (commentId: string) => void;
  isDeletingComment: boolean;
  deleteCommentError: string | null;
  onClearDeleteCommentError: () => void;
  reactionsByComment: ReactionsByComment;
  onReact: (commentId: string, reactionValue: string) => void;
  isReacting: boolean;
  reactionError: string | null;
  onClearReactionError: () => void;
}

export function PullRequestDetail({
  pullRequest,
  differences,
  commentThreads,
  diffTexts,
  onBack,
  onHelp,
  onPostComment,
  isPostingComment,
  commentError,
  onClearCommentError,
  onPostInlineComment,
  isPostingInlineComment,
  inlineCommentError,
  onClearInlineCommentError,
  onPostReply,
  isPostingReply,
  replyError,
  onClearReplyError,
  approvals,
  approvalEvaluation,
  onApprove,
  onRevoke,
  isApproving,
  approvalError,
  onClearApprovalError,
  onMerge,
  isMerging,
  mergeError,
  onClearMergeError,
  onCheckConflicts,
  onClosePR,
  isClosingPR,
  closePRError,
  onClearClosePRError,
  commits,
  commitDifferences,
  commitDiffTexts,
  isLoadingCommitDiff,
  onLoadCommitDiff,
  onUpdateComment,
  isUpdatingComment,
  updateCommentError,
  onClearUpdateCommentError,
  onDeleteComment,
  isDeletingComment,
  deleteCommentError,
  onClearDeleteCommentError,
  reactionsByComment,
  onReact,
  isReacting,
  reactionError,
  onClearReactionError,
}: Props) {
  const [cursorIndex, setCursorIndex] = useState(0);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isInlineCommenting, setIsInlineCommenting] = useState(false);
  const [inlineCommentLocation, setInlineCommentLocation] = useState<{
    filePath: string;
    filePosition: number;
    relativeFileVersion: "BEFORE" | "AFTER";
  } | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{
    commentId: string;
    author: string;
    content: string;
  } | null>(null);
  const [approvalAction, setApprovalAction] = useState<"approve" | "revoke" | null>(null);
  const [mergeStep, setMergeStep] = useState<"strategy" | "confirm" | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<MergeStrategy>("fast-forward");
  const [conflictSummary, setConflictSummary] = useState<ConflictSummary | null>(null);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [viewIndex, setViewIndex] = useState(-1); // -1 = All changes
  const [collapsedThreads, setCollapsedThreads] = useState<Set<number>>(() => {
    const collapsed = new Set<number>();
    for (let i = 0; i < commentThreads.length; i++) {
      if ((commentThreads[i]?.comments.length ?? 0) >= FOLD_THRESHOLD) {
        collapsed.add(i);
      }
    }
    return collapsed;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    commentId: string;
    content: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    commentId: string;
  } | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);

  useAsyncDismiss(isPostingComment, commentError, () => {
    setIsCommenting(false);
  });
  useAsyncDismiss(isPostingInlineComment, inlineCommentError, () => {
    setIsInlineCommenting(false);
    setInlineCommentLocation(null);
  });
  useAsyncDismiss(isPostingReply, replyError, () => {
    setIsReplying(false);
    setReplyTarget(null);
  });
  useAsyncDismiss(isApproving, approvalError, () => {
    setApprovalAction(null);
  });
  useAsyncDismiss(isMerging, mergeError, () => {
    setMergeStep(null);
  });
  useAsyncDismiss(isClosingPR, closePRError, () => {
    setIsClosing(false);
  });
  useAsyncDismiss(isUpdatingComment, updateCommentError, () => {
    setIsEditing(false);
    setEditTarget(null);
  });
  useAsyncDismiss(isDeletingComment, deleteCommentError, () => {
    setIsDeleting(false);
    setDeleteTarget(null);
  });
  useAsyncDismiss(isReacting, reactionError, () => {
    setShowReactionPicker(false);
    setReactionTarget(null);
  });

  const target = pullRequest.pullRequestTargets?.[0];
  const title = pullRequest.title ?? "(no title)";
  const prId = pullRequest.pullRequestId ?? "";
  const author = extractAuthorName(pullRequest.authorArn ?? "unknown");
  const status = pullRequest.pullRequestStatus ?? "OPEN";
  const creationDate = pullRequest.creationDate ? formatRelativeDate(pullRequest.creationDate) : "";
  const destRef = target?.destinationReference?.replace("refs/heads/", "") ?? "";
  const sourceRef = target?.sourceReference?.replace("refs/heads/", "") ?? "";

  const lines = useMemo(() => {
    if (viewIndex === -1) {
      return buildDisplayLines(
        differences,
        diffTexts,
        commentThreads,
        collapsedThreads,
        reactionsByComment,
      );
    }
    return buildDisplayLines(commitDifferences, commitDiffTexts, [], new Set(), new Map());
  }, [
    viewIndex,
    differences,
    diffTexts,
    commentThreads,
    collapsedThreads,
    reactionsByComment,
    commitDifferences,
    commitDiffTexts,
  ]);

  async function handleStrategySelect(strategy: MergeStrategy) {
    setSelectedStrategy(strategy);
    setIsCheckingConflicts(true);
    setConflictSummary(null);

    try {
      const summary = await onCheckConflicts(strategy);
      setConflictSummary(summary);
      setIsCheckingConflicts(false);

      if (summary.mergeable) {
        setMergeStep("confirm");
      }
    } catch {
      setIsCheckingConflicts(false);
      setMergeStep(null);
    }
  }

  useInput((input, key) => {
    if (
      isCommenting ||
      isInlineCommenting ||
      isReplying ||
      isEditing ||
      isDeleting ||
      approvalAction ||
      mergeStep ||
      isClosing ||
      showReactionPicker
    )
      return;

    if (key.tab && commits.length > 0) {
      const newIndex = key.shift
        ? viewIndex - 1 < -1
          ? commits.length - 1
          : viewIndex - 1
        : viewIndex + 1 > commits.length - 1
          ? -1
          : viewIndex + 1;

      setViewIndex(newIndex);
      setCursorIndex(0);
      if (newIndex >= 0) {
        onLoadCommitDiff(newIndex);
      }
      return;
    }

    if (input === "q" || key.escape) {
      onBack();
      return;
    }
    if (input === "?") {
      onHelp();
      return;
    }
    if (input === "j" || key.downArrow) {
      setCursorIndex((prev) => Math.min(prev + 1, lines.length - 1));
      return;
    }
    if (input === "k" || key.upArrow) {
      setCursorIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (input === "c") {
      if (viewIndex >= 0) return;
      setIsCommenting(true);
      return;
    }
    if (input === "C") {
      if (viewIndex >= 0) return;
      const currentLine = lines[cursorIndex];
      if (!currentLine) return;
      const location = getLocationFromLine(currentLine);
      if (!location) return;
      setInlineCommentLocation(location);
      setIsInlineCommenting(true);
      return;
    }
    if (input === "o") {
      const currentLine = lines[cursorIndex];
      if (!currentLine) return;
      if (currentLine.threadIndex === undefined) return;
      setCollapsedThreads((prev) => {
        const next = new Set(prev);
        if (next.has(currentLine.threadIndex!)) {
          next.delete(currentLine.threadIndex!);
        } else {
          next.add(currentLine.threadIndex!);
        }
        return next;
      });
      return;
    }
    if (input === "R") {
      const currentLine = lines[cursorIndex];
      if (!currentLine) return;
      const target = getReplyTargetFromLine(currentLine);
      if (!target) return;
      setReplyTarget(target);
      setIsReplying(true);
      return;
    }
    if (input === "a") {
      setApprovalAction("approve");
      return;
    }
    if (input === "r") {
      setApprovalAction("revoke");
      return;
    }
    if (input === "m") {
      setMergeStep("strategy");
      return;
    }
    if (input === "x") {
      setIsClosing(true);
      return;
    }
    if (input === "e") {
      const currentLine = lines[cursorIndex];
      if (!currentLine) return;
      const editInfo = getCommentIdFromLine(currentLine);
      if (!editInfo) return;
      const content = findCommentContent(commentThreads, editInfo.commentId);
      setEditTarget({ commentId: editInfo.commentId, content });
      setIsEditing(true);
      return;
    }
    if (input === "d") {
      const currentLine = lines[cursorIndex];
      if (!currentLine) return;
      const delInfo = getCommentIdFromLine(currentLine);
      if (!delInfo) return;
      setDeleteTarget(delInfo);
      setIsDeleting(true);
      return;
    }
    if (input === "g") {
      if (viewIndex >= 0) return;
      const currentLine = lines[cursorIndex];
      if (!currentLine) return;
      if (!(COMMENT_LINE_TYPES as readonly string[]).includes(currentLine.type)) return;
      if (!currentLine.commentId) return;
      setReactionTarget(currentLine.commentId);
      setShowReactionPicker(true);
      return;
    }
  });

  const visibleLineCount =
    isCommenting ||
    isInlineCommenting ||
    isReplying ||
    isEditing ||
    isDeleting ||
    approvalAction ||
    mergeStep ||
    isClosing ||
    showReactionPicker
      ? 20
      : 30;
  const scrollOffset = useMemo(() => {
    const halfVisible = Math.floor(visibleLineCount / 2);
    const maxOffset = Math.max(0, lines.length - visibleLineCount);
    const idealOffset = cursorIndex - halfVisible;
    return Math.max(0, Math.min(idealOffset, maxOffset));
  }, [cursorIndex, lines.length, visibleLineCount]);
  const visibleLines = lines.slice(scrollOffset, scrollOffset + visibleLineCount);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={0}>
        <Text bold color="cyan">
          PR #{prId}: {title}
        </Text>
      </Box>
      <Box>
        <Text>
          Author: {author} Status: {status} {creationDate}
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>
          {destRef} ← {sourceRef}
        </Text>
      </Box>
      <Box>
        <Text>
          Approvals:{" "}
          {approvals.filter((a) => a.approvalState === "APPROVE").length > 0
            ? `${approvals
                .filter((a) => a.approvalState === "APPROVE")
                .map((a) => extractAuthorName(a.userArn ?? ""))
                .join(", ")} ✓`
            : "(none)"}
        </Text>
      </Box>
      {approvalEvaluation &&
        (approvalEvaluation.approvalRulesSatisfied?.length ?? 0) +
          (approvalEvaluation.approvalRulesNotSatisfied?.length ?? 0) >
          0 && (
          <Box marginBottom={1}>
            <Text>
              Rules: {approvalEvaluation.approved ? "✓" : "✗"}{" "}
              {approvalEvaluation.approved ? "Approved" : "Not approved"} (
              {approvalEvaluation.approvalRulesSatisfied?.length ?? 0}/
              {(approvalEvaluation.approvalRulesSatisfied?.length ?? 0) +
                (approvalEvaluation.approvalRulesNotSatisfied?.length ?? 0)}{" "}
              rules satisfied)
            </Text>
          </Box>
        )}
      {commits.length > 0 && (
        <Box flexDirection="column" marginBottom={0}>
          <Box>
            {viewIndex === -1 ? (
              <>
                <Text bold color="cyan">
                  [All changes]
                </Text>
                <Text> Commits ({commits.length})</Text>
              </>
            ) : (
              <>
                <Text>All changes </Text>
                <Text bold color="cyan">
                  [Commit {viewIndex + 1}/{commits.length}]
                </Text>
                <Text> {commits[viewIndex]!.shortId}</Text>
              </>
            )}
          </Box>
          {viewIndex >= 0 && (
            <Text dimColor>
              {commits[viewIndex]!.message} {commits[viewIndex]!.authorName}{" "}
              {formatRelativeDate(commits[viewIndex]!.authorDate)}
            </Text>
          )}
        </Box>
      )}
      {isLoadingCommitDiff && viewIndex >= 0 && (
        <Box>
          <Text color="cyan">Loading commit diff...</Text>
        </Box>
      )}
      <Box flexDirection="column">
        {visibleLines.map((line, index) => {
          const globalIndex = scrollOffset + index;
          const isCursor = globalIndex === cursorIndex;
          return (
            <Box key={globalIndex}>
              <Text>{isCursor ? "> " : "  "}</Text>
              {renderDiffLine(line, isCursor)}
            </Box>
          );
        })}
      </Box>
      {isCommenting && (
        <CommentInput
          onSubmit={onPostComment}
          onCancel={() => setIsCommenting(false)}
          isPosting={isPostingComment}
          error={commentError}
          onClearError={onClearCommentError}
        />
      )}
      {isInlineCommenting && inlineCommentLocation && (
        <Box flexDirection="column">
          <Text dimColor>
            Inline comment on {inlineCommentLocation.filePath}:{inlineCommentLocation.filePosition}
          </Text>
          <CommentInput
            onSubmit={(content) => onPostInlineComment(content, inlineCommentLocation)}
            onCancel={() => {
              setIsInlineCommenting(false);
              setInlineCommentLocation(null);
            }}
            isPosting={isPostingInlineComment}
            error={inlineCommentError}
            onClearError={onClearInlineCommentError}
          />
        </Box>
      )}
      {isReplying && replyTarget && (
        <Box flexDirection="column">
          <Text dimColor>
            Replying to {replyTarget.author}: {replyTarget.content.slice(0, 50)}
            {replyTarget.content.length > 50 ? "..." : ""}
          </Text>
          <CommentInput
            onSubmit={(content) => onPostReply(replyTarget.commentId, content)}
            onCancel={() => {
              setIsReplying(false);
              setReplyTarget(null);
              onClearReplyError();
            }}
            isPosting={isPostingReply}
            error={replyError}
            onClearError={onClearReplyError}
          />
        </Box>
      )}
      {approvalAction && (
        <ConfirmPrompt
          message={
            approvalAction === "approve" ? "Approve this pull request?" : "Revoke your approval?"
          }
          onConfirm={approvalAction === "approve" ? onApprove : onRevoke}
          onCancel={() => {
            setApprovalAction(null);
            onClearApprovalError();
          }}
          isProcessing={isApproving}
          processingMessage={approvalAction === "approve" ? "Approving..." : "Revoking approval..."}
          error={approvalError}
          onClearError={() => {
            onClearApprovalError();
            setApprovalAction(null);
          }}
        />
      )}
      {mergeStep === "strategy" && !isCheckingConflicts && !conflictSummary && (
        <MergeStrategySelector
          sourceRef={sourceRef}
          destRef={destRef}
          onSelect={handleStrategySelect}
          onCancel={() => {
            setMergeStep(null);
            setConflictSummary(null);
          }}
        />
      )}
      {isCheckingConflicts && (
        <Box flexDirection="column">
          <Text color="cyan">Checking for conflicts...</Text>
        </Box>
      )}
      {conflictSummary && !conflictSummary.mergeable && (
        <ConflictDisplay
          conflictSummary={conflictSummary}
          onDismiss={() => {
            setConflictSummary(null);
            setMergeStep(null);
          }}
        />
      )}
      {mergeStep === "confirm" && (
        <ConfirmPrompt
          message={`Merge ${sourceRef} into ${destRef} using ${formatStrategyName(selectedStrategy)}?`}
          onConfirm={() => onMerge(selectedStrategy)}
          onCancel={() => {
            setMergeStep(null);
            setConflictSummary(null);
            onClearMergeError();
          }}
          isProcessing={isMerging}
          processingMessage="Merging..."
          error={mergeError}
          onClearError={() => {
            onClearMergeError();
            setMergeStep(null);
          }}
        />
      )}
      {isClosing && (
        <ConfirmPrompt
          message="Close this pull request without merging?"
          onConfirm={onClosePR}
          onCancel={() => {
            setIsClosing(false);
            onClearClosePRError();
          }}
          isProcessing={isClosingPR}
          processingMessage="Closing..."
          error={closePRError}
          onClearError={() => {
            onClearClosePRError();
            setIsClosing(false);
          }}
        />
      )}
      {isEditing && editTarget && (
        <Box flexDirection="column">
          <CommentInput
            onSubmit={(content) => onUpdateComment(editTarget.commentId, content)}
            onCancel={() => {
              setIsEditing(false);
              setEditTarget(null);
              onClearUpdateCommentError();
            }}
            isPosting={isUpdatingComment}
            error={updateCommentError}
            onClearError={onClearUpdateCommentError}
            initialValue={editTarget.content}
            label="Edit Comment:"
            postingMessage="Updating comment..."
            errorPrefix="Failed to update comment:"
          />
        </Box>
      )}
      {isDeleting && deleteTarget && (
        <ConfirmPrompt
          message="Delete this comment?"
          onConfirm={() => onDeleteComment(deleteTarget.commentId)}
          onCancel={() => {
            setIsDeleting(false);
            setDeleteTarget(null);
            onClearDeleteCommentError();
          }}
          isProcessing={isDeletingComment}
          processingMessage="Deleting comment..."
          error={deleteCommentError}
          onClearError={() => {
            onClearDeleteCommentError();
            setIsDeleting(false);
            setDeleteTarget(null);
          }}
        />
      )}
      {showReactionPicker && reactionTarget && (
        <ReactionPicker
          onSelect={(shortCode) => onReact(reactionTarget, shortCode)}
          onCancel={() => {
            setShowReactionPicker(false);
            setReactionTarget(null);
            onClearReactionError();
          }}
          isProcessing={isReacting}
          error={reactionError}
          onClearError={() => {
            onClearReactionError();
            setShowReactionPicker(false);
            setReactionTarget(null);
          }}
          currentReactions={reactionsByComment.get(reactionTarget) ?? []}
        />
      )}
      <Box marginTop={1}>
        <Text dimColor>
          {isCommenting ||
          isInlineCommenting ||
          isReplying ||
          isEditing ||
          isDeleting ||
          approvalAction ||
          mergeStep ||
          isClosing ||
          showReactionPicker
            ? ""
            : viewIndex === -1 && commits.length > 0
              ? "Tab view ↑↓ c comment C inline R reply o fold e edit d del g react a/r approve m merge x close q ? help"
              : viewIndex >= 0
                ? "Tab next S-Tab prev ↑↓ e edit d del a/r approve m merge x close q ? help"
                : "↑↓ c comment C inline R reply o fold e edit d del g react a/r approve m merge x close q ? help"}
        </Text>
      </Box>
    </Box>
  );
}

function renderDiffLine(line: DisplayLine, isCursor = false): React.ReactNode {
  const bold = isCursor;
  switch (line.type) {
    case "header":
      return (
        <Text bold color="yellow">
          {line.text}
        </Text>
      );
    case "separator":
      return <Text dimColor>{line.text}</Text>;
    case "add":
      return (
        <Text color="green" bold={bold}>
          {line.text}
        </Text>
      );
    case "delete":
      return (
        <Text color="red" bold={bold}>
          {line.text}
        </Text>
      );
    case "context":
      return <Text bold={bold}>{line.text}</Text>;
    case "comment-header":
      return <Text bold>{line.text}</Text>;
    case "comment":
      return (
        <Text>
          {" "}
          {line.text}
          {line.reactionText ? <Text dimColor> {line.reactionText}</Text> : null}
        </Text>
      );
    case "inline-comment":
      return (
        <Text color="magenta">
          {" "}
          {line.text}
          {line.reactionText ? <Text dimColor> {line.reactionText}</Text> : null}
        </Text>
      );
    case "inline-reply":
      return (
        <Text color="magenta">
          {"   "}
          {line.text}
          {line.reactionText ? <Text dimColor> {line.reactionText}</Text> : null}
        </Text>
      );
    case "comment-reply":
      return (
        <Text>
          {"   "}
          {line.text}
          {line.reactionText ? <Text dimColor> {line.reactionText}</Text> : null}
        </Text>
      );
    case "fold-indicator":
      return (
        <Text dimColor>
          {"   "}
          {line.text}
        </Text>
      );
  }
}

function ConflictDisplay({
  conflictSummary,
  onDismiss,
}: {
  conflictSummary: ConflictSummary;
  onDismiss: () => void;
}) {
  useInput(() => {
    onDismiss();
  });

  return (
    <Box flexDirection="column">
      <Text color="red">
        ✗ Cannot merge: {conflictSummary.conflictCount} conflicting file
        {conflictSummary.conflictCount !== 1 ? "s" : ""}
      </Text>
      <Text> </Text>
      {conflictSummary.conflictFiles.map((file) => (
        <Text key={file}> {file}</Text>
      ))}
      <Text> </Text>
      <Text>Resolve conflicts before merging.</Text>
      <Text dimColor>Press any key to return</Text>
    </Box>
  );
}

function formatStrategyName(strategy: MergeStrategy): string {
  switch (strategy) {
    case "fast-forward":
      return "fast-forward";
    case "squash":
      return "squash";
    case "three-way":
      return "three-way merge";
  }
}
