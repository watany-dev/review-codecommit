export const CODECOMMIT_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "af-south-1",
  "ap-east-1",
  "ap-south-1",
  "ap-south-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-southeast-3",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-northeast-3",
  "ca-central-1",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-south-1",
  "eu-north-1",
  "il-central-1",
  "me-south-1",
  "me-central-1",
  "sa-east-1",
] as const;

export type ShellType = "bash" | "zsh" | "fish";

export function isValidShellType(value: string): value is ShellType {
  return value === "bash" || value === "zsh" || value === "fish";
}

export function parseAwsProfiles(configContent: string): string[] {
  const profiles: string[] = [];
  for (const line of configContent.split("\n")) {
    const trimmed = line.trim();
    const profileMatch = trimmed.match(/^\[profile\s+(.+?)\]$/);
    if (profileMatch?.[1]) {
      profiles.push(profileMatch[1]);
      continue;
    }
    if (trimmed === "[default]") {
      profiles.push("default");
    }
  }
  return profiles.sort();
}
