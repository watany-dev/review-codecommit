import { COMMENT_LINE_TYPES } from "./displayLines.js";
import type { DisplayLine } from "./formatDiff.js";

/** split view の各ペインのセル */
export interface SplitDiffCell {
  type: "empty" | "context" | "add" | "delete";
  lineNumber?: number;
  text: string;
}

/** split view の 1 行を表す union 型 */
export type SplitRow =
  | { kind: "full-width"; line: DisplayLine; sourceIndex: number }
  | {
      kind: "split";
      left: SplitDiffCell;
      right: SplitDiffCell;
      sourceIndex: number;
      fullWidthLines: DisplayLine[];
    };

const FULL_WIDTH_TYPES = new Set<DisplayLine["type"]>([
  "header",
  "separator",
  "truncation",
  "truncate-context",
  "comment-header",
]);

function removePrefix(text: string): string {
  if (text.length > 0 && (text[0] === "+" || text[0] === "-" || text[0] === " ")) {
    return text.slice(1);
  }
  return text;
}

function emptyCell(): SplitDiffCell {
  return { type: "empty", text: "" };
}

function flushDeleteAddBuffer(
  deleteBuffer: { line: DisplayLine; index: number }[],
  addBuffer: { line: DisplayLine; index: number }[],
  rows: SplitRow[],
): void {
  const maxLen = Math.max(deleteBuffer.length, addBuffer.length);
  for (let i = 0; i < maxLen; i++) {
    const del = deleteBuffer[i];
    const add = addBuffer[i];
    const sourceIndex = del?.index ?? add!.index;

    const left: SplitDiffCell = del
      ? { type: "delete", lineNumber: del.line.beforeLineNumber, text: removePrefix(del.line.text) }
      : emptyCell();

    const right: SplitDiffCell = add
      ? { type: "add", lineNumber: add.line.afterLineNumber, text: removePrefix(add.line.text) }
      : emptyCell();

    rows.push({ kind: "split", left, right, sourceIndex, fullWidthLines: [] });
  }
}

export function buildSplitRows(lines: DisplayLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let deleteBuffer: { line: DisplayLine; index: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (COMMENT_LINE_TYPES.has(line.type) || line.type === "fold-indicator") {
      // Flush any pending deletes before attaching comment
      if (deleteBuffer.length > 0) {
        flushDeleteAddBuffer(deleteBuffer, [], rows);
        deleteBuffer = [];
      }
      // Attach to previous split row's fullWidthLines
      const lastRow = rows[rows.length - 1];
      if (lastRow && lastRow.kind === "split") {
        lastRow.fullWidthLines.push(line);
      } else {
        rows.push({ kind: "full-width", line, sourceIndex: i });
      }
      continue;
    }

    if (FULL_WIDTH_TYPES.has(line.type)) {
      if (deleteBuffer.length > 0) {
        flushDeleteAddBuffer(deleteBuffer, [], rows);
        deleteBuffer = [];
      }
      rows.push({ kind: "full-width", line, sourceIndex: i });
      continue;
    }

    if (line.type === "context") {
      if (deleteBuffer.length > 0) {
        flushDeleteAddBuffer(deleteBuffer, [], rows);
        deleteBuffer = [];
      }
      const text = removePrefix(line.text);
      rows.push({
        kind: "split",
        left: { type: "context", lineNumber: line.beforeLineNumber, text },
        right: { type: "context", lineNumber: line.afterLineNumber, text },
        sourceIndex: i,
        fullWidthLines: [],
      });
      continue;
    }

    if (line.type === "delete") {
      deleteBuffer.push({ line, index: i });
      continue;
    }

    if (line.type === "add") {
      if (deleteBuffer.length > 0) {
        // Collect consecutive adds
        const addBuffer: { line: DisplayLine; index: number }[] = [{ line, index: i }];
        while (i + 1 < lines.length && lines[i + 1]!.type === "add") {
          i++;
          addBuffer.push({ line: lines[i]!, index: i });
        }
        flushDeleteAddBuffer(deleteBuffer, addBuffer, rows);
        deleteBuffer = [];
      } else {
        // Standalone add (no preceding deletes)
        rows.push({
          kind: "split",
          left: emptyCell(),
          right: { type: "add", lineNumber: line.afterLineNumber, text: removePrefix(line.text) },
          sourceIndex: i,
          fullWidthLines: [],
        });
      }
      continue;
    }
  }

  // Flush remaining deletes
  if (deleteBuffer.length > 0) {
    flushDeleteAddBuffer(deleteBuffer, [], rows);
  }

  return rows;
}
