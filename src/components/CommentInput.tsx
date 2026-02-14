import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import React, { useState } from "react";

interface Props {
  onSubmit: (content: string) => void;
  onCancel: () => void;
  isPosting: boolean;
  error: string | null;
  onClearError: () => void;
  initialValue?: string;
  label?: string;
  postingMessage?: string;
  errorPrefix?: string;
}

export const COMMENT_MAX_LENGTH = 10240;

export function CommentInput({
  onSubmit,
  onCancel,
  isPosting,
  error,
  onClearError,
  initialValue = "",
  label = "New Comment:",
  postingMessage = "Posting comment...",
  errorPrefix = "Failed to post comment:",
}: Props) {
  const [value, setValue] = useState(initialValue);

  useInput((_input, key) => {
    if (error) {
      onClearError();
      return;
    }
    if (key.escape) {
      onCancel();
    }
  });

  function handleChange(newValue: string) {
    if (newValue.length <= COMMENT_MAX_LENGTH) {
      setValue(newValue);
    }
  }

  function handleSubmit(text: string) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
  }

  if (isPosting) {
    return (
      <Box flexDirection="column">
        <Text color="cyan">{postingMessage}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">
          {errorPrefix} {error}
        </Text>
        <Text dimColor>Press any key to return</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>{label}</Text>
      <Box>
        <Text>&gt; </Text>
        <TextInput value={value} onChange={handleChange} onSubmit={handleSubmit} />
      </Box>
      <Text dimColor>
        Enter submit Esc cancel ({value.trim().length}/{COMMENT_MAX_LENGTH})
      </Text>
    </Box>
  );
}
