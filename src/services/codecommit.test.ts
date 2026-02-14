import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  evaluateApprovalRules,
  getApprovalStates,
  getBlobContent,
  getComments,
  getPullRequestDetail,
  listPullRequests,
  listRepositories,
  postComment,
  updateApprovalState,
} from "./codecommit.js";

const mockSend = vi.fn();

const mockClient = {
  send: mockSend,
} as any;

beforeEach(() => {
  mockSend.mockReset();
});

describe("listRepositories", () => {
  it("returns repositories from API response", async () => {
    mockSend.mockResolvedValueOnce({
      repositories: [
        { repositoryName: "my-service", repositoryId: "1" },
        { repositoryName: "my-frontend", repositoryId: "2" },
      ],
    });
    const repos = await listRepositories(mockClient);
    expect(repos).toHaveLength(2);
    expect(repos[0].repositoryName).toBe("my-service");
  });

  it("returns empty array when no repositories", async () => {
    mockSend.mockResolvedValueOnce({ repositories: undefined });
    const repos = await listRepositories(mockClient);
    expect(repos).toHaveLength(0);
  });
});

describe("listPullRequests", () => {
  it("returns pull request summaries", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequestIds: ["42"],
      nextToken: undefined,
    });
    mockSend.mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login timeout",
        authorArn: "arn:aws:iam::123456789012:user/watany",
        creationDate: new Date("2026-02-13T10:00:00Z"),
      },
    });
    const result = await listPullRequests(mockClient, "my-service");
    expect(result.pullRequests).toHaveLength(1);
    expect(result.pullRequests[0].title).toBe("fix: login timeout");
  });
});

describe("getPullRequestDetail", () => {
  it("fetches pull request with differences and comments", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login timeout",
        pullRequestTargets: [
          {
            sourceCommit: "abc123",
            destinationCommit: "def456",
          },
        ],
      },
    });
    mockSend.mockResolvedValueOnce({
      differences: [
        {
          beforeBlob: { blobId: "b1", path: "src/auth.ts" },
          afterBlob: { blobId: "b2", path: "src/auth.ts" },
        },
      ],
    });
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [
        {
          comments: [
            {
              authorArn: "arn:aws:iam::123456789012:user/taro",
              content: "LGTM",
            },
          ],
        },
      ],
    });

    const detail = await getPullRequestDetail(mockClient, "42", "my-service");
    expect(detail.pullRequest.title).toBe("fix: login timeout");
    expect(detail.differences).toHaveLength(1);
    expect(detail.commentThreads).toHaveLength(1);
    expect(detail.commentThreads[0].location).toBeNull();
    expect(detail.commentThreads[0].comments[0].content).toBe("LGTM");
  });
});

describe("listPullRequests edge cases", () => {
  it("returns empty array when no PR IDs", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequestIds: undefined,
      nextToken: undefined,
    });
    const result = await listPullRequests(mockClient, "my-service");
    expect(result.pullRequests).toHaveLength(0);
  });

  it("handles PR without full data", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequestIds: ["99"],
      nextToken: "token123",
    });
    mockSend.mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: undefined,
        title: undefined,
        authorArn: undefined,
        creationDate: undefined,
      },
    });
    const result = await listPullRequests(mockClient, "my-service");
    expect(result.pullRequests).toHaveLength(1);
    expect(result.pullRequests[0].title).toBe("(no title)");
    expect(result.nextToken).toBe("token123");
  });

  it("skips when pullRequest is undefined in response", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequestIds: ["99"],
      nextToken: undefined,
    });
    mockSend.mockResolvedValueOnce({
      pullRequest: undefined,
    });
    const result = await listPullRequests(mockClient, "my-service");
    expect(result.pullRequests).toHaveLength(0);
  });
});

