#!/usr/bin/env node
import React from "react";
import { render } from "ink";
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
    if (args[i] === "--profile" && args[i + 1]) {
      result.profile = args[i + 1];
      i++;
    } else if (args[i] === "--region" && args[i + 1]) {
      result.region = args[i + 1];
      i++;
    } else if (!args[i].startsWith("-")) {
      result.repoName = args[i];
    }
  }

  return result;
}

const parsed = parseArgs(process.argv);
const client = createClient({
  profile: parsed.profile,
  region: parsed.region,
});

render(<App client={client} initialRepo={parsed.repoName} />);
