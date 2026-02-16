import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closePullRequest,
  createClient,
  deleteComment,
  evaluateApprovalRules,
  getApprovalStates,
  getBlobContent,
  getComments,
  getCommit,
  getCommitDifferences,
  getCommitsForPR,
  getMergeConflicts,
  getPullRequestDetail,
  getReactionsForComment,
  getReactionsForComments,
  listPullRequests,
  listRepositories,
  mergePullRequest,
  postComment,
  postCommentReply,
  putReaction,
  updateApprovalState,
  updateComment,
} from "./codecommit.js";

const mockSend = vi.fn();

const mockClient = {
  send: mockSend,
} as any;

beforeEach(() => {
  mockSend.mockReset();
});

describe("createClient", () => {
  it("returns a CodeCommitClient instance with provided config", () => {
    const client = createClient({ profile: "dev", region: "ap-northeast-1" });
    expect(client).toBeInstanceOf(Object);
    expect(client.send).toBeDefined();
  });
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
  it("returns pull request summaries with OPEN status", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequestIds: ["42"],
      nextToken: undefined,
    });
    mockSend.mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "42",
        title: "fix: login timeout",
        authorArn: "arn:aws:iam::123456789012:user/watany",
        pullRequestStatus: "OPEN",
        creationDate: new Date("2026-02-13T10:00:00Z"),
      },
    });
    const result = await listPullRequests(mockClient, "my-service");
    expect(result.pullRequests).toHaveLength(1);
    expect(result.pullRequests[0].title).toBe("fix: login timeout");
    expect(result.pullRequests[0].status).toBe("OPEN");
  });

  it("returns MERGED status when mergeMetadata.isMerged is true", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequestIds: ["40"],
      nextToken: undefined,
    });
    mockSend.mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "40",
        title: "feat: auth",
        authorArn: "arn:aws:iam::123456789012:user/watany",
        pullRequestStatus: "CLOSED",
        creationDate: new Date("2026-02-11T10:00:00Z"),
        pullRequestTargets: [
          {
            mergeMetadata: {
              isMerged: true,
              mergedBy: "arn:aws:iam::123456789012:user/taro",
              mergeCommitId: "abc123",
              mergeOption: "SQUASH_MERGE",
            },
          },
        ],
      },
    });
    const result = await listPullRequests(mockClient, "my-service");
    expect(result.pullRequests).toHaveLength(1);
    expect(result.pullRequests[0].status).toBe("MERGED");
  });

  it("passes pullRequestStatus OPEN to API by default", async () => {
    mockSend.mockResolvedValueOnce({ pullRequestIds: [], nextToken: undefined });
    await listPullRequests(mockClient, "my-service");
    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.input.pullRequestStatus).toBe("OPEN");
  });

  it("passes pullRequestStatus CLOSED to API when specified", async () => {
    mockSend.mockResolvedValueOnce({ pullRequestIds: [], nextToken: undefined });
    await listPullRequests(mockClient, "my-service", undefined, "CLOSED");
    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.input.pullRequestStatus).toBe("CLOSED");
  });

  it("passes pullRequestStatus OPEN to API when specified", async () => {
    mockSend.mockResolvedValueOnce({ pullRequestIds: [], nextToken: undefined });
    await listPullRequests(mockClient, "my-service", undefined, "OPEN");
    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.input.pullRequestStatus).toBe("OPEN");
  });

  it("returns nextToken when API provides one", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequestIds: [],
      nextToken: "next-page-token",
    });
    const result = await listPullRequests(mockClient, "my-service");
    expect(result.nextToken).toBe("next-page-token");
  });

  it("returns no nextToken on last page", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequestIds: [],
      nextToken: undefined,
    });
    const result = await listPullRequests(mockClient, "my-service");
    expect(result.nextToken).toBeUndefined();
  });

  it("returns CLOSED status when mergeMetadata.isMerged is false", async () => {
    mockSend.mockResolvedValueOnce({
      pullRequestIds: ["35"],
      nextToken: undefined,
    });
    mockSend.mockResolvedValueOnce({
      pullRequest: {
        pullRequestId: "35",
        title: "fix: typos",
        authorArn: "arn:aws:iam::123456789012:user/hanako",
        pullRequestStatus: "CLOSED",
        creationDate: new Date("2026-02-09T10:00:00Z"),
        pullRequestTargets: [
          {
            mergeMetadata: {
              isMerged: false,
            },
          },
        ],
      },
    });
    const result = await listPullRequests(mockClient, "my-service");
    expect(result.pullRequests).toHaveLength(1);
    expect(result.pullRequests[0].status).toBe("CLOSED");
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

  it("passes commit IDs and repositoryName to GetCommentsForPullRequest", async () => {
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
    mockSend.mockResolvedValueOnce({ differences: [] });
    mockSend.mockResolvedValueOnce({ commentsForPullRequestData: [] });

    await getPullRequestDetail(mockClient, "42", "my-service");

    // Third call is GetCommentsForPullRequestCommand
    const commentsCall = mockSend.mock.calls[2][0];
    expect(commentsCall.input).toEqual(
      expect.objectContaining({
        pullRequestId: "42",
        repositoryName: "my-service",
        afterCommitId: "abc123",
        beforeCommitId: "def456",
      }),
    );
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
    expect(result.pullRequests[0].status).toBe("OPEN");
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

  it("paginates GetDifferences when NextToken is present", async () => {
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
    // First page of differences (call #2)
    mockSend.mockResolvedValueOnce({
      differences: [{ beforeBlob: { blobId: "b1" }, afterBlob: { blobId: "b2" } }],
      NextToken: "page2",
    });
    // Comments (call #3, interleaved due to Promise.all)
    mockSend.mockResolvedValueOnce({ commentsForPullRequestData: [] });
    // Second page of differences (call #4)
    mockSend.mockResolvedValueOnce({
      differences: [{ beforeBlob: { blobId: "b3" }, afterBlob: { blobId: "b4" } }],
      NextToken: undefined,
    });

    const detail = await getPullRequestDetail(mockClient, "42", "my-service");
    expect(detail.differences).toHaveLength(2);
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

    const threads = await getComments(mockClient, "42");
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

    const threads = await getComments(mockClient, "42");
    expect(threads).toHaveLength(0);
  });

  it("handles thread with no comments", async () => {
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [{ comments: undefined }],
    });

    const threads = await getComments(mockClient, "42");
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

    const threads = await getComments(mockClient, "42");
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

    const threads = await getComments(mockClient, "42");
    expect(threads).toHaveLength(1);
    expect(threads[0].location).toEqual({
      filePath: "src/app.ts",
      filePosition: 0,
      relativeFileVersion: "AFTER",
    });
  });

  it("paginates when nextToken is present", async () => {
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [{ comments: [{ commentId: "c1", content: "first page" }] }],
      nextToken: "page2",
    });
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [{ comments: [{ commentId: "c2", content: "second page" }] }],
      nextToken: undefined,
    });

    const threads = await getComments(mockClient, "42");
    expect(threads).toHaveLength(2);
    expect(threads[0].comments[0].content).toBe("first page");
    expect(threads[1].comments[0].content).toBe("second page");
    expect(mockSend).toHaveBeenCalledTimes(2);
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

    const threads = await getComments(mockClient, "42");
    expect(threads).toHaveLength(1);
    expect(threads[0].location).toBeNull();
  });

  it("passes commit IDs and repositoryName when provided", async () => {
    mockSend.mockResolvedValueOnce({ commentsForPullRequestData: [] });

    await getComments(mockClient, "42", {
      repositoryName: "my-service",
      afterCommitId: "abc123",
      beforeCommitId: "def456",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          pullRequestId: "42",
          repositoryName: "my-service",
          afterCommitId: "abc123",
          beforeCommitId: "def456",
        }),
      }),
    );
  });

  it("omits commit IDs when only one is provided", async () => {
    mockSend.mockResolvedValueOnce({ commentsForPullRequestData: [] });

    await getComments(mockClient, "42", {
      repositoryName: "my-service",
      afterCommitId: "abc123",
    });

    const callInput = mockSend.mock.calls[0][0].input;
    expect(callInput.pullRequestId).toBe("42");
    expect(callInput.repositoryName).toBe("my-service");
    expect(callInput.afterCommitId).toBeUndefined();
    expect(callInput.beforeCommitId).toBeUndefined();
  });

  it("sorts comments so root comment comes before replies", async () => {
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [
        {
          comments: [
            {
              commentId: "reply-1",
              inReplyTo: "root-1",
              content: "This is a reply",
              authorArn: "arn:aws:iam::123456789012:user/bob",
            },
            {
              commentId: "root-1",
              content: "This is the root comment",
              authorArn: "arn:aws:iam::123456789012:user/alice",
            },
          ],
        },
      ],
    });

    const threads = await getComments(mockClient, "42");
    expect(threads).toHaveLength(1);
    expect(threads[0].comments[0].commentId).toBe("root-1");
    expect(threads[0].comments[0].inReplyTo).toBeUndefined();
    expect(threads[0].comments[1].commentId).toBe("reply-1");
    expect(threads[0].comments[1].inReplyTo).toBe("root-1");
  });

  it("sorts replies by creationDate within a thread", async () => {
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [
        {
          comments: [
            {
              commentId: "reply-2",
              inReplyTo: "root-1",
              content: "Second reply",
              creationDate: new Date("2026-02-14T12:00:00Z"),
            },
            {
              commentId: "root-1",
              content: "Root",
              creationDate: new Date("2026-02-14T10:00:00Z"),
            },
            {
              commentId: "reply-1",
              inReplyTo: "root-1",
              content: "First reply",
              creationDate: new Date("2026-02-14T11:00:00Z"),
            },
          ],
        },
      ],
    });

    const threads = await getComments(mockClient, "42");
    expect(threads[0].comments[0].commentId).toBe("root-1");
    expect(threads[0].comments[1].commentId).toBe("reply-1");
    expect(threads[0].comments[2].commentId).toBe("reply-2");
  });

  it("handles replies with missing creationDate during sort", async () => {
    mockSend.mockResolvedValueOnce({
      commentsForPullRequestData: [
        {
          comments: [
            {
              commentId: "reply-2",
              inReplyTo: "root-1",
              content: "Has date",
              creationDate: new Date("2026-02-14T12:00:00Z"),
            },
            {
              commentId: "root-1",
              content: "Root",
            },
            {
              commentId: "reply-1",
              inReplyTo: "root-1",
              content: "No date",
            },
            {
              commentId: "reply-3",
              inReplyTo: "root-1",
              content: "Also no date",
            },
          ],
        },
      ],
    });

    const threads = await getComments(mockClient, "42");
    expect(threads[0].comments[0].commentId).toBe("root-1");
    // Replies without creationDate (epoch 0) come before those with dates
    expect(threads[0].comments[1].commentId).toBe("reply-1");
    expect(threads[0].comments[2].commentId).toBe("reply-3");
    expect(threads[0].comments[3].commentId).toBe("reply-2");
  });
});

