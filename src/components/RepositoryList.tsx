import type { RepositoryNameIdPair } from "@aws-sdk/client-codecommit";
import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

interface Props {
  repositories: RepositoryNameIdPair[];
  onSelect: (repositoryName: string) => void;
  onQuit: () => void;
  onHelp: () => void;
}

export function RepositoryList({ repositories, onSelect, onQuit, onHelp }: Props) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onQuit();
      return;
    }
    if (input === "?") {
      onHelp();
      return;
    }
    if (input === "j" || key.downArrow) {
      setCursor((prev) => Math.min(prev + 1, repositories.length - 1));
      return;
    }
    if (input === "k" || key.upArrow) {
      setCursor((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.return) {
      const repo = repositories[cursor];
      if (repo?.repositoryName) {
        onSelect(repo.repositoryName);
      }
    }
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