describe("getPullRequestDetail edge cases", () => {
  it("throws when pullRequest is missing from response", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequest: undefined,
    });
    await expect(getPullRequestDetail(mockClient, "42", "my-service")).rejects.toThrow(
      "Pull request 42 not found.",
    );
  });

  it("handles pull request without targets", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: something",
        pullRequestTargets: [],
      },
    });
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [],
    });

    const detail = await getPullRequestDetail(mockClient, "42", "my-service");
    expect(detail.differences).toHaveLength(0);
    expect(detail.commentThreads).toHaveLength(0);
  });

  it("handles undefined differences in response", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        pullRequestTargets: [
          {
            sourceCommit: "abc",
            destinationCommit: "def",
          },
        ],
      },
    });
    mockSend.mockResolvedValueOnce({
      differences: undefined,
    });
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [],
    });

    const detail = await getPullRequestDetail(mockClient, "42", "my-service");
    expect(detail.differences).toHaveLength(0);
  });

  it("handles empty comments data", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        pullRequestTargets: [],
      },
    });
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: undefined,
    });

    const detail = await getPullRequestDetail(mockClient, "42", "my-service");
    expect(detail.commentThreads).toHaveLength(0);
  });

  it("handles thread with no comments", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        pullRequestTargets: [],
      },
    });
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [{ comments: undefined }],
    });

    const detail = await getPullRequestDetail(mockClient, "42", "my-service");
    expect(detail.commentThreads).toHaveLength(1);
    expect(detail.commentThreads[0].comments).toHaveLength(0);
  });

  it("defaults filePosition and relativeFileVersion in getPullRequestDetail", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        pullRequestTargets: [],
      },
    });
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [
        {
          location: {
            filePath: "src/x.ts",
            filePosition: undefined,
            relativeFileVersion: undefined,
          },
          comments: [{ commentId: "c1", content: "test" }],
        },
      ],
    });

    const detail = await getPullRequestDetail(mockClient, "42", "my-service");
    expect(detail.commentThreads[0].location).toEqual({
      filePath: "src/x.ts",
      filePosition: 0,
      relativeFileVersion: "AFTER",
    });
  });

  it("preserves inline comment location in threads", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        pullRequestTargets: [],
      },
    });
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [
        {
          location: {
            filePath: "src/index.ts",
            filePosition: 5,
            relativeFileVersion: "BEFORE",
          },
          comments: [{ commentId: "c1", content: "fix this" }],
        },
      ],
    });

    const detail = await getPullRequestDetail(mockClient, "42", "my-service");
    expect(detail.commentThreads).toHaveLength(1);
    expect(detail.commentThreads[0].location).toEqual({
      filePath: "src/index.ts",
      filePosition: 5,
      relativeFileVersion: "BEFORE",
    });
  });
});

describe("postComment", () => {
  it("posts a comment and returns the result", async () => {
    const mockComment = {
      commentId: "comment-1",
      content: "Looks good!",
      authorArn: "arn:aws:iam::123456789012:user/watany",
      creationDate: new Date("2026-02-13T12:00:00Z"),
    };
    mockSend.mockResolvedValueOnce({ comment: mockComment });

    const result = await postComment(mockClient, {
      pullRequestId: "42",
      repositoryName: "my-service",
      beforeCommitId: "def456",
      afterCommitId: "abc123",
      content: "Looks good!",
    });

    expect(result).toEqual(mockComment);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          pullRequestId: "42",
          repositoryName: "my-service",
          beforeCommitId: "def456",
          afterCommitId: "abc123",
          content: "Looks good!",
        },
      }),
    );
  });

  it("posts a comment with location parameter", async () => {
    const mockComment = {
      commentId: "comment-2",
      content: "Fix this line",
      authorArn: "arn:aws:iam::123456789012:user/watany",
    };
    mockSend.mockResolvedValueOnce({ comment: mockComment });

    const result = await postComment(mockClient, {
      pullRequestId: "42",
      repositoryName: "my-service",
      beforeCommitId: "def456",
      afterCommitId: "abc123",
      content: "Fix this line",
      location: {
        filePath: "src/auth.ts",
        filePosition: 10,
        relativeFileVersion: "AFTER",
      },
    });

    expect(result).toEqual(mockComment);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          pullRequestId: "42",
          repositoryName: "my-service",
          beforeCommitId: "def456",
          afterCommitId: "abc123",
          content: "Fix this line",
          location: {
            filePath: "src/auth.ts",
            filePosition: 10,
            relativeFileVersion: "AFTER",
          },
        },
      }),
    );
  });

  it("posts a comment without location (general comment)", async () => {
    const mockComment = {
      commentId: "comment-3",
      content: "General",
    };
    mockSend.mockResolvedValueOnce({ comment: mockComment });

    await postComment(mockClient, {
      pullRequestId: "42",
      repositoryName: "my-service",
      beforeCommitId: "def456",
      afterCommitId: "abc123",
      content: "General",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          pullRequestId: "42",
          repositoryName: "my-service",
          beforeCommitId: "def456",
          afterCommitId: "abc123",
          content: "General",
          location: undefined,
        },
      }),
    );
  });

  it("propagates API errors", async () => {
    const error = new Error("Access denied");
    error.name = "AccessDeniedException";
    mockSend.mockRejectedValueOnce(error);

    await expect(
      postComment(mockClient, {
        pullRequestId: "42",
        repositoryName: "my-service",
        beforeCommitId: "def456",
        afterCommitId: "abc123",
        content: "test",
      }),
    ).rejects.toThrow("Access denied");
  });
});

