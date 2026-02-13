import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
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
  });

  it("renders help title", () => {
    const { lastFrame } = render(<Help onClose={vi.fn()} />);
    expect(lastFrame()).toContain("titmouse");
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
});