describe("postCommentReply", () => {
  it("posts a reply with inReplyTo and content", async () => {
    const mockReply = {
      commentId: "reply-1",
      content: "Will fix in next PR",
      authorArn: "arn:aws:iam::123456789012:user/watany",
      inReplyTo: "comment-1",
    };
    mockSend.mockResolvedValueOnce({ comment: mockReply });

    const result = await postCommentReply(mockClient, {
      inReplyTo: "comment-1",
      content: "Will fix in next PR",
    });

    expect(result).toEqual(mockReply);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          inReplyTo: "comment-1",
          content: "Will fix in next PR",
        },
      }),
    );
  });

  it("propagates API errors", async () => {
    const error = new Error("comment not found");
    error.name = "CommentDoesNotExistException";
    mockSend.mockRejectedValueOnce(error);

    await expect(
      postCommentReply(mockClient, {
        inReplyTo: "nonexistent",
        content: "reply",
      }),
    ).rejects.toThrow("comment not found");
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

  it("returns placeholder for oversized content (>1MB)", async () => {
    const largeContent = new Uint8Array(1024 * 1024 + 1);
    mockSend.mockResolvedValueOnce({ content: largeContent });
    const content = await getBlobContent(mockClient, "my-service", "blob1");
    expect(content).toBe("[File too large to display]");
  });
});

