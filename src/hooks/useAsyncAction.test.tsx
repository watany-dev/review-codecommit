import { Text } from "ink";
import { render } from "ink-testing-library";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useAsyncAction } from "./useAsyncAction.js";

function TestComponent({
  action,
  formatError,
  onResult,
}: {
  action: (...args: string[]) => Promise<void>;
  formatError?: (err: unknown, ...args: string[]) => string;
  onResult?: (result: ReturnType<typeof useAsyncAction<string[]>>) => void;
}) {
  const result = useAsyncAction(action, formatError);
  onResult?.(result);
  return <Text>{`processing: ${result.isProcessing}, error: ${result.error ?? "null"}`}</Text>;
}

describe("useAsyncAction", () => {
  it("starts with isProcessing=false and error=null", () => {
    const action = vi.fn().mockResolvedValue(undefined);
    let captured: ReturnType<typeof useAsyncAction<string[]>> | undefined;
    render(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );
    expect(captured!.isProcessing).toBe(false);
    expect(captured!.error).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("sets isProcessing=true while action is pending, then false after resolution", async () => {
    let resolve!: () => void;
    const action = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolve = res;
        }),
    );

    let captured: ReturnType<typeof useAsyncAction<string[]>> | undefined;
    const { rerender } = render(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    captured!.execute();
    // Allow state update to propagate
    rerender(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );
    expect(captured!.isProcessing).toBe(true);
    expect(captured!.error).toBeNull();

    resolve();
    await new Promise((r) => setTimeout(r, 0));
    rerender(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );
    expect(captured!.isProcessing).toBe(false);
    expect(captured!.error).toBeNull();
  });

  it("sets error when action throws", async () => {
    const action = vi.fn().mockRejectedValue(new Error("something went wrong"));
    let captured: ReturnType<typeof useAsyncAction<string[]>> | undefined;
    const { rerender } = render(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    captured!.execute();
    await new Promise((r) => setTimeout(r, 0));
    rerender(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );
    expect(captured!.isProcessing).toBe(false);
    expect(captured!.error).toContain("something went wrong");
  });

  it("uses custom formatError when provided", async () => {
    const action = vi.fn().mockRejectedValue(new Error("raw error"));
    const formatError = vi.fn().mockReturnValue("formatted error");
    let captured: ReturnType<typeof useAsyncAction<string[]>> | undefined;
    const { rerender } = render(
      <TestComponent
        action={action}
        formatError={formatError}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    captured!.execute();
    await new Promise((r) => setTimeout(r, 0));
    rerender(
      <TestComponent
        action={action}
        formatError={formatError}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );
    expect(captured!.error).toBe("formatted error");
    expect(formatError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("clearError resets error to null", async () => {
    const action = vi.fn().mockRejectedValue(new Error("oops"));
    let captured: ReturnType<typeof useAsyncAction<string[]>> | undefined;
    const { rerender } = render(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    captured!.execute();
    await new Promise((r) => setTimeout(r, 0));
    rerender(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );
    expect(captured!.error).not.toBeNull();

    captured!.clearError();
    rerender(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );
    expect(captured!.error).toBeNull();
  });

  it("passes arguments through to the action", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    let captured: ReturnType<typeof useAsyncAction<string[]>> | undefined;
    render(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    captured!.execute("arg1", "arg2");
    await new Promise((r) => setTimeout(r, 0));
    expect(action).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("clears error at the start of a new execute call", async () => {
    let callCount = 0;
    const action = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) throw new Error("first failure");
    });

    let captured: ReturnType<typeof useAsyncAction<string[]>> | undefined;
    const { rerender } = render(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    // First call fails
    captured!.execute();
    await new Promise((r) => setTimeout(r, 0));
    rerender(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );
    expect(captured!.error).not.toBeNull();

    // Second call succeeds — error should clear
    captured!.execute();
    await new Promise((r) => setTimeout(r, 0));
    rerender(
      <TestComponent
        action={action}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );
    expect(captured!.error).toBeNull();
  });

  it("passes action args to formatError on failure", async () => {
    const action = vi.fn().mockRejectedValue(new Error("fail"));
    const formatError = vi.fn((_err: unknown, ..._args: string[]) => "formatted");
    let captured: ReturnType<typeof useAsyncAction<string[]>> | undefined;
    const { rerender } = render(
      <TestComponent
        action={action}
        formatError={formatError}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    captured!.execute("arg1", "arg2");
    await new Promise((r) => setTimeout(r, 0));
    rerender(
      <TestComponent
        action={action}
        formatError={formatError}
        onResult={(r) => {
          captured = r;
        }}
      />,
    );
    expect(formatError).toHaveBeenCalledWith(expect.any(Error), "arg1", "arg2");
  });

  it("uses latest action closure on each execute", async () => {
    function TestWithState() {
      const [count, setCount] = useState(0);
      const { execute } = useAsyncAction(async () => {
        setCount((c) => c + 1);
      });
      return (
        <Text
          onClick={() => {
            execute();
          }}
        >{`count: ${count}`}</Text>
      );
    }

    const { lastFrame } = render(<TestWithState />);
    expect(lastFrame()).toContain("count: 0");
  });
});
