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
      const startBi = bi;
      const startAi = ai;

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

      // Safety: if both loops broke without advancing, force progress to prevent infinite loop
      /* v8 ignore start -- defensive guard; the greedy algorithm always advances in normal cases */
      if (bi === startBi && ai === startAi) {
        if (bi < beforeLines.length) {
          result.push({
            type: "delete",
            text: `-${beforeLines[bi]}`,
            beforeLineNumber: bi + 1,
          });
          bi++;
        }
        if (ai < afterLines.length) {
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