describe("mergePullRequest", () => {
  it("uses MergePullRequestByFastForwardCommand for fast-forward strategy", async () => {
    const mockPR = { pullRequestId: "42", pullRequestStatus: "CLOSED" };
    mockSend.mockResolvedValueOnce({ pullRequest: mockPR });

    const result = await mergePullRequest(mockClient, {
      pullRequestId: "42",
      repositoryName: "my-service",
      strategy: "fast-forward",
    });

    expect(result).toEqual(mockPR);
    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.constructor.name).toBe("MergePullRequestByFastForwardCommand");
    expect(sentCommand.input).toEqual({
      pullRequestId: "42",
      repositoryName: "my-service",
      sourceCommitId: undefined,
    });
  });

  it("uses MergePullRequestBySquashCommand for squash strategy", async () => {
    const mockPR = { pullRequestId: "42", pullRequestStatus: "CLOSED" };
    mockSend.mockResolvedValueOnce({ pullRequest: mockPR });

    const result = await mergePullRequest(mockClient, {
      pullRequestId: "42",
      repositoryName: "my-service",
      strategy: "squash",
    });

    expect(result).toEqual(mockPR);
    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.constructor.name).toBe("MergePullRequestBySquashCommand");
  });

  it("uses MergePullRequestByThreeWayCommand for three-way strategy", async () => {
    const mockPR = { pullRequestId: "42", pullRequestStatus: "CLOSED" };
    mockSend.mockResolvedValueOnce({ pullRequest: mockPR });

    const result = await mergePullRequest(mockClient, {
      pullRequestId: "42",
      repositoryName: "my-service",
      strategy: "three-way",
    });

    expect(result).toEqual(mockPR);
    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.constructor.name).toBe("MergePullRequestByThreeWayCommand");
  });

  it("passes sourceCommitId when provided", async () => {
    mockSend.mockResolvedValueOnce({ pullRequest: { pullRequestId: "42" } });

    await mergePullRequest(mockClient, {
      pullRequestId: "42",
      repositoryName: "my-service",
      sourceCommitId: "abc123",
      strategy: "fast-forward",
    });

    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.input.sourceCommitId).toBe("abc123");
  });

  it("propagates API errors", async () => {
    const error = new Error("merge failed");
    error.name = "ManualMergeRequiredException";
    mockSend.mockRejectedValueOnce(error);

    await expect(
      mergePullRequest(mockClient, {
        pullRequestId: "42",
        repositoryName: "my-service",
        strategy: "fast-forward",
      }),
    ).rejects.toThrow("merge failed");
  });
});

