import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./services/codecommit.js", () => ({
  listRepositories: vi.fn(),
  listPullRequests: vi.fn(),
  getPullRequestDetail: vi.fn(),
  getBlobContent: vi.fn(),
  postComment: vi.fn(),
}));

import { App } from "./app.js";
import {
  getBlobContent,
  getPullRequestDetail,
  listPullRequests,
  listRepositories,
  postComment,
} from "./services/codecommit.js";

const mockClient = {} as any;

describe("App", () => {
  beforeEach(() => {
    vi.mocked(listRepositories).mockReset();
    vi.mocked(listPullRequests).mockReset();
    vi.mocked(getPullRequestDetail).mockReset();
    vi.mocked(getBlobContent).mockReset();
    vi.mocked(postComment).mockReset();
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    vi.mocked(listRepositories).mockReturnValue(new Promise(() => {}));
    const { lastFrame } = render(<App client={mockClient} />);
    expect(lastFrame()).toContain("Loading");
  });

  it("shows repository list after loading", async () => {
    vi.mocked(listRepositories).mockResolvedValue([
      { repositoryName: "my-service", repositoryId: "1" },
    ]);
    const { lastFrame } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("my-service");
    });
  });

  it("loads PRs when initialRepo is provided", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    const { lastFrame } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
  });

  // formatError tests for all error types
  it("shows auth error for CredentialsProviderError", async () => {
    const error = new Error("bad");
    error.name = "CredentialsProviderError";
    vi.mocked(listRepositories).mockRejectedValue(error);
    const { lastFrame } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("AWS authentication failed");
    });
  });

  it("shows auth error for CredentialError", async () => {
    const error = new Error("bad");
    error.name = "CredentialError";
    vi.mocked(listRepositories).mockRejectedValue(error);
    const { lastFrame } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("AWS authentication failed");
    });
  });

  it("shows repo not found error", async () => {
    const error = new Error("not found");
    error.name = "RepositoryDoesNotExistException";
    vi.mocked(listPullRequests).mockRejectedValue(error);
    const { lastFrame } = render(<App client={mockClient} initialRepo="missing" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Repository not found");
    });
  });

  it("shows access denied error", async () => {
    const error = new Error("no");
    error.name = "AccessDeniedException";
    vi.mocked(listRepositories).mockRejectedValue(error);
    const { lastFrame } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Access denied");
    });
  });

  it("shows unauthorized error", async () => {
    const error = new Error("no");
    error.name = "UnauthorizedException";
    vi.mocked(listRepositories).mockRejectedValue(error);
    const { lastFrame } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Access denied");
    });
  });

  it("shows network error for NetworkingError", async () => {
    const error = new Error("network fail");
    error.name = "NetworkingError";
    vi.mocked(listRepositories).mockRejectedValue(error);
    const { lastFrame } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Network error");
    });
  });

  it("shows network error for ECONNREFUSED", async () => {
    vi.mocked(listRepositories).mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:443"));
    const { lastFrame } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Network error");
    });
  });

  it("shows network error for ETIMEDOUT", async () => {
    vi.mocked(listRepositories).mockRejectedValue(new Error("connect ETIMEDOUT"));
    const { lastFrame } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Network error");
    });
  });

  it("shows generic error message", async () => {
    vi.mocked(listRepositories).mockRejectedValue(new Error("something went wrong"));
    const { lastFrame } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("something went wrong");
    });
  });

  it("shows generic message for non-Error values", async () => {
    vi.mocked(listRepositories).mockRejectedValue("raw string error");
    const { lastFrame } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("An unexpected error occurred");
    });
  });

  it("sanitizes ARN from error message", async () => {
    vi.mocked(listRepositories).mockRejectedValue(
      new Error("Resource arn:aws:codecommit:us-east-1:123456789012:my-repo not available"),
    );
    const { lastFrame } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      const frame = lastFrame() ?? "";
      expect(frame).toContain("[ARN]");
      expect(frame).not.toContain("arn:aws:");
      expect(frame).not.toContain("123456789012");
    });
  });

  // Screen navigation tests
  it("navigates from repos to PRs on selection", async () => {
    vi.mocked(listRepositories).mockResolvedValue([
      { repositoryName: "my-service", repositoryId: "1" },
    ]);
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    const { lastFrame, stdin } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("my-service");
    });

    stdin.write("\r"); // Enter to select
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
  });

  it("navigates from PRs to detail on selection", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [],
      },
      differences: [],
      comments: [],
    });

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r"); // Enter to select PR
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
  });

  it("navigates back from detail to PRs", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [],
      },
      differences: [],
      comments: [],
    });

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    stdin.write("q");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Open Pull Requests");
    });
  });

  it("calls process.exit when going back from PRs with initialRepo", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [],
    });
    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("No open pull requests");
    });

    stdin.write("q");
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it("navigates back from PRs to repos without initialRepo", async () => {
    vi.mocked(listRepositories).mockResolvedValue([
      { repositoryName: "my-service", repositoryId: "1" },
    ]);
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [],
    });
    const { lastFrame, stdin } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("my-service");
    });

    stdin.write("\r"); // select repo
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Open Pull Requests");
    });

    stdin.write("q"); // back to repos
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select Repository");
    });
  });

  it("calls process.exit from repos quit", async () => {
    vi.mocked(listRepositories).mockResolvedValue([
      { repositoryName: "my-service", repositoryId: "1" },
    ]);
    const { lastFrame, stdin } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("my-service");
    });

    stdin.write("q");
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it("shows help screen and returns", async () => {
    vi.mocked(listRepositories).mockResolvedValue([
      { repositoryName: "my-service", repositoryId: "1" },
    ]);
    const { lastFrame, stdin } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("my-service");
    });

    stdin.write("?");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Key Bindings");
    });
  });

  it("loads PR detail with blob content", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/fix",
          },
        ],
      },
      differences: [
        {
          beforeBlob: { blobId: "b1", path: "src/auth.ts" },
          afterBlob: { blobId: "b2", path: "src/auth.ts" },
        },
      ],
      comments: [],
    });
    vi.mocked(getBlobContent)
      .mockResolvedValueOnce("const timeout = 3000;")
      .mockResolvedValueOnce("const timeout = 10000;");

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
  });

  it("loads PR detail with only afterBlob", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "feat: new file",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "feat: new file",
        pullRequestTargets: [],
      },
      differences: [
        {
          beforeBlob: undefined,
          afterBlob: { blobId: "b2", path: "src/new.ts" },
        },
      ],
      comments: [],
    });
    vi.mocked(getBlobContent).mockResolvedValueOnce("const x = 1;");

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("feat: new file");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
  });

  it("shows error when PR detail loading fails", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockRejectedValue(new Error("failed to load"));

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("failed to load");
    });
  });

  it("shows error when loading PRs fails", async () => {
    vi.mocked(listPullRequests).mockRejectedValue(new Error("load failed"));
    const { lastFrame } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("load failed");
    });
  });

  it("loads PR detail with no blobs (deleted file)", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "chore: remove old",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "chore: remove old",
        pullRequestTargets: [],
      },
      differences: [
        {
          beforeBlob: { blobId: "b1", path: "src/old.ts" },
          afterBlob: undefined,
        },
      ],
      comments: [],
    });
    vi.mocked(getBlobContent).mockResolvedValueOnce("old content");

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("chore: remove old");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
  });

  it("shows help from PR list screen", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("?");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Key Bindings");
    });
  });

  it("shows help from PR detail screen", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [],
      },
      differences: [],
      comments: [],
    });

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    stdin.write("?");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Key Bindings");
    });
  });

  it("posts comment successfully and reloads comments", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "def456",
            sourceCommit: "abc123",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/fix",
          },
        ],
      },
      differences: [],
      comments: [],
    });
    vi.mocked(postComment).mockResolvedValue({
      commentId: "c1",
      content: "Looks good!",
      authorArn: "arn:aws:iam::123456789012:user/watany",
    });

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    // Enter comment mode and submit
    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });

    // Mock reload after post
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "def456",
            sourceCommit: "abc123",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/fix",
          },
        ],
      },
      differences: [],
      comments: [
        {
          commentId: "c1",
          content: "Looks good!",
          authorArn: "arn:aws:iam::123456789012:user/watany",
        },
      ],
    });

    stdin.write("Looks good!");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(postComment).toHaveBeenCalled();
    });
  });

  it("shows error when comment post fails", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "def456",
            sourceCommit: "abc123",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/fix",
          },
        ],
      },
      differences: [],
      comments: [],
    });

    const accessError = new Error("denied");
    accessError.name = "AccessDeniedException";
    vi.mocked(postComment).mockRejectedValue(accessError);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });

    stdin.write("test comment");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(lastFrame()).toContain("Failed to post comment:");
      expect(lastFrame()).toContain("Access denied");
    });
  });

  it("shows comment error for CommentContentRequiredException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "def456",
            sourceCommit: "abc123",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/fix",
          },
        ],
      },
      differences: [],
      comments: [],
    });
    const err = new Error("empty");
    err.name = "CommentContentRequiredException";
    vi.mocked(postComment).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });
    stdin.write("x");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(lastFrame()).toContain("Comment cannot be empty.");
    });
  });

  it("shows comment error for CommentContentSizeLimitExceededException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "def456",
            sourceCommit: "abc123",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/fix",
          },
        ],
      },
      differences: [],
      comments: [],
    });
    const err = new Error("too long");
    err.name = "CommentContentSizeLimitExceededException";
    vi.mocked(postComment).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });
    stdin.write("x");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(lastFrame()).toContain("Comment exceeds the 10,240 character limit.");
    });
  });

  it("shows comment error for PullRequestDoesNotExistException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "def456",
            sourceCommit: "abc123",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/fix",
          },
        ],
      },
      differences: [],
      comments: [],
    });
    const err = new Error("gone");
    err.name = "PullRequestDoesNotExistException";
    vi.mocked(postComment).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });
    stdin.write("x");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(lastFrame()).toContain("Pull request not found.");
    });
  });

  it("shows generic comment error message", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "def456",
            sourceCommit: "abc123",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/fix",
          },
        ],
      },
      differences: [],
      comments: [],
    });
    vi.mocked(postComment).mockRejectedValue(new Error("something broke"));

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });
    stdin.write("x");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(lastFrame()).toContain("something broke");
    });
  });

  it("shows non-Error comment error as string", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "def456",
            sourceCommit: "abc123",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/fix",
          },
        ],
      },
      differences: [],
      comments: [],
    });
    vi.mocked(postComment).mockRejectedValue("raw error string");

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });
    stdin.write("x");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(lastFrame()).toContain("raw error string");
    });
  });

  it("does not call postComment when pullRequestTargets is empty", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [],
      },
      differences: [],
      comments: [],
    });

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    stdin.write("c");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("New Comment:");
    });

    stdin.write("test");
    await vi.waitFor(() => {
      stdin.write("\r");
    });

    // Give time for any async operations
    await new Promise((r) => setTimeout(r, 50));
    expect(postComment).not.toHaveBeenCalled();
  });
});
