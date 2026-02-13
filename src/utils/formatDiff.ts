export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "delete" | "context";
  content: string;
}

export interface FileDiffSection {
  filePath: string;
  hunks: DiffHunk[];
}

export function computeUnifiedDiff(
  beforeContent: string,
  afterContent: string,
  filePath: string,
): FileDiffSection {
  const beforeLines = beforeContent.split("\n");
  const afterLines = afterContent.split("\n");
  const hunks = buildHunks(beforeLines, afterLines);
  return { filePath, hunks };
}

function buildHunks(beforeLines: string[], afterLines: string[]): DiffHunk[] {
  const lcs = longestCommonSubsequence(beforeLines, afterLines);
  const lines: DiffLine[] = [];

  let bi = 0;
  let ai = 0;
  let li = 0;

  while (bi < beforeLines.length || ai < afterLines.length) {
    if (li < lcs.length && bi < beforeLines.length && ai < afterLines.length && beforeLines[bi] === lcs[li] && afterLines[ai] === lcs[li]) {
      lines.push({ type: "context", content: ` ${beforeLines[bi]}` });
      bi++;
      ai++;
      li++;
    } else {
      if (bi < beforeLines.length && (li >= lcs.length || beforeLines[bi] !== lcs[li])) {
        lines.push({ type: "delete", content: `-${beforeLines[bi]}` });
        bi++;
      } else if (ai < afterLines.length && (li >= lcs.length || afterLines[ai] !== lcs[li])) {
        lines.push({ type: "add", content: `+${afterLines[ai]}` });
        ai++;
      }
    }
  }

  if (lines.length === 0) {
    return [];
  }

  const hunks: DiffHunk[] = [];
  const contextSize = 3;

  let hunkStart = -1;
  let hunkLines: DiffLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type !== "context") {
      const start = Math.max(0, i - contextSize);
      if (hunkStart === -1) {
        hunkStart = start;
        for (let j = start; j < i; j++) {
          hunkLines.push(lines[j]);
        }
      } else if (start > hunkLines.length + hunkStart) {
        hunks.push({
          header: formatHunkHeader(hunkStart, hunkLines),
          lines: hunkLines,
        });
        hunkStart = start;
        hunkLines = [];
        for (let j = start; j < i; j++) {
          hunkLines.push(lines[j]);
        }
      }
      hunkLines.push(lines[i]);
    } else if (hunkStart !== -1) {
      const distToNext = findNextChange(lines, i);
      if (distToNext <= contextSize * 2) {
        hunkLines.push(lines[i]);
      } else if (hunkLines.length > 0) {
        const end = Math.min(i + contextSize, lines.length);
        for (let j = i; j < end; j++) {
          hunkLines.push(lines[j]);
        }
        hunks.push({
          header: formatHunkHeader(hunkStart, hunkLines),
          lines: hunkLines,
        });
        hunkStart = -1;
        hunkLines = [];
      }
    }
  }

  if (hunkLines.length > 0) {
    hunks.push({
      header: formatHunkHeader(hunkStart, hunkLines),
      lines: hunkLines,
    });
  }

  return hunks;
}

function findNextChange(lines: DiffLine[], fromIndex: number): number {
  for (let i = fromIndex; i < lines.length; i++) {
    if (lines[i].type !== "context") {
      return i - fromIndex;
    }
  }
  return Infinity;
}

function formatHunkHeader(start: number, lines: DiffLine[]): string {
  let delStart = start + 1;
  let addStart = start + 1;
  let delCount = 0;
  let addCount = 0;

  for (const line of lines) {
    if (line.type === "delete" || line.type === "context") {
      delCount++;
    }
    if (line.type === "add" || line.type === "context") {
      addCount++;
    }
  }

  return `@@ -${delStart},${delCount} +${addStart},${addCount} @@`;
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

export function formatDiffForDisplay(sections: FileDiffSection[]): string {
  const parts: string[] = [];
  for (const section of sections) {
    parts.push(`--- a/${section.filePath}`);
    parts.push(`+++ b/${section.filePath}`);
    for (const hunk of section.hunks) {
      parts.push(hunk.header);
      for (const line of hunk.lines) {
        parts.push(line.content);
      }
    }
    parts.push("");
  }
  return parts.join("\n");
}