describe("getMergeConflicts", () => {
  it("returns mergeable summary when no conflicts", async () => {
    mockSend.mockResolvedValueOnce({
      mergeable: true,
      conflictMetadataList: [],
    });

    const result = await getMergeConflicts(mockClient, {
      repositoryName: "my-service",
      sourceCommitId: "abc123",
      destinationCommitId: "def456",
      strategy: "fast-forward",
    });

    expect(result).toEqual({
      mergeable: true,
      conflictCount: 0,
      conflictFiles: [],
    });
  });

  it("returns conflict details when conflicts exist", async () => {
    mockSend.mockResolvedValueOnce({
      mergeable: false,
      conflictMetadataList: [
        { filePath: "src/auth.ts", numberOfConflicts: 2 },
        { filePath: "src/config.ts", numberOfConflicts: 1 },
      ],
    });

    const result = await getMergeConflicts(mockClient, {
      repositoryName: "my-service",
      sourceCommitId: "abc123",
      destinationCommitId: "def456",
      strategy: "squash",
    });

    expect(result).toEqual({
      mergeable: false,
      conflictCount: 2,
      conflictFiles: ["src/auth.ts", "src/config.ts"],
    });
  });

  it("uses (unknown) for conflict files with missing filePath", async () => {
    mockSend.mockResolvedValueOnce({
      mergeable: false,
      conflictMetadataList: [{ filePath: undefined, numberOfConflicts: 1 }],
    });

    const result = await getMergeConflicts(mockClient, {
      repositoryName: "my-service",
      sourceCommitId: "abc123",
      destinationCommitId: "def456",
      strategy: "squash",
    });

    expect(result.conflictFiles).toEqual(["(unknown)"]);
  });

  it("maps merge strategy to correct mergeOption", async () => {
    mockSend.mockResolvedValueOnce({ mergeable: true, conflictMetadataList: [] });
    await getMergeConflicts(mockClient, {
      repositoryName: "my-service",
      sourceCommitId: "abc",
      destinationCommitId: "def",
      strategy: "fast-forward",
    });
    expect(mockSend.mock.calls[0][0].input.mergeOption).toBe("FAST_FORWARD_MERGE");

    mockSend.mockResolvedValueOnce({ mergeable: true, conflictMetadataList: [] });
    await getMergeConflicts(mockClient, {
      repositoryName: "my-service",
      sourceCommitId: "abc",
      destinationCommitId: "def",
      strategy: "squash",
    });
    expect(mockSend.mock.calls[1][0].input.mergeOption).toBe("SQUASH_MERGE");

    mockSend.mockResolvedValueOnce({ mergeable: true, conflictMetadataList: [] });
    await getMergeConflicts(mockClient, {
      repositoryName: "my-service",
      sourceCommitId: "abc",
      destinationCommitId: "def",
      strategy: "three-way",
    });
    expect(mockSend.mock.calls[2][0].input.mergeOption).toBe("THREE_WAY_MERGE");
  });

  it("handles undefined mergeable and conflictMetadataList", async () => {
    mockSend.mockResolvedValueOnce({
      mergeable: undefined,
      conflictMetadataList: undefined,
    });

    const result = await getMergeConflicts(mockClient, {
      repositoryName: "my-service",
      sourceCommitId: "abc",
      destinationCommitId: "def",
      strategy: "three-way",
    });

    expect(result).toEqual({
      mergeable: false,
      conflictCount: 0,
      conflictFiles: [],
    });
  });

  it("propagates API errors", async () => {
    const error = new Error("access denied");
    error.name = "AccessDeniedException";
    mockSend.mockRejectedValueOnce(error);

    await expect(
      getMergeConflicts(mockClient, {
        repositoryName: "my-service",
        sourceCommitId: "abc",
        destinationCommitId: "def",
        strategy: "fast-forward",
      }),
    ).rejects.toThrow("access denied");
  });
});

