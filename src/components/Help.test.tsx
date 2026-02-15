import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { Help } from "./Help.js";

describe("Help", () => {
  it("renders key bindings", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    const output = lastFrame();
    expect(output).toContain("Key Bindings:");
    expect(output).toContain("j / ↓");
    expect(output).toContain("k / ↑");
    expect(output).toContain("Enter");
    expect(output).toContain("Ctrl+C");
    expect(output).toContain("c");
    expect(output).toContain("Post comment");
    expect(output).toContain("C");
    expect(output).toContain("Post inline comment");
    expect(output).toContain("R");
    expect(output).toContain("Reply to comment");
    expect(output).toContain("o");
    expect(output).toContain("Toggle thread fold");
    expect(output).toContain("a");
    expect(output).toContain("Approve PR");
    expect(output).toContain("r");
    expect(output).toContain("Revoke approval");
    expect(output).toContain("m");
    expect(output).toContain("Merge PR");
    expect(output).toContain("x");
    expect(output).toContain("Close PR without merge");
    expect(output).toContain("Tab");
    expect(output).toContain("Switch to commit view");
    expect(output).toContain("S-Tab");
    expect(output).toContain("Previous commit");
  });

  it("renders help title", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("review-codecommit");
    expect(lastFrame()).toContain("Help");
  });

  it("calls onClose on ? key", () => {
    const onClose = vi.fn();
    const { stdin } = render(<Help onClose={onClose} />);
    stdin.write("?");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on q key", () => {
    const onClose = vi.fn();
    const { stdin } = render(<Help onClose={onClose} />);
    stdin.write("q");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on enter key", () => {
    const onClose = vi.fn();
    const { stdin } = render(<Help onClose={onClose} />);
    stdin.write("\r");
    expect(onClose).toHaveBeenCalled();
  });

  // v0.7: Comment edit/delete keybindings
  it("shows e Edit comment keybinding", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("Edit comment");
  });

  it("shows d Delete comment keybinding", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("Delete comment");
  });

  // v0.8: Filter, search, pagination keybindings
  it("shows f Filter by status keybinding", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("Filter by status");
  });

  it("shows / Search pull requests keybinding", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("Search pull requests");
  });

  it("shows n Next page keybinding", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("Next page");
  });

  it("shows p Previous page keybinding", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("Previous page");
  });

  // v0.2.0: Reaction keybinding
  it("shows g React to comment keybinding", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("React to comment");
  });
});
