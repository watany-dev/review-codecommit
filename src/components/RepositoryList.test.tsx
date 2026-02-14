import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { RepositoryList } from "./RepositoryList.js";

describe("RepositoryList", () => {
  const repos = [
    { repositoryName: "my-service", repositoryId: "1" },
    { repositoryName: "my-frontend", repositoryId: "2" },
    { repositoryName: "shared-lib", repositoryId: "3" },
  ];

  it("renders repository names", () => {
    const { lastFrame } = render(
      <RepositoryList repositories={repos} onSelect={vi.fn()} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    const output = lastFrame();
    expect(output).toContain("my-service");
    expect(output).toContain("my-frontend");
    expect(output).toContain("shared-lib");
  });

  it("shows select header", () => {
    const { lastFrame } = render(
      <RepositoryList repositories={repos} onSelect={vi.fn()} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    expect(lastFrame()).toContain("Select Repository:");
  });

  it("shows navigation hints", () => {
    const { lastFrame } = render(
      <RepositoryList repositories={repos} onSelect={vi.fn()} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    expect(lastFrame()).toContain("navigate");
    expect(lastFrame()).toContain("select");
    expect(lastFrame()).toContain("quit");
  });

  it("highlights first item by default", () => {
    const { lastFrame } = render(
      <RepositoryList repositories={repos} onSelect={vi.fn()} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    expect(lastFrame()).toContain("> my-service");
    // Non-selected items should have no cursor prefix
    expect(lastFrame()).toContain("  my-frontend");
    expect(lastFrame()).toContain("  shared-lib");
  });

  it("calls onSelect on enter", () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <RepositoryList repositories={repos} onSelect={onSelect} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    stdin.write("\r");
    expect(onSelect).toHaveBeenCalledWith("my-service");
  });

  it("calls onQuit on q key", () => {
    const onQuit = vi.fn();
    const { stdin } = render(
      <RepositoryList repositories={repos} onSelect={vi.fn()} onQuit={onQuit} onHelp={vi.fn()} />,
    );
    stdin.write("q");
    expect(onQuit).toHaveBeenCalled();
  });

  it("renders repos with missing repositoryId", () => {
    const reposNoId = [
      { repositoryName: "no-id-repo" },
      { repositoryName: "another-repo", repositoryId: "x" },
    ];
    const { lastFrame } = render(
      <RepositoryList
        repositories={reposNoId as any}
        onSelect={vi.fn()}
        onQuit={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("no-id-repo");
    expect(lastFrame()).toContain("another-repo");
  });

  it("calls onHelp on ? key", () => {
    const onHelp = vi.fn();
    const { stdin } = render(
      <RepositoryList repositories={repos} onSelect={vi.fn()} onQuit={vi.fn()} onHelp={onHelp} />,
    );
    stdin.write("?");
    expect(onHelp).toHaveBeenCalled();
  });

  it("handles repos with missing repositoryId", () => {
    const reposNoId = [
      { repositoryName: "no-id-repo" } as any,
      { repositoryName: "another-repo", repositoryId: undefined } as any,
    ];
    const { lastFrame } = render(
      <RepositoryList
        repositories={reposNoId}
        onSelect={vi.fn()}
        onQuit={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("no-id-repo");
    expect(lastFrame()).toContain("another-repo");
  });
});
