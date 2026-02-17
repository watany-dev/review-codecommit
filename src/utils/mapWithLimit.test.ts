import { describe, expect, it } from "vitest";
import { mapWithLimit } from "./mapWithLimit.js";

describe("mapWithLimit", () => {
  it("maps all items and preserves order", async () => {
    const result = await mapWithLimit([1, 2, 3], 2, async (x) => x * 10);
    expect(result).toEqual([10, 20, 30]);
  });

  it("limits concurrency to specified value", async () => {
    let running = 0;
    let maxRunning = 0;

    const result = await mapWithLimit([1, 2, 3, 4, 5], 2, async (x) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 10));
      running--;
      return x;
    });

    expect(result).toEqual([1, 2, 3, 4, 5]);
    expect(maxRunning).toBe(2);
  });

  it("handles empty array", async () => {
    const result = await mapWithLimit([], 5, async (x: number) => x);
    expect(result).toEqual([]);
  });

  it("handles limit larger than items", async () => {
    const result = await mapWithLimit([1, 2], 10, async (x) => x * 2);
    expect(result).toEqual([2, 4]);
  });

  it("propagates errors", async () => {
    await expect(
      mapWithLimit([1, 2, 3], 2, async (x) => {
        if (x === 2) throw new Error("fail");
        return x;
      }),
    ).rejects.toThrow("fail");
  });
});
