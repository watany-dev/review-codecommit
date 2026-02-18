import {
  type Approval,
  CodeCommitClient,
  type Comment,
  DeleteCommentContentCommand,
  type Difference,
  EvaluatePullRequestApprovalRulesCommand,
  type Evaluation,
  GetBlobCommand,
  GetCommentReactionsCommand,
  GetCommentsForPullRequestCommand,
  GetCommitCommand,
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
  PutCommentReactionCommand,
  type RepositoryNameIdPair,
  UpdateCommentCommand,
  UpdatePullRequestApprovalStateCommand,
  UpdatePullRequestStatusCommand,
} from "@aws-sdk/client-codecommit";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { mapWithLimit } from "../utils/mapWithLimit.js";

const textDecoder = new TextDecoder();

export interface CodeCommitConfig {
  profile?: string;
  region?: string;
}

export type PullRequestDisplayStatus = "OPEN" | "CLOSED" | "MERGED";

export interface PullRequestSummary {
  pullRequestId: string;
  title: string;
  authorArn: string;
  creationDate: Date;
  status: PullRequestDisplayStatus;
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
  return new CodeCommitClient({
    ...(config.region && { region: config.region }),
    ...(config.profile && { profile: config.profile }),
    requestHandler: new NodeHttpHandler({
      requestTimeout: 10_000,
      connectionTimeout: 5_000,
    }),
  });
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
  pullRequestStatus?: "OPEN" | "CLOSED",
): Promise<{ pullRequests: PullRequestSummary[]; nextToken?: string }> {
  const listCommand = new ListPullRequestsCommand({
    repositoryName,
    pullRequestStatus: pullRequestStatus ?? "OPEN",
    maxResults: 25,
    nextToken,
  });
  const listResponse = await client.send(listCommand);
  const pullRequestIds = listResponse.pullRequestIds ?? [];

  const pullRequests: PullRequestSummary[] = (
    await mapWithLimit(pullRequestIds, 5, async (id) => {
      const getCommand = new GetPullRequestCommand({ pullRequestId: id });
      const getResponse = await client.send(getCommand);
      const pr = getResponse.pullRequest;
      if (!pr) return null;

      const apiStatus = pr.pullRequestStatus ?? "OPEN";
      const isMerged = pr.pullRequestTargets?.[0]?.mergeMetadata?.isMerged === true;
      const displayStatus: PullRequestDisplayStatus =
        apiStatus === "CLOSED" && isMerged ? "MERGED" : (apiStatus as PullRequestDisplayStatus);

      return {
        pullRequestId: pr.pullRequestId ?? id,
        title: pr.title ?? "(no title)",
        authorArn: pr.authorArn ?? "unknown",
        creationDate: pr.creationDate ?? new Date(),
        status: displayStatus,
      };
    })
  ).filter((pr): pr is PullRequestSummary => pr !== null);

  const result: { pullRequests: PullRequestSummary[]; nextToken?: string } = { pullRequests };
  if (listResponse.nextToken != null) result.nextToken = listResponse.nextToken;
  return result;
}

