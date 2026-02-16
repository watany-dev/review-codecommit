import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/index.ts"],
      thresholds: {
        statements: 95,
        branches: 93,
        functions: 95,
        lines: 95,
      },
      reporter: ["text", "lcov"],
    },
  },
});
