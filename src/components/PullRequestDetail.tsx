import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { PullRequest, Difference, Comment } from "@aws-sdk/client-codecommit";
import { formatRelativeDate, extractAuthorName } from "../utils/formatDate.js";

interface Props {
  pullRequest: PullRequest;
  differences: Difference[];
  comments: Comment[];
  diffTexts: Map<string, { before: string; after: string }>;
  onBack: () => void;
  onHelp: () => void;
}

export function PullRequestDetail({
  pullRequest,
  differences,
  comments,
  diffTexts,
  onBack,
  onHelp,
}: Props) {
  const [scrollOffset, setScrollOffset] = useState(0);

  const target = pullRequest.pullRequestTargets?.[0];
  const title = pullRequest.title ?? "(no title)";
  const prId = pullRequest.pullRequestId ?? "";
  const author = extractAuthorName(pullRequest.authorArn ?? "unknown");
  const status = pullRequest.pullRequestStatus ?? "OPEN";
  const creationDate = pullRequest.creationDate
    ? formatRelativeDate(pullRequest.creationDate)
    : "";
  const destRef = target?.destinationReference?.replace("refs/heads/", "") ?? "";
  const sourceRef = target?.sourceReference?.replace("refs/heads/", "") ?? "";

  const lines = buildDisplayLines(differences, diffTexts, comments);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onBack();
      return;
    }
    if (input === "?") {
      onHelp();
      return;
    }
    if (input === "j" || key.downArrow) {
      setScrollOffset((prev) => Math.min(prev + 1, Math.max(0, lines.length - 10)));
      return;
    }
    if (input === "k" || key.upArrow) {
      setScrollOffset((prev) => Math.max(prev - 1, 0));
      return;
    }
  });

  const visibleLines = lines.slice(scrollOffset, scrollOffset + 30);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={0}>
        <Text bold color="cyan">PR #{prId}: {title}</Text>
      </Box>
      <Box>
        <Text>Author: {author}  Status: {status}  {creationDate}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>{destRef} ← {sourceRef}</Text>
      </Box>
      <Box flexDirection="column">
        {visibleLines.map((line, index) => (
          <Box key={scrollOffset + index}>
            {renderDiffLine(line)}
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑↓ scroll  q back  ? help</Text>
      </Box>
    </Box>
  );
}

interface DisplayLine {
  type: "header" | "separator" | "add" | "delete" | "context" | "hunk" | "comment-header" | "comment";
  text: string;
}

function buildDisplayLines(
  differences: Difference[],
  diffTexts: Map<string, { before: string; after: string }>,
  comments: Comment[],
): DisplayLine[] {
  const lines: DisplayLine[] = [];

  for (const diff of differences) {
    const filePath =
      diff.afterBlob?.path ?? diff.beforeBlob?.path ?? "(unknown file)";
    lines.push({ type: "header", text: filePath });
    lines.push({ type: "separator", text: "─".repeat(50) });

    const blobKey = `${diff.beforeBlob?.blobId ?? ""}:${diff.afterBlob?.blobId ?? ""}`;
    const texts = diffTexts.get(blobKey);

    if (texts) {
      const beforeLines = texts.before.split("\n");
      const afterLines = texts.after.split("\n");
      const diffLines = computeSimpleDiff(beforeLines, afterLines);
      for (const dl of diffLines) {
        lines.push(dl);
      }
    }

    lines.push({ type: "separator", text: "" });
  }

  if (comments.length > 0) {
    lines.push({ type: "separator", text: "─".repeat(50) });
    lines.push({ type: "comment-header", text: `Comments (${comments.length}):` });
    for (const comment of comments) {
      const author = extractAuthorName(comment.authorArn ?? "unknown");
      const content = comment.content ?? "";
      lines.push({ type: "comment", text: `${author}: ${content}` });
    }
  }

  return lines;
}

function computeSimpleDiff(beforeLines: string[], afterLines: string[]): DisplayLine[] {
  const result: DisplayLine[] = [];
  let bi = 0;
  let ai = 0;

  while (bi < beforeLines.length || ai < afterLines.length) {
    if (bi < beforeLines.length && ai < afterLines.length && beforeLines[bi] === afterLines[ai]) {
      result.push({ type: "context", text: ` ${beforeLines[bi]}` });
      bi++;
      ai++;
    } else {
      while (bi < beforeLines.length && (ai >= afterLines.length || beforeLines[bi] !== afterLines[ai])) {
        const nextMatch = afterLines.indexOf(beforeLines[bi], ai);
        if (nextMatch !== -1 && nextMatch - ai < 5) break;
        result.push({ type: "delete", text: `-${beforeLines[bi]}` });
        bi++;
      }
      while (ai < afterLines.length && (bi >= beforeLines.length || afterLines[ai] !== beforeLines[bi])) {
        const nextMatch = beforeLines.indexOf(afterLines[ai], bi);
        if (nextMatch !== -1 && nextMatch - bi < 5) break;
        result.push({ type: "add", text: `+${afterLines[ai]}` });
        ai++;
      }
    }
  }

  return result;
}

function renderDiffLine(line: DisplayLine): React.ReactNode {
  switch (line.type) {
    case "header":
      return <Text bold color="yellow">{line.text}</Text>;
    case "separator":
      return <Text dimColor>{line.text}</Text>;
    case "add":
      return <Text color="green">{line.text}</Text>;
    case "delete":
      return <Text color="red">{line.text}</Text>;
    case "context":
      return <Text>{line.text}</Text>;
    case "hunk":
      return <Text color="cyan">{line.text}</Text>;
    case "comment-header":
      return <Text bold>{line.text}</Text>;
    case "comment":
      return <Text>  {line.text}</Text>;
    default:
      return <Text>{line.text}</Text>;
  }
}
