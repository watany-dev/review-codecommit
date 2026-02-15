import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CODECOMMIT_REGIONS,
  type ShellType,
  isValidShellType,
  parseAwsProfiles,
} from "./completions.js";

describe("CODECOMMIT_REGIONS", () => {
  it("contains known CodeCommit regions", () => {
    expect(CODECOMMIT_REGIONS).toContain("us-east-1");
    expect(CODECOMMIT_REGIONS).toContain("ap-northeast-1");
    expect(CODECOMMIT_REGIONS).toContain("eu-west-1");
  });

  it("has more than 20 regions", () => {
    expect(CODECOMMIT_REGIONS.length).toBeGreaterThan(20);
  });

  it("contains only unique values", () => {
    const unique = new Set(CODECOMMIT_REGIONS);
    expect(unique.size).toBe(CODECOMMIT_REGIONS.length);
  });
});

describe("isValidShellType", () => {
  it("returns true for bash", () => {
    expect(isValidShellType("bash")).toBe(true);
  });

  it("returns true for zsh", () => {
    expect(isValidShellType("zsh")).toBe(true);
  });

  it("returns true for fish", () => {
    expect(isValidShellType("fish")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidShellType("")).toBe(false);
  });

  it("returns false for invalid value", () => {
    expect(isValidShellType("powershell")).toBe(false);
  });

  it("returns false for uppercase", () => {
    expect(isValidShellType("BASH")).toBe(false);
  });
});

describe("parseAwsProfiles", () => {
  it("parses default profile only", () => {
    const config = "[default]\nregion=us-east-1";
    expect(parseAwsProfiles(config)).toEqual(["default"]);
  });

  it("parses named profile", () => {
    const config = "[profile dev]\nregion=us-east-1";
    expect(parseAwsProfiles(config)).toEqual(["dev"]);
  });

  it("parses multiple profiles sorted alphabetically", () => {
    const config = "[default]\n[profile dev]\n[profile prod]";
    expect(parseAwsProfiles(config)).toEqual(["default", "dev", "prod"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseAwsProfiles("")).toEqual([]);
  });

  it("returns empty array when no section headers", () => {
    const config = "region=us-east-1\noutput=json";
    expect(parseAwsProfiles(config)).toEqual([]);
  });

  it("parses profile name with spaces", () => {
    const config = "[profile my profile]";
    expect(parseAwsProfiles(config)).toEqual(["my profile"]);
  });

  it("ignores comment lines", () => {
    const config = "# comment\n[default]";
    expect(parseAwsProfiles(config)).toEqual(["default"]);
  });

  it("ignores invalid section headers", () => {
    const config = "[invalid]";
    expect(parseAwsProfiles(config)).toEqual([]);
  });

  it("sorts profiles alphabetically", () => {
    const config = "[profile zebra]\n[profile alpha]";
    expect(parseAwsProfiles(config)).toEqual(["alpha", "zebra"]);
  });

  it("excludes sso-session sections", () => {
    const config = "[sso-session my-sso]\n[profile sso-user]";
    expect(parseAwsProfiles(config)).toEqual(["sso-user"]);
  });
});

// Property-Based Tests
describe("parseAwsProfiles (property-based)", () => {
  it("never throws on arbitrary strings", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (input) => {
        expect(() => parseAwsProfiles(input)).not.toThrow();
      }),
    );
  });

  it("always returns a sorted array", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (input) => {
        const result = parseAwsProfiles(input);
        const sorted = [...result].sort();
        expect(result).toEqual(sorted);
      }),
    );
  });
});
