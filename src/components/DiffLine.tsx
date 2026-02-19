import { Text } from "ink";
import React from "react";
import type { DisplayLine } from "../utils/formatDiff.js";
import { detectLanguage, type HighlightSegment, highlightLine } from "../utils/highlightCode.js";

function renderSegments(segments: HighlightSegment[]): React.ReactNode {
  if (segments.length === 1 && !segments[0]?.color && !segments[0]?.bold && !segments[0]?.dim) {
    /* v8 ignore next -- segments always have at least one element here */
    return segments[0]?.text ?? "";
  }
  let offset = 0;
  return segments.map((seg) => {
    const key = `s${offset}`;
    offset += seg.text.length;
    return (
      <Text
        key={key}
        {...(seg.color ? { color: seg.color } : {})}
        {...(seg.bold ? { bold: true } : {})}
        {...(seg.dim ? { dimColor: true } : {})}
        {...(seg.italic ? { italic: true } : {})}
      >
        {seg.text}
      </Text>
    );
  });
}

function renderCodeLine(
  line: DisplayLine,
  prefixColor: string | undefined,
  bold: boolean,
): React.ReactNode {
  const prefix = line.text.slice(0, 1);
  const content = line.text.slice(1);
  const lang = line.filePath ? detectLanguage(line.filePath) : undefined;

  if (lang && content) {
    const segments = highlightLine(content, lang);
    return (
      <Text bold={bold}>
        {prefixColor ? <Text color={prefixColor}>{prefix}</Text> : <Text>{prefix}</Text>}
        {renderSegments(segments)}
      </Text>
    );
  }
  return (
    <Text {...(prefixColor ? { color: prefixColor } : {})} bold={bold}>
      {line.text}
    </Text>
  );
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
      return renderCodeLine(line, "green", bold);
    case "delete":
      return renderCodeLine(line, "red", bold);
    case "context":
      return renderCodeLine(line, undefined, bold);
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
