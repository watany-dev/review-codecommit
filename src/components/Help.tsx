import React from "react";
import { Box, Text, useInput } from "ink";

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
        <Text bold color="cyan">titmouse — Help</Text>
      </Box>
      <Box flexDirection="column">
        <Text bold>Key Bindings:</Text>
        <Text>  j / ↓      Cursor down</Text>
        <Text>  k / ↑      Cursor up</Text>
        <Text>  Enter      Select / confirm</Text>
        <Text>  q / Esc    Back / quit</Text>
        <Text>  Ctrl+C     Exit immediately</Text>
        <Text>  ?          Toggle this help</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press any key to close</Text>
      </Box>
    </Box>
  );
}
