import type { Approval, Difference, Evaluation, PullRequest } from "@aws-sdk/client-codecommit";
import { Box, Text, useInput } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AsyncActionState } from "../hooks/useAsyncAction.js";
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
  countLines,
  DIFF_CHUNK_SIZE,
  FOLD_THRESHOLD,
  getThreadKey,
  LARGE_DIFF_THRESHOLD,
} from "../utils/displayLines.js";
import { extractAuthorName, formatRelativeDate } from "../utils/formatDate.js";
import type { DisplayLine } from "../utils/formatDiff.js";
import { CommentInput } from "./CommentInput.js";
import { ConfirmPrompt } from "./ConfirmPrompt.js";
import { ConflictDisplay } from "./ConflictDisplay.js";
import { DiffRow } from "./DiffLine.js";
import { MergeStrategySelector } from "./MergeStrategySelector.js";
import { ReactionPicker } from "./ReactionPicker.js";

type InlineLocation = {
  filePath: string;
  filePosition: number;
  relativeFileVersion: "BEFORE" | "AFTER";
};

const EMPTY_STATUS_MAP = new Map<string, "loading" | "loaded" | "error">();

interface CommitViewProps {
  commits: CommitInfo[];
  differences: Difference[];
  diffTexts: Map<string, { before: string; after: string }>;
  isLoading: boolean;
  onLoad: (commitIndex: number) => void;
  commitsAvailable: boolean;
}

interface Props {
  pullRequest: PullRequest;
  differences: Difference[];
  commentThreads: CommentThread[];
  diffTexts: Map<string, { before: string; after: string }>;
  diffTextStatus?: Map<string, "loading" | "loaded" | "error">;
  onBack: () => void;
  onHelp: () => void;
  onShowActivity: () => void;
  comment: AsyncActionState<[content: string]>;
  inlineComment: AsyncActionState<[content: string, location: InlineLocation]>;
  reply: AsyncActionState<[inReplyTo: string, content: string]>;
  approval: AsyncActionState<["APPROVE" | "REVOKE"]> & {
    approvals: Approval[];
    evaluation: Evaluation | null;
  };
  merge: AsyncActionState<[strategy: MergeStrategy]> & {
    onCheckConflicts: (strategy: MergeStrategy) => Promise<ConflictSummary>;
  };
  close: AsyncActionState<[]>;
  commitView: CommitViewProps;
  editComment: AsyncActionState<[commentId: string, content: string]>;
  deleteComment: AsyncActionState<[commentId: string]>;
  reaction: AsyncActionState<[commentId: string, reactionValue: string]> & {
    byComment: ReactionsByComment;
  };
}

