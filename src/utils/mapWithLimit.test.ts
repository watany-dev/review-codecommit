import fc from "fast-check";
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

// --- Property-Based Tests ---

describe("mapWithLimit (property-based)", () => {
  it("always returns array of same length as input", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer(), { maxLength: 20 }),
        fc.integer({ min: 1, max: 10 }),
        async (items, limit) => {
          const result = await mapWithLimit(items, limit, async (x) => x);
          expect(result).toHaveLength(items.length);
        },
      ),
    );
  });

  it("preserves input order regardless of concurrency limit", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer(), { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 10 }),
        async (items, limit) => {
          const result = await mapWithLimit(items, limit, async (x) => x);
          expect(result).toEqual(items);
        },
      ),
    );
  });

  it("with limit=1, processes at most 1 item concurrently", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer(), { minLength: 1, maxLength: 10 }), async (items) => {
        let running = 0;
        let maxRunning = 0;
        await mapWithLimit(items, 1, async (x) => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await Promise.resolve();
          running--;
          return x;
        });
        expect(maxRunning).toBeLessThanOrEqual(1);
      }),
    );
  });
});
