import type { Approval, Difference, Evaluation, PullRequest } from "@aws-sdk/client-codecommit";
import { Box, Text, useInput } from "ink";
import React, { useEffect, useMemo, useState } from "react";
import type {
  CommentThread,
  CommitInfo,
  ConflictSummary,
  MergeStrategy,
  ReactionSummary,
  ReactionsByComment,
} from "../services/codecommit.js";
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
  const [wasPosting, setWasPosting] = useState(false);
  const [isInlineCommenting, setIsInlineCommenting] = useState(false);
  const [inlineCommentLocation, setInlineCommentLocation] = useState<{
    filePath: string;
    filePosition: number;
    relativeFileVersion: "BEFORE" | "AFTER";
  } | null>(null);
  const [wasPostingInline, setWasPostingInline] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{
    commentId: string;
    author: string;
    content: string;
  } | null>(null);
  const [wasPostingReply, setWasPostingReply] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "revoke" | null>(null);
  const [wasApproving, setWasApproving] = useState(false);
  const [mergeStep, setMergeStep] = useState<"strategy" | "confirm" | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<MergeStrategy>("fast-forward");
  const [conflictSummary, setConflictSummary] = useState<ConflictSummary | null>(null);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [viewIndex, setViewIndex] = useState(-1); // -1 = All changes
  const [wasMerging, setWasMerging] = useState(false);
  const [wasClosingPR, setWasClosingPR] = useState(false);
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
  const [wasUpdating, setWasUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    commentId: string;
  } | null>(null);
  const [wasDeleting, setWasDeleting] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [wasReacting, setWasReacting] = useState(false);

  useEffect(() => {
    if (isPostingComment) {
      setWasPosting(true);
    } else if (wasPosting && !commentError) {
      setIsCommenting(false);
      setWasPosting(false);
    } else {
      setWasPosting(false);
    }
  }, [isPostingComment, commentError]);

  useEffect(() => {
    if (isPostingInlineComment) {
      setWasPostingInline(true);
    } else if (wasPostingInline && !inlineCommentError) {
      setIsInlineCommenting(false);
      setInlineCommentLocation(null);
      setWasPostingInline(false);
    } else {
      setWasPostingInline(false);
    }
  }, [isPostingInlineComment, inlineCommentError]);

  useEffect(() => {
    if (isPostingReply) {
      setWasPostingReply(true);
    } else if (wasPostingReply && !replyError) {
      setIsReplying(false);
      setReplyTarget(null);
      setWasPostingReply(false);
    } else {
      setWasPostingReply(false);
    }
  }, [isPostingReply, replyError]);

  useEffect(() => {
    if (isApproving) {
      setWasApproving(true);
    } else if (wasApproving && !approvalError) {
      setApprovalAction(null);
      setWasApproving(false);
    } else {
      setWasApproving(false);
    }
  }, [isApproving, approvalError]);

  useEffect(() => {
    if (isMerging) {
      setWasMerging(true);
    } else if (wasMerging && !mergeError) {
      setMergeStep(null);
      setWasMerging(false);
    } else {
      setWasMerging(false);
    }
  }, [isMerging, mergeError]);

  useEffect(() => {
    if (isClosingPR) {
      setWasClosingPR(true);
    } else if (wasClosingPR && !closePRError) {
      setIsClosing(false);
      setWasClosingPR(false);
    } else {
      setWasClosingPR(false);
    }
  }, [isClosingPR, closePRError]);

  useEffect(() => {
    if (isUpdatingComment) {
      setWasUpdating(true);
    } else if (wasUpdating && !updateCommentError) {
      setIsEditing(false);
      setEditTarget(null);
      setWasUpdating(false);
    } else {
      setWasUpdating(false);
    }
  }, [isUpdatingComment, updateCommentError]);

  useEffect(() => {
    if (isDeletingComment) {
      setWasDeleting(true);
    } else if (wasDeleting && !deleteCommentError) {
      setIsDeleting(false);
      setDeleteTarget(null);
      setWasDeleting(false);
    } else {
      setWasDeleting(false);
    }
  }, [isDeletingComment, deleteCommentError]);

  useEffect(() => {
    if (isReacting) {
      setWasReacting(true);
    } else if (wasReacting && !reactionError) {
      setShowReactionPicker(false);
      setReactionTarget(null);
      setWasReacting(false);
    } else {
      setWasReacting(false);
    }
  }, [isReacting, reactionError]);

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
      const editInfo = getEditTargetFromLine(currentLine);
      if (!editInfo) return;
      const content = findCommentContent(commentThreads, editInfo.commentId);
      setEditTarget({ commentId: editInfo.commentId, content });
      setIsEditing(true);
      return;
    }
    if (input === "d") {
      const currentLine = lines[cursorIndex];
      if (!currentLine) return;
      const delInfo = getDeleteTargetFromLine(currentLine);
      if (!delInfo) return;
      setDeleteTarget(delInfo);
      setIsDeleting(true);
      return;
    }
    if (input === "g") {
      if (viewIndex >= 0) return;
      const currentLine = lines[cursorIndex];
      if (!currentLine) return;
      const commentTypes = ["inline-comment", "comment", "inline-reply", "comment-reply"];
      if (!commentTypes.includes(currentLine.type)) return;
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

interface DisplayLine {
  type:
    | "header"
    | "separator"
    | "add"
    | "delete"
    | "context"
    | "comment-header"
    | "comment"
    | "inline-comment"
    | "inline-reply"
    | "comment-reply"
    | "fold-indicator";
  text: string;
  filePath?: string;
  beforeLineNumber?: number;
  afterLineNumber?: number;
  threadIndex?: number | undefined;
  commentId?: string | undefined;
  reactionText?: string;
}

function getEditTargetFromLine(line: DisplayLine): { commentId: string } | null {
  const commentTypes = ["inline-comment", "comment", "inline-reply", "comment-reply"];
  if (!commentTypes.includes(line.type)) return null;
  if (!line.commentId) return null;
  return { commentId: line.commentId };
}

function getDeleteTargetFromLine(line: DisplayLine): { commentId: string } | null {
  const commentTypes = ["inline-comment", "comment", "inline-reply", "comment-reply"];
  if (!commentTypes.includes(line.type)) return null;
  if (!line.commentId) return null;
  return { commentId: line.commentId };
}

function findCommentContent(commentThreads: CommentThread[], commentId: string): string {
  for (const thread of commentThreads) {
    for (const comment of thread.comments) {
      if (comment.commentId === commentId) {
        return comment.content ?? "";
      }
    }
  }
  /* v8 ignore start -- commentId always matches a thread entry */
  return "";
}
/* v8 ignore stop */

function getReplyTargetFromLine(
  line: DisplayLine,
): { commentId: string; author: string; content: string } | null {
  const commentTypes = ["inline-comment", "comment", "inline-reply", "comment-reply"];
  if (!commentTypes.includes(line.type)) return null;
  if (!line.commentId) return null;

  // Extract author from line text
  const text = line.text;
  let author = "unknown";
  let content = text;
  // For inline comments: "💬 author: content" or reply "└ author: content"
  // For general comments: "author: content" or reply "└ author: content"
  const colonIdx = text.indexOf(": ");
  if (colonIdx !== -1) {
    const prefix = text.slice(0, colonIdx);
    content = text.slice(colonIdx + 2);
    // Remove prefix symbols
    author = prefix.replace(/^[💬└\s]+/, "").trim();
  }

  return { commentId: line.commentId, author, content };
}

const FOLD_THRESHOLD = 4;

function formatReactionBadge(reactions: ReactionSummary[] | undefined): string {
  if (!reactions || reactions.length === 0) return "";
  return reactions
    .filter((r) => r.count > 0)
    .map((r) => `${r.emoji}×${r.count}`)
    .join(" ");
}

function appendThreadLines(
  lines: DisplayLine[],
  thread: CommentThread,
  threadIndex: number,
  collapsedThreads: Set<number>,
  mode: "inline" | "general",
  reactionsByComment: ReactionsByComment,
): void {
  const comments = thread.comments;
  if (comments.length === 0) return;

  const rootComment = comments.find((c) => !c.inReplyTo) ?? comments[0]!;
  const replies = comments.filter((c) => c !== rootComment);
  const isCollapsed = collapsedThreads.has(threadIndex);
  const shouldFold = comments.length >= FOLD_THRESHOLD;

  const rootAuthor = extractAuthorName(rootComment.authorArn ?? "unknown");
  const rootContent = rootComment.content ?? "";
  const rootReactionText = formatReactionBadge(reactionsByComment.get(rootComment.commentId ?? ""));

  if (mode === "inline") {
    lines.push({
      type: "inline-comment",
      text: `💬 ${rootAuthor}: ${rootContent}`,
      threadIndex,
      commentId: rootComment.commentId,
      reactionText: rootReactionText,
    });
  } else {
    lines.push({
      type: "comment",
      text: `${rootAuthor}: ${rootContent}`,
      threadIndex,
      commentId: rootComment.commentId,
      reactionText: rootReactionText,
    });
  }

  if (shouldFold && isCollapsed) {
    lines.push({
      type: "fold-indicator",
      text: `[+${replies.length} replies]`,
      threadIndex,
    });
    return;
  }

  for (const reply of replies) {
    const author = extractAuthorName(reply.authorArn ?? "unknown");
    const content = reply.content ?? "";
    const replyReactionText = formatReactionBadge(reactionsByComment.get(reply.commentId ?? ""));

    if (mode === "inline") {
      lines.push({
        type: "inline-reply",
        text: `└ ${author}: ${content}`,
        threadIndex,
        commentId: reply.commentId,
        reactionText: replyReactionText,
      });
    } else {
      lines.push({
        type: "comment-reply",
        text: `└ ${author}: ${content}`,
        threadIndex,
        commentId: reply.commentId,
        reactionText: replyReactionText,
      });
    }
  }
}

function buildDisplayLines(
  differences: Difference[],
  diffTexts: Map<string, { before: string; after: string }>,
  commentThreads: CommentThread[],
  collapsedThreads: Set<number>,
  reactionsByComment: ReactionsByComment,
): DisplayLine[] {
  const lines: DisplayLine[] = [];

  // Index inline comments by file:position:version for efficient lookup
  const inlineThreadsByKey = new Map<string, { thread: CommentThread; index: number }[]>();
  for (let i = 0; i < commentThreads.length; i++) {
    const thread = commentThreads[i]!;
    if (thread.location) {
      const key = `${thread.location.filePath}:${thread.location.filePosition}:${thread.location.relativeFileVersion}`;
      const existing = inlineThreadsByKey.get(key) ?? [];
      existing.push({ thread, index: i });
      inlineThreadsByKey.set(key, existing);
    }
  }

  for (const diff of differences) {
    const filePath = diff.afterBlob?.path ?? diff.beforeBlob?.path ?? "(unknown file)";
    lines.push({ type: "header", text: filePath });
    lines.push({ type: "separator", text: "─".repeat(50) });

    const blobKey = `${diff.beforeBlob?.blobId ?? ""}:${diff.afterBlob?.blobId ?? ""}`;
    const texts = diffTexts.get(blobKey);

    if (texts) {
      const beforeLines = texts.before.split("\n");
      const afterLines = texts.after.split("\n");
      const diffLines = computeSimpleDiff(beforeLines, afterLines);
      for (const dl of diffLines) {
        dl.filePath = filePath;
        lines.push(dl);

        const matchingEntries = findMatchingThreadEntries(inlineThreadsByKey, filePath, dl);
        for (const { thread, index: threadIdx } of matchingEntries) {
          appendThreadLines(
            lines,
            thread,
            threadIdx,
            collapsedThreads,
            "inline",
            reactionsByComment,
          );
        }
      }
    }

    lines.push({ type: "separator", text: "" });
  }

  const generalThreads = commentThreads
    .map((t, i) => ({ thread: t, index: i }))
    .filter(({ thread }) => thread.location === null);

  if (generalThreads.length > 0) {
    const totalComments = generalThreads.reduce(
      (sum, { thread }) => sum + thread.comments.length,
      0,
    );
    lines.push({ type: "separator", text: "─".repeat(50) });
    lines.push({ type: "comment-header", text: `Comments (${totalComments}):` });
    for (const { thread, index: threadIdx } of generalThreads) {
      appendThreadLines(lines, thread, threadIdx, collapsedThreads, "general", reactionsByComment);
    }
  }

  return lines;
}

function findMatchingThreadEntries(
  threadsByKey: Map<string, { thread: CommentThread; index: number }[]>,
  filePath: string,
  line: DisplayLine,
): { thread: CommentThread; index: number }[] {
  const results: { thread: CommentThread; index: number }[] = [];

  if (line.type === "delete" && line.beforeLineNumber) {
    const key = `${filePath}:${line.beforeLineNumber}:BEFORE`;
    results.push(...(threadsByKey.get(key) ?? []));
  }

  if (line.type === "add" && line.afterLineNumber) {
    const key = `${filePath}:${line.afterLineNumber}:AFTER`;
    results.push(...(threadsByKey.get(key) ?? []));
  }

  if (line.type === "context") {
    if (line.beforeLineNumber) {
      const key = `${filePath}:${line.beforeLineNumber}:BEFORE`;
      results.push(...(threadsByKey.get(key) ?? []));
    }
    if (line.afterLineNumber) {
      const key = `${filePath}:${line.afterLineNumber}:AFTER`;
      results.push(...(threadsByKey.get(key) ?? []));
    }
  }

  return results;
}

function getLocationFromLine(line: DisplayLine): {
  filePath: string;
  filePosition: number;
  relativeFileVersion: "BEFORE" | "AFTER";
} | null {
  if (!line.filePath) return null;

  if (line.type === "delete" && line.beforeLineNumber) {
    return {
      filePath: line.filePath,
      filePosition: line.beforeLineNumber,
      relativeFileVersion: "BEFORE",
    };
  }
  if ((line.type === "add" || line.type === "context") && line.afterLineNumber) {
    return {
      filePath: line.filePath,
      filePosition: line.afterLineNumber,
      relativeFileVersion: "AFTER",
    };
  }

  /* v8 ignore start -- diff lines always have line numbers */
  return null;
}
/* v8 ignore stop */

/**
 * Computes a simplified line-by-line diff between two sets of lines.
 *
 * Algorithm:
 * 1. When lines match at current positions: add as context and advance both indices
 * 2. When lines differ:
 *    a. Process deletions: consume lines from 'before' until we find a match
 *       - Stop early if a matching line is found within the next 5 lines (optimization)
 *    b. Process additions: consume lines from 'after' until we find a match
 *       - Stop early if a matching line is found within the next 5 lines (optimization)
 *
 * This is a greedy algorithm that prioritizes matching lines over minimal edit distance.
 * The 5-line lookahead prevents excessive deletions/additions when lines are just reordered.
 */
function computeSimpleDiff(beforeLines: string[], afterLines: string[]): DisplayLine[] {
  const result: DisplayLine[] = [];
  let bi = 0; // Index for beforeLines
  let ai = 0; // Index for afterLines

  // Process both arrays until all lines are consumed
  while (bi < beforeLines.length || ai < afterLines.length) {
    const beforeLine = beforeLines[bi];
    const afterLine = afterLines[ai];

    // Case 1: Lines match at current position - add as context
    if (bi < beforeLines.length && ai < afterLines.length && beforeLine === afterLine) {
      result.push({
        type: "context",
        text: ` ${beforeLine}`,
        beforeLineNumber: bi + 1,
        afterLineNumber: ai + 1,
      });
      bi++;
      ai++;
    } else {
      // Case 2: Lines differ - process deletions first, then additions

      // Process deletions: consume lines from 'before' that don't match current 'after'
      while (
        bi < beforeLines.length &&
        (ai >= afterLines.length || beforeLines[bi] !== afterLines[ai])
      ) {
        const bl = beforeLines[bi]!;
        // Optimization: look ahead to see if this line appears soon in 'after'
        const nextMatch = afterLines.indexOf(bl, ai);
        if (nextMatch !== -1 && nextMatch - ai < 5) break; // Stop if match found within 5 lines
        result.push({
          type: "delete",
          text: `-${bl}`,
          beforeLineNumber: bi + 1,
        });
        bi++;
      }

      // Process additions: consume lines from 'after' that don't match current 'before'
      while (
        ai < afterLines.length &&
        (bi >= beforeLines.length || afterLines[ai] !== beforeLines[bi])
      ) {
        const al = afterLines[ai]!;
        // Optimization: look ahead to see if this line appears soon in 'before'
        const nextMatch = beforeLines.indexOf(al, bi);
        if (nextMatch !== -1 && nextMatch - bi < 5) break; // Stop if match found within 5 lines
        result.push({
          type: "add",
          text: `+${al}`,
          afterLineNumber: ai + 1,
        });
        ai++;
      }
    }
  }

  return result;
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
