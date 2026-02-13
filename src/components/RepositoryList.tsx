import type { RepositoryNameIdPair } from "@aws-sdk/client-codecommit";
import { Box, Text } from "ink";
import React from "react";
import { useListNavigation } from "../hooks/useListNavigation.js";

interface Props {
  repositories: RepositoryNameIdPair[];
  onSelect: (repositoryName: string) => void;
  onQuit: () => void;
  onHelp: () => void;
}

export function RepositoryList({ repositories, onSelect, onQuit, onHelp }: Props) {
  const { cursor } = useListNavigation({
    items: repositories,
    onSelect: (repo) => {
      if (repo?.repositoryName) {
        onSelect(repo.repositoryName);
      }
    },
    onBack: onQuit,
    onHelp,
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          titmouse
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold>Select Repository:</Text>
      </Box>
      {repositories.map((repo, index) => (
        <Box key={repo.repositoryId ?? index}>
          <Text {...(index === cursor ? { color: "green" as const } : {})}>
            {index === cursor ? "> " : "  "}
            {repo.repositoryName}
          </Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate Enter select q quit ? help</Text>
      </Box>
    </Box>
  );
}
