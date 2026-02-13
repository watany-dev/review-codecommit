import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import type { PullRequestSummary } from "../services/codecommit.js";
import { extractAuthorName, formatRelativeDate } from "../utils/formatDate.js";

interface Props {
  repositoryName: string;
  pullRequests: PullRequestSummary[];
  onSelect: (pullRequestId: string) => void;
  onBack: () => void;
  onHelp: () => void;
}

export function PullRequestList({ repositoryName, pullRequests, onSelect, onBack, onHelp }: Props) {
  const [cursor, setCursor] = useState(0);

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
      setCursor((prev) => Math.min(prev + 1, pullRequests.length - 1));
      return;
    }
    if (input === "k" || key.upArrow) {
      setCursor((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.return) {
      const pr = pullRequests[cursor];
      if (pr) {
        onSelect(pr.pullRequestId);
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          titmouse
        </Text>
        <Text> — </Text>
        <Text bold>{repositoryName}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold>Open Pull Requests ({pullRequests.length}):</Text>
      </Box>
      {pullRequests.length === 0 ? (
        <Box>
          <Text dimColor>No open pull requests.</Text>
        </Box>
      ) : (
        pullRequests.map((pr, index) => (
          <Box key={pr.pullRequestId}>
            <Text {...(index === cursor ? { color: "green" as const } : {})}>
              {index === cursor ? "> " : "  "}#{pr.pullRequestId} {pr.title}
              {"  "}
              <Text dimColor>
                {extractAuthorName(pr.authorArn)} {formatRelativeDate(pr.creationDate)}
              </Text>
            </Text>
          </Box>
        ))
      )}
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate Enter view q back ? help</Text>
      </Box>
    </Box>
  );
}
