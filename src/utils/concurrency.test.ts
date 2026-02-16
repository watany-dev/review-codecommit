import { describe, expect, it } from "vitest";
import { mapWithLimit } from "./concurrency.js";

describe("mapWithLimit", () => {
  it("returns mapped results in original order", async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await mapWithLimit(items, 2, async (n) => n * 10);
    expect(result).toEqual([10, 20, 30, 40, 50]);
  });

  it("handles empty array", async () => {
    const result = await mapWithLimit([], 5, async (n: number) => n);
    expect(result).toEqual([]);
  });

  it("handles single item", async () => {
    const result = await mapWithLimit([42], 3, async (n) => n.toString());
    expect(result).toEqual(["42"]);
  });

  it("limits concurrency to the specified value", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);

    await mapWithLimit(items, 3, async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      // Yield control to allow other tasks to start if concurrency is broken
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return n;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThanOrEqual(1);
  });

  it("works when concurrency exceeds item count", async () => {
    const items = [1, 2];
    const result = await mapWithLimit(items, 100, async (n) => n + 1);
    expect(result).toEqual([2, 3]);
  });

  it("propagates errors from the mapping function", async () => {
    const items = [1, 2, 3];
    await expect(
      mapWithLimit(items, 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
  });
});
