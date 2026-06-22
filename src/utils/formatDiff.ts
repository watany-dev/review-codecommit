export interface DisplayLine {
  type:
    | "header"
    | "separator"
    | "add"
    | "delete"
    | "context"
    | "truncation"
    | "truncate-context"
    | "comment-header"
    | "comment"
    | "inline-comment"
    | "inline-reply"
    | "comment-reply"
    | "fold-indicator";
  text: string;
  filePath?: string;
  diffKey?: string;
  beforeLineNumber?: number;
  afterLineNumber?: number;
  threadIndex?: number | undefined;
  commentId?: string | undefined;
  reactionText?: string;
}

/** Lookahead window for detecting nearby matching lines (reorders/small edits). */
const LOOKAHEAD_WINDOW = 5;

/** Returns true if `target` appears in `lines` within the lookahead window starting at `start`. */
function hasNearbyMatch(lines: string[], start: number, target: string): boolean {
  const end = Math.min(lines.length, start + LOOKAHEAD_WINDOW);
  for (let i = start; i < end; i++) {
    if (lines[i] === target) return true;
  }
  return false;
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
  // Inputs are never mutated, so hoist lengths out of the hot loop.
  const blen = beforeLines.length;
  const alen = afterLines.length;
  let bi = 0; // Index for beforeLines
  let ai = 0; // Index for afterLines

  // Process both arrays until all lines are consumed
  while (bi < blen || ai < alen) {
    const beforeLine = beforeLines[bi];
    const afterLine = afterLines[ai];

    // Case 1: Lines match at current position - add as context
    if (bi < blen && ai < alen && beforeLine === afterLine) {
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
      const startBi = bi;
      const startAi = ai;

      // Process deletions: consume lines from 'before' that don't match current 'after'
      while (bi < blen && (ai >= alen || beforeLines[bi] !== afterLines[ai])) {
        const bl = beforeLines[bi]!;
        // Optimization: stop if this line appears within the lookahead window in 'after'
        if (hasNearbyMatch(afterLines, ai, bl)) break;
        result.push({
          type: "delete",
          text: `-${bl}`,
          beforeLineNumber: bi + 1,
        });
        bi++;
      }

      // Process additions: consume lines from 'after' that don't match current 'before'
      while (ai < alen && (bi >= blen || afterLines[ai] !== beforeLines[bi])) {
        const al = afterLines[ai]!;
        // Optimization: stop if this line appears within the lookahead window in 'before'
        if (hasNearbyMatch(beforeLines, bi, al)) break;
        result.push({
          type: "add",
          text: `+${al}`,
          afterLineNumber: ai + 1,
        });
        ai++;
      }

      // Safety: if both loops broke without advancing, force progress to prevent infinite loop
      /* v8 ignore start -- defensive guard; the greedy algorithm always advances in normal cases */
      if (bi === startBi && ai === startAi) {
        if (bi < blen) {
          result.push({
            type: "delete",
            text: `-${beforeLines[bi]}`,
            beforeLineNumber: bi + 1,
          });
          bi++;
        }
        if (ai < alen) {
          result.push({
            type: "add",
            text: `+${afterLines[ai]}`,
            afterLineNumber: ai + 1,
          });
          ai++;
        }
      }
      /* v8 ignore stop */
    }
  }

  return result;
}
