#!/usr/bin/env node
import { render } from "ink";
import React from "react";
import packageJson from "../package.json";
import { App } from "./app.js";
import { generateCompletion, isValidShellType } from "./completions.js";
import { createClient } from "./services/codecommit.js";

interface ParsedArgs {
  repoName?: string;
  profile?: string;
  region?: string;
  help?: boolean;
  version?: boolean;
  completions?: string;
}

const VERSION = packageJson.version;

const HELP_TEXT = `review-codecommit - A TUI tool for reviewing AWS CodeCommit pull requests

Usage: review-codecommit [options] [repository]

Options:
  --profile <name>       AWS profile to use
  --region <region>       AWS region to use
  --completions <shell>   Generate completion script (bash, zsh, fish)
  --help, -h              Show this help message
  --version, -v           Show version number

Navigation:
  j/k or arrows       Move cursor
  Enter               Select item
  Esc/q               Go back / quit
  ?                   Show help`;

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--version" || arg === "-v") {
      result.version = true;
    } else if (arg === "--profile" && nextArg) {
      result.profile = nextArg;
      i++;
    } else if (arg === "--region" && nextArg) {
      result.region = nextArg;
      i++;
    } else if (arg === "--completions") {
      if (nextArg && !nextArg.startsWith("-")) {
        result.completions = nextArg;
        i++;
      } else {
        result.completions = "";
      }
    } else if (arg && !arg.startsWith("-")) {
      result.repoName = arg;
    }
  }

  return result;
}

const parsed = parseArgs(process.argv);

if (parsed.help) {
  console.log(HELP_TEXT);
  process.exit(0);
}

if (parsed.version) {
  console.log(VERSION);
  process.exit(0);
}

if (parsed.completions !== undefined) {
  if (!isValidShellType(parsed.completions)) {
    console.error(
      `Invalid shell type: "${parsed.completions}". Use bash, zsh, or fish.`,
    );
    process.exit(1);
  }
  console.log(generateCompletion(parsed.completions));
  process.exit(0);
}

const client = createClient({
  ...(parsed.profile != null ? { profile: parsed.profile } : {}),
  ...(parsed.region != null ? { region: parsed.region } : {}),
});

render(
  <App client={client} {...(parsed.repoName != null ? { initialRepo: parsed.repoName } : {})} />,
);
