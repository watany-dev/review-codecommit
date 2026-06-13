import type { Difference } from "@aws-sdk/client-codecommit";
import type { CommentThread, ReactionSummary, ReactionsByComment } from "../services/codecommit.js";
import { extractAuthorName } from "./formatDate.js";
import { computeSimpleDiff, type DisplayLine } from "./formatDiff.js";

export type { DisplayLine };

export const LARGE_DIFF_THRESHOLD = 1500;
export const DIFF_CHUNK_SIZE = 300;

export const COMMENT_LINE_TYPES = new Set<DisplayLine["type"]>([
  "inline-comment",
  "comment",
  "inline-reply",
  "comment-reply",
]);

export const FOLD_THRESHOLD = 4;

const SEPARATOR_TEXT = "─".repeat(50);

/** Counts lines in `text` without allocating an array (equivalent to split("\n").length). */
export function countLines(text: string): number {
  let count = 1;
  let idx = text.indexOf("\n");
  while (idx !== -1) {
    count++;
    idx = text.indexOf("\n", idx + 1);
  }
  return count;
}

export function getThreadKey(thread: CommentThread, index: number): string {
  const rootComment = thread.comments.find((comment) => !comment.inReplyTo) ?? thread.comments[0];
  return rootComment?.commentId ?? `thread-${index}`;
}

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
  collapsedThreads: Map<string, boolean>,
  threadKey: string,
  mode: "inline" | "general",
  reactionsByComment: ReactionsByComment,
): void {
  const comments = thread.comments;
  if (comments.length === 0) return;

  const rootComment = comments.find((c) => !c.inReplyTo) ?? comments[0]!;
  const replies = comments.filter((c) => c !== rootComment);
  const shouldFold = comments.length >= FOLD_THRESHOLD;
  const isCollapsed = collapsedThreads.get(threadKey) ?? shouldFold;

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

/* v8 ignore start -- defensive clamp and proportional split; all call sites use valid inputs */
function getSliceLimits(beforeCount: number, afterCount: number, totalLimit: number) {
  if (totalLimit <= 0) return { beforeLimit: 0, afterLimit: 0 };
  const total = beforeCount + afterCount;
  if (total <= totalLimit) return { beforeLimit: beforeCount, afterLimit: afterCount };

  const beforeRatio = total === 0 ? 0.5 : beforeCount / total;
  let beforeLimit = Math.round(totalLimit * beforeRatio);
  beforeLimit = Math.min(beforeCount, Math.max(0, beforeLimit));
  let afterLimit = Math.min(afterCount, totalLimit - beforeLimit);

  if (afterLimit < totalLimit - beforeLimit) {
    const remaining = totalLimit - (beforeLimit + afterLimit);
    beforeLimit = Math.min(beforeCount, beforeLimit + remaining);
  }

  return { beforeLimit, afterLimit };
}
/* v8 ignore stop */

function findMatchingThreadEntries(
  threadsByKey: Map<string, { thread: CommentThread; index: number }[]>,
  line: DisplayLine,
): { thread: CommentThread; index: number }[] {
  const results: { thread: CommentThread; index: number }[] = [];

  if (line.type === "delete" && line.beforeLineNumber) {
    const key = `${line.beforeLineNumber}:BEFORE`;
    results.push(...(threadsByKey.get(key) ?? []));
  }

  if (line.type === "add" && line.afterLineNumber) {
    const key = `${line.afterLineNumber}:AFTER`;
    results.push(...(threadsByKey.get(key) ?? []));
  }

  /* v8 ignore start -- context lines always have both line numbers in practice */
  if (line.type === "context") {
    if (line.beforeLineNumber) {
      const key = `${line.beforeLineNumber}:BEFORE`;
      results.push(...(threadsByKey.get(key) ?? []));
    }
    if (line.afterLineNumber) {
      const key = `${line.afterLineNumber}:AFTER`;
      results.push(...(threadsByKey.get(key) ?? []));
    }
  }
  /* v8 ignore stop */

  return results;
}

// Line counts are derived from immutable text pairs fetched per blob, so a
// WeakMap keyed by the pair object stays correct and skips re-scanning the
// same strings on every rebuild (cursor moves rebuild nothing, but comment
// or limit changes rebuild all files).
const lineCountCache = new WeakMap<object, { before: number; after: number }>();

function getLineCounts(texts: { before: string; after: string }): {
  before: number;
  after: number;
} {
  let counts = lineCountCache.get(texts);
  if (counts === undefined) {
    counts = { before: countLines(texts.before), after: countLines(texts.after) };
    lineCountCache.set(texts, counts);
  }
  return counts;
}

export function buildDisplayLines(
  differences: Difference[],
  diffTexts: Map<string, { before: string; after: string }>,
  diffTextStatus: Map<string, "loading" | "loaded" | "error">,
  diffLineLimits: Map<string, number>,
  commentThreads: CommentThread[],
  collapsedThreads: Map<string, boolean>,
  reactionsByComment: ReactionsByComment,
  diffCache?: Map<string, DisplayLine[]>,
): DisplayLine[] {
  const lines: DisplayLine[] = [];

  // Index inline comments per file, then by position:version, so files
  // without threads skip per-line lookups (and key strings) entirely
  const inlineThreadsByFile = new Map<
    string,
    Map<string, { thread: CommentThread; index: number }[]>
  >();
  for (let i = 0; i < commentThreads.length; i++) {
    const thread = commentThreads[i]!;
    if (thread.location) {
      let fileThreads = inlineThreadsByFile.get(thread.location.filePath);
      if (!fileThreads) {
        fileThreads = new Map();
        inlineThreadsByFile.set(thread.location.filePath, fileThreads);
      }
      const key = `${thread.location.filePosition}:${thread.location.relativeFileVersion}`;
      const existing = fileThreads.get(key) ?? [];
      existing.push({ thread, index: i });
      fileThreads.set(key, existing);
    }
  }

  for (const diff of differences) {
    const filePath = diff.afterBlob?.path ?? diff.beforeBlob?.path ?? "(unknown file)";
    lines.push({ type: "header", text: filePath });
    lines.push({ type: "separator", text: SEPARATOR_TEXT });

    const blobKey = `${diff.beforeBlob?.blobId ?? ""}:${diff.afterBlob?.blobId ?? ""}`;
    const texts = diffTexts.get(blobKey);
    const status = diffTextStatus.get(blobKey) ?? "loading";

    if (texts) {
      const { before: beforeCount, after: afterCount } = getLineCounts(texts);
      const totalLines = beforeCount + afterCount;
      const defaultLimit = totalLines > LARGE_DIFF_THRESHOLD ? DIFF_CHUNK_SIZE : totalLines;
      const currentLimit = diffLineLimits.get(blobKey) ?? defaultLimit;
      const displayLimit = Math.min(currentLimit, totalLines);
      const cacheKey = `${blobKey}:${displayLimit}`;
      let diffLines = diffCache?.get(cacheKey);
      if (!diffLines) {
        // Split only on cache miss; the warm path never needs the line arrays
        const beforeLines = texts.before.split("\n");
        const afterLines = texts.after.split("\n");
        const { beforeLimit, afterLimit } = getSliceLimits(
          beforeLines.length,
          afterLines.length,
          displayLimit,
        );
        // Slicing copies the array; skip it when the whole file is shown
        // (the common non-truncated case), which is most files
        diffLines = computeSimpleDiff(
          beforeLimit < beforeLines.length ? beforeLines.slice(0, beforeLimit) : beforeLines,
          afterLimit < afterLines.length ? afterLines.slice(0, afterLimit) : afterLines,
        );
        // Enrich once here so the hot loop below can push lines without per-call copies
        for (const dl of diffLines) {
          dl.filePath = filePath;
          dl.diffKey = blobKey;
        }
        diffCache?.set(cacheKey, diffLines);
      }
      const fileThreads = inlineThreadsByFile.get(filePath);
      for (const dl of diffLines) {
        lines.push(dl);

        if (!fileThreads) continue;
        const matchingEntries = findMatchingThreadEntries(fileThreads, dl);
        for (const { thread, index: threadIdx } of matchingEntries) {
          appendThreadLines(
            lines,
            thread,
            threadIdx,
            collapsedThreads,
            getThreadKey(thread, threadIdx),
            "inline",
            reactionsByComment,
          );
        }
      }
      if (totalLines > displayLimit) {
        const moreCount = Math.min(DIFF_CHUNK_SIZE, totalLines - displayLimit);
        lines.push({
          type: "truncate-context",
          text: `... truncated ${displayLimit}/${totalLines} lines`,
          filePath,
          diffKey: blobKey,
        });
        lines.push({
          type: "truncation",
          text: `[t] show next ${moreCount} lines`,
          filePath,
          diffKey: blobKey,
        });
      }
    } else if (status === "error") {
      lines.push({
        type: "context",
        text: "(Failed to load file content)",
        filePath,
        diffKey: blobKey,
      });
    } else {
      lines.push({
        type: "context",
        text: "(Loading file content...)",
        filePath,
        diffKey: blobKey,
      });
    }

    lines.push({ type: "separator", text: "", diffKey: blobKey, filePath });
  }

  const generalThreads = commentThreads
    .map((t, i) => ({ thread: t, index: i }))
    .filter(({ thread }) => thread.location === null);

  if (generalThreads.length > 0) {
    const totalComments = generalThreads.reduce(
      (sum, { thread }) => sum + thread.comments.length,
      0,
    );
    lines.push({ type: "separator", text: SEPARATOR_TEXT });
    lines.push({ type: "comment-header", text: `Comments (${totalComments}):` });
    for (const { thread, index: threadIdx } of generalThreads) {
      appendThreadLines(
        lines,
        thread,
        threadIdx,
        collapsedThreads,
        getThreadKey(thread, threadIdx),
        "general",
        reactionsByComment,
      );
    }
  }

  return lines;
}
