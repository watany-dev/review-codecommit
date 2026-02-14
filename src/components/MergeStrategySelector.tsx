import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import type { MergeStrategy } from "../services/codecommit.js";

interface Props {
  sourceRef: string;
  destRef: string;
  onSelect: (strategy: MergeStrategy) => void;
  onCancel: () => void;
}

const STRATEGIES: { key: MergeStrategy; label: string }[] = [
  { key: "fast-forward", label: "Fast-forward" },
  { key: "squash", label: "Squash" },
  { key: "three-way", label: "Three-way merge" },
];

export function MergeStrategySelector({ sourceRef, destRef, onSelect, onCancel }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (input === "j" || key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, STRATEGIES.length - 1));
      return;
    }
    if (input === "k" || key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.return) {
      onSelect(STRATEGIES[selectedIndex]!.key);
      return;
    }
    if (input === "q" || key.escape) {
      onCancel();
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <Text>
        Merge {sourceRef} into {destRef}
      </Text>
      <Text> </Text>
      <Text>Select merge strategy:</Text>
      {STRATEGIES.map((s, i) => (
        <Text key={s.key}>
          {i === selectedIndex ? "> " : "  "}
          {s.label}
        </Text>
      ))}
      <Text> </Text>
      <Text dimColor>↑↓ select Enter confirm Esc cancel</Text>
    </Box>
  );
}