describe("getComments", () => {
  it("returns comment threads from API response", async () => {
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [
        {
          comments: [
            {
              commentId: "comment-1",
              content: "First comment",
              authorArn: "arn:aws:iam::123456789012:user/alice",
              creationDate: new Date("2026-02-13T10:00:00Z"),
            },
            {
              commentId: "comment-2",
              content: "Second comment",
              authorArn: "arn:aws:iam::123456789012:user/bob",
              creationDate: new Date("2026-02-13T11:00:00Z"),
            },
          ],
        },
      ],
    });

    const threads = await getComments(mockClient, "42", "my-service");
    expect(threads).toHaveLength(1);
    expect(threads[0].location).toBeNull();
    expect(threads[0].comments).toHaveLength(2);
    expect(threads[0].comments[0].content).toBe("First comment");
    expect(threads[0].comments[1].content).toBe("Second comment");
  });

  it("handles empty comments data", async () => {
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: undefined,
    });

    const threads = await getComments(mockClient, "42", "my-service");
    expect(threads).toHaveLength(0);
  });

  it("handles thread with no comments", async () => {
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [{ comments: undefined }],
    });

    const threads = await getComments(mockClient, "42", "my-service");
    expect(threads).toHaveLength(1);
    expect(threads[0].comments).toHaveLength(0);
  });

  it("returns location for inline comment threads", async () => {
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [
        {
          location: {
            filePath: "src/auth.ts",
            filePosition: 10,
            relativeFileVersion: "AFTER",
          },
          comments: [{ commentId: "c1", content: "inline comment" }],
        },
        {
          comments: [{ commentId: "c2", content: "general comment" }],
        },
      ],
    });

    const threads = await getComments(mockClient, "42", "my-service");
    expect(threads).toHaveLength(2);
    expect(threads[0].location).toEqual({
      filePath: "src/auth.ts",
      filePosition: 10,
      relativeFileVersion: "AFTER",
    });
    expect(threads[1].location).toBeNull();
  });

  it("defaults filePosition and relativeFileVersion when missing", async () => {
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [
        {
          location: {
            filePath: "src/app.ts",
            filePosition: undefined,
            relativeFileVersion: undefined,
          },
          comments: [{ commentId: "c1", content: "inline" }],
        },
      ],
    });

    const threads = await getComments(mockClient, "42", "my-service");
    expect(threads).toHaveLength(1);
    expect(threads[0].location).toEqual({
      filePath: "src/app.ts",
      filePosition: 0,
      relativeFileVersion: "AFTER",
    });
  });

  it("treats location without filePath as general comment", async () => {
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [
        {
          location: { filePath: undefined, filePosition: 5 },
          comments: [{ commentId: "c1", content: "comment" }],
        },
      ],
    });

    const threads = await getComments(mockClient, "42", "my-service");
    expect(threads).toHaveLength(1);
    expect(threads[0].location).toBeNull();
  });
});

