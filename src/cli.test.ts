import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import packageJson from "../package.json";

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

describe("cli module-level execution", () => {
  it("passes profile, region, and repoName when provided in argv", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "cli", "--profile", "dev", "--region", "us-west-2", "my-repo"];
    vi.resetModules();

    const { render } = await import("ink");
    const { createClient } = await import("./services/codecommit.js");
    await import("./cli.js");

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ profile: "dev", region: "us-west-2" }),
    );
    expect(render).toHaveBeenCalled();

    process.argv = originalArgv;
  });

  it("exits with help text when --help is passed", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "cli", "--help"];
    vi.resetModules();

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("./cli.js");

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("review-codecommit"));
    expect(exitSpy).toHaveBeenCalledWith(0);

    logSpy.mockRestore();
    exitSpy.mockRestore();
    process.argv = originalArgv;
  });

  it("exits with version when --version is passed", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "cli", "--version"];
    vi.resetModules();

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("./cli.js");

    expect(logSpy).toHaveBeenCalledWith(packageJson.version);
    expect(exitSpy).toHaveBeenCalledWith(0);

    logSpy.mockRestore();
    exitSpy.mockRestore();
    process.argv = originalArgv;
  });
});

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

  it("parses --help flag", () => {
    const result = parseArgs(["node", "cli", "--help"]);
    expect(result.help).toBe(true);
  });

  it("parses -h flag", () => {
    const result = parseArgs(["node", "cli", "-h"]);
    expect(result.help).toBe(true);
  });

  it("parses --version flag", () => {
    const result = parseArgs(["node", "cli", "--version"]);
    expect(result.version).toBe(true);
  });

  it("parses -v flag", () => {
    const result = parseArgs(["node", "cli", "-v"]);
    expect(result.version).toBe(true);
  });

  it("parses --completions bash", () => {
    const result = parseArgs(["node", "cli", "--completions", "bash"]);
    expect(result.completions).toBe("bash");
  });

  it("parses --completions zsh", () => {
    const result = parseArgs(["node", "cli", "--completions", "zsh"]);
    expect(result.completions).toBe("zsh");
  });

  it("parses --completions fish", () => {
    const result = parseArgs(["node", "cli", "--completions", "fish"]);
    expect(result.completions).toBe("fish");
  });

  it("sets completions to empty string when no value (end of args)", () => {
    const result = parseArgs(["node", "cli", "--completions"]);
    expect(result.completions).toBe("");
  });

  it("parses --completions with other options", () => {
    const result = parseArgs(["node", "cli", "--completions", "bash", "--profile", "dev"]);
    expect(result.completions).toBe("bash");
    expect(result.profile).toBe("dev");
  });

  it("does not consume flag as completions value", () => {
    const result = parseArgs(["node", "cli", "--completions", "--help"]);
    expect(result.completions).toBe("");
    expect(result.help).toBe(true);
  });

  it("does not consume --profile flag as completions value", () => {
    const result = parseArgs(["node", "cli", "--completions", "--profile", "dev"]);
    expect(result.completions).toBe("");
    expect(result.profile).toBe("dev");
  });

  it("parses --completions with invalid value (validation is not parseArgs responsibility)", () => {
    const result = parseArgs(["node", "cli", "--completions", "invalid"]);
    expect(result.completions).toBe("invalid");
  });
});

// --- Property-Based Tests ---

const argWord = fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-_"), {
  minLength: 1,
  maxLength: 20,
});

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
      fc.property(fc.array(argWord, { minLength: 0, maxLength: 5 }), (extraArgs) => {
        const argv = ["node", "cli", ...extraArgs];
        const result = parseArgs(argv);
        if (result.profile !== undefined) {
          expect(argv).toContain(result.profile);
        }
      }),
    );
  });

  it("region value comes from the input array", () => {
    fc.assert(
      fc.property(fc.array(argWord, { minLength: 0, maxLength: 5 }), (extraArgs) => {
        const argv = ["node", "cli", ...extraArgs];
        const result = parseArgs(argv);
        if (result.region !== undefined) {
          expect(argv).toContain(result.region);
        }
      }),
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

  it("correctly round-trips --completions value", () => {
    const nonFlagWord = fc
      .stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789_"), {
        minLength: 1,
        maxLength: 20,
      });
    fc.assert(
      fc.property(nonFlagWord, (shellVal) => {
        const result = parseArgs(["node", "cli", "--completions", shellVal]);
        expect(result.completions).toBe(shellVal);
      }),
    );
  });

  it("sets completions to empty string when next arg is a flag", () => {
    fc.assert(
      fc.property(argWord, (flagName) => {
        const result = parseArgs(["node", "cli", "--completions", `--${flagName}`]);
        expect(result.completions).toBe("");
      }),
    );
  });
});
