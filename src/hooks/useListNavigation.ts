import { useInput } from "ink";
import { useState } from "react";

interface UseListNavigationOptions<T> {
  items: T[];
  onSelect: (item: T) => void;
  onBack: () => void;
  onHelp: () => void;
}

/**
 * Custom hook for common list navigation with vim-style keybindings.
 *
 * Provides:
 * - j/↓: Move cursor down
 * - k/↑: Move cursor up
 * - Enter: Select current item
 * - q/Escape: Go back
 * - ?: Show help
 */
export function useListNavigation<T>({ items, onSelect, onBack, onHelp }: UseListNavigationOptions<T>) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onBack();
      return;
    }
    if (input === "?") {
      onHelp();
      return;
    }
    if (input === "j" || key.downArrow) {
      setCursor((prev) => Math.min(prev + 1, items.length - 1));
      return;
    }
    if (input === "k" || key.upArrow) {
      setCursor((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.return) {
      const item = items[cursor];
      if (item) {
        onSelect(item);
      }
    }
  });

  return { cursor };
}
