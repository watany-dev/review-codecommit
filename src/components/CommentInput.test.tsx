import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { CommentInput } from "./CommentInput.js";

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
});
