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
  const color = cell.type === "delete" ? "red" : cell.type === "add" ? "green" : undefined;
  return (
    <Text color={color}>
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
        <Box width={paneWidth}>
          {renderSplitCell(row.left, codeWidth)}
        </Box>
        <Text dimColor>│</Text>
        <Box width={paneWidth}>
          {renderSplitCell(row.right, codeWidth)}
        </Box>
      </Box>
      {row.fullWidthLines.map((fl, idx) => (
        <Box key={idx}>
          <Text>{"  "}</Text>
          {renderDiffLine(fl)}
        </Box>
      ))}
    </>
  );
}
