import { Box, Text } from "ink";
import React from "react";
import { useListNavigation } from "../hooks/useListNavigation.js";
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
  const { cursor } = useListNavigation({
    items: pullRequests,
    onSelect: (pr) => {
      onSelect(pr.pullRequestId);
    },
    onBack,
    onHelp,
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
