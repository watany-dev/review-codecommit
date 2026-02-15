import { Text } from "ink";
import { render } from "ink-testing-library";
import React, { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { type AsyncOpsActions, type AsyncOpsState, useAsyncOps } from "./useAsyncOps.js";

let capturedState: AsyncOpsState;
let capturedActions: AsyncOpsActions;

function TestComponent({ onReady }: { onReady?: () => void }) {
  const [state, actions] = useAsyncOps();
  capturedState = state;
  capturedActions = actions;
  useEffect(() => {
    onReady?.();
  }, []);
  return <Text>test</Text>;
}

describe("useAsyncOps", () => {
  it("initializes all operations with isProcessing=false and error=null", () => {
    render(<TestComponent />);
    for (const key of Object.keys(capturedState)) {
      const entry = capturedState[key as keyof AsyncOpsState];
      expect(entry.isProcessing).toBe(false);
      expect(entry.error).toBeNull();
    }
  });

  it("start sets isProcessing to true", () => {
    const { rerender } = render(<TestComponent />);
    capturedActions.start("comment");
    rerender(<TestComponent />);
    expect(capturedState.comment.isProcessing).toBe(true);
    expect(capturedState.comment.error).toBeNull();
  });

  it("done sets isProcessing to false", () => {
    const { rerender } = render(<TestComponent />);
    capturedActions.start("reply");
    rerender(<TestComponent />);
    capturedActions.done("reply");
    rerender(<TestComponent />);
    expect(capturedState.reply.isProcessing).toBe(false);
    expect(capturedState.reply.error).toBeNull();
  });

  it("error sets error message and stops processing", () => {
    const { rerender } = render(<TestComponent />);
    capturedActions.start("merge");
    rerender(<TestComponent />);
    capturedActions.error("merge", "Conflict detected");
    rerender(<TestComponent />);
    expect(capturedState.merge.isProcessing).toBe(false);
    expect(capturedState.merge.error).toBe("Conflict detected");
  });

  it("clearError clears only the error", () => {
    const { rerender } = render(<TestComponent />);
    capturedActions.error("approve", "Access denied");
    rerender(<TestComponent />);
    capturedActions.clearError("approve");
    rerender(<TestComponent />);
    expect(capturedState.approve.error).toBeNull();
    expect(capturedState.approve.isProcessing).toBe(false);
  });

  it("operations are independent", () => {
    const { rerender } = render(<TestComponent />);
    capturedActions.start("comment");
    capturedActions.error("react", "Failed");
    rerender(<TestComponent />);
    expect(capturedState.comment.isProcessing).toBe(true);
    expect(capturedState.react.error).toBe("Failed");
    expect(capturedState.reply.isProcessing).toBe(false);
  });
});