describe("updateApprovalState", () => {
  it("sends Approve command with correct parameters", async () => {
    mockSend.mockResolvedValueOnce({});
    await updateApprovalState(mockClient, {
      pullRequestId: "42",
      revisionId: "rev-1",
      approvalState: "APPROVE",
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          pullRequestId: "42",
          revisionId: "rev-1",
          approvalState: "APPROVE",
        },
      }),
    );
  });

  it("sends Revoke command with correct parameters", async () => {
    mockSend.mockResolvedValueOnce({});
    await updateApprovalState(mockClient, {
      pullRequestId: "42",
      revisionId: "rev-1",
      approvalState: "REVOKE",
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          pullRequestId: "42",
          revisionId: "rev-1",
          approvalState: "REVOKE",
        },
      }),
    );
  });

  it("propagates API errors", async () => {
    const error = new Error("Access denied");
    error.name = "AccessDeniedException";
    mockSend.mockRejectedValueOnce(error);
    await expect(
      updateApprovalState(mockClient, {
        pullRequestId: "42",
        revisionId: "rev-1",
        approvalState: "APPROVE",
      }),
    ).rejects.toThrow("Access denied");
  });
});

describe("getApprovalStates", () => {
  it("returns approval list when approvals exist", async () => {
    mockSend.mockResolvedValueOnce({
      approvals: [{ userArn: "arn:aws:iam::123456789012:user/taro", approvalState: "APPROVE" }],
    });
    const result = await getApprovalStates(mockClient, {
      pullRequestId: "42",
      revisionId: "rev-1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].approvalState).toBe("APPROVE");
  });

  it("returns empty array when no approvals", async () => {
    mockSend.mockResolvedValueOnce({ approvals: undefined });
    const result = await getApprovalStates(mockClient, {
      pullRequestId: "42",
      revisionId: "rev-1",
    });
    expect(result).toHaveLength(0);
  });

  it("propagates API errors", async () => {
    const error = new Error("not found");
    error.name = "PullRequestDoesNotExistException";
    mockSend.mockRejectedValueOnce(error);
    await expect(
      getApprovalStates(mockClient, {
        pullRequestId: "42",
        revisionId: "rev-1",
      }),
    ).rejects.toThrow("not found");
  });
});

describe("evaluateApprovalRules", () => {
  it("returns evaluation when rules are satisfied", async () => {
    mockSend.mockResolvedValueOnce({
      evaluation: {
        approved: true,
        overridden: false,
        approvalRulesSatisfied: ["RequireOneApproval"],
        approvalRulesNotSatisfied: [],
      },
    });
    const result = await evaluateApprovalRules(mockClient, {
      pullRequestId: "42",
      revisionId: "rev-1",
    });
    expect(result).not.toBeNull();
    expect(result!.approved).toBe(true);
    expect(result!.approvalRulesSatisfied).toHaveLength(1);
  });

  it("returns evaluation when rules are not satisfied", async () => {
    mockSend.mockResolvedValueOnce({
      evaluation: {
        approved: false,
        overridden: false,
        approvalRulesSatisfied: [],
        approvalRulesNotSatisfied: ["RequireOneApproval"],
      },
    });
    const result = await evaluateApprovalRules(mockClient, {
      pullRequestId: "42",
      revisionId: "rev-1",
    });
    expect(result).not.toBeNull();
    expect(result!.approved).toBe(false);
  });

  it("returns null when evaluation is undefined", async () => {
    mockSend.mockResolvedValueOnce({ evaluation: undefined });
    const result = await evaluateApprovalRules(mockClient, {
      pullRequestId: "42",
      revisionId: "rev-1",
    });
    expect(result).toBeNull();
  });

  it("propagates API errors", async () => {
    const error = new Error("no rules");
    mockSend.mockRejectedValueOnce(error);
    await expect(
      evaluateApprovalRules(mockClient, {
        pullRequestId: "42",
        revisionId: "rev-1",
      }),
    ).rejects.toThrow("no rules");
  });
});

describe("getBlobContent", () => {
  it("decodes blob content", async () => {
    const encoder = new TextEncoder();
    mockSend.mockResolvedValueOnce({
      content: encoder.encode("const x = 1;"),
    });
    const content = await getBlobContent(mockClient, "my-service", "blob1");
    expect(content).toBe("const x = 1;");
  });

  it("returns empty string when no content", async () => {
    mockSend.mockResolvedValueOnce({ content: undefined });
    const content = await getBlobContent(mockClient, "my-service", "blob1");
    expect(content).toBe("");
  });
});
