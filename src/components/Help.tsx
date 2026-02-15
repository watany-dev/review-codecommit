import { Box, Text, useInput } from "ink";
import React from "react";

interface Props {
  onClose: () => void;
}

export function Help({ onClose }: Props) {
  useInput((input, key) => {
    if (input === "?" || input === "q" || key.escape || key.return) {
      onClose();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          review-codecommit — Help
        </Text>
      </Box>
      <Box flexDirection="column">
        <Text bold>Key Bindings:</Text>
        <Text> j / ↓ Cursor down</Text>
        <Text> k / ↑ Cursor up</Text>
        <Text> Enter Select / confirm</Text>
        <Text> q / Esc Back / quit</Text>
        <Text> Ctrl+C Exit immediately</Text>
        <Text> c Post comment (PR Detail)</Text>
        <Text> C Post inline comment (PR Detail)</Text>
        <Text> R Reply to comment (PR Detail)</Text>
        <Text> o Toggle thread fold (PR Detail)</Text>
        <Text> e Edit comment (PR Detail)</Text>
        <Text> d Delete comment (PR Detail)</Text>
        <Text> g React to comment (PR Detail)</Text>
        <Text> a Approve PR (PR Detail)</Text>
        <Text> r Revoke approval (PR Detail)</Text>
        <Text> m Merge PR (PR Detail)</Text>
        <Text> x Close PR without merge (PR Detail)</Text>
        <Text> Tab Switch to commit view (PR Detail)</Text>
        <Text> S-Tab Previous commit (PR Detail)</Text>
        <Text> f Filter by status (PR List)</Text>
        <Text> / Search pull requests (PR List)</Text>
        <Text> n Next page (PR List)</Text>
        <Text> p Previous page (PR List)</Text>
        <Text> ? Toggle this help</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press any key to close</Text>
      </Box>
    </Box>
  );
}
