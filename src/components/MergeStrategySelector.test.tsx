import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { MergeStrategySelector } from "./MergeStrategySelector.js";

describe("MergeStrategySelector", () => {
  it("renders all three strategies with cursor on first item", () => {
    const { lastFrame } = render(
      <MergeStrategySelector
        sourceRef="feature/login-fix"
        destRef="main"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("Merge feature/login-fix into main");
    expect(output).toContain("Select merge strategy:");
    expect(output).toContain("> Fast-forward");
    expect(output).toContain("  Squash");
    expect(output).toContain("  Three-way merge");
  });

  it("moves cursor down with j key", async () => {
    const { lastFrame, stdin } = render(
      <MergeStrategySelector
        sourceRef="feature"
        destRef="main"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    stdin.write("j");
    await vi.waitFor(() => {
      const output = lastFrame() ?? "";
      expect(output).toContain("  Fast-forward");
      expect(output).toContain("> Squash");
    });
  });

  it("moves cursor up with k key", async () => {
    const { lastFrame, stdin } = render(
      <MergeStrategySelector
        sourceRef="feature"
        destRef="main"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> Squash");
    });
    stdin.write("k");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> Fast-forward");
    });
  });

  it("does not move cursor past last item", async () => {
    const { lastFrame, stdin } = render(
      <MergeStrategySelector
        sourceRef="feature"
        destRef="main"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    stdin.write("j");
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> Three-way merge");
    });
  });

  it("does not move cursor before first item", () => {
    const { lastFrame, stdin } = render(
      <MergeStrategySelector
        sourceRef="feature"
        destRef="main"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    stdin.write("k");
    const output = lastFrame() ?? "";
    expect(output).toContain("> Fast-forward");
  });

  it("calls onSelect with selected strategy on Enter", async () => {
    const onSelect = vi.fn();
    const { lastFrame, stdin } = render(
      <MergeStrategySelector
        sourceRef="feature"
        destRef="main"
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> Squash");
    });
    stdin.write("\r");
    expect(onSelect).toHaveBeenCalledWith("squash");
  });

  it("calls onCancel on Esc key", () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <MergeStrategySelector
        sourceRef="feature"
        destRef="main"
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    stdin.write("\u001B");
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel on q key", () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <MergeStrategySelector
        sourceRef="feature"
        destRef="main"
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    stdin.write("q");
    expect(onCancel).toHaveBeenCalled();
  });

  it("does not call onSelect or onCancel on unrelated key", () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const { stdin } = render(
      <MergeStrategySelector
        sourceRef="feature"
        destRef="main"
        onSelect={onSelect}
        onCancel={onCancel}
      />,
    );
    stdin.write("x");
    expect(onSelect).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("displays branch names in merge header", () => {
    const { lastFrame } = render(
      <MergeStrategySelector
        sourceRef="bugfix/issue-123"
        destRef="develop"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("Merge bugfix/issue-123 into develop");
  });
});
