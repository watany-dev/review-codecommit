import type {
  Approval,
  Comment,
  Difference,
  Evaluation,
  PullRequest,
} from "@aws-sdk/client-codecommit";
import { Box, Text, useInput } from "ink";
import React, { useEffect, useState } from "react";
import { extractAuthorName, formatRelativeDate } from "../utils/formatDate.js";
import { CommentInput } from "./CommentInput.js";
import { ConfirmPrompt } from "./ConfirmPrompt.js";

interface Props {
  pullRequest: PullRequest;
  differences: Difference[];
  comments: Comment[];
  diffTexts: Map<string, { before: string; after: string }>;
  onBack: () => void;
  onHelp: () => void;
  onPostComment: (content: string) => void;
  isPostingComment: boolean;
  commentError: string | null;
  onClearCommentError: () => void;
  approvals: Approval[];
  approvalEvaluation: Evaluation | null;
  onApprove: () => void;
  onRevoke: () => void;
  isApproving: boolean;
  approvalError: string | null;
  onClearApprovalError: () => void;
}

export function PullRequestDetail({
  pullRequest,
  differences,
  comments,
  diffTexts,
  onBack,
  onHelp,
  onPostComment,
  isPostingComment,
  commentError,
  onClearCommentError,
  approvals,
  approvalEvaluation,
  onApprove,
  onRevoke,
  isApproving,
  approvalError,
  onClearApprovalError,
}: Props) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isCommenting, setIsCommenting] = useState(false);
  const [wasPosting, setWasPosting] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "revoke" | null>(null);
  const [wasApproving, setWasApproving] = useState(false);

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
    if (isApproving) {
      setWasApproving(true);
    } else if (wasApproving && !approvalError) {
      setApprovalAction(null);
      setWasApproving(false);
    } else {
      setWasApproving(false);
    }
  }, [isApproving, approvalError]);

  const target = pullRequest.pullRequestTargets?.[0];
  const title = pullRequest.title ?? "(no title)";
  const prId = pullRequest.pullRequestId ?? "";
  const author = extractAuthorName(pullRequest.authorArn ?? "unknown");
  const status = pullRequest.pullRequestStatus ?? "OPEN";
  const creationDate = pullRequest.creationDate ? formatRelativeDate(pullRequest.creationDate) : "";
  const destRef = target?.destinationReference?.replace("refs/heads/", "") ?? "";
  const sourceRef = target?.sourceReference?.replace("refs/heads/", "") ?? "";

  const lines = buildDisplayLines(differences, diffTexts, comments);

  useInput((input, key) => {
    if (isCommenting || approvalAction) return;

    if (input === "q" || key.escape) {
      onBack();
      return;
    }
    if (input === "?") {
      onHelp();
      return;
    }
    if (input === "j" || key.downArrow) {
      setScrollOffset((prev) => Math.min(prev + 1, Math.max(0, lines.length - 10)));
      return;
    }
    if (input === "k" || key.upArrow) {
      setScrollOffset((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (input === "c") {
      setIsCommenting(true);
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
  });

  const visibleLineCount = isCommenting || approvalAction ? 20 : 30;
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
      <Box flexDirection="column">
        {visibleLines.map((line, index) => (
          <Box key={scrollOffset + index}>{renderDiffLine(line)}</Box>
        ))}
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
      <Box marginTop={1}>
        <Text dimColor>
          {isCommenting || approvalAction
            ? ""
            : "↑↓ scroll  c comment  a approve  r revoke  q back  ? help"}
        </Text>
      </Box>
    </Box>
  );
}

interface DisplayLine {
  type: "header" | "separator" | "add" | "delete" | "context" | "comment-header" | "comment";
  text: string;
}

function buildDisplayLines(
  differences: Difference[],
  diffTexts: Map<string, { before: string; after: string }>,
  comments: Comment[],
): DisplayLine[] {
  const lines: DisplayLine[] = [];

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
        lines.push(dl);
      }
    }

    lines.push({ type: "separator", text: "" });
  }

  if (comments.length > 0) {
    lines.push({ type: "separator", text: "─".repeat(50) });
    lines.push({ type: "comment-header", text: `Comments (${comments.length}):` });
    for (const comment of comments) {
      const author = extractAuthorName(comment.authorArn ?? "unknown");
      const content = comment.content ?? "";
      lines.push({ type: "comment", text: `${author}: ${content}` });
    }
  }

  return lines;
}

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
      result.push({ type: "context", text: ` ${beforeLine}` });
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
        result.push({ type: "delete", text: `-${bl}` });
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
        result.push({ type: "add", text: `+${al}` });
        ai++;
      }
    }
  }

  return result;
}

function renderDiffLine(line: DisplayLine): React.ReactNode {
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
      return <Text color="green">{line.text}</Text>;
    case "delete":
      return <Text color="red">{line.text}</Text>;
    case "context":
      return <Text>{line.text}</Text>;
    case "comment-header":
      return <Text bold>{line.text}</Text>;
    case "comment":
      return <Text> {line.text}</Text>;
  }
}
