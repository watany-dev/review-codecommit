import {
  CodeCommitClient,
  type Comment,
  type Difference,
  GetBlobCommand,
  GetCommentsForPullRequestCommand,
  GetDifferencesCommand,
  GetPullRequestCommand,
  ListPullRequestsCommand,
  ListRepositoriesCommand,
  PostCommentForPullRequestCommand,
  type PullRequest,
  type RepositoryNameIdPair,
} from "@aws-sdk/client-codecommit";

export interface CodeCommitConfig {
  profile?: string;
  region?: string;
}

export interface PullRequestSummary {
  pullRequestId: string;
  title: string;
  authorArn: string;
  creationDate: Date;
}

export interface PullRequestDetail {
  pullRequest: PullRequest;
  differences: Difference[];
  comments: Comment[];
}

export interface FileDiff {
  filePath: string;
  content: string;
}

export function createClient(config: CodeCommitConfig): CodeCommitClient {
  const options: { region?: string; profile?: string } = {};
  if (config.region) options.region = config.region;
  if (config.profile) options.profile = config.profile;
  return new CodeCommitClient(options);
}

export async function listRepositories(client: CodeCommitClient): Promise<RepositoryNameIdPair[]> {
  const command = new ListRepositoriesCommand({
    sortBy: "lastModifiedDate",
    order: "descending",
  });
  const response = await client.send(command);
  return response.repositories ?? [];
}

export async function listPullRequests(
  client: CodeCommitClient,
  repositoryName: string,
  nextToken?: string,
): Promise<{ pullRequests: PullRequestSummary[]; nextToken?: string }> {
  const listCommand = new ListPullRequestsCommand({
    repositoryName,
    pullRequestStatus: "OPEN",
    maxResults: 25,
    nextToken,
  });
  const listResponse = await client.send(listCommand);
  const pullRequestIds = listResponse.pullRequestIds ?? [];

  const pullRequests: PullRequestSummary[] = [];
  for (const id of pullRequestIds) {
    const getCommand = new GetPullRequestCommand({ pullRequestId: id });
    const getResponse = await client.send(getCommand);
    const pr = getResponse.pullRequest;
    if (pr) {
      pullRequests.push({
        pullRequestId: pr.pullRequestId ?? id,
        title: pr.title ?? "(no title)",
        authorArn: pr.authorArn ?? "unknown",
        creationDate: pr.creationDate ?? new Date(),
      });
    }
  }

  const result: { pullRequests: PullRequestSummary[]; nextToken?: string } = { pullRequests };
  if (listResponse.nextToken != null) result.nextToken = listResponse.nextToken;
  return result;
}

export async function getPullRequestDetail(
  client: CodeCommitClient,
  pullRequestId: string,
  repositoryName: string,
): Promise<PullRequestDetail> {
  const getCommand = new GetPullRequestCommand({ pullRequestId });
  const getResponse = await client.send(getCommand);
  const pullRequest = getResponse.pullRequest;
  if (!pullRequest) {
    throw new Error(`Pull request ${pullRequestId} not found.`);
  }

  const target = pullRequest.pullRequestTargets?.[0];
  const differences: Difference[] = [];

  if (target?.sourceCommit && target?.destinationCommit) {
    const diffCommand = new GetDifferencesCommand({
      repositoryName,
      beforeCommitSpecifier: target.destinationCommit,
      afterCommitSpecifier: target.sourceCommit,
    });
    const diffResponse = await client.send(diffCommand);
    differences.push(...(diffResponse.differences ?? []));
  }

  const comments: Comment[] = [];
  const commentsCommand = new GetCommentsForPullRequestCommand({
    pullRequestId,
    repositoryName,
  });
  const commentsResponse = await client.send(commentsCommand);
  for (const thread of commentsResponse.commentsForPullRequestData ?? []) {
    for (const comment of thread.comments ?? []) {
      comments.push(comment);
    }
  }

  return { pullRequest, differences, comments };
}

export async function postComment(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    repositoryName: string;
    beforeCommitId: string;
    afterCommitId: string;
    content: string;
  },
): Promise<Comment> {
  const command = new PostCommentForPullRequestCommand({
    pullRequestId: params.pullRequestId,
    repositoryName: params.repositoryName,
    beforeCommitId: params.beforeCommitId,
    afterCommitId: params.afterCommitId,
    content: params.content,
  });
  const response = await client.send(command);
  return response.comment!;
}

export async function getBlobContent(
  client: CodeCommitClient,
  repositoryName: string,
  blobId: string,
): Promise<string> {
  const command = new GetBlobCommand({ repositoryName, blobId });
  const response = await client.send(command);
  if (response.content) {
    return new TextDecoder().decode(response.content);
  }
  return "";
}
