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

  it("does not call onSelect when repositoryName is missing", () => {
    const onSelect = vi.fn();
    const reposNoName = [{ repositoryId: "1" } as any];
    const { stdin } = render(
      <RepositoryList
        repositories={reposNoName}
        onSelect={onSelect}
        onQuit={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    stdin.write("\r");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("moves cursor down with j and clamps at the last item", async () => {
    const { lastFrame, stdin } = render(
      <RepositoryList repositories={repos} onSelect={vi.fn()} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> my-frontend");
    });
    stdin.write("j");
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> shared-lib");
      expect(lastFrame()).not.toContain("> my-service");
      expect(lastFrame()).not.toContain("> my-frontend");
    });
  });

  it("moves cursor up with k and clamps at the first item", async () => {
    const { lastFrame, stdin } = render(
      <RepositoryList repositories={repos} onSelect={vi.fn()} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> my-frontend");
    });
    stdin.write("k");
    stdin.write("k");
    stdin.write("k");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> my-service");
      expect(lastFrame()).not.toContain("> my-frontend");
    });
  });

  it("calls onQuit on escape", () => {
    const onQuit = vi.fn();
    const { stdin } = render(
      <RepositoryList repositories={repos} onSelect={vi.fn()} onQuit={onQuit} onHelp={vi.fn()} />,
    );
    stdin.write("\u001B");
    expect(onQuit).toHaveBeenCalled();
  });

  it("does nothing on an unrelated key", () => {
    const onSelect = vi.fn();
    const onQuit = vi.fn();
    const onHelp = vi.fn();
    const { lastFrame, stdin } = render(
      <RepositoryList
        repositories={repos}
        onSelect={onSelect}
        onQuit={onQuit}
        onHelp={onHelp}
      />,
    );
    stdin.write("x");
    expect(onSelect).not.toHaveBeenCalled();
    expect(onQuit).not.toHaveBeenCalled();
    expect(onHelp).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("> my-service");
  });

  it("handles an empty repository list", () => {
    const onSelect = vi.fn();
    const { lastFrame, stdin } = render(
      <RepositoryList repositories={[]} onSelect={onSelect} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    expect(lastFrame()).toContain("Select Repository:");
    expect(lastFrame()).not.toContain("> ");
    stdin.write("\r");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps cursor at 0 after pressing j on an empty list and items arrive", async () => {
    const { lastFrame, stdin, rerender } = render(
      <RepositoryList repositories={[]} onSelect={vi.fn()} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    stdin.write("j");
    await vi.waitFor(() => expect(lastFrame()).not.toContain("> "));
    rerender(
      <RepositoryList repositories={repos} onSelect={vi.fn()} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> my-service");
      expect(lastFrame()).not.toContain("> my-frontend");
    });
  });

  it("selects the first item with enter after j on an empty list and items arrive", async () => {
    const onSelect = vi.fn();
    const { stdin, rerender } = render(
      <RepositoryList repositories={[]} onSelect={onSelect} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    stdin.write("j");
    await new Promise((resolve) => setTimeout(resolve, 20));
    rerender(
      <RepositoryList repositories={repos} onSelect={onSelect} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    stdin.write("\r");
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith("my-service"));
  });

  it("clamps cursor when items shrink below the cursor position", async () => {
    const { lastFrame, stdin, rerender } = render(
      <RepositoryList repositories={repos} onSelect={vi.fn()} onQuit={vi.fn()} onHelp={vi.fn()} />,
    );
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => expect(lastFrame()).toContain("> shared-lib"));
    rerender(
      <RepositoryList
        repositories={[repos[0]!]}
        onSelect={vi.fn()}
        onQuit={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("> my-service");
      expect(lastFrame()).not.toContain("shared-lib");
    });
  });
});
