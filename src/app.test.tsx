import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./services/codecommit.js", () => ({
  listRepositories: vi.fn(),
  listPullRequests: vi.fn(),
  getPullRequestDetail: vi.fn(),
  getBlobContent: vi.fn(),
  postComment: vi.fn(),
  postCommentReply: vi.fn(),
  getComments: vi.fn(),
  getApprovalStates: vi.fn(),
  evaluateApprovalRules: vi.fn(),
  updateApprovalState: vi.fn(),
  mergePullRequest: vi.fn(),
  getMergeConflicts: vi.fn(),
  closePullRequest: vi.fn(),
  getCommitsForPR: vi.fn(),
  getCommitDifferences: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  getReactionsForComments: vi.fn(),
  putReaction: vi.fn(),
}));

import { App } from "./app.js";
import {
  closePullRequest,
  deleteComment,
  evaluateApprovalRules,
  getApprovalStates,
  getBlobContent,
  getComments,
  getCommitDifferences,
  getCommitsForPR,
  getMergeConflicts,
  getPullRequestDetail,
  getReactionsForComments,
  listPullRequests,
  listRepositories,
  mergePullRequest,
  postComment,
  postCommentReply,
  putReaction,
  updateApprovalState,
  updateComment,
} from "./services/codecommit.js";

const mockClient = {} as any;

