import { Text } from "ink";
import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { useListNavigation } from "./useListNavigation.js";

function TestComponent({
  items,
  onSelect,
  onBack,
  onHelp,
}: {
  items: string[];
  onSelect: (item: string) => void;
  onBack: () => void;
  onHelp: () => void;
}) {
  const { cursor } = useListNavigation({ items, onSelect, onBack, onHelp });
  return <Text>{`cursor: ${cursor}`}</Text>;
}

describe("useListNavigation", () => {
  it("initializes cursor at 0", () => {
    const { lastFrame } = render(
      <TestComponent
        items={["a", "b", "c"]}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    expect(lastFrame()).toBe("cursor: 0");
  });

  it("moves cursor down with j key", async () => {
    const { stdin, lastFrame } = render(
      <TestComponent
        items={["a", "b", "c"]}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toBe("cursor: 1");
    });
  });

  it("moves cursor up with k key", async () => {
    const { stdin, lastFrame } = render(
      <TestComponent
        items={["a", "b", "c"]}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toBe("cursor: 1");
    });
    stdin.write("k");
    await vi.waitFor(() => {
      expect(lastFrame()).toBe("cursor: 0");
    });
  });

  it("does not move cursor below last item", async () => {
    const { stdin, lastFrame } = render(
      <TestComponent
        items={["a", "b"]}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    stdin.write("j");
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toBe("cursor: 1");
    });
  });

  it("does not move cursor above first item", async () => {
    const { stdin, lastFrame } = render(
      <TestComponent
        items={["a", "b", "c"]}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    stdin.write("k");
    await vi.waitFor(() => {
      expect(lastFrame()).toBe("cursor: 0");
    });
  });

  it("calls onBack when q is pressed", () => {
    const onBack = vi.fn();
    const { stdin } = render(
      <TestComponent items={["a", "b"]} onSelect={vi.fn()} onBack={onBack} onHelp={vi.fn()} />,
    );
    stdin.write("q");
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("calls onHelp when ? is pressed", () => {
    const onHelp = vi.fn();
    const { stdin } = render(
      <TestComponent items={["a", "b"]} onSelect={vi.fn()} onBack={vi.fn()} onHelp={onHelp} />,
    );
    stdin.write("?");
    expect(onHelp).toHaveBeenCalledOnce();
  });

  it("calls onSelect when return is pressed", () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <TestComponent
        items={["a", "b", "c"]}
        onSelect={onSelect}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    stdin.write("\r");
    expect(onSelect).toHaveBeenCalled();
  });

  it("handles escape key", () => {
    const onBack = vi.fn();
    const { stdin } = render(
      <TestComponent items={["a", "b"]} onSelect={vi.fn()} onBack={onBack} onHelp={vi.fn()} />,
    );
    stdin.write("\u001B");
    expect(onBack).toHaveBeenCalled();
  });

  it("handles empty items list", () => {
    const onSelect = vi.fn();
    const { lastFrame } = render(
      <TestComponent items={[]} onSelect={onSelect} onBack={vi.fn()} onHelp={vi.fn()} />,
    );
    expect(lastFrame()).toBe("cursor: 0");
  });
});
