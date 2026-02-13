import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listRepositories,
  listPullRequests,
  getPullRequestDetail,
  getBlobContent,
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
    expect(detail.comments).toHaveLength(1);
    expect(detail.comments[0].content).toBe("LGTM");
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
