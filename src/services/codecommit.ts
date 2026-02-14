import {
  type Approval,
  CodeCommitClient,
  type Comment,
  type Difference,
  EvaluatePullRequestApprovalRulesCommand,
  type Evaluation,
  GetBlobCommand,
  GetCommentsForPullRequestCommand,
  GetDifferencesCommand,
  GetPullRequestApprovalStatesCommand,
  GetPullRequestCommand,
  ListPullRequestsCommand,
  ListRepositoriesCommand,
  PostCommentForPullRequestCommand,
  PostCommentReplyCommand,
  type PullRequest,
  type RepositoryNameIdPair,
  UpdatePullRequestApprovalStateCommand,
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

export interface CommentThread {
  location: {
    filePath: string;
    filePosition: number;
    relativeFileVersion: "BEFORE" | "AFTER";
  } | null;
  comments: Comment[];
}

export interface PullRequestDetail {
  pullRequest: PullRequest;
  differences: Difference[];
  commentThreads: CommentThread[];
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

  const commentThreads = await fetchCommentThreads(client, pullRequestId, {
    repositoryName,
    ...(target?.sourceCommit && target?.destinationCommit
      ? {
          afterCommitId: target.sourceCommit,
          beforeCommitId: target.destinationCommit,
        }
      : {}),
  });

  return { pullRequest, differences, commentThreads };
}

function sortCommentsRootFirst(comments: Comment[]): Comment[] {
  const root: Comment[] = [];
  const replies: Comment[] = [];
  for (const c of comments) {
    if (c.inReplyTo) {
      replies.push(c);
    } else {
      root.push(c);
    }
  }
  replies.sort((a, b) => (a.creationDate?.getTime() ?? 0) - (b.creationDate?.getTime() ?? 0));
  return [...root, ...replies];
}

async function fetchCommentThreads(
  client: CodeCommitClient,
  pullRequestId: string,
  params?: {
    repositoryName?: string;
    afterCommitId?: string;
    beforeCommitId?: string;
  },
): Promise<CommentThread[]> {
  const commentThreads: CommentThread[] = [];
  const commentsCommand = new GetCommentsForPullRequestCommand({
    pullRequestId,
    ...(params?.repositoryName ? { repositoryName: params.repositoryName } : {}),
    ...(params?.afterCommitId && params?.beforeCommitId
      ? {
          afterCommitId: params.afterCommitId,
          beforeCommitId: params.beforeCommitId,
        }
      : {}),
  });
  const commentsResponse = await client.send(commentsCommand);
  for (const thread of commentsResponse.commentsForPullRequestData ?? []) {
    const location = thread.location?.filePath
      ? {
          filePath: thread.location.filePath,
          filePosition: thread.location.filePosition ?? 0,
          relativeFileVersion:
            (thread.location.relativeFileVersion as "BEFORE" | "AFTER") ?? "AFTER",
        }
      : null;
    commentThreads.push({
      location,
      comments: sortCommentsRootFirst(thread.comments ?? []),
    });
  }
  return commentThreads;
}

export async function getComments(
  client: CodeCommitClient,
  pullRequestId: string,
  params?: {
    repositoryName?: string;
    afterCommitId?: string;
    beforeCommitId?: string;
  },
): Promise<CommentThread[]> {
  return fetchCommentThreads(client, pullRequestId, params);
}

export async function postComment(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    repositoryName: string;
    beforeCommitId: string;
    afterCommitId: string;
    content: string;
    location?: {
      filePath: string;
      filePosition: number;
      relativeFileVersion: "BEFORE" | "AFTER";
    };
  },
): Promise<Comment> {
  const command = new PostCommentForPullRequestCommand({
    pullRequestId: params.pullRequestId,
    repositoryName: params.repositoryName,
    beforeCommitId: params.beforeCommitId,
    afterCommitId: params.afterCommitId,
    content: params.content,
    location: params.location
      ? {
          filePath: params.location.filePath,
          filePosition: params.location.filePosition,
          relativeFileVersion: params.location.relativeFileVersion,
        }
      : undefined,
  });
  const response = await client.send(command);
  return response.comment!;
}

export async function postCommentReply(
  client: CodeCommitClient,
  params: {
    inReplyTo: string;
    content: string;
  },
): Promise<Comment> {
  const command = new PostCommentReplyCommand({
    inReplyTo: params.inReplyTo,
    content: params.content,
  });
  const response = await client.send(command);
  return response.comment!;
}

export async function updateApprovalState(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    revisionId: string;
    approvalState: "APPROVE" | "REVOKE";
  },
): Promise<void> {
  const command = new UpdatePullRequestApprovalStateCommand({
    pullRequestId: params.pullRequestId,
    revisionId: params.revisionId,
    approvalState: params.approvalState,
  });
  await client.send(command);
}

export async function getApprovalStates(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    revisionId: string;
  },
): Promise<Approval[]> {
  const command = new GetPullRequestApprovalStatesCommand({
    pullRequestId: params.pullRequestId,
    revisionId: params.revisionId,
  });
  const response = await client.send(command);
  return response.approvals ?? [];
}

export async function evaluateApprovalRules(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    revisionId: string;
  },
): Promise<Evaluation | null> {
  const command = new EvaluatePullRequestApprovalRulesCommand({
    pullRequestId: params.pullRequestId,
    revisionId: params.revisionId,
  });
  const response = await client.send(command);
  return response.evaluation ?? null;
}

const MAX_BLOB_SIZE = 1024 * 1024; // 1MB limit for TUI display

export async function getBlobContent(
  client: CodeCommitClient,
  repositoryName: string,
  blobId: string,
): Promise<string> {
  const command = new GetBlobCommand({ repositoryName, blobId });
  const response = await client.send(command);
  if (response.content) {
    if (response.content.byteLength > MAX_BLOB_SIZE) {
      return "[File too large to display]";
    }
    return new TextDecoder().decode(response.content);
  }
  return "";
}
