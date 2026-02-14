import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { COMMENT_MAX_LENGTH, CommentInput } from "./CommentInput.js";

describe("CommentInput", () => {
  it("renders input form with label and hints", () => {
    const { lastFrame } = render(
      <CommentInput
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isPosting={false}
        error={null}
        onClearError={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("New Comment:");
    expect(output).toContain(">");
    expect(output).toContain("Enter submit");
    expect(output).toContain("Esc cancel");
    expect(output).toContain("/10240");
  });

  it("calls onSubmit with trimmed text on Enter", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <CommentInput
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        isPosting={false}
        error={null}
        onClearError={vi.fn()}
      />,
    );
    stdin.write("Hello world");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(onSubmit).toHaveBeenCalledWith("Hello world");
    });
  });

  it("does not call onSubmit on empty input", () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <CommentInput
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        isPosting={false}
        error={null}
        onClearError={vi.fn()}
      />,
    );
    stdin.write("\r");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("truncates input at max length boundary", async () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(
      <CommentInput
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        isPosting={false}
        error={null}
        onClearError={vi.fn()}
      />,
    );
    // Write exactly at limit
    const maxText = "a".repeat(COMMENT_MAX_LENGTH);
    stdin.write(maxText);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(`${COMMENT_MAX_LENGTH}/${COMMENT_MAX_LENGTH}`);
    });
    // Try to write one more char - should be rejected by handleChange
    stdin.write("b");
    await vi.waitFor(() => {
      // Counter should still show max, not max+1
      expect(lastFrame()).toContain(`${COMMENT_MAX_LENGTH}/${COMMENT_MAX_LENGTH}`);
    });
  });

  it("calls onCancel on Escape key", () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <CommentInput
        onSubmit={vi.fn()}
        onCancel={onCancel}
        isPosting={false}
        error={null}
        onClearError={vi.fn()}
      />,
    );
    stdin.write("\u001B");
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows posting state", () => {
    const { lastFrame } = render(
      <CommentInput
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isPosting={true}
        error={null}
        onClearError={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("Posting comment...");
  });

  it("shows error message", () => {
    const { lastFrame } = render(
      <CommentInput
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isPosting={false}
        error="Comment exceeds the 10,240 character limit."
        onClearError={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("Failed to post comment:");
    expect(output).toContain("Comment exceeds the 10,240 character limit.");
    expect(output).toContain("Press any key to return");
  });

  it("calls onClearError on any key when error is shown", () => {
    const onClearError = vi.fn();
    const { stdin } = render(
      <CommentInput
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isPosting={false}
        error="Some error"
        onClearError={onClearError}
      />,
    );
    stdin.write("x");
    expect(onClearError).toHaveBeenCalled();
  });

  it("shows default label when label is not specified", () => {
    const { lastFrame } = render(
      <CommentInput
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isPosting={false}
        error={null}
        onClearError={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("New Comment:");
  });

  it("shows custom label when label is specified", () => {
    const { lastFrame } = render(
      <CommentInput
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isPosting={false}
        error={null}
        onClearError={vi.fn()}
        label="Edit Comment:"
      />,
    );
    expect(lastFrame()).toContain("Edit Comment:");
  });

  it("prefills input with initialValue", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <CommentInput
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        isPosting={false}
        error={null}
        onClearError={vi.fn()}
        initialValue="existing content"
      />,
    );
    // Submit the prefilled value directly
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("existing content");
    });
  });

  it("shows custom postingMessage when specified", () => {
    const { lastFrame } = render(
      <CommentInput
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isPosting={true}
        error={null}
        onClearError={vi.fn()}
        postingMessage="Updating comment..."
      />,
    );
    expect(lastFrame()).toContain("Updating comment...");
  });

  it("shows custom errorPrefix when specified", () => {
    const { lastFrame } = render(
      <CommentInput
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isPosting={false}
        error="You can only edit your own comments."
        onClearError={vi.fn()}
        errorPrefix="Failed to update comment:"
      />,
    );
    const output = lastFrame();
    expect(output).toContain("Failed to update comment:");
    expect(output).toContain("You can only edit your own comments.");
  });

  it("submits edited prefilled value", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <CommentInput
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        isPosting={false}
        error={null}
        onClearError={vi.fn()}
        initialValue="old"
      />,
    );
    // ink-text-input replaces value with typed content
    stdin.write(" updated");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(onSubmit).toHaveBeenCalledWith("old updated");
    });
  });
});