describe("App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: no reactions
    vi.mocked(getReactionsForComments).mockResolvedValue(new Map());
    vi.mocked(putReaction).mockResolvedValue(undefined);
    // Default: no commits
    vi.mocked(getCommitsForPR).mockResolvedValue([]);
    vi.mocked(getCommitDifferences).mockResolvedValue([]);
    // Default: no approvals, no rules
    vi.mocked(getApprovalStates).mockResolvedValue([]);
    vi.mocked(evaluateApprovalRules).mockResolvedValue(null);
    // Default: no conflicts
    vi.mocked(getMergeConflicts).mockResolvedValue({
      mergeable: true,
      conflictCount: 0,
      conflictFiles: [],
    });
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
          status: "OPEN" as const,
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

  it("sanitizes access key ID from error message", async () => {
    vi.mocked(listRepositories).mockRejectedValue(
      new Error("Invalid credentials for AKIAIOSFODNN7EXAMPLE"),
    );
    const { lastFrame } = render(<App client={mockClient} />);
    await vi.waitFor(() => {
      const frame = lastFrame() ?? "";
      expect(frame).toContain("[ACCESS_KEY]");
      expect(frame).not.toContain("AKIAIOSFODNN7EXAMPLE");
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
          status: "OPEN" as const,
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
          status: "OPEN" as const,
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
      commentThreads: [],
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
          status: "OPEN" as const,
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
      commentThreads: [],
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
      expect(lastFrame()).toContain("Navigation");
    });

    // Close help by pressing ? again
    stdin.write("?");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("my-service");
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
          status: "OPEN" as const,
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
      commentThreads: [],
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

    await vi.waitFor(() => {
      expect(getBlobContent).toHaveBeenCalledWith(mockClient, "my-service", "b1");
      expect(getBlobContent).toHaveBeenCalledWith(mockClient, "my-service", "b2");
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
          status: "OPEN" as const,
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
      commentThreads: [],
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

    await vi.waitFor(() => {
      expect(getBlobContent).toHaveBeenCalledWith(mockClient, "my-service", "b2");
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
          status: "OPEN" as const,
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

    expect(getBlobContent).not.toHaveBeenCalled();
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
          status: "OPEN" as const,
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
      commentThreads: [],
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

    await vi.waitFor(() => {
      expect(getBlobContent).toHaveBeenCalledWith(mockClient, "my-service", "b1");
    });
  });

  it("shows blob error state when blob fetch fails", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
      commentThreads: [],
    });
    vi.mocked(getBlobContent)
      .mockResolvedValueOnce("const timeout = 3000;")
      .mockRejectedValueOnce(new Error("blob failed"));

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(Failed to load file content)");
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
          status: "OPEN" as const,
        },
      ],
    });
    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("?");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Navigation");
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
          status: "OPEN" as const,
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
      commentThreads: [],
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
      expect(lastFrame()).toContain("Navigation");
    });

    expect(getBlobContent).not.toHaveBeenCalled();
  });

  it("posts comment successfully and reloads comments", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
      commentThreads: [],
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
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "c1",
              content: "Looks good!",
              authorArn: "arn:aws:iam::123456789012:user/watany",
            },
          ],
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
          status: "OPEN" as const,
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
      commentThreads: [],
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
          status: "OPEN" as const,
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
      commentThreads: [],
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
          status: "OPEN" as const,
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
      commentThreads: [],
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
          status: "OPEN" as const,
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
      commentThreads: [],
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
          status: "OPEN" as const,
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
      commentThreads: [],
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
          status: "OPEN" as const,
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
      commentThreads: [],
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
          status: "OPEN" as const,
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
      commentThreads: [],
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

    await new Promise((r) => setTimeout(r, 0));
    expect(postComment).not.toHaveBeenCalled();
  });

  // v0.3: Approval integration tests
  it("loads approval states when opening PR detail", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    vi.mocked(getApprovalStates).mockResolvedValue([
      { userArn: "arn:aws:iam::123456789012:user/taro", approvalState: "APPROVE" },
    ]);
    vi.mocked(evaluateApprovalRules).mockResolvedValue({
      approved: true,
      overridden: false,
      approvalRulesSatisfied: ["RequireOne"],
      approvalRulesNotSatisfied: [],
    });

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
      expect(lastFrame()).toContain("taro");
      expect(lastFrame()).toContain("Approved");
    });
  });

  it("approves PR successfully and reloads approval states", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    vi.mocked(updateApprovalState).mockResolvedValue(undefined);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    // Press 'a' to start approve
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });

    // Mock reload after approve
    vi.mocked(getApprovalStates).mockResolvedValue([
      { userArn: "arn:aws:iam::123456789012:user/watany", approvalState: "APPROVE" },
    ]);

    // Confirm with 'y'
    stdin.write("y");
    await vi.waitFor(() => {
      expect(updateApprovalState).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ approvalState: "APPROVE" }),
      );
    });
  });

  it("revokes approval successfully", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    vi.mocked(updateApprovalState).mockResolvedValue(undefined);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    stdin.write("r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Revoke your approval?");
    });

    stdin.write("y");
    await vi.waitFor(() => {
      expect(updateApprovalState).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ approvalState: "REVOKE" }),
      );
    });
  });

  it("shows approval error on failure", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    const accessError = new Error("denied");
    accessError.name = "AccessDeniedException";
    vi.mocked(updateApprovalState).mockRejectedValue(accessError);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });

    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Access denied. Check your IAM policy.");
    });
  });

  it("does not call updateApprovalState when revisionId is missing", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: undefined,
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });

    stdin.write("y");
    await new Promise((r) => setTimeout(r, 0));
    expect(updateApprovalState).not.toHaveBeenCalled();
  });

  it("handles evaluateApprovalRules failure gracefully", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    vi.mocked(evaluateApprovalRules).mockRejectedValue(new Error("no rules configured"));

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      // Should still load PR detail without Rules line
      expect(lastFrame()).toContain("PR #42");
      expect(lastFrame()).not.toContain("Rules:");
    });
  });

  // formatApprovalError edge cases
  it("shows PullRequestCannotBeApprovedByAuthorException error", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("cannot approve own");
    err.name = "PullRequestCannotBeApprovedByAuthorException";
    vi.mocked(updateApprovalState).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Cannot approve your own pull request.");
    });
  });

  it("shows PullRequestCannotBeApprovedByAuthorException error on revoke", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("cannot approve own");
    err.name = "PullRequestCannotBeApprovedByAuthorException";
    vi.mocked(updateApprovalState).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Revoke your approval?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Cannot revoke approval on your own pull request.");
    });
  });

  it("shows InvalidRevisionIdException error", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("invalid");
    err.name = "InvalidRevisionIdException";
    vi.mocked(updateApprovalState).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Invalid revision. The PR may have been updated.");
    });
  });

  it("shows PullRequestAlreadyClosedException error", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("closed");
    err.name = "PullRequestAlreadyClosedException";
    vi.mocked(updateApprovalState).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Pull request is already closed.");
    });
  });

  it("shows EncryptionKeyAccessDeniedException error", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("key denied");
    err.name = "EncryptionKeyAccessDeniedException";
    vi.mocked(updateApprovalState).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Encryption key access denied.");
    });
  });

  it("shows generic approval error message", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    vi.mocked(updateApprovalState).mockRejectedValue(new Error("unknown error occurred"));

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("unknown error occurred");
    });
  });

  it("shows PullRequestDoesNotExistException approval error", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("not found");
    err.name = "PullRequestDoesNotExistException";
    vi.mocked(updateApprovalState).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Pull request not found.");
    });
  });

  it("shows RevisionIdRequiredException approval error", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("required");
    err.name = "RevisionIdRequiredException";
    vi.mocked(updateApprovalState).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Invalid revision. The PR may have been updated.");
    });
  });

  it("clears approval error and returns to normal mode", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    const accessError = new Error("denied");
    accessError.name = "AccessDeniedException";
    vi.mocked(updateApprovalState).mockRejectedValue(accessError);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Access denied. Check your IAM policy.");
    });

    // Press any key to clear error and return to normal mode
    stdin.write("x");
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain("Access denied");
      expect(lastFrame()).toContain("a/r approve");
    });
  });

  it("shows revoke approval error on failure", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    const accessError = new Error("denied");
    accessError.name = "AccessDeniedException";
    vi.mocked(updateApprovalState).mockRejectedValue(accessError);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Revoke your approval?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Access denied. Check your IAM policy.");
    });
  });

  it("shows non-Error approval error as string", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        revisionId: "rev-1",
        pullRequestTargets: [],
      },
      differences: [],
      commentThreads: [],
    });
    vi.mocked(updateApprovalState).mockRejectedValue("raw string error");

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("a");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approve this pull request?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("raw string error");
    });
  });

  // v0.4: Inline comment integration tests
  it("shows inline comment error on failure", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
      differences: [
        {
          beforeBlob: { blobId: "b1", path: "src/auth.ts" },
          afterBlob: { blobId: "b2", path: "src/auth.ts" },
        },
      ],
      commentThreads: [],
    });
    vi.mocked(getBlobContent)
      .mockResolvedValueOnce("const timeout = 3000;")
      .mockResolvedValueOnce("const timeout = 10000;");
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

    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      const frame = lastFrame() ?? "";
      expect(frame).toMatch(/> .*const timeout = 3000/);
    });
    stdin.write("C");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
    });

    stdin.write("test inline");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(lastFrame()).toContain("Failed to post comment:");
      expect(lastFrame()).toContain("Access denied");
    });
  });

  it("posts inline comment successfully and reloads comments", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
      differences: [
        {
          beforeBlob: { blobId: "b1", path: "src/auth.ts" },
          afterBlob: { blobId: "b2", path: "src/auth.ts" },
        },
      ],
      commentThreads: [],
    });
    vi.mocked(getBlobContent)
      .mockResolvedValueOnce("const timeout = 3000;")
      .mockResolvedValueOnce("const timeout = 10000;");
    vi.mocked(postComment).mockResolvedValue({
      commentId: "c1",
      content: "Fix this!",
    });

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    // Move cursor to a diff line, wait for render, then press C
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      const frame = lastFrame() ?? "";
      expect(frame).toMatch(/> .*const timeout = 3000/);
    });
    stdin.write("C");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Inline comment on");
    });

    // Mock reload after post
    vi.mocked(getComments).mockResolvedValue([
      {
        location: {
          filePath: "src/auth.ts",
          filePosition: 1,
          relativeFileVersion: "AFTER",
        },
        comments: [
          {
            commentId: "c1",
            content: "Fix this!",
            authorArn: "arn:aws:iam::123456789012:user/watany",
          },
        ],
      },
    ]);

    stdin.write("Fix this!");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(postComment).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          content: "Fix this!",
          location: expect.objectContaining({
            filePath: "src/auth.ts",
          }),
        }),
      );
    });
  });

  // v0.5: Reply integration tests
  it("shows reply error on failure", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
      nextToken: undefined,
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        authorArn: "arn:aws:iam::123456789012:user/watany",
        pullRequestStatus: "OPEN",
        creationDate: new Date("2026-02-13T10:00:00Z"),
        revisionId: "rev-1",
        pullRequestTargets: [
          {
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
            destinationCommit: "abc",
            sourceCommit: "def",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "c1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "Please fix",
            },
          ],
        },
      ],
    });
    vi.mocked(getBlobContent).mockResolvedValue("");

    const replyError = new Error("comment not found");
    replyError.name = "CommentDoesNotExistException";
    vi.mocked(postCommentReply).mockRejectedValue(replyError);

    const { stdin, lastFrame } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    // Select PR
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    // Navigate to comment line (sep=0, comment-header=1, comment=2)
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*taro: Please fix/);
    });

    // Open reply mode
    stdin.write("R");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
    });

    stdin.write("my reply");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(lastFrame()).toContain("Failed to post comment:");
      expect(lastFrame()).toContain("The comment you are replying to no longer exists.");
    });
  });

  it("posts reply successfully and reloads comments", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
      nextToken: undefined,
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        authorArn: "arn:aws:iam::123456789012:user/watany",
        pullRequestStatus: "OPEN",
        creationDate: new Date("2026-02-13T10:00:00Z"),
        revisionId: "rev-1",
        pullRequestTargets: [
          {
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
            destinationCommit: "abc",
            sourceCommit: "def",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "c1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "Please fix",
            },
          ],
        },
      ],
    });
    vi.mocked(getBlobContent).mockResolvedValue("");
    vi.mocked(postCommentReply).mockResolvedValue({
      commentId: "reply-1",
      content: "Will do!",
      authorArn: "arn:aws:iam::123456789012:user/watany",
      inReplyTo: "c1",
    });

    // Mock reload after post
    vi.mocked(getComments).mockResolvedValue([
      {
        location: null,
        comments: [
          {
            commentId: "c1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "Please fix",
          },
          {
            commentId: "reply-1",
            inReplyTo: "c1",
            authorArn: "arn:aws:iam::123456789012:user/watany",
            content: "Will do!",
          },
        ],
      },
    ]);

    const { stdin, lastFrame } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    // Navigate to comment line
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*taro: Please fix/);
    });

    stdin.write("R");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
    });

    stdin.write("Will do!");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(postCommentReply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          inReplyTo: "c1",
          content: "Will do!",
        }),
      );
    });
  });

  it("shows reply size limit error", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
      nextToken: undefined,
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        authorArn: "arn:aws:iam::123456789012:user/watany",
        pullRequestStatus: "OPEN",
        creationDate: new Date("2026-02-13T10:00:00Z"),
        revisionId: "rev-1",
        pullRequestTargets: [
          {
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
            destinationCommit: "abc",
            sourceCommit: "def",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "c1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "Fix it",
            },
          ],
        },
      ],
    });
    vi.mocked(getBlobContent).mockResolvedValue("");

    const sizeError = new Error("size limit");
    sizeError.name = "CommentContentSizeLimitExceededException";
    vi.mocked(postCommentReply).mockRejectedValue(sizeError);

    const { stdin, lastFrame } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*taro: Fix it/);
    });
    stdin.write("R");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
    });
    stdin.write("long reply");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(lastFrame()).toContain("Reply exceeds the 10,240 character limit.");
    });
  });

  it("shows reply empty error for CommentContentRequiredException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
      nextToken: undefined,
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        authorArn: "arn:aws:iam::123456789012:user/watany",
        pullRequestStatus: "OPEN",
        creationDate: new Date("2026-02-13T10:00:00Z"),
        revisionId: "rev-1",
        pullRequestTargets: [
          {
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
            destinationCommit: "abc",
            sourceCommit: "def",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "c1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "Fix it",
            },
          ],
        },
      ],
    });
    vi.mocked(getBlobContent).mockResolvedValue("");

    const emptyError = new Error("empty");
    emptyError.name = "CommentContentRequiredException";
    vi.mocked(postCommentReply).mockRejectedValue(emptyError);

    const { stdin, lastFrame } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*taro: Fix it/);
    });
    stdin.write("R");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
    });
    stdin.write("reply");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(lastFrame()).toContain("Reply cannot be empty.");
    });
  });

  it("shows invalid comment ID error", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
      nextToken: undefined,
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        authorArn: "arn:aws:iam::123456789012:user/watany",
        pullRequestStatus: "OPEN",
        creationDate: new Date("2026-02-13T10:00:00Z"),
        revisionId: "rev-1",
        pullRequestTargets: [
          {
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
            destinationCommit: "abc",
            sourceCommit: "def",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "c1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "Fix it",
            },
          ],
        },
      ],
    });
    vi.mocked(getBlobContent).mockResolvedValue("");

    const idError = new Error("invalid id");
    idError.name = "InvalidCommentIdException";
    vi.mocked(postCommentReply).mockRejectedValue(idError);

    const { stdin, lastFrame } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> .*taro: Fix it/);
    });
    stdin.write("R");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replying to taro:");
    });
    stdin.write("reply");
    await vi.waitFor(() => {
      stdin.write("\r");
      expect(lastFrame()).toContain("Invalid comment ID format.");
    });
  });

  // v0.6: Merge integration tests
  it("merges PR and returns to PR list", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
            destinationCommit: "def456",
            sourceCommit: "abc123",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });
    vi.mocked(mergePullRequest).mockResolvedValue({
      pullRequestId: "42",
      pullRequestStatus: "CLOSED",
    } as any);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });

    stdin.write("\r"); // select fast-forward
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });

    stdin.write("y");
    await vi.waitFor(() => {
      expect(mergePullRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          pullRequestId: "42",
          strategy: "fast-forward",
        }),
      );
    });
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Open Pull Requests");
    });
  });

  it("shows merge error for ManualMergeRequiredException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
            destinationCommit: "def456",
            sourceCommit: "abc123",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("conflicts");
    err.name = "ManualMergeRequiredException";
    vi.mocked(mergePullRequest).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });

    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Conflicts detected. Cannot auto-merge.");
    });
  });

  it("shows merge error for PullRequestApprovalRulesNotSatisfiedException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
            destinationCommit: "def456",
            sourceCommit: "abc123",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("rules not met");
    err.name = "PullRequestApprovalRulesNotSatisfiedException";
    vi.mocked(mergePullRequest).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Approval rules not satisfied.");
    });
  });

  it("shows merge error for TipOfSourceReferenceIsDifferentException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
            destinationCommit: "def456",
            sourceCommit: "abc123",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("branch updated");
    err.name = "TipOfSourceReferenceIsDifferentException";
    vi.mocked(mergePullRequest).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Source branch has been updated.");
    });
  });

  // v0.6: Close PR integration tests
  it("closes PR and returns to PR list", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
      differences: [],
      commentThreads: [],
    });
    vi.mocked(closePullRequest).mockResolvedValue({
      pullRequestId: "42",
      pullRequestStatus: "CLOSED",
    } as any);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    stdin.write("x");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Close this pull request without merging?");
    });

    stdin.write("y");
    await vi.waitFor(() => {
      expect(closePullRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ pullRequestId: "42" }),
      );
    });
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Open Pull Requests");
    });
  });

  it("shows close error for PullRequestAlreadyClosedException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
      commentThreads: [],
    });
    const err = new Error("already closed");
    err.name = "PullRequestAlreadyClosedException";
    vi.mocked(closePullRequest).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("x");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Close this pull request without merging?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Pull request is already closed.");
    });
  });

  it("shows merge error for ConcurrentReferenceUpdateException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
            destinationCommit: "def456",
            sourceCommit: "abc123",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("concurrent");
    err.name = "ConcurrentReferenceUpdateException";
    vi.mocked(mergePullRequest).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Branch was updated concurrently.");
    });
  });

  it("shows merge error for PullRequestAlreadyClosedException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
            destinationCommit: "def456",
            sourceCommit: "abc123",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("closed");
    err.name = "PullRequestAlreadyClosedException";
    vi.mocked(mergePullRequest).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Pull request is already closed.");
    });
  });

  it("shows merge error for EncryptionKeyAccessDeniedException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
            destinationCommit: "def456",
            sourceCommit: "abc123",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("key denied");
    err.name = "EncryptionKeyAccessDeniedException";
    vi.mocked(mergePullRequest).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Encryption key access denied.");
    });
  });

  it("shows merge error for TipsDivergenceExceededException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
            destinationCommit: "def456",
            sourceCommit: "abc123",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("diverged");
    err.name = "TipsDivergenceExceededException";
    vi.mocked(mergePullRequest).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Branches have diverged too much.");
    });
  });

  it("shows merge error for PullRequestDoesNotExistException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
            destinationCommit: "def456",
            sourceCommit: "abc123",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });
    const err = new Error("not found");
    err.name = "PullRequestDoesNotExistException";
    vi.mocked(mergePullRequest).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Pull request not found.");
    });
  });

  it("shows close error for PullRequestDoesNotExistException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
      commentThreads: [],
    });
    const err = new Error("not found");
    err.name = "PullRequestDoesNotExistException";
    vi.mocked(closePullRequest).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("x");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Close this pull request without merging?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Pull request not found.");
    });
  });

  it("skips conflict check when PR target has no commit IDs", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
      differences: [],
      commentThreads: [],
    });
    vi.mocked(mergePullRequest).mockResolvedValue({
      pullRequestId: "42",
      pullRequestStatus: "CLOSED",
    } as any);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("m");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select merge strategy:");
    });
    stdin.write("\r"); // select fast-forward
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("(y/n)");
    });
    // getMergeConflicts should NOT have been called since commits are missing
    expect(getMergeConflicts).not.toHaveBeenCalled();

    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Open Pull Requests");
    });
  });

  it("shows close error for AccessDeniedException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
      commentThreads: [],
    });
    const err = new Error("denied");
    err.name = "AccessDeniedException";
    vi.mocked(closePullRequest).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    stdin.write("x");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Close this pull request without merging?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Access denied.");
    });
  });

  it("lazy loads commits on Tab press when mergeBase exists", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            sourceCommit: "src123",
            destinationCommit: "dest456",
            mergeBase: "base789",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });
    vi.mocked(getCommitsForPR).mockResolvedValue([
      {
        commitId: "src123",
        shortId: "src1234",
        message: "Fix bug",
        authorName: "watany",
        authorDate: new Date("2026-02-13T10:00:00Z"),
        parentIds: ["base789"],
      },
    ]);
    vi.mocked(getCommitDifferences).mockResolvedValue([]);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    // Commits not loaded yet during initial detail load
    expect(getCommitsForPR).not.toHaveBeenCalled();
    // Tab header should show [All changes] because commitsAvailable is true
    expect(lastFrame()).toContain("[All changes]");

    // Tab triggers lazy load
    stdin.write("\t");
    await vi.waitFor(() => {
      expect(getCommitsForPR).toHaveBeenCalledWith(mockClient, "my-service", "src123", "base789");
    });
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("[Commit 1/1]");
    });
  });

  it("does not show commits when mergeBase is missing", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            sourceCommit: "src123",
            destinationCommit: "dest456",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    expect(getCommitsForPR).not.toHaveBeenCalled();
    expect(lastFrame()).not.toContain("[All changes]");
  });

  it("loads commits and commit diff when switching to commit view via Tab", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            sourceCommit: "src123",
            destinationCommit: "dest456",
            mergeBase: "base789",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });
    vi.mocked(getCommitsForPR).mockResolvedValue([
      {
        commitId: "src123",
        shortId: "src1234",
        message: "Fix bug",
        authorName: "watany",
        authorDate: new Date("2026-02-13T10:00:00Z"),
        parentIds: ["base789"],
      },
    ]);
    vi.mocked(getCommitDifferences).mockResolvedValue([
      {
        beforeBlob: { blobId: "cb1", path: "src/auth.ts" },
        afterBlob: { blobId: "cb2", path: "src/auth.ts" },
      },
    ]);
    vi.mocked(getBlobContent).mockResolvedValue("content");

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    stdin.write("\t"); // switch to commit view (triggers lazy load)
    await vi.waitFor(() => {
      expect(getCommitsForPR).toHaveBeenCalledWith(mockClient, "my-service", "src123", "base789");
    });
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("[Commit 1/1]");
    });
    await vi.waitFor(() => {
      expect(getCommitDifferences).toHaveBeenCalledWith(
        mockClient,
        "my-service",
        "base789",
        "src123",
      );
    });
  });

  it("loads commit diff for new file (afterBlob only) and reuses cached commits", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            sourceCommit: "src123",
            destinationCommit: "dest456",
            mergeBase: "base789",
          },
        ],
      },
      differences: [],
      commentThreads: [],
    });
    vi.mocked(getCommitsForPR).mockResolvedValue([
      {
        commitId: "c1",
        shortId: "c1short",
        message: "First commit",
        authorName: "watany",
        authorDate: new Date("2026-02-13T09:00:00Z"),
        parentIds: ["base789"],
      },
      {
        commitId: "c2",
        shortId: "c2short",
        message: "Second commit",
        authorName: "watany",
        authorDate: new Date("2026-02-13T10:00:00Z"),
        parentIds: ["c1"],
      },
    ]);
    // First commit: new file + deleted file (covers both missing blob branches)
    vi.mocked(getCommitDifferences)
      .mockResolvedValueOnce([
        {
          afterBlob: { blobId: "newfile1", path: "src/new.ts" },
        },
        {
          beforeBlob: { blobId: "deleted1", path: "src/old.ts" },
        },
      ])
      .mockResolvedValueOnce([
        {
          beforeBlob: { blobId: "b1", path: "src/edit.ts" },
          afterBlob: { blobId: "b2", path: "src/edit.ts" },
        },
      ]);
    vi.mocked(getBlobContent).mockResolvedValue("content");

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    // Switch to commit view (triggers lazy load of commits)
    stdin.write("\t");
    await vi.waitFor(() => {
      expect(getCommitsForPR).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("[Commit 1/2]");
    });

    // Navigate to second commit via Tab (commits already cached, no re-fetch)
    stdin.write("\t");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("[Commit 2/2]");
    });
    // getCommitsForPR should NOT be called again
    expect(getCommitsForPR).toHaveBeenCalledTimes(1);
    // But getCommitDifferences should be called for the second commit
    await vi.waitFor(() => {
      expect(getCommitDifferences).toHaveBeenCalledTimes(2);
    });
  });

  it("reloads comments without commit IDs when target has no commits", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
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
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "comment-1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "Original",
            },
          ],
        },
      ],
    });
    vi.mocked(updateComment).mockResolvedValue({
      commentId: "comment-1",
      content: "Updated",
    });
    vi.mocked(getComments).mockResolvedValue([]);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    for (let i = 0; i < 10; i++) {
      stdin.write("j");
    }
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(">  taro");
    });
    stdin.write("e");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Edit Comment:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(getComments).toHaveBeenCalledWith(
        mockClient,
        "42",
        expect.objectContaining({ repositoryName: "my-service" }),
      );
    });
  });

  // v0.7: Comment edit/delete tests
  it("calls updateComment and reloads comments on successful edit", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "dest1",
            sourceCommit: "src1",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "comment-1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "Original content",
            },
          ],
        },
      ],
    });
    vi.mocked(updateComment).mockResolvedValue({
      commentId: "comment-1",
      content: "Updated content",
    });
    vi.mocked(getComments).mockResolvedValue([
      {
        location: null,
        comments: [
          {
            commentId: "comment-1",
            authorArn: "arn:aws:iam::123456789012:user/taro",
            content: "Updated content",
          },
        ],
      },
    ]);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    // Navigate to comment line
    for (let i = 0; i < 10; i++) {
      stdin.write("j");
    }
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(">  taro");
    });
    stdin.write("e");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Edit Comment:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(updateComment).toHaveBeenCalledWith(mockClient, {
        commentId: "comment-1",
        content: "Original content",
      });
    });
  });

  it("shows updateComment error for CommentNotCreatedByCallerException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "dest1",
            sourceCommit: "src1",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "comment-1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "LGTM",
            },
          ],
        },
      ],
    });
    const err = new Error("not your comment");
    err.name = "CommentNotCreatedByCallerException";
    vi.mocked(updateComment).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    for (let i = 0; i < 10; i++) {
      stdin.write("j");
    }
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(">  taro");
    });
    stdin.write("e");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Edit Comment:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("You can only edit your own comments.");
    });
  });

  it("calls deleteComment and reloads comments on successful delete", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "dest1",
            sourceCommit: "src1",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "comment-1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "Delete me",
            },
          ],
        },
      ],
    });
    vi.mocked(deleteComment).mockResolvedValue({
      commentId: "comment-1",
      content: "",
      deleted: true,
    });
    vi.mocked(getComments).mockResolvedValue([]);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    for (let i = 0; i < 10; i++) {
      stdin.write("j");
    }
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(">  taro");
    });
    stdin.write("d");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Delete this comment?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(deleteComment).toHaveBeenCalledWith(mockClient, {
        commentId: "comment-1",
      });
    });
  });

  it("shows deleteComment error for CommentDeletedException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "dest1",
            sourceCommit: "src1",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "comment-1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "LGTM",
            },
          ],
        },
      ],
    });
    const err = new Error("already deleted");
    err.name = "CommentDeletedException";
    vi.mocked(deleteComment).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    for (let i = 0; i < 10; i++) {
      stdin.write("j");
    }
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(">  taro");
    });
    stdin.write("d");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Delete this comment?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Comment has already been deleted.");
    });
  });

  it("shows edit error for CommentContentSizeLimitExceededException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "dest1",
            sourceCommit: "src1",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "comment-1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "LGTM",
            },
          ],
        },
      ],
    });
    const err = new Error("too long");
    err.name = "CommentContentSizeLimitExceededException";
    vi.mocked(updateComment).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    for (let i = 0; i < 10; i++) {
      stdin.write("j");
    }
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(">  taro");
    });
    stdin.write("e");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Edit Comment:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Comment exceeds the 10,240 character limit.");
    });
  });

  it("shows edit error for CommentDeletedException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "dest1",
            sourceCommit: "src1",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "comment-1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "LGTM",
            },
          ],
        },
      ],
    });
    const err = new Error("deleted");
    err.name = "CommentDeletedException";
    vi.mocked(updateComment).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    for (let i = 0; i < 10; i++) {
      stdin.write("j");
    }
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(">  taro");
    });
    stdin.write("e");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Edit Comment:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Comment has already been deleted.");
    });
  });

  it("shows edit error for CommentDoesNotExistException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "dest1",
            sourceCommit: "src1",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "comment-1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "LGTM",
            },
          ],
        },
      ],
    });
    const err = new Error("not found");
    err.name = "CommentDoesNotExistException";
    vi.mocked(updateComment).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    for (let i = 0; i < 10; i++) {
      stdin.write("j");
    }
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(">  taro");
    });
    stdin.write("e");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Edit Comment:");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Comment no longer exists.");
    });
  });

  it("shows delete error for CommentDoesNotExistException", async () => {
    vi.mocked(listPullRequests).mockResolvedValue({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValue({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationCommit: "dest1",
            sourceCommit: "src1",
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature",
          },
        ],
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "comment-1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "LGTM",
            },
          ],
        },
      ],
    });
    const err = new Error("not found");
    err.name = "CommentDoesNotExistException";
    vi.mocked(deleteComment).mockRejectedValue(err);

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    for (let i = 0; i < 10; i++) {
      stdin.write("j");
    }
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(">  taro");
    });
    stdin.write("d");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Delete this comment?");
    });
    stdin.write("y");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Comment no longer exists.");
    });
  });

  // v0.8: Status filter integration tests
  it("changes filter to CLOSED and reloads PRs", async () => {
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "35",
          title: "fix: typos",
          authorArn: "arn:aws:iam::123456789012:user/hanako",
          creationDate: new Date("2026-02-09T10:00:00Z"),
          status: "CLOSED" as const,
        },
      ],
    });

    stdin.write("f"); // filter to CLOSED
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: typos");
    });
    expect(vi.mocked(listPullRequests)).toHaveBeenLastCalledWith(
      mockClient,
      "my-service",
      undefined,
      "CLOSED",
    );
  });

  it("changes filter to MERGED and filters client-side", async () => {
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    // First f: OPEN→CLOSED
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "35",
          title: "fix: typos",
          authorArn: "arn:aws:iam::123456789012:user/hanako",
          creationDate: new Date("2026-02-09T10:00:00Z"),
          status: "CLOSED" as const,
        },
      ],
    });
    stdin.write("f");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("[Closed]");
    });

    // Second f: CLOSED→MERGED, API returns CLOSED but client filters to MERGED
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "40",
          title: "feat: auth",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-11T10:00:00Z"),
          status: "MERGED" as const,
        },
        {
          pullRequestId: "35",
          title: "fix: typos",
          authorArn: "arn:aws:iam::123456789012:user/hanako",
          creationDate: new Date("2026-02-09T10:00:00Z"),
          status: "CLOSED" as const,
        },
      ],
    });
    stdin.write("f");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("[Merged]");
      expect(lastFrame()).toContain("feat: auth");
      expect(lastFrame()).not.toContain("fix: typos");
    });
  });

  // v0.8: Pagination integration tests
  it("navigates to next page with n key", async () => {
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
      nextToken: "token-A",
    });
    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
      expect(lastFrame()).toContain("n next");
    });

    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "50",
          title: "feat: search",
          authorArn: "arn:aws:iam::123456789012:user/taro",
          creationDate: new Date("2026-02-10T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });

    stdin.write("n");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("feat: search");
      expect(lastFrame()).toContain("Page 2");
    });
    expect(vi.mocked(listPullRequests)).toHaveBeenLastCalledWith(
      mockClient,
      "my-service",
      "token-A",
      "OPEN",
    );
  });

  it("navigates to previous page with p key", async () => {
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
      nextToken: "token-A",
    });
    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    // Go to page 2
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "50",
          title: "feat: search",
          authorArn: "arn:aws:iam::123456789012:user/taro",
          creationDate: new Date("2026-02-10T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
      nextToken: "token-B",
    });
    stdin.write("n");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Page 2");
    });

    // Go back to page 1
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
      nextToken: "token-A",
    });
    stdin.write("p");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Page 1");
      expect(lastFrame()).toContain("fix: login");
    });
  });

  it("resets pagination on filter change", async () => {
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
      nextToken: "token-A",
    });
    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    // Go to page 2
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "50",
          title: "feat: search",
          authorArn: "arn:aws:iam::123456789012:user/taro",
          creationDate: new Date("2026-02-10T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    stdin.write("n");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Page 2");
    });

    // Change filter -> should reset to page 1
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "35",
          title: "fix: typos",
          authorArn: "arn:aws:iam::123456789012:user/hanako",
          creationDate: new Date("2026-02-09T10:00:00Z"),
          status: "CLOSED" as const,
        },
      ],
    });
    stdin.write("f");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Page 1");
      expect(lastFrame()).toContain("fix: typos");
    });
  });

  it("handles InvalidContinuationTokenException by resetting to page 1", async () => {
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
      nextToken: "token-A",
    });
    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    const tokenError = new Error("Invalid token");
    tokenError.name = "InvalidContinuationTokenException";
    vi.mocked(listPullRequests).mockRejectedValueOnce(tokenError);

    stdin.write("n");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Page token expired");
    });
  });

  // v0.2.0: Reaction integration test
  it("loads reactions with PR detail and calls putReaction on g key", async () => {
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature/login",
            sourceCommit: "src1",
            destinationCommit: "dst1",
            mergeBase: "base1",
          },
        ],
        revisionId: "rev1",
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            {
              commentId: "comment-1",
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "LGTM",
            },
          ],
        },
      ],
    });
    vi.mocked(getReactionsForComments).mockResolvedValueOnce(
      new Map([["comment-1", [{ emoji: "👍", shortCode: ":thumbsup:", count: 1, userArns: [] }]]]),
    );

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });

    // Select the PR
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    // Verify reactions loaded (badge displayed)
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("👍×1");
    });

    // Verify getReactionsForComments was called
    expect(vi.mocked(getReactionsForComments)).toHaveBeenCalledWith(mockClient, ["comment-1"]);
  });

  it("submits reaction successfully and reloads reactions", async () => {
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature/login",
            sourceCommit: "src1",
            destinationCommit: "dst1",
            mergeBase: "base1",
          },
        ],
        revisionId: "rev1",
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            { commentId: "c1", authorArn: "arn:aws:iam::123456789012:user/taro", content: "OK" },
          ],
        },
      ],
    });

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    for (let i = 0; i < 5; i++) stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(">  taro: OK");
    });
    stdin.write("g");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("React to comment:");
    });

    // Mock successful reaction and reload
    vi.mocked(putReaction).mockResolvedValueOnce(undefined);
    vi.mocked(getReactionsForComments).mockResolvedValueOnce(
      new Map([["c1", [{ emoji: "👍", shortCode: ":thumbsup:", count: 1, userArns: [] }]]]),
    );

    stdin.write("\r"); // submit reaction
    await vi.waitFor(() => {
      expect(vi.mocked(putReaction)).toHaveBeenCalledWith(mockClient, {
        commentId: "c1",
        reactionValue: ":thumbsup:",
      });
    });
    // Badge should appear after reactions reload
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("👍×1");
    });
  });

  it("shows reaction error when putReaction fails with CommentDeletedException", async () => {
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature/login",
            sourceCommit: "src1",
            destinationCommit: "dst1",
            mergeBase: "base1",
          },
        ],
        revisionId: "rev1",
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            { commentId: "c1", authorArn: "arn:aws:iam::123456789012:user/taro", content: "OK" },
          ],
        },
      ],
    });

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });

    // Navigate to comment line
    for (let i = 0; i < 5; i++) stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(">  taro: OK");
    });

    // Open reaction picker
    stdin.write("g");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("React to comment:");
    });

    // Make putReaction fail
    const error = new Error("deleted");
    error.name = "CommentDeletedException";
    vi.mocked(putReaction).mockRejectedValueOnce(error);

    stdin.write("\r"); // submit reaction
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Comment has already been deleted.");
    });
  });

  it.each([
    { errorName: "CommentDoesNotExistException", expected: "Comment no longer exists." },
    { errorName: "ReactionValueRequiredException", expected: "Reaction value is required." },
    { errorName: "InvalidReactionValueException", expected: "Invalid reaction value." },
  ])("shows $expected for $errorName", async ({ errorName, expected }) => {
    vi.mocked(listPullRequests).mockResolvedValueOnce({
      pullRequests: [
        {
          pullRequestId: "42",
          title: "fix: login",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-13T10:00:00Z"),
          status: "OPEN" as const,
        },
      ],
    });
    vi.mocked(getPullRequestDetail).mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login",
        pullRequestTargets: [
          {
            destinationReference: "refs/heads/main",
            sourceReference: "refs/heads/feature/login",
            sourceCommit: "src1",
            destinationCommit: "dst1",
            mergeBase: "base1",
          },
        ],
        revisionId: "rev1",
      },
      differences: [],
      commentThreads: [
        {
          location: null,
          comments: [
            { commentId: "c1", authorArn: "arn:aws:iam::123456789012:user/taro", content: "OK" },
          ],
        },
      ],
    });

    const { lastFrame, stdin } = render(<App client={mockClient} initialRepo="my-service" />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("fix: login");
    });
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("PR #42");
    });
    for (let i = 0; i < 5; i++) stdin.write("j");
    stdin.write("j");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(">  taro: OK");
    });
    stdin.write("g");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("React to comment:");
    });

    const error = new Error("fail");
    error.name = errorName;
    vi.mocked(putReaction).mockRejectedValueOnce(error);
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(expected);
    });
  });
});
