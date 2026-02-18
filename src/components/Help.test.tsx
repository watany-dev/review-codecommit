import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { Help } from "./Help.js";

describe("Help", () => {
  it("renders key bindings grouped by category", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    const output = lastFrame();

    // Category headers
    expect(output).toContain("Navigation");
    expect(output).toContain("Comments (PR Detail)");
    expect(output).toContain("PR Actions (PR Detail)");
    expect(output).toContain("PR List");

    // Navigation
    expect(output).toContain("j / ↓");
    expect(output).toContain("k / ↑");
    expect(output).toContain("Enter");
    expect(output).toContain("Ctrl+C");

    // Comments
    expect(output).toContain("Post comment");
    expect(output).toContain("Post inline comment");
    expect(output).toContain("Reply to comment");
    expect(output).toContain("Toggle thread fold");

    // PR Actions
    expect(output).toContain("Approve PR");
    expect(output).toContain("Revoke approval");
    expect(output).toContain("Merge PR");
    expect(output).toContain("Close PR without merge");
    expect(output).toContain("Shift+Tab");
    expect(output).toContain("Previous commit");
  });

  it("renders category headers in correct order", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    const output = lastFrame()!;
    const navPos = output.indexOf("Navigation");
    const commentsPos = output.indexOf("Comments (PR Detail)");
    const actionsPos = output.indexOf("PR Actions (PR Detail)");
    const listPos = output.indexOf("PR List");
    expect(navPos).toBeLessThan(commentsPos);
    expect(commentsPos).toBeLessThan(actionsPos);
    expect(actionsPos).toBeLessThan(listPos);
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

  it("calls onClose on escape key", () => {
    const onClose = vi.fn();
    const { stdin } = render(<Help onClose={onClose} />);
    stdin.write("\u001B");
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose on unrelated key", () => {
    const onClose = vi.fn();
    const { stdin } = render(<Help onClose={onClose} />);
    stdin.write("x");
    expect(onClose).not.toHaveBeenCalled();
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

  it("shows A Activity timeline keybinding", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("Activity timeline");
  });

  it("shows h/l reaction navigation keybindings", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("Previous reaction");
    expect(lastFrame()).toContain("Next reaction");
  });

  it("displays page scroll keybindings", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    const output = lastFrame();
    expect(output).toContain("Ctrl+d");
    expect(output).toContain("Half page down");
    expect(output).toContain("Ctrl+u");
    expect(output).toContain("Half page up");
    expect(output).toContain("G");
    expect(output).toContain("Jump to end");
  });

  it("shows n Next file keybinding", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("Next file");
  });

  it("shows N Previous file keybinding", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("Previous file");
  });

  it("shows f File list keybinding", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("File list");
  });
});
