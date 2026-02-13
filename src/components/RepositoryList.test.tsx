import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { RepositoryList } from "./RepositoryList.js";

describe("RepositoryList", () => {
  const repos = [
    { repositoryName: "my-service", repositoryId: "1" },
    { repositoryName: "my-frontend", repositoryId: "2" },
    { repositoryName: "shared-lib", repositoryId: "3" },
  ];

  it("renders repository names", () => {
    const { lastFrame } = render(
      <RepositoryList
        repositories={repos}
        onSelect={vi.fn()}
        onQuit={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("my-service");
    expect(output).toContain("my-frontend");
    expect(output).toContain("shared-lib");
  });

  it("shows select header", () => {
    const { lastFrame } = render(
      <RepositoryList
        repositories={repos}
        onSelect={vi.fn()}
        onQuit={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("Select Repository:");
  });

  it("shows navigation hints", () => {
    const { lastFrame } = render(
      <RepositoryList
        repositories={repos}
        onSelect={vi.fn()}
        onQuit={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("navigate");
    expect(lastFrame()).toContain("select");
    expect(lastFrame()).toContain("quit");
  });

  it("highlights first item by default", () => {
    const { lastFrame } = render(
      <RepositoryList
        repositories={repos}
        onSelect={vi.fn()}
        onQuit={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("> my-service");
  });
});
