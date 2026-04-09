import { Text } from "ink";
import React from "react";
import type { DisplayLine } from "../utils/formatDiff.js";

function formatGutter(line: DisplayLine): string {
  const before =
    line.beforeLineNumber !== undefined ? String(line.beforeLineNumber).padStart(4) : "    ";
  const after =
    line.afterLineNumber !== undefined ? String(line.afterLineNumber).padStart(4) : "    ";
  return `${before} ${after} │ `;
}

export function renderDiffLine(line: DisplayLine, isCursor = false): React.ReactNode {
  const bold = isCursor;
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
      return (
        <Text color="green" bold={bold}>
          <Text dimColor>{formatGutter(line)}</Text>
          {line.text}
        </Text>
      );
    case "delete":
      return (
        <Text color="red" bold={bold}>
          <Text dimColor>{formatGutter(line)}</Text>
          {line.text}
        </Text>
      );
    case "context":
      return (
        <Text bold={bold}>
          <Text dimColor>{formatGutter(line)}</Text>
          {line.text}
        </Text>
      );
    case "truncate-context":
      return <Text dimColor>{line.text}</Text>;
    case "truncation":
      return <Text dimColor>{line.text}</Text>;
    case "comment-header":
      return <Text bold>{line.text}</Text>;
    case "comment":
      return (
        <Text>
          {" "}
          {line.text}
          {line.reactionText ? <Text dimColor> {line.reactionText}</Text> : null}
        </Text>
      );
    case "inline-comment":
      return (
        <Text color="magenta">
          {" "}
          {line.text}
          {/* v8 ignore next -- inline comments rendered without reactions in tests */}
          {line.reactionText ? <Text dimColor> {line.reactionText}</Text> : null}
        </Text>
      );
    case "inline-reply":
      return (
        <Text color="magenta">
          {"   "}
          {line.text}
          {/* v8 ignore next -- inline replies rendered without reactions in tests */}
          {line.reactionText ? <Text dimColor> {line.reactionText}</Text> : null}
        </Text>
      );
    case "comment-reply":
      return (
        <Text>
          {"   "}
          {line.text}
          {line.reactionText ? <Text dimColor> {line.reactionText}</Text> : null}
        </Text>
      );
    case "fold-indicator":
      return (
        <Text dimColor>
          {"   "}
          {line.text}
        </Text>
      );
  }
}