async function getAllDifferences(
  client: CodeCommitClient,
  repositoryName: string,
  beforeCommitSpecifier: string,
  afterCommitSpecifier: string,
): Promise<Difference[]> {
  const allDifferences: Difference[] = [];
  let nextToken: string | undefined;
  do {
    const response = await client.send(
      new GetDifferencesCommand({
        repositoryName,
        beforeCommitSpecifier,
        afterCommitSpecifier,
        NextToken: nextToken,
      }),
    );
    allDifferences.push(...(response.differences ?? []));
    nextToken = response.NextToken;
  } while (nextToken);
  return allDifferences;
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

  const [differences, commentThreads] = await Promise.all([
    hasCommits
      ? getAllDifferences(client, repositoryName, target!.destinationCommit!, target!.sourceCommit!)
      : Promise.resolve([]),
    getComments(client, pullRequestId, {
      repositoryName,
      ...(hasCommits
        ? {
            afterCommitId: target!.sourceCommit!,
            beforeCommitId: target!.destinationCommit!,
          }
        : {}),
    }),
  ]);

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

export async function getComments(
  client: CodeCommitClient,
  pullRequestId: string,
  params?: {
    repositoryName?: string;
    afterCommitId?: string;
    beforeCommitId?: string;
  },
): Promise<CommentThread[]> {
  const commentThreads: CommentThread[] = [];
  const baseInput = {
    pullRequestId,
    ...(params?.repositoryName ? { repositoryName: params.repositoryName } : {}),
    ...(params?.afterCommitId && params?.beforeCommitId
      ? {
          afterCommitId: params.afterCommitId,
          beforeCommitId: params.beforeCommitId,
        }
      : {}),
  };
  let nextToken: string | undefined;
  do {
    const commentsResponse = await client.send(
      new GetCommentsForPullRequestCommand({ ...baseInput, nextToken }),
    );
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
    nextToken = commentsResponse.nextToken;
  } while (nextToken);
  return commentThreads;
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
  if (!response.comment) throw new Error("Empty comment response from CodeCommit API.");
  return response.comment;
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
  if (!response.comment) throw new Error("Empty reply response from CodeCommit API.");
  return response.comment;
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
    return textDecoder.decode(response.content);
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
  if (!response.pullRequest) throw new Error("Empty merge response from CodeCommit API.");
  return response.pullRequest;
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
  if (!response.pullRequest) throw new Error("Empty close response from CodeCommit API.");
  return response.pullRequest;
}

export interface CommitInfo {
  commitId: string;
  shortId: string;
  message: string;
  authorName: string;
  authorDate: Date;
  parentIds: string[];
}

export async function getCommit(
  client: CodeCommitClient,
  repositoryName: string,
  commitId: string,
): Promise<CommitInfo> {
  const command = new GetCommitCommand({ repositoryName, commitId });
  const response = await client.send(command);
  const commit = response.commit;
  if (!commit) throw new Error(`Commit ${commitId} not found.`);

  return {
    commitId: commit.commitId ?? commitId,
    shortId: (commit.commitId ?? commitId).slice(0, 7),
    /* v8 ignore next -- split always returns at least one element */
    message: (commit.message ?? "").split("\n")[0] ?? "",
    authorName: commit.author?.name ?? "unknown",
    authorDate: commit.author?.date ? new Date(commit.author.date) : new Date(),
    parentIds: commit.parents ?? [],
  };
}

const MAX_COMMITS = 100;

export async function getCommitsForPR(
  client: CodeCommitClient,
  repositoryName: string,
  sourceCommit: string,
  mergeBase: string,
): Promise<CommitInfo[]> {
  const commits: CommitInfo[] = [];
  let currentId = sourceCommit;

  while (currentId !== mergeBase && commits.length < MAX_COMMITS) {
    const commit = await getCommit(client, repositoryName, currentId);
    commits.push(commit);
    if (commit.parentIds.length === 0) break;
    currentId = commit.parentIds[0]!;
  }

  return commits.reverse();
}

export async function getCommitDifferences(
  client: CodeCommitClient,
  repositoryName: string,
  beforeCommitId: string,
  afterCommitId: string,
): Promise<Difference[]> {
  return getAllDifferences(client, repositoryName, beforeCommitId, afterCommitId);
}

export async function updateComment(
  client: CodeCommitClient,
  params: {
    commentId: string;
    content: string;
  },
): Promise<Comment> {
  const command = new UpdateCommentCommand({
    commentId: params.commentId,
    content: params.content,
  });
  const response = await client.send(command);
  if (!response.comment) throw new Error("Empty update response from CodeCommit API.");
  return response.comment;
}

export async function deleteComment(
  client: CodeCommitClient,
  params: {
    commentId: string;
  },
): Promise<Comment> {
  const command = new DeleteCommentContentCommand({
    commentId: params.commentId,
  });
  const response = await client.send(command);
  if (!response.comment) throw new Error("Empty delete response from CodeCommit API.");
  return response.comment;
}

/** Aggregated reaction information for a single comment */
export interface ReactionSummary {
  emoji: string;
  shortCode: string;
  count: number;
  userArns: string[];
}

/** commentId → ReactionSummary[] mapping */
export type ReactionsByComment = Map<string, ReactionSummary[]>;

export async function putReaction(
  client: CodeCommitClient,
  params: {
    commentId: string;
    reactionValue: string;
  },
): Promise<void> {
  const command = new PutCommentReactionCommand({
    commentId: params.commentId,
    reactionValue: params.reactionValue,
  });
  await client.send(command);
}

export async function getReactionsForComment(
  client: CodeCommitClient,
  commentId: string,
): Promise<ReactionSummary[]> {
  const command = new GetCommentReactionsCommand({
    commentId,
  });
  const response = await client.send(command);

  return (response.reactionsForComment ?? []).map((r) => ({
    emoji: r.reaction?.emoji ?? "",
    shortCode: r.reaction?.shortCode ?? "",
    count: (r.reactionUsers?.length ?? 0) + (r.reactionsFromDeletedUsersCount ?? 0),
    userArns: r.reactionUsers ?? [],
  }));
}

export async function getReactionsForComments(
  client: CodeCommitClient,
  commentIds: string[],
): Promise<ReactionsByComment> {
  const results: ReactionsByComment = new Map();
  const settled = await mapWithLimit(commentIds, 5, async (commentId) => {
    try {
      const reactions = await getReactionsForComment(client, commentId);
      return { commentId, reactions };
    } catch {
      return { commentId, reactions: [] as ReactionSummary[] };
    }
  });
  for (const { commentId, reactions } of settled) {
    if (reactions.length > 0) {
      results.set(commentId, reactions);
    }
  }
  return results;
}
