import { Box, Text } from "ink";
import React from "react";
import type { SplitDiffCell, SplitRow } from "../utils/splitDiff.js";
import { renderDiffLine } from "./DiffLine.js";

interface SplitDiffLineProps {
  row: SplitRow;
  isCursor: boolean;
  paneWidth: number;
}

function renderSplitCell(cell: SplitDiffCell, codeWidth: number): React.ReactNode {
  if (cell.type === "empty") {
    return <Text dimColor>{" ".repeat(codeWidth + 5)}</Text>;
  }
  const lineNum = cell.lineNumber ? String(cell.lineNumber).padStart(4) : "    ";
  const code = cell.text.length > codeWidth ? cell.text.slice(0, codeWidth) : cell.text;
  if (cell.type === "delete") {
    return (
      <Text color="red">
        <Text dimColor>{lineNum}</Text> {code}
      </Text>
    );
  }
  if (cell.type === "add") {
    return (
      <Text color="green">
        <Text dimColor>{lineNum}</Text> {code}
      </Text>
    );
  }
  return (
    <Text>
      <Text dimColor>{lineNum}</Text> {code}
    </Text>
  );
}

export function SplitDiffLine({ row, isCursor, paneWidth }: SplitDiffLineProps) {
  if (row.kind === "full-width") {
    return (
      <Box>
        <Text>{isCursor ? "> " : "  "}</Text>
        {renderDiffLine(row.line, isCursor)}
      </Box>
    );
  }

  const codeWidth = paneWidth - 5;
  return (
    <>
      <Box>
        <Text>{isCursor ? "> " : "  "}</Text>
        <Box width={paneWidth}>{renderSplitCell(row.left, codeWidth)}</Box>
        <Text dimColor>│</Text>
        <Box width={paneWidth}>{renderSplitCell(row.right, codeWidth)}</Box>
      </Box>
      {row.fullWidthLines.map((fl) => (
        <Box key={fl.commentId ?? fl.text}>
          <Text>{"  "}</Text>
          {renderDiffLine(fl)}
        </Box>
      ))}
    </>
  );
}
