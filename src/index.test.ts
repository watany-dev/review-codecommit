import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { greet } from "./index.js";

describe("greet", () => {
  it("returns greeting with name", () => {
    expect(greet("titmouse")).toBe("Hello, titmouse!");
  });

  it("property: always starts with Hello", () => {
    fc.assert(
      fc.property(fc.string(), (name) => {
        expect(greet(name)).toMatch(/^Hello, /);
      }),
    );
  });

  it("property: always ends with !", () => {
    fc.assert(
      fc.property(fc.string(), (name) => {
        expect(greet(name)).toMatch(/!$/);
      }),
    );
  });
});
