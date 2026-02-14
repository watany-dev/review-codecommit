import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { PullRequestList } from "./PullRequestList.js";

describe("PullRequestList", () => {
  const pullRequests = [
    {
      pullRequestId: "42",
      title: "fix: login timeout",
      authorArn: "arn:aws:iam::123456789012:user/watany",
      creationDate: new Date("2026-02-13T10:00:00Z"),
      status: "OPEN" as const,
    },
    {
      pullRequestId: "43",
      title: "feat: add dashboard",
      authorArn: "arn:aws:iam::123456789012:user/taro",
      creationDate: new Date("2026-02-12T10:00:00Z"),
      status: "OPEN" as const,
    },
  ];

  it("renders pull request titles", () => {
    const { lastFrame } = render(
      <PullRequestList
        repositoryName="my-service"
        pullRequests={pullRequests}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("fix: login timeout");
    expect(output).toContain("feat: add dashboard");
  });

  it("shows repository name and PR count", () => {
    const { lastFrame } = render(
      <PullRequestList
        repositoryName="my-service"
        pullRequests={pullRequests}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    const output = lastFrame();
    expect(output).toContain("my-service");
    expect(output).toContain("Open Pull Requests (2)");
  });

  it("shows empty message when no PRs", () => {
    const { lastFrame } = render(
      <PullRequestList
        repositoryName="my-service"
        pullRequests={[]}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("No open pull requests");
  });

  it("highlights first item by default", () => {
    const { lastFrame } = render(
      <PullRequestList
        repositoryName="my-service"
        pullRequests={pullRequests}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("> ");
    expect(lastFrame()).toContain("#42");
  });

  it("shows navigation hints", () => {
    const { lastFrame } = render(
      <PullRequestList
        repositoryName="my-service"
        pullRequests={pullRequests}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("navigate");
    expect(lastFrame()).toContain("back");
    expect(lastFrame()).toContain("help");
  });

  it("navigates down with j key", () => {
    const { lastFrame, stdin } = render(
      <PullRequestList
        repositoryName="my-service"
        pullRequests={pullRequests}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    stdin.write("j");
    expect(lastFrame()).toContain("> ");
    expect(lastFrame()).toContain("#43");
  });

  it("navigates up with k key", () => {
    const { lastFrame, stdin } = render(
      <PullRequestList
        repositoryName="my-service"
        pullRequests={pullRequests}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    stdin.write("j"); // move down first
    stdin.write("k"); // move back up
    // cursor should be back at first item
    const output = lastFrame();
    expect(output).toContain("#42");
  });

  it("calls onSelect on enter", () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <PullRequestList
        repositoryName="my-service"
        pullRequests={pullRequests}
        onSelect={onSelect}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    stdin.write("\r");
    expect(onSelect).toHaveBeenCalledWith("42");
  });

  it("calls onBack on q key", () => {
    const onBack = vi.fn();
    const { stdin } = render(
      <PullRequestList
        repositoryName="my-service"
        pullRequests={pullRequests}
        onSelect={vi.fn()}
        onBack={onBack}
        onHelp={vi.fn()}
      />,
    );
    stdin.write("q");
    expect(onBack).toHaveBeenCalled();
  });

  it("calls onHelp on ? key", () => {
    const onHelp = vi.fn();
    const { stdin } = render(
      <PullRequestList
        repositoryName="my-service"
        pullRequests={pullRequests}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={onHelp}
      />,
    );
    stdin.write("?");
    expect(onHelp).toHaveBeenCalled();
  });

  it("does not go below last item", () => {
    const { lastFrame, stdin } = render(
      <PullRequestList
        repositoryName="my-service"
        pullRequests={pullRequests}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    stdin.write("j");
    stdin.write("j");
    stdin.write("j"); // try to go past end
    expect(lastFrame()).toContain("#43");
  });

  it("does not go above first item", () => {
    const { lastFrame, stdin } = render(
      <PullRequestList
        repositoryName="my-service"
        pullRequests={pullRequests}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onHelp={vi.fn()}
      />,
    );
    stdin.write("k"); // try to go above first
    expect(lastFrame()).toContain("#42");
  });
});
