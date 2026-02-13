#!/usr/bin/env node
import { render } from "ink";
import React from "react";
import { App } from "./app.js";
import { createClient } from "./services/codecommit.js";

interface ParsedArgs {
  repoName?: string;
  profile?: string;
  region?: string;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    if (arg === "--profile" && nextArg) {
      result.profile = nextArg;
      i++;
    } else if (arg === "--region" && nextArg) {
      result.region = nextArg;
      i++;
    } else if (arg && !arg.startsWith("-")) {
      result.repoName = arg;
    }
  }

  return result;
}

const parsed = parseArgs(process.argv);
const client = createClient({
  ...(parsed.profile != null ? { profile: parsed.profile } : {}),
  ...(parsed.region != null ? { region: parsed.region } : {}),
});

render(
  <App client={client} {...(parsed.repoName != null ? { initialRepo: parsed.repoName } : {})} />,
);
