import { describe, expect, it } from "vitest";
import { buildConsoleUrl } from "./consoleUrl.js";

describe("buildConsoleUrl", () => {
  it("builds correct CodeCommit console URL", () => {
    const url = buildConsoleUrl("ap-northeast-1", "my-repo", "42");
    expect(url).toBe(
      "https://ap-northeast-1.console.aws.amazon.com/codesuite/codecommit/repositories/my-repo/pull-requests/42/details",
    );
  });

  it("encodes special characters in repository name", () => {
    const url = buildConsoleUrl("us-east-1", "my repo/special", "1");
    expect(url).toContain("my%20repo%2Fspecial");
  });

  it("works with different regions", () => {
    const url = buildConsoleUrl("eu-west-1", "repo", "99");
    expect(url.startsWith("https://eu-west-1.console.aws.amazon.com/")).toBe(true);
  });
});
