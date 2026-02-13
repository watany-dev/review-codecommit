import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmPrompt } from "./ConfirmPrompt.js";

describe("ConfirmPrompt", () => {
  const defaultProps = {
    message: "Approve this pull request?",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isProcessing: false,
    processingMessage: "Approving...",
    error: null as string | null,
    onClearError: vi.fn(),
  };

  it("renders confirmation message with (y/n)", () => {
    const { lastFrame } = render(<ConfirmPrompt {...defaultProps} />);
    expect(lastFrame()).toContain("Approve this pull request? (y/n)");
  });

  it("calls onConfirm on y key", () => {
    const onConfirm = vi.fn();
    const { stdin } = render(<ConfirmPrompt {...defaultProps} onConfirm={onConfirm} />);
    stdin.write("y");
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onCancel on n key", () => {
    const onCancel = vi.fn();
    const { stdin } = render(<ConfirmPrompt {...defaultProps} onCancel={onCancel} />);
    stdin.write("n");
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel on Escape key", () => {
    const onCancel = vi.fn();
    const { stdin } = render(<ConfirmPrompt {...defaultProps} onCancel={onCancel} />);
    stdin.write("\x1B");
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows processing message when isProcessing is true", () => {
    const { lastFrame } = render(
      <ConfirmPrompt {...defaultProps} isProcessing={true} processingMessage="Approving..." />,
    );
    expect(lastFrame()).toContain("Approving...");
    expect(lastFrame()).not.toContain("(y/n)");
  });

  it("shows error message and return hint when error is set", () => {
    const { lastFrame } = render(
      <ConfirmPrompt {...defaultProps} error="Access denied. Check your IAM policy." />,
    );
    expect(lastFrame()).toContain("Access denied. Check your IAM policy.");
    expect(lastFrame()).toContain("Press any key to return");
  });

  it("calls onClearError on any key when error is shown", () => {
    const onClearError = vi.fn();
    const { stdin } = render(
      <ConfirmPrompt
        {...defaultProps}
        error="Some error"
        onClearError={onClearError}
      />,
    );
    stdin.write("x");
    expect(onClearError).toHaveBeenCalled();
  });

  it("does not call onConfirm when isProcessing is true", () => {
    const onConfirm = vi.fn();
    const { stdin } = render(
      <ConfirmPrompt {...defaultProps} isProcessing={true} onConfirm={onConfirm} />,
    );
    stdin.write("y");
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