export function PullRequestDetail({
  pullRequest,
  differences,
  commentThreads,
  diffTexts,
  diffTextStatus = EMPTY_STATUS_MAP,
  onBack,
  onHelp,
  onShowActivity,
  comment,
  inlineComment,
  reply,
  approval,
  merge,
  close,
  commitView: {
    commits,
    differences: commitDifferences,
    diffTexts: commitDiffTexts,
    isLoading: isLoadingCommitDiff,
    onLoad: onLoadCommitDiff,
    commitsAvailable,
  },
  editComment,
  deleteComment,
  reaction,
}: Props) {
  function buildCollapsedThreadState(
    threads: CommentThread[],
    previous?: Map<string, boolean>,
  ): Map<string, boolean> {
    const next = new Map<string, boolean>();
    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i]!;
      const key = getThreadKey(thread, i);
      next.set(key, previous?.get(key) ?? thread.comments.length >= FOLD_THRESHOLD);
    }
    return next;
  }

  const [cursorIndex, setCursorIndex] = useState(0);
  const [isCommenting, setIsCommenting] = useState(false);
  const [inlineCommentLocation, setInlineCommentLocation] = useState<{
    filePath: string;
    filePosition: number;
    relativeFileVersion: "BEFORE" | "AFTER";
  } | null>(null);
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
  const [collapsedThreads, setCollapsedThreads] = useState<Map<string, boolean>>(() =>
    buildCollapsedThreadState(commentThreads),
  );
  const [editTarget, setEditTarget] = useState<{
    commentId: string;
    content: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    commentId: string;
  } | null>(null);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [diffLineLimits, setDiffLineLimits] = useState<Map<string, number>>(new Map());
  const [showFileList, setShowFileList] = useState(false);
  const [fileListCursor, setFileListCursor] = useState(0);
  const [pendingBracket, setPendingBracket] = useState<"[" | "]" | null>(null);
  const diffCacheRef = useRef<Map<string, DisplayLine[]>>(new Map());

  useEffect(() => {
    setDiffLineLimits(new Map());
    diffCacheRef.current = new Map();
  }, [differences]);

  useEffect(() => {
    setCollapsedThreads((prev) => buildCollapsedThreadState(commentThreads, prev));
  }, [commentThreads]);

  useAsyncDismiss(comment.isProcessing, comment.error, () => setIsCommenting(false));
  useAsyncDismiss(inlineComment.isProcessing, inlineComment.error, () =>
    setInlineCommentLocation(null),
  );
  useAsyncDismiss(reply.isProcessing, reply.error, () => setReplyTarget(null));
  useAsyncDismiss(approval.isProcessing, approval.error, () => setApprovalAction(null));
  /* v8 ignore next -- merge success auto-close tested in app.test.tsx */
  useAsyncDismiss(merge.isProcessing, merge.error, () => setMergeStep(null));
  /* v8 ignore next -- close success auto-close tested in app.test.tsx */
  useAsyncDismiss(close.isProcessing, close.error, () => setIsClosing(false));
  useAsyncDismiss(editComment.isProcessing, editComment.error, () => setEditTarget(null));
  useAsyncDismiss(deleteComment.isProcessing, deleteComment.error, () => setDeleteTarget(null));
  useAsyncDismiss(reaction.isProcessing, reaction.error, () => setReactionTarget(null));

  const target = pullRequest.pullRequestTargets?.[0];
  const title = pullRequest.title ?? "(no title)";
  const prId = pullRequest.pullRequestId ?? "";
  const author = extractAuthorName(pullRequest.authorArn ?? "unknown");
  const status = pullRequest.pullRequestStatus ?? "OPEN";
  const creationDate = pullRequest.creationDate ? formatRelativeDate(pullRequest.creationDate) : "";
  const destRef = target?.destinationReference?.replace("refs/heads/", "") ?? "";
  const sourceRef = target?.sourceReference?.replace("refs/heads/", "") ?? "";

  const approvedUsers = useMemo(
    () => approval.approvals.filter((a) => a.approvalState === "APPROVE"),
    [approval.approvals],
  );

  const lines = useMemo(() => {
    if (viewIndex === -1) {
      return buildDisplayLines(
        differences,
        diffTexts,
        diffTextStatus,
        diffLineLimits,
        commentThreads,
        collapsedThreads,
        reaction.byComment,
        diffCacheRef.current,
      );
    }
    return buildDisplayLines(
      commitDifferences,
      commitDiffTexts,
      new Map(),
      new Map(),
      [],
      new Map(),
      new Map(),
    );
  }, [
    viewIndex,
    differences,
    diffTexts,
    diffTextStatus,
    diffLineLimits,
    commentThreads,
    collapsedThreads,
    reaction.byComment,
    commitDifferences,
    commitDiffTexts,
  ]);

  // Keep 0 <= cursorIndex < max(lines.length, 1) when lines shrink (thread fold,
  // comment deletion) or are replaced (view switch), so a row is always highlighted.
  useEffect(() => {
    setCursorIndex((prev) => Math.max(0, Math.min(prev, lines.length - 1)));
  }, [lines.length]);

  const hasTruncation = useMemo(() => lines.some((line) => line.type === "truncation"), [lines]);

  const headerIndices = useMemo(
    () =>
      lines.reduce<number[]>((acc, line, i) => {
        if (line.type === "header") acc.push(i);
        return acc;
      }, []),
    [lines],
  );

  const fileNames = useMemo(() => headerIndices.map((i) => lines[i]!.text), [headerIndices, lines]);

  const filePosition = useMemo(() => {
    if (headerIndices.length === 0) return { current: 0, total: 0 };
    let current = 1;
    for (let i = headerIndices.length - 1; i >= 0; i--) {
      if (cursorIndex >= headerIndices[i]!) {
        current = i + 1;
        break;
      }
    }
    return { current, total: headerIndices.length };
  }, [cursorIndex, headerIndices]);

  async function handleStrategySelect(strategy: MergeStrategy) {
    setSelectedStrategy(strategy);
    setIsCheckingConflicts(true);
    setConflictSummary(null);

    try {
      const summary = await merge.onCheckConflicts(strategy);
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

  const visibleLineCount =
    isCommenting ||
    inlineCommentLocation ||
    replyTarget ||
    editTarget ||
    deleteTarget ||
    approvalAction ||
    mergeStep ||
    isClosing ||
    reactionTarget ||
    showFileList
      ? 20
      : 30;

  useInput((input, key) => {
    // File list mode: handle its own keys before the modal guard
    if (showFileList) {
      if (input === "j" || key.downArrow) {
        setFileListCursor((prev) => Math.min(prev + 1, fileNames.length - 1));
      } else if (input === "k" || key.upArrow) {
        setFileListCursor((prev) => Math.max(prev - 1, 0));
      } else if (key.return) {
        const targetIndex = headerIndices[fileListCursor];
        if (targetIndex !== undefined) setCursorIndex(targetIndex);
        setShowFileList(false);
      } else if (key.escape || input === "f" || input === "q") {
        setShowFileList(false);
      }
      return;
    }

    if (
      isCommenting ||
      inlineCommentLocation ||
      replyTarget ||
      editTarget ||
      deleteTarget ||
      approvalAction ||
      mergeStep ||
      isClosing ||
      reactionTarget
    )
      return;

    // === 2-key sequence: ]c / [c for change navigation ===
    if (pendingBracket && input === "c") {
      const isNext = pendingBracket === "]";
      setPendingBracket(null);
      if (isNext) {
        const idx = lines.findIndex(
          (l, i) => i > cursorIndex && (l.type === "add" || l.type === "delete"),
        );
        if (idx !== -1) setCursorIndex(idx);
      } else {
        for (let i = cursorIndex - 1; i >= 0; i--) {
          if (lines[i]!.type === "add" || lines[i]!.type === "delete") {
            setCursorIndex(i);
            break;
          }
        }
      }
      return;
    }
    if (pendingBracket) {
      setPendingBracket(null);
    }

    if (key.tab && (commits.length > 0 || commitsAvailable)) {
      if (commits.length === 0) {
        // Lazy load: trigger first commit load
        setViewIndex(0);
        setCursorIndex(0);
        onLoadCommitDiff(0);
        return;
      }

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
      setCursorIndex((prev) => Math.max(0, Math.min(prev + 1, lines.length - 1)));
      return;
    }
    if (input === "k" || key.upArrow) {
      setCursorIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (input === "t") {
      if (viewIndex >= 0) return;
      const currentLine = lines[cursorIndex];
      const diffKey = currentLine?.diffKey;
      if (!diffKey) return;
      const texts = diffTexts.get(diffKey);
      /* v8 ignore next -- diffKey originates from diffTexts entries */
      if (!texts) return;
      const totalLines = countLines(texts.before) + countLines(texts.after);
      if (totalLines <= LARGE_DIFF_THRESHOLD) return;
      const currentLimit = diffLineLimits.get(diffKey) ?? DIFF_CHUNK_SIZE;
      /* v8 ignore next -- requires many t-presses to reach full expansion */
      if (currentLimit >= totalLines) return;
      const nextLimit = Math.min(currentLimit + DIFF_CHUNK_SIZE, totalLines);
      setDiffLineLimits((prev) => {
        const next = new Map(prev);
        next.set(diffKey, nextLimit);
        return next;
      });
      return;
    }
    // Ctrl+d: half page down
    if (key.ctrl && input === "d") {
      if (lines.length === 0) return;
      const halfPage = Math.floor(visibleLineCount / 2);
      setCursorIndex((prev) => Math.min(prev + halfPage, lines.length - 1));
      return;
    }
    // Ctrl+u: half page up
    if (key.ctrl && input === "u") {
      if (lines.length === 0) return;
      const halfPage = Math.floor(visibleLineCount / 2);
      setCursorIndex((prev) => Math.max(prev - halfPage, 0));
      return;
    }
    // G: jump to last line
    if (input === "G") {
      if (lines.length === 0) return;
      setCursorIndex(lines.length - 1);
      return;
    }
    // n: next file header
    if (input === "n") {
      const idx = findNextHeaderIndex(headerIndices, cursorIndex);
      if (idx !== -1) setCursorIndex(idx);
      return;
    }
    // N: previous file header
    if (input === "N") {
      const idx = findPrevHeaderIndex(headerIndices, cursorIndex);
      if (idx !== -1) setCursorIndex(idx);
      return;
    }
    // f: toggle file list
    if (input === "f") {
      if (viewIndex >= 0) return;
      setShowFileList(true);
      setFileListCursor(0);
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
      return;
    }
    if (input === "o") {
      const currentLine = lines[cursorIndex];
      if (!currentLine) return;
      if (currentLine.threadIndex === undefined) return;
      const thread = commentThreads[currentLine.threadIndex];
      if (!thread) return;
      const threadKey = getThreadKey(thread, currentLine.threadIndex);
      const defaultCollapsed = thread.comments.length >= FOLD_THRESHOLD;
      setCollapsedThreads((prev) => {
        const next = new Map(prev);
        next.set(threadKey, !(prev.get(threadKey) ?? defaultCollapsed));
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
    if (input === "A") {
      onShowActivity();
      return;
    }
    if (input === "e") {
      const currentLine = lines[cursorIndex];
      if (!currentLine) return;
      const editInfo = getCommentIdFromLine(currentLine);
      if (!editInfo) return;
      const content = findCommentContent(commentThreads, editInfo.commentId);
      setEditTarget({ commentId: editInfo.commentId, content });
      return;
    }
    if (input === "d") {
      const currentLine = lines[cursorIndex];
      if (!currentLine) return;
      const delInfo = getCommentIdFromLine(currentLine);
      if (!delInfo) return;
      setDeleteTarget(delInfo);
      return;
    }
    if (input === "g") {
      if (viewIndex >= 0) return;
      const currentLine = lines[cursorIndex];
      if (!currentLine) return;
      if (!COMMENT_LINE_TYPES.has(currentLine.type)) return;
      if (!currentLine.commentId) return;
      setReactionTarget(currentLine.commentId);
      return;
    }
    if (input === "]") {
      setPendingBracket("]");
      return;
    }
    if (input === "[") {
      setPendingBracket("[");
      return;
    }
  });

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
        {filePosition.total > 0 && (
          <Text dimColor>
            {" "}
            File {filePosition.current}/{filePosition.total}
          </Text>
        )}
      </Box>
      <Box>
        <Text>
          Approvals:{" "}
          {approvedUsers.length > 0
            ? `${approvedUsers.map((a) => extractAuthorName(a.userArn ?? "")).join(", ")} ✓`
            : "(none)"}
        </Text>
      </Box>
      {approval.evaluation &&
        (approval.evaluation.approvalRulesSatisfied?.length ?? 0) +
          (approval.evaluation.approvalRulesNotSatisfied?.length ?? 0) >
          0 && (
          <Box marginBottom={1}>
            <Text>
              Rules: {approval.evaluation.approved ? "✓" : "✗"}{" "}
              {approval.evaluation.approved ? "Approved" : "Not approved"} (
              {approval.evaluation.approvalRulesSatisfied?.length ?? 0}/
              {(approval.evaluation.approvalRulesSatisfied?.length ?? 0) +
                (approval.evaluation.approvalRulesNotSatisfied?.length ?? 0)}{" "}
              rules satisfied)
            </Text>
          </Box>
        )}
      {(commits.length > 0 || commitsAvailable) && (
        <Box flexDirection="column" marginBottom={0}>
          <Box>
            {viewIndex === -1 ? (
              <>
                <Text bold color="cyan">
                  [All changes]
                </Text>
                {commits.length > 0 && <Text> Commits ({commits.length})</Text>}
              </>
            ) : commits[viewIndex] ? (
              <>
                <Text>All changes </Text>
                <Text bold color="cyan">
                  [Commit {viewIndex + 1}/{commits.length}]
                </Text>
                <Text> {commits[viewIndex]!.shortId}</Text>
              </>
            ) : (
              <>
                <Text>All changes </Text>
                <Text color="cyan">Loading commits...</Text>
              </>
            )}
          </Box>
          {viewIndex >= 0 && commits[viewIndex] && (
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
          return <DiffRow key={globalIndex} line={line} isCursor={globalIndex === cursorIndex} />;
        })}
      </Box>
      {isCommenting && (
        <CommentInput
          onSubmit={comment.execute}
          onCancel={() => setIsCommenting(false)}
          isPosting={comment.isProcessing}
          error={comment.error}
          onClearError={comment.clearError}
        />
      )}
      {inlineCommentLocation && (
        <Box flexDirection="column">
          <Text dimColor>
            Inline comment on {inlineCommentLocation.filePath}:{inlineCommentLocation.filePosition}
          </Text>
          <CommentInput
            onSubmit={(content) => inlineComment.execute(content, inlineCommentLocation)}
            onCancel={() => setInlineCommentLocation(null)}
            isPosting={inlineComment.isProcessing}
            error={inlineComment.error}
            onClearError={inlineComment.clearError}
          />
        </Box>
      )}
      {replyTarget && (
        <Box flexDirection="column">
          <Text dimColor>
            Replying to {replyTarget.author}: {replyTarget.content.slice(0, 50)}
            {replyTarget.content.length > 50 ? "..." : ""}
          </Text>
          <CommentInput
            onSubmit={(content) => reply.execute(replyTarget.commentId, content)}
            onCancel={() => {
              setReplyTarget(null);
              reply.clearError();
            }}
            isPosting={reply.isProcessing}
            error={reply.error}
            onClearError={reply.clearError}
          />
        </Box>
      )}
      {approvalAction && (
        <ConfirmPrompt
          message={
            approvalAction === "approve" ? "Approve this pull request?" : "Revoke your approval?"
          }
          onConfirm={
            approvalAction === "approve"
              ? () => approval.execute("APPROVE")
              : () => approval.execute("REVOKE")
          }
          onCancel={() => {
            setApprovalAction(null);
            approval.clearError();
          }}
          isProcessing={approval.isProcessing}
          processingMessage={approvalAction === "approve" ? "Approving..." : "Revoking approval..."}
          error={approval.error}
          onClearError={() => {
            approval.clearError();
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
          onConfirm={() => merge.execute(selectedStrategy)}
          onCancel={() => {
            setMergeStep(null);
            setConflictSummary(null);
            merge.clearError();
          }}
          isProcessing={merge.isProcessing}
          processingMessage="Merging..."
          error={merge.error}
          onClearError={() => {
            merge.clearError();
            setMergeStep(null);
          }}
        />
      )}
      {isClosing && (
        <ConfirmPrompt
          message="Close this pull request without merging?"
          onConfirm={() => close.execute()}
          onCancel={() => {
            setIsClosing(false);
            close.clearError();
          }}
          isProcessing={close.isProcessing}
          processingMessage="Closing..."
          error={close.error}
          onClearError={() => {
            close.clearError();
            setIsClosing(false);
          }}
        />
      )}
      {editTarget && (
        <Box flexDirection="column">
          <CommentInput
            onSubmit={(content) => editComment.execute(editTarget.commentId, content)}
            onCancel={() => {
              setEditTarget(null);
              editComment.clearError();
            }}
            isPosting={editComment.isProcessing}
            error={editComment.error}
            onClearError={editComment.clearError}
            initialValue={editTarget.content}
            label="Edit Comment:"
            postingMessage="Updating comment..."
            errorPrefix="Failed to update comment:"
          />
        </Box>
      )}
      {deleteTarget && (
        <ConfirmPrompt
          message="Delete this comment?"
          onConfirm={() => deleteComment.execute(deleteTarget.commentId)}
          onCancel={() => {
            setDeleteTarget(null);
            deleteComment.clearError();
          }}
          isProcessing={deleteComment.isProcessing}
          processingMessage="Deleting comment..."
          error={deleteComment.error}
          onClearError={() => {
            deleteComment.clearError();
            setDeleteTarget(null);
          }}
        />
      )}
      {reactionTarget && (
        <ReactionPicker
          onSelect={(shortCode) => reaction.execute(reactionTarget, shortCode)}
          onCancel={() => {
            setReactionTarget(null);
            reaction.clearError();
          }}
          isProcessing={reaction.isProcessing}
          error={reaction.error}
          onClearError={() => {
            reaction.clearError();
            setReactionTarget(null);
          }}
          currentReactions={reaction.byComment.get(reactionTarget) ?? []}
        />
      )}
      {showFileList && (
        <Box flexDirection="column">
          <Text bold>Files ({fileNames.length}):</Text>
          {fileNames.map((name, i) => (
            <Text key={name}>
              {i === fileListCursor ? "> " : "  "}
              {name}
            </Text>
          ))}
          <Text dimColor>j/k move Enter select Esc close</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          {isCommenting ||
          inlineCommentLocation ||
          replyTarget ||
          editTarget ||
          deleteTarget ||
          approvalAction ||
          mergeStep ||
          isClosing ||
          reactionTarget ||
          showFileList
            ? ""
            : pendingBracket
              ? `${pendingBracket}_ Press c for ${pendingBracket === "]" ? "next" : "previous"} change, other key to cancel`
              : viewIndex === -1 && (commits.length > 0 || commitsAvailable)
                ? `Tab view ↑↓ n/N file ]c/[c change f list c comment C inline R reply o fold e edit d del g react a/r approve m merge x close A activity q ? help${hasTruncation ? " t more" : ""}`
                : viewIndex >= 0
                  ? "Tab next Shift+Tab prev ↑↓ ]c/[c change e edit d del a/r approve m merge x close q ? help"
                  : `↑↓ n/N file ]c/[c change f list c comment C inline R reply o fold e edit d del g react a/r approve m merge x close A activity q ? help${hasTruncation ? " t more" : ""}`}
        </Text>
      </Box>
    </Box>
  );
}

function getCommentIdFromLine(line: DisplayLine): { commentId: string } | null {
  if (!COMMENT_LINE_TYPES.has(line.type)) return null;
  if (!line.commentId) return null;
  return { commentId: line.commentId };
}

/* v8 ignore start -- commentId always matches a thread entry; loop-exit branch unreachable */
function findCommentContent(commentThreads: CommentThread[], commentId: string): string {
  for (const thread of commentThreads) {
    for (const comment of thread.comments) {
      if (comment.commentId === commentId) {
        return comment.content ?? "";
      }
    }
  }
  return "";
}
/* v8 ignore stop */

function getReplyTargetFromLine(
  line: DisplayLine,
): { commentId: string; author: string; content: string } | null {
  if (!COMMENT_LINE_TYPES.has(line.type)) return null;
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

function findNextHeaderIndex(headerIndices: number[], currentIndex: number): number {
  if (headerIndices.length === 0) return -1;
  const next = headerIndices.find((i) => i > currentIndex);
  return next ?? headerIndices[0]!;
}

function findPrevHeaderIndex(headerIndices: number[], currentIndex: number): number {
  if (headerIndices.length === 0) return -1;
  const prev = [...headerIndices].reverse().find((i) => i < currentIndex);
  return prev ?? headerIndices[headerIndices.length - 1]!;
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
