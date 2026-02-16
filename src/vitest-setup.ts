import { vi } from "vitest";

// Reduce default vi.waitFor polling interval from 50ms to 10ms.
// The default 50ms interval causes ~27s of idle polling across 541 calls.
// After each successful poll, flush pending microtasks so React effects
// (e.g. useInput handler re-registration) complete before the test continues.
const originalWaitFor = vi.waitFor.bind(vi);
const flushEffects = () => new Promise<void>((r) => setTimeout(r, 0));
Object.assign(vi, {
  waitFor: async (
    callback: () => unknown,
    options?: number | { timeout?: number; interval?: number },
  ) => {
    const opts =
      typeof options === "number"
        ? { timeout: options, interval: 10 }
        : { interval: 10, ...options };
    const result = await originalWaitFor(callback, opts);
    await flushEffects();
    return result;
  },
});
