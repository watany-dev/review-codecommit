import { render } from "ink";
import React from "react";
import { App } from "./app.js";
import { createClient } from "./services/codecommit.js";

interface StartOptions {
  profile?: string;
  region?: string;
  repoName?: string;
}

/**
 * TUI entry point, loaded dynamically from cli.tsx so that --help/--version/
 * --completions never pay for evaluating ink, React, and the AWS SDK.
 */
export function startTui(options: StartOptions): void {
  const client = createClient({
    ...(options.profile != null ? { profile: options.profile } : {}),
    ...(options.region != null ? { region: options.region } : {}),
  });

  render(
    <App
      client={client}
      {...(options.repoName != null ? { initialRepo: options.repoName } : {})}
    />,
  );
}
