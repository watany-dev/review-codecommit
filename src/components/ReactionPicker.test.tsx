import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ReactionPicker } from "./ReactionPicker.js";

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

const defaultProps = {
  onSelect: vi.fn(),
  onCancel: vi.fn(),
  isProcessing: false,
  error: null,
  onClearError: vi.fn(),
  currentReactions: [],
};

describe("ReactionPicker", () => {
  it("renders all 8 reactions in initial display", () => {
    const { lastFrame } = render(<ReactionPicker {...defaultProps} />);
    const output = lastFrame();
    expect(output).toContain("React to comment:");
    for (const r of REACTIONS) {
      expect(output).toContain(r.emoji);
    }
  });

  it("shows first item selected by default", () => {
    const { lastFrame } = render(<ReactionPicker {...defaultProps} />);
    expect(lastFrame()).toContain("> 👍");
  });

  it("moves selection right with l key", async () => {
    const { lastFrame, stdin } = render(<ReactionPicker {...defaultProps} />);
    stdin.write("l");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> 👎");
    });
  });

  it("moves selection left with h key", async () => {
    const { lastFrame, stdin } = render(<ReactionPicker {...defaultProps} />);
    stdin.write("l");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> 👎");
    });
    stdin.write("h");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> 👍");
    });
  });

  it("wraps to last item when pressing h at first position", async () => {
    const { lastFrame, stdin } = render(<ReactionPicker {...defaultProps} />);
    stdin.write("h");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> 👀");
    });
  });

  it("wraps to first item when pressing l at last position", async () => {
    const { lastFrame, stdin } = render(<ReactionPicker {...defaultProps} />);
    for (let i = 0; i < REACTIONS.length - 1; i++) {
      stdin.write("l");
    }
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> 👀");
    });
    stdin.write("l");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> 👍");
    });
  });

  it("calls onSelect with shortCode on Enter", () => {
    const onSelect = vi.fn();
    const { stdin } = render(<ReactionPicker {...defaultProps} onSelect={onSelect} />);
    stdin.write("\r");
    expect(onSelect).toHaveBeenCalledWith(":thumbsup:");
  });

  it("calls onSelect with correct shortCode after navigation", async () => {
    const onSelect = vi.fn();
    const { lastFrame, stdin } = render(<ReactionPicker {...defaultProps} onSelect={onSelect} />);
    stdin.write("l");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> 👎");
    });
    stdin.write("\r");
    expect(onSelect).toHaveBeenCalledWith(":thumbsdown:");
  });

  it("calls onCancel on q key", () => {
    const onCancel = vi.fn();
    const { stdin } = render(<ReactionPicker {...defaultProps} onCancel={onCancel} />);
    stdin.write("q");
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows 'Adding reaction...' when isProcessing is true", () => {
    const { lastFrame } = render(<ReactionPicker {...defaultProps} isProcessing={true} />);
    expect(lastFrame()).toContain("Adding reaction...");
  });

  it("shows error message when error is set", () => {
    const { lastFrame } = render(
      <ReactionPicker {...defaultProps} error="Comment has already been deleted." />,
    );
    expect(lastFrame()).toContain("Failed to add reaction: Comment has already been deleted.");
    expect(lastFrame()).toContain("Press any key to return");
  });

  it("calls onClearError on any key when error is shown", () => {
    const onClearError = vi.fn();
    const { stdin } = render(
      <ReactionPicker {...defaultProps} error="Comment not found." onClearError={onClearError} />,
    );
    stdin.write("a");
    expect(onClearError).toHaveBeenCalled();
  });

  it("ignores input when isProcessing", () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const { stdin } = render(
      <ReactionPicker
        {...defaultProps}
        isProcessing={true}
        onSelect={onSelect}
        onCancel={onCancel}
      />,
    );
    stdin.write("\r");
    stdin.write("q");
    expect(onSelect).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("shows reaction count badge for existing reactions", () => {
    const { lastFrame } = render(
      <ReactionPicker
        {...defaultProps}
        currentReactions={[
          { emoji: "👍", shortCode: ":thumbsup:", count: 2, userArns: [] },
          { emoji: "🎉", shortCode: ":hooray:", count: 1, userArns: [] },
        ]}
      />,
    );
    expect(lastFrame()).toContain("👍(2)");
    expect(lastFrame()).toContain("🎉(1)");
  });

  it("does not show count badge for reactions with count 0", () => {
    const { lastFrame } = render(
      <ReactionPicker
        {...defaultProps}
        currentReactions={[
          { emoji: "👍", shortCode: ":thumbsup:", count: 0, userArns: [] },
          { emoji: "🎉", shortCode: ":hooray:", count: 1, userArns: [] },
        ]}
      />,
    );
    expect(lastFrame()).not.toContain("👍(0)");
    expect(lastFrame()).toContain("🎉(1)");
  });

  it("calls onCancel on escape key", () => {
    const onCancel = vi.fn();
    const { stdin } = render(<ReactionPicker {...defaultProps} onCancel={onCancel} />);
    stdin.write("\u001B");
    expect(onCancel).toHaveBeenCalled();
  });

  it("does nothing on unrelated key", () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const { stdin } = render(
      <ReactionPicker {...defaultProps} onSelect={onSelect} onCancel={onCancel} />,
    );
    stdin.write("x");
    expect(onSelect).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("shows footer hint text", () => {
    const { lastFrame } = render(<ReactionPicker {...defaultProps} />);
    expect(lastFrame()).toContain("←→/h/l select");
    expect(lastFrame()).toContain("Enter send");
    expect(lastFrame()).toContain("Esc cancel");
  });
});
