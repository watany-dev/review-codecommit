import { Box, Text, useInput } from "ink";
import React from "react";

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
  processingMessage: string;
  error: string | null;
  onClearError: () => void;
}

export function ConfirmPrompt({
  message,
  onConfirm,
  onCancel,
  isProcessing,
  processingMessage,
  error,
  onClearError,
}: Props) {
  useInput((input, key) => {
    if (error) {
      onClearError();
      return;
    }
    if (isProcessing) return;

    if (input === "y" || input === "Y") {
      onConfirm();
      return;
    }
    if (input === "n" || input === "N" || key.escape) {
      onCancel();
      return;
    }
  });

  if (isProcessing) {
    return (
      <Box flexDirection="column">
        <Text color="cyan">{processingMessage}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">{error}</Text>
        <Text dimColor>Press any key to return</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>{message} (y/n)</Text>
    </Box>
  );
}
