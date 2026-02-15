import type { Difference } from "@aws-sdk/client-codecommit";
import type { CommentThread, ReactionSummary, ReactionsByComment } from "../services/codecommit.js";
import { extractAuthorName } from "./formatDate.js";

export interface DisplayLine {
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

/** Comment line types used to identify comment-related DisplayLines. */
export const COMMENT_LINE_TYPES = [
  "inline-comment",
  "comment",
  "inline-reply",
  "comment-reply",
] as const;

export const FOLD_THRESHOLD = 4;

/**
 * Extracts commentId from a DisplayLine if it represents a comment.
 * Unified replacement for getEditTargetFromLine / getDeleteTargetFromLine.
 */
export function getCommentIdFromLine(line: DisplayLine): { commentId: string } | null {
  if (!(COMMENT_LINE_TYPES as readonly string[]).includes(line.type)) return null;
  if (!line.commentId) return null;
  return { commentId: line.commentId };
}

export function getReplyTargetFromLine(
  line: DisplayLine,
): { commentId: string; author: string; content: string } | null {
  if (!(COMMENT_LINE_TYPES as readonly string[]).includes(line.type)) return null;
  if (!line.commentId) return null;

  const text = line.text;
  let author = "unknown";
  let content = text;
  const colonIdx = text.indexOf(": ");
  if (colonIdx !== -1) {
    const prefix = text.slice(0, colonIdx);
    content = text.slice(colonIdx + 2);
    author = prefix.replace(/^[💬└\s]+/, "").trim();
  }

  return { commentId: line.commentId, author, content };
}

export function getLocationFromLine(line: DisplayLine): {
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

export function findCommentContent(commentThreads: CommentThread[], commentId: string): string {
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
export function computeSimpleDiff(beforeLines: string[], afterLines: string[]): DisplayLine[] {
  const result: DisplayLine[] = [];
  let bi = 0;
  let ai = 0;

  while (bi < beforeLines.length || ai < afterLines.length) {
    const beforeLine = beforeLines[bi];
    const afterLine = afterLines[ai];

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
      while (
        bi < beforeLines.length &&
        (ai >= afterLines.length || beforeLines[bi] !== afterLines[ai])
      ) {
        const bl = beforeLines[bi]!;
        const nextMatch = afterLines.indexOf(bl, ai);
        if (nextMatch !== -1 && nextMatch - ai < 5) break;
        result.push({
          type: "delete",
          text: `-${bl}`,
          beforeLineNumber: bi + 1,
        });
        bi++;
      }

      while (
        ai < afterLines.length &&
        (bi >= beforeLines.length || afterLines[ai] !== beforeLines[bi])
      ) {
        const al = afterLines[ai]!;
        const nextMatch = beforeLines.indexOf(al, bi);
        if (nextMatch !== -1 && nextMatch - bi < 5) break;
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

export function buildDisplayLines(
  differences: Difference[],
  diffTexts: Map<string, { before: string; after: string }>,
  commentThreads: CommentThread[],
  collapsedThreads: Set<number>,
  reactionsByComment: ReactionsByComment,
): DisplayLine[] {
  const lines: DisplayLine[] = [];

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