describe("closePullRequest", () => {
  it("sends UpdatePullRequestStatusCommand with CLOSED status", async () => {
    const mockPR = { pullRequestId: "42", pullRequestStatus: "CLOSED" };
    mockSend.mockResolvedValueOnce({ pullRequest: mockPR });

    const result = await closePullRequest(mockClient, {
      pullRequestId: "42",
    });

    expect(result).toEqual(mockPR);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          pullRequestId: "42",
          pullRequestStatus: "CLOSED",
        },
      }),
    );
  });

  it("propagates API errors", async () => {
    const error = new Error("already closed");
    error.name = "PullRequestAlreadyClosedException";
    mockSend.mockRejectedValueOnce(error);

    await expect(
      closePullRequest(mockClient, {
        pullRequestId: "42",
      }),
    ).rejects.toThrow("already closed");
  });
});

describe("getCommit", () => {
  it("returns CommitInfo with correct fields", async () => {
    mockSend.mockResolvedValueOnce({
      commit: {
        commitId: "abc1234567890",
        parents: ["parent123"],
        message: "Fix login timeout\n\nDetailed description",
        author: {
          name: "watany",
          email: "watany@example.com",
          date: "1707868800",
        },
      },
    });

    const result = await getCommit(mockClient, "my-service", "abc1234567890");
    expect(result.commitId).toBe("abc1234567890");
    expect(result.shortId).toBe("abc1234");
    expect(result.message).toBe("Fix login timeout");
    expect(result.authorName).toBe("watany");
    expect(result.authorDate).toBeInstanceOf(Date);
    expect(result.parentIds).toEqual(["parent123"]);
  });

  it("throws when commit is undefined", async () => {
    mockSend.mockResolvedValueOnce({ commit: undefined });
    await expect(getCommit(mockClient, "my-service", "nonexistent")).rejects.toThrow(
      "Commit nonexistent not found.",
    );
  });

  it("extracts first line of multiline message", async () => {
    mockSend.mockResolvedValueOnce({
      commit: {
        commitId: "abc1234",
        parents: [],
        message: "First line\nSecond line\nThird line",
        author: { name: "watany", date: "1707868800" },
      },
    });

    const result = await getCommit(mockClient, "my-service", "abc1234");
    expect(result.message).toBe("First line");
  });

  it("defaults authorName to unknown when not set", async () => {
    mockSend.mockResolvedValueOnce({
      commit: {
        commitId: "abc1234",
        parents: [],
        message: "test",
        author: { date: "1707868800" },
      },
    });

    const result = await getCommit(mockClient, "my-service", "abc1234");
    expect(result.authorName).toBe("unknown");
  });

  it("defaults authorDate to now when not set", async () => {
    const before = Date.now();
    mockSend.mockResolvedValueOnce({
      commit: {
        commitId: "abc1234",
        parents: [],
        message: "test",
        author: { name: "watany" },
      },
    });

    const result = await getCommit(mockClient, "my-service", "abc1234");
    expect(result.authorDate.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("handles empty message", async () => {
    mockSend.mockResolvedValueOnce({
      commit: {
        commitId: "abc1234",
        parents: [],
        message: undefined,
        author: { name: "watany", date: "1707868800" },
      },
    });

    const result = await getCommit(mockClient, "my-service", "abc1234");
    expect(result.message).toBe("");
  });

  it("handles undefined parents", async () => {
    mockSend.mockResolvedValueOnce({
      commit: {
        commitId: "abc1234",
        parents: undefined,
        message: "test",
        author: { name: "watany", date: "1707868800" },
      },
    });

    const result = await getCommit(mockClient, "my-service", "abc1234");
    expect(result.parentIds).toEqual([]);
  });

  it("falls back to input commitId when commit.commitId is undefined", async () => {
    mockSend.mockResolvedValueOnce({
      commit: {
        commitId: undefined,
        parents: [],
        message: "test",
        author: { name: "watany", date: "1707868800" },
      },
    });

    const result = await getCommit(mockClient, "my-service", "fallback123");
    expect(result.commitId).toBe("fallback123");
    expect(result.shortId).toBe("fallbac");
  });
});

describe("getCommitsForPR", () => {
  it("returns commits in chronological order (oldest first)", async () => {
    // sourceCommit = commit3, mergeBase = base
    // commit3 -> commit2 -> commit1 -> base
    mockSend.mockResolvedValueOnce({
      commit: {
        commitId: "commit3",
        parents: ["commit2"],
        message: "Third commit",
        author: { name: "watany", date: "1707868803" },
      },
    });
    mockSend.mockResolvedValueOnce({
      commit: {
        commitId: "commit2",
        parents: ["commit1"],
        message: "Second commit",
        author: { name: "watany", date: "1707868802" },
      },
    });
    mockSend.mockResolvedValueOnce({
      commit: {
        commitId: "commit1",
        parents: ["base"],
        message: "First commit",
        author: { name: "watany", date: "1707868801" },
      },
    });

    const result = await getCommitsForPR(mockClient, "my-service", "commit3", "base");
    expect(result).toHaveLength(3);
    expect(result[0].commitId).toBe("commit1");
    expect(result[1].commitId).toBe("commit2");
    expect(result[2].commitId).toBe("commit3");
  });

  it("returns single commit when parent is mergeBase", async () => {
    mockSend.mockResolvedValueOnce({
      commit: {
        commitId: "commit1",
        parents: ["base"],
        message: "Only commit",
        author: { name: "watany", date: "1707868801" },
      },
    });

    const result = await getCommitsForPR(mockClient, "my-service", "commit1", "base");
    expect(result).toHaveLength(1);
    expect(result[0].commitId).toBe("commit1");
  });

  it("returns empty array when sourceCommit equals mergeBase", async () => {
    const result = await getCommitsForPR(mockClient, "my-service", "base", "base");
    expect(result).toHaveLength(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("stops when commit has no parents", async () => {
    mockSend.mockResolvedValueOnce({
      commit: {
        commitId: "orphan",
        parents: [],
        message: "Orphan commit",
        author: { name: "watany", date: "1707868801" },
      },
    });

    const result = await getCommitsForPR(mockClient, "my-service", "orphan", "base");
    expect(result).toHaveLength(1);
    expect(result[0].commitId).toBe("orphan");
  });

  it("limits to MAX_COMMITS (100)", async () => {
    // Create a chain of 101 commits that never reaches mergeBase
    for (let i = 0; i < 100; i++) {
      mockSend.mockResolvedValueOnce({
        commit: {
          commitId: `commit-${i}`,
          parents: [`commit-${i + 1}`],
          message: `Commit ${i}`,
          author: { name: "watany", date: "1707868800" },
        },
      });
    }

    const result = await getCommitsForPR(mockClient, "my-service", "commit-0", "unreachable");
    expect(result).toHaveLength(100);
  });
});

describe("getCommitDifferences", () => {
  it("returns differences between two commits", async () => {
    mockSend.mockResolvedValueOnce({
      differences: [
        {
          beforeBlob: { blobId: "b1", path: "src/auth.ts" },
          afterBlob: { blobId: "b2", path: "src/auth.ts" },
        },
      ],
    });

    const result = await getCommitDifferences(mockClient, "my-service", "parent1", "commit1");
    expect(result).toHaveLength(1);
    expect(result[0].afterBlob?.path).toBe("src/auth.ts");
  });

  it("returns empty array when no differences", async () => {
    mockSend.mockResolvedValueOnce({ differences: undefined });

    const result = await getCommitDifferences(mockClient, "my-service", "parent1", "commit1");
    expect(result).toHaveLength(0);
  });

  it("passes correct commit specifiers", async () => {
    mockSend.mockResolvedValueOnce({ differences: [] });

    await getCommitDifferences(mockClient, "my-service", "parentABC", "commitDEF");

    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.input).toEqual(
      expect.objectContaining({
        repositoryName: "my-service",
        beforeCommitSpecifier: "parentABC",
        afterCommitSpecifier: "commitDEF",
      }),
    );
  });

  it("paginates when NextToken is present", async () => {
    mockSend.mockResolvedValueOnce({
      differences: [{ beforeBlob: { blobId: "b1" }, afterBlob: { blobId: "b2" } }],
      NextToken: "page2",
    });
    mockSend.mockResolvedValueOnce({
      differences: [{ beforeBlob: { blobId: "b3" }, afterBlob: { blobId: "b4" } }],
      NextToken: undefined,
    });

    const result = await getCommitDifferences(mockClient, "my-service", "parent1", "commit1");
    expect(result).toHaveLength(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});

describe("updateComment", () => {
  it("sends UpdateCommentCommand with correct parameters and returns updated comment", async () => {
    const mockComment = {
      commentId: "comment-1",
      content: "Updated content",
      authorArn: "arn:aws:iam::123456789012:user/watany",
    };
    mockSend.mockResolvedValueOnce({ comment: mockComment });

    const result = await updateComment(mockClient, {
      commentId: "comment-1",
      content: "Updated content",
    });

    expect(result).toEqual(mockComment);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          commentId: "comment-1",
          content: "Updated content",
        },
      }),
    );
  });

  it("propagates API errors", async () => {
    const error = new Error("not your comment");
    error.name = "CommentNotCreatedByCallerException";
    mockSend.mockRejectedValueOnce(error);

    await expect(
      updateComment(mockClient, {
        commentId: "comment-1",
        content: "New content",
      }),
    ).rejects.toThrow("not your comment");
  });
});

describe("deleteComment", () => {
  it("sends DeleteCommentContentCommand with correct parameters and returns deleted comment", async () => {
    const mockComment = {
      commentId: "comment-1",
      content: "",
      deleted: true,
      authorArn: "arn:aws:iam::123456789012:user/watany",
    };
    mockSend.mockResolvedValueOnce({ comment: mockComment });

    const result = await deleteComment(mockClient, {
      commentId: "comment-1",
    });

    expect(result).toEqual(mockComment);
    expect(result.deleted).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          commentId: "comment-1",
        },
      }),
    );
  });

  it("propagates API errors", async () => {
    const error = new Error("already deleted");
    error.name = "CommentDeletedException";
    mockSend.mockRejectedValueOnce(error);

    await expect(
      deleteComment(mockClient, {
        commentId: "comment-1",
      }),
    ).rejects.toThrow("already deleted");
  });
});

