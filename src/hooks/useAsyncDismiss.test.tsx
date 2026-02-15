import { Text } from "ink";
import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { useAsyncDismiss } from "./useAsyncDismiss.js";

function TestComponent({
  isProcessing,
  error,
  onDismiss,
}: {
  isProcessing: boolean;
  error: string | null;
  onDismiss: () => void;
}) {
  useAsyncDismiss(isProcessing, error, onDismiss);
  return <Text>test</Text>;
}

describe("useAsyncDismiss", () => {
  it("calls onDismiss when processing completes without error", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <TestComponent isProcessing={false} error={null} onDismiss={onDismiss} />,
    );
    // Start processing
    rerender(<TestComponent isProcessing={true} error={null} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();

    // Finish processing without error
    rerender(<TestComponent isProcessing={false} error={null} onDismiss={onDismiss} />);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not call onDismiss when processing completes with error", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <TestComponent isProcessing={false} error={null} onDismiss={onDismiss} />,
    );
    // Start processing
    rerender(<TestComponent isProcessing={true} error={null} onDismiss={onDismiss} />);

    // Finish processing with error
    rerender(<TestComponent isProcessing={false} error="Something failed" onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does not call onDismiss on initial render", () => {
    const onDismiss = vi.fn();
    render(<TestComponent isProcessing={false} error={null} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does not call onDismiss while still processing", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <TestComponent isProcessing={true} error={null} onDismiss={onDismiss} />,
    );
    rerender(<TestComponent isProcessing={true} error={null} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
