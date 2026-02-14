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
  GetMergeConflictsCommand,
  GetPullRequestApprovalStatesCommand,
  GetPullRequestCommand,
  ListPullRequestsCommand,
  ListRepositoriesCommand,
  MergePullRequestByFastForwardCommand,
  MergePullRequestBySquashCommand,
  MergePullRequestByThreeWayCommand,
  PostCommentForPullRequestCommand,
  PostCommentReplyCommand,
  type PullRequest,
  type RepositoryNameIdPair,
  UpdatePullRequestApprovalStateCommand,
  UpdatePullRequestStatusCommand,
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

  const pullRequests: PullRequestSummary[] = (
    await Promise.all(
      pullRequestIds.map(async (id) => {
        const getCommand = new GetPullRequestCommand({ pullRequestId: id });
        const getResponse = await client.send(getCommand);
        const pr = getResponse.pullRequest;
        if (!pr) return null;
        return {
          pullRequestId: pr.pullRequestId ?? id,
          title: pr.title ?? "(no title)",
          authorArn: pr.authorArn ?? "unknown",
          creationDate: pr.creationDate ?? new Date(),
        };
      }),
    )
  ).filter((pr): pr is PullRequestSummary => pr !== null);

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
  const hasCommits = !!(target?.sourceCommit && target?.destinationCommit);

  const [diffResult, commentThreads] = await Promise.all([
    hasCommits
      ? client
          .send(
            new GetDifferencesCommand({
              repositoryName,
              beforeCommitSpecifier: target!.destinationCommit!,
              afterCommitSpecifier: target!.sourceCommit!,
            }),
          )
          .then((r) => r.differences ?? [])
      : Promise.resolve([]),
    fetchCommentThreads(client, pullRequestId, {
      repositoryName,
      ...(hasCommits
        ? {
            afterCommitId: target!.sourceCommit!,
            beforeCommitId: target!.destinationCommit!,
          }
        : {}),
    }),
  ]);

  return { pullRequest, differences: diffResult as Difference[], commentThreads };
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

export type MergeStrategy = "fast-forward" | "squash" | "three-way";

export interface ConflictSummary {
  mergeable: boolean;
  conflictCount: number;
  conflictFiles: string[];
}

export async function mergePullRequest(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    repositoryName: string;
    sourceCommitId?: string | undefined;
    strategy: MergeStrategy;
  },
): Promise<PullRequest> {
  let command;
  switch (params.strategy) {
    case "fast-forward":
      command = new MergePullRequestByFastForwardCommand({
        pullRequestId: params.pullRequestId,
        repositoryName: params.repositoryName,
        sourceCommitId: params.sourceCommitId,
      });
      break;
    case "squash":
      command = new MergePullRequestBySquashCommand({
        pullRequestId: params.pullRequestId,
        repositoryName: params.repositoryName,
        sourceCommitId: params.sourceCommitId,
      });
      break;
    case "three-way":
      command = new MergePullRequestByThreeWayCommand({
        pullRequestId: params.pullRequestId,
        repositoryName: params.repositoryName,
        sourceCommitId: params.sourceCommitId,
      });
      break;
  }
  const response = await client.send(command);
  return response.pullRequest!;
}

export async function getMergeConflicts(
  client: CodeCommitClient,
  params: {
    repositoryName: string;
    sourceCommitId: string;
    destinationCommitId: string;
    strategy: MergeStrategy;
  },
): Promise<ConflictSummary> {
  const mergeOptionMap: Record<
    MergeStrategy,
    "FAST_FORWARD_MERGE" | "SQUASH_MERGE" | "THREE_WAY_MERGE"
  > = {
    "fast-forward": "FAST_FORWARD_MERGE",
    squash: "SQUASH_MERGE",
    "three-way": "THREE_WAY_MERGE",
  };

  const command = new GetMergeConflictsCommand({
    repositoryName: params.repositoryName,
    sourceCommitSpecifier: params.sourceCommitId,
    destinationCommitSpecifier: params.destinationCommitId,
    mergeOption: mergeOptionMap[params.strategy],
  });
  const response = await client.send(command);

  return {
    mergeable: response.mergeable ?? false,
    conflictCount: response.conflictMetadataList?.length ?? 0,
    conflictFiles: (response.conflictMetadataList ?? [])
      .map((c) => c.filePath ?? "(unknown)")
      .filter(Boolean),
  };
}

export async function closePullRequest(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
  },
): Promise<PullRequest> {
  const command = new UpdatePullRequestStatusCommand({
    pullRequestId: params.pullRequestId,
    pullRequestStatus: "CLOSED",
  });
  const response = await client.send(command);
  return response.pullRequest!;
}
