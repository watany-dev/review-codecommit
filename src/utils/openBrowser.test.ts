import { afterEach, describe, expect, it, vi } from "vitest";
import { openBrowser } from "./openBrowser.js";

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

describe("openBrowser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls exec with xdg-open on linux", async () => {
    const { exec } = await import("node:child_process");
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux" });

    openBrowser("https://example.com");

    expect(exec).toHaveBeenCalledWith('xdg-open "https://example.com"');

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("calls exec with open on macOS", async () => {
    const { exec } = await import("node:child_process");
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin" });

    openBrowser("https://example.com");

    expect(exec).toHaveBeenCalledWith('open "https://example.com"');

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("calls exec with start on Windows", async () => {
    const { exec } = await import("node:child_process");
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32" });

    openBrowser("https://example.com");

    expect(exec).toHaveBeenCalledWith('start "https://example.com"');

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });
});
