import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";

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

// --- Property-Based Tests ---

const argWord = fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-_"), { minLength: 1, maxLength: 20 });

describe("parseArgs (property-based)", () => {
  it("never throws on arbitrary string arrays", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 0, maxLength: 30 }), { minLength: 2, maxLength: 10 }),
        (argv) => {
          expect(() => parseArgs(argv)).not.toThrow();
        },
      ),
    );
  });

  it("profile value comes from the input array", () => {
    fc.assert(
      fc.property(
        fc.array(argWord, { minLength: 0, maxLength: 5 }),
        (extraArgs) => {
          const argv = ["node", "cli", ...extraArgs];
          const result = parseArgs(argv);
          if (result.profile !== undefined) {
            expect(argv).toContain(result.profile);
          }
        },
      ),
    );
  });

  it("region value comes from the input array", () => {
    fc.assert(
      fc.property(
        fc.array(argWord, { minLength: 0, maxLength: 5 }),
        (extraArgs) => {
          const argv = ["node", "cli", ...extraArgs];
          const result = parseArgs(argv);
          if (result.region !== undefined) {
            expect(argv).toContain(result.region);
          }
        },
      ),
    );
  });

  it("correctly round-trips --profile value", () => {
    fc.assert(
      fc.property(argWord, (profileVal) => {
        const result = parseArgs(["node", "cli", "--profile", profileVal]);
        expect(result.profile).toBe(profileVal);
      }),
    );
  });

  it("correctly round-trips --region value", () => {
    fc.assert(
      fc.property(argWord, (regionVal) => {
        const result = parseArgs(["node", "cli", "--region", regionVal]);
        expect(result.region).toBe(regionVal);
      }),
    );
  });
});
