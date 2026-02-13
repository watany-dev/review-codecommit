import { describe, it, expect, vi } from "vitest";

vi.mock("ink", () => ({
  render: vi.fn(),
}));

vi.mock("./app.js", () => ({
  App: () => null,
}));

vi.mock("./services/codecommit.js", () => ({
  createClient: vi.fn(() => ({})),
}));

import { parseArgs } from "./cli.js";

describe("parseArgs", () => {
  it("parses --profile flag", () => {
    const result = parseArgs(["node", "cli", "--profile", "dev"]);
    expect(result.profile).toBe("dev");
  });

  it("parses --region flag", () => {
    const result = parseArgs(["node", "cli", "--region", "us-east-1"]);
    expect(result.region).toBe("us-east-1");
  });

  it("parses repo name as positional argument", () => {
    const result = parseArgs(["node", "cli", "my-service"]);
    expect(result.repoName).toBe("my-service");
  });

  it("parses all arguments together", () => {
    const result = parseArgs([
      "node",
      "cli",
      "--profile",
      "prod",
      "--region",
      "ap-northeast-1",
      "my-repo",
    ]);
    expect(result.profile).toBe("prod");
    expect(result.region).toBe("ap-northeast-1");
    expect(result.repoName).toBe("my-repo");
  });

  it("returns empty result with no arguments", () => {
    const result = parseArgs(["node", "cli"]);
    expect(result.profile).toBeUndefined();
    expect(result.region).toBeUndefined();
    expect(result.repoName).toBeUndefined();
  });

  it("ignores --profile without value", () => {
    const result = parseArgs(["node", "cli", "--profile"]);
    expect(result.profile).toBeUndefined();
  });

  it("ignores --region without value", () => {
    const result = parseArgs(["node", "cli", "--region"]);
    expect(result.region).toBeUndefined();
  });

  it("ignores unknown flags", () => {
    const result = parseArgs(["node", "cli", "--unknown", "value"]);
    expect(result.repoName).toBe("value");
  });
});
