import { afterEach, describe, expect, it, vi } from "vitest";
import { createBatcher } from "./batchUpdates.js";

describe("createBatcher", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies all items enqueued within the delay as a single batch", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const batcher = createBatcher<number>(apply, 16);

    batcher.enqueue(1);
    batcher.enqueue(2);
    batcher.enqueue(3);
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(16);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("starts a new window after a flush from the timer", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const batcher = createBatcher<string>(apply, 16);

    batcher.enqueue("a");
    vi.advanceTimersByTime(16);
    batcher.enqueue("b");
    vi.advanceTimersByTime(16);

    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenNthCalledWith(1, ["a"]);
    expect(apply).toHaveBeenNthCalledWith(2, ["b"]);
  });

  it("flush applies immediately and cancels the pending timer", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const batcher = createBatcher<number>(apply, 16);

    batcher.enqueue(1);
    batcher.enqueue(2);
    batcher.flush();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith([1, 2]);

    vi.advanceTimersByTime(16);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("flush is a no-op when nothing is pending", () => {
    const apply = vi.fn();
    const batcher = createBatcher<number>(apply, 16);
    batcher.flush();
    expect(apply).not.toHaveBeenCalled();
  });

  it("does not call apply when the timer fires on an empty queue", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const batcher = createBatcher<number>(apply, 16);

    batcher.enqueue(1);
    batcher.flush();
    vi.advanceTimersByTime(16);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
