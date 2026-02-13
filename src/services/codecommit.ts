import {
  CodeCommitClient,
  ListRepositoriesCommand,
  ListPullRequestsCommand,
  GetPullRequestCommand,
  GetDifferencesCommand,
  GetBlobCommand,
  GetCommentsForPullRequestCommand,
  type RepositoryNameIdPair,
  type PullRequest,
  type Difference,
  type Comment,
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
  return new CodeCommitClient({
    ...(config.region && { region: config.region }),
    ...(config.profile && {
      credentials: undefined,
      profile: config.profile,
    }),
  });
}

export async function listRepositories(
  client: CodeCommitClient,
): Promise<RepositoryNameIdPair[]> {
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

  return {
    pullRequests,
    nextToken: listResponse.nextToken,
  };
}

export async function getPullRequestDetail(
  client: CodeCommitClient,
  pullRequestId: string,
  repositoryName: string,
): Promise<PullRequestDetail> {
  const getCommand = new GetPullRequestCommand({ pullRequestId });
  const getResponse = await client.send(getCommand);
  const pullRequest = getResponse.pullRequest!;

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