describe("putReaction", () => {
  it("sends PutCommentReactionCommand with correct parameters", async () => {
    mockSend.mockResolvedValueOnce({});

    await putReaction(mockClient, {
      commentId: "comment-1",
      reactionValue: ":thumbsup:",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          commentId: "comment-1",
          reactionValue: ":thumbsup:",
        },
      }),
    );
  });

  it("propagates API errors", async () => {
    const error = new Error("comment deleted");
    error.name = "CommentDeletedException";
    mockSend.mockRejectedValueOnce(error);

    await expect(
      putReaction(mockClient, {
        commentId: "comment-1",
        reactionValue: ":thumbsup:",
      }),
    ).rejects.toThrow("comment deleted");
  });
});

describe("getReactionsForComment", () => {
  it("returns ReactionSummary array with correct aggregation", async () => {
    mockSend.mockResolvedValueOnce({
      reactionsForComment: [
        {
          reaction: { emoji: "👍", shortCode: ":thumbsup:", unicode: "U+1F44D" },
          reactionUsers: [
            "arn:aws:iam::123456789012:user/alice",
            "arn:aws:iam::123456789012:user/bob",
          ],
          reactionsFromDeletedUsersCount: 0,
        },
        {
          reaction: { emoji: "🎉", shortCode: ":hooray:", unicode: "U+1F389" },
          reactionUsers: ["arn:aws:iam::123456789012:user/alice"],
          reactionsFromDeletedUsersCount: 1,
        },
      ],
    });

    const result = await getReactionsForComment(mockClient, "comment-1");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      emoji: "👍",
      shortCode: ":thumbsup:",
      count: 2,
      userArns: ["arn:aws:iam::123456789012:user/alice", "arn:aws:iam::123456789012:user/bob"],
    });
    expect(result[1]).toEqual({
      emoji: "🎉",
      shortCode: ":hooray:",
      count: 2,
      userArns: ["arn:aws:iam::123456789012:user/alice"],
    });
  });

  it("returns empty array when no reactions", async () => {
    mockSend.mockResolvedValueOnce({
      reactionsForComment: undefined,
    });

    const result = await getReactionsForComment(mockClient, "comment-1");
    expect(result).toHaveLength(0);
  });

  it("includes deleted users in count", async () => {
    mockSend.mockResolvedValueOnce({
      reactionsForComment: [
        {
          reaction: { emoji: "👍", shortCode: ":thumbsup:" },
          reactionUsers: ["arn:aws:iam::123456789012:user/alice"],
          reactionsFromDeletedUsersCount: 3,
        },
      ],
    });

    const result = await getReactionsForComment(mockClient, "comment-1");
    expect(result[0].count).toBe(4);
  });

  it("handles missing reaction fields gracefully", async () => {
    mockSend.mockResolvedValueOnce({
      reactionsForComment: [
        {
          reaction: {},
          reactionUsers: undefined,
          reactionsFromDeletedUsersCount: undefined,
        },
      ],
    });

    const result = await getReactionsForComment(mockClient, "comment-1");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      emoji: "",
      shortCode: "",
      count: 0,
      userArns: [],
    });
  });

  it("propagates API errors", async () => {
    const error = new Error("comment not found");
    error.name = "CommentDoesNotExistException";
    mockSend.mockRejectedValueOnce(error);

    await expect(getReactionsForComment(mockClient, "comment-1")).rejects.toThrow(
      "comment not found",
    );
  });
});

