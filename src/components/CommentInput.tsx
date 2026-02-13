import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import React, { useState } from "react";

interface Props {
  onSubmit: (content: string) => void;
  onCancel: () => void;
  isPosting: boolean;
  error: string | null;
  onClearError: () => void;
}

export function CommentInput({ onSubmit, onCancel, isPosting, error, onClearError }: Props) {
  const [value, setValue] = useState("");

  useInput((_input, key) => {
    if (error) {
      onClearError();
      return;
    }
    if (key.escape) {
      onCancel();
    }
  });

  function handleSubmit(text: string) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
  }

  if (isPosting) {
    return (
      <Box flexDirection="column">
        <Text color="cyan">Posting comment...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Failed to post comment: {error}</Text>
        <Text dimColor>Press any key to return</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>New Comment:</Text>
      <Box>
        <Text>&gt; </Text>
        <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
      </Box>
      <Text dimColor>Enter submit Esc cancel</Text>
    </Box>
  );
}
