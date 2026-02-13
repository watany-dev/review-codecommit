import { describe, it, expect } from "vitest";
import { App, createClient } from "./index.js";

describe("index exports", () => {
  it("exports App component", () => {
    expect(App).toBeDefined();
  });

  it("exports createClient function", () => {
    expect(createClient).toBeDefined();
    expect(typeof createClient).toBe("function");
  });
});