describe("getReactionsForComments", () => {
  it("returns Map of commentId to ReactionSummary arrays", async () => {
    mockSend.mockResolvedValueOnce({
      reactionsForComment: [
        {
          reaction: { emoji: "👍", shortCode: ":thumbsup:" },
          reactionUsers: ["arn:aws:iam::123456789012:user/alice"],
          reactionsFromDeletedUsersCount: 0,
        },
      ],
    });
    mockSend.mockResolvedValueOnce({
      reactionsForComment: [
        {
          reaction: { emoji: "🎉", shortCode: ":hooray:" },
          reactionUsers: ["arn:aws:iam::123456789012:user/bob"],
          reactionsFromDeletedUsersCount: 0,
        },
      ],
    });

    const result = await getReactionsForComments(mockClient, ["c1", "c2"]);
    expect(result.size).toBe(2);
    expect(result.get("c1")?.[0].emoji).toBe("👍");
    expect(result.get("c2")?.[0].emoji).toBe("🎉");
  });

  it("continues when individual comment errors occur", async () => {
    mockSend.mockRejectedValueOnce(new Error("deleted"));
    mockSend.mockResolvedValueOnce({
      reactionsForComment: [
        {
          reaction: { emoji: "👍", shortCode: ":thumbsup:" },
          reactionUsers: ["arn:aws:iam::123456789012:user/alice"],
          reactionsFromDeletedUsersCount: 0,
        },
      ],
    });

    const result = await getReactionsForComments(mockClient, ["c1", "c2"]);
    expect(result.size).toBe(1);
    expect(result.has("c1")).toBe(false);
    expect(result.get("c2")?.[0].emoji).toBe("👍");
  });

  it("returns empty Map for empty commentIds list", async () => {
    const result = await getReactionsForComments(mockClient, []);
    expect(result.size).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("limits concurrency to 6 workers", async () => {
    let activeCalls = 0;
    let maxConcurrent = 0;
    const ids = Array.from({ length: 12 }, (_, i) => `c${i}`);

    mockSend.mockImplementation(
      () =>
        new Promise((resolve) => {
          activeCalls++;
          maxConcurrent = Math.max(maxConcurrent, activeCalls);
          setTimeout(() => {
            activeCalls--;
            resolve({ reactionsForComment: [] });
          }, 10);
        }),
    );

    await getReactionsForComments(mockClient, ids);
    expect(maxConcurrent).toBeLessThanOrEqual(6);
    expect(mockSend).toHaveBeenCalledTimes(12);
  });
});
