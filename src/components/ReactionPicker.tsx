import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import type { ReactionSummary } from "../services/codecommit.js";

const REACTIONS = [
  { emoji: "👍", shortCode: ":thumbsup:" },
  { emoji: "👎", shortCode: ":thumbsdown:" },
  { emoji: "😄", shortCode: ":laugh:" },
  { emoji: "🎉", shortCode: ":hooray:" },
  { emoji: "😕", shortCode: ":confused:" },
  { emoji: "❤️", shortCode: ":heart:" },
  { emoji: "🚀", shortCode: ":rocket:" },
  { emoji: "👀", shortCode: ":eyes:" },
] as const;

export { REACTIONS };

interface Props {
  onSelect: (shortCode: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
  error: string | null;
  onClearError: () => void;
  currentReactions: ReactionSummary[];
}

export function ReactionPicker({
  onSelect,
  onCancel,
  isProcessing,
  error,
  onClearError,
  currentReactions,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const reactionCounts = new Map<string, number>();
  for (const r of currentReactions) {
    if (r.count > 0) {
      reactionCounts.set(r.shortCode, r.count);
    }
  }

  useInput((input, key) => {
    if (error) {
      onClearError();
      return;
    }

    if (isProcessing) return;

    if (key.escape || input === "q") {
      onCancel();
      return;
    }

    if (key.leftArrow || input === "h") {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : REACTIONS.length - 1));
      return;
    }

    if (key.rightArrow || input === "l") {
      setSelectedIndex((prev) => (prev < REACTIONS.length - 1 ? prev + 1 : 0));
      return;
    }

    if (key.return) {
      onSelect(REACTIONS[selectedIndex]!.shortCode);
      return;
    }
  });

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Failed to add reaction: {error}</Text>
        <Text dimColor>Press any key to return</Text>
      </Box>
    );
  }

  if (isProcessing) {
    return (
      <Box>
        <Text color="cyan">Adding reaction...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>React to comment:</Text>
      <Box>
        {REACTIONS.map((r, i) => {
          const count = reactionCounts.get(r.shortCode);
          return (
            <Text key={r.shortCode}>
              {i === selectedIndex ? "> " : "  "}
              {r.emoji}
              {count ? `(${count})` : ""}
              {"  "}
            </Text>
          );
        })}
      </Box>
      <Text dimColor>←→ select  Enter send  Esc cancel</Text>
    </Box>
  );
}
