import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createClient,
  getBlobContent,
  getPullRequestDetail,
  listPullRequests,
  listRepositories,
} from "./codecommit.js";

const mockSend = vi.fn();

const mockClient = {
  send: mockSend,
} as any;

beforeEach(() => {
  mockSend.mockReset();
});

describe("createClient", () => {
  it("creates client without options", () => {
    const client = createClient({});
    expect(client).toBeDefined();
  });

  it("creates client with profile", () => {
    const client = createClient({ profile: "dev" });
    expect(client).toBeDefined();
  });

  it("creates client with region", () => {
    const client = createClient({ region: "us-east-1" });
    expect(client).toBeDefined();
  });

  it("creates client with all options", () => {
    const client = createClient({ profile: "prod", region: "ap-northeast-1" });
    expect(client).toBeDefined();
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
    expect(detail.comments).toHaveLength(0);
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
    expect(detail.comments).toHaveLength(0);
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
    expect(detail.comments).toHaveLength(0);
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
