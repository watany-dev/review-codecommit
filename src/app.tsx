import type {
  Approval,
  CodeCommitClient,
  Difference,
  Evaluation,
  PullRequest,
  RepositoryNameIdPair,
} from "@aws-sdk/client-codecommit";
import { Box, Text } from "ink";
import React, { useEffect, useRef, useState } from "react";
import { ActivityTimeline } from "./components/ActivityTimeline.js";
import { Help } from "./components/Help.js";
import { PullRequestDetail } from "./components/PullRequestDetail.js";
import { PullRequestList } from "./components/PullRequestList.js";
import { RepositoryList } from "./components/RepositoryList.js";
import { useAsyncAction } from "./hooks/useAsyncAction.js";
import {
  type CommentThread,
  type CommitInfo,
  type ConflictSummary,
  closePullRequest,
  deleteComment,
  evaluateApprovalRules,
  getApprovalStates,
  getComments,
  getCommitDifferences,
  getCommitsForPR,
  getMergeConflicts,
  getPullRequestActivity,
  getPullRequestDetail,
  getReactionsForComments,
  listPullRequests,
  listRepositories,
  type MergeStrategy,
  mergePullRequest,
  type PrActivityEvent,
  type PullRequestDisplayStatus,
  type PullRequestSummary,
  postComment,
  postCommentReply,
  putReaction,
  type ReactionsByComment,
  updateApprovalState,
  updateComment,
} from "./services/codecommit.js";
import { blobKey, fetchBlobTexts, streamBlobTexts } from "./utils/blobTexts.js";
import { formatErrorMessage } from "./utils/formatError.js";

type Screen = "repos" | "prs" | "detail" | "activity";

interface PaginationState {
  currentPage: number;
  currentCursor: PaginationCursor;
  nextCursor: PaginationCursor;
  previousCursors: PaginationCursor[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PaginationCursor {
  apiToken: string | undefined;
  pending: PullRequestSummary[];
}

const PAGE_SIZE = 25;

function createPaginationCursor(
  apiToken: string | undefined = undefined,
  pending: PullRequestSummary[] = [],
): PaginationCursor {
  return { apiToken, pending };
}

function createInitialPagination(): PaginationState {
  return {
    currentPage: 1,
    currentCursor: createPaginationCursor(),
    nextCursor: createPaginationCursor(),
    previousCursors: [],
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

function filterPullRequestsByStatus(
  pullRequests: PullRequestSummary[],
  status: PullRequestDisplayStatus,
): PullRequestSummary[] {
  switch (status) {
    case "OPEN":
      return pullRequests;
    case "CLOSED":
      return pullRequests.filter((pr) => pr.status === "CLOSED");
    case "MERGED":
      return pullRequests.filter((pr) => pr.status === "MERGED");
  }
}

interface AppProps {
  client: CodeCommitClient;
  initialRepo?: string;
}

export function App({ client, initialRepo }: AppProps) {
  const [screen, setScreen] = useState<Screen>(initialRepo ? "prs" : "repos");
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [repositories, setRepositories] = useState<RepositoryNameIdPair[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>(initialRepo ?? "");
  const [pullRequests, setPullRequests] = useState<PullRequestSummary[]>([]);

  const [prDetail, setPrDetail] = useState<PullRequest | null>(null);
  const [prDifferences, setPrDifferences] = useState<Difference[]>([]);
  const [commentThreads, setCommentThreads] = useState<CommentThread[]>([]);
  const [diffTexts, setDiffTexts] = useState<Map<string, { before: string; after: string }>>(
    new Map(),
  );
  const [diffTextStatus, setDiffTextStatus] = useState<Map<string, "loading" | "loaded" | "error">>(
    new Map(),
  );

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [approvalEvaluation, setApprovalEvaluation] = useState<Evaluation | null>(null);

  const approvalAction = useAsyncAction(
    async (state: "APPROVE" | "REVOKE") => {
      if (!prDetail?.pullRequestId || !prDetail?.revisionId) return;
      await updateApprovalState(client, {
        pullRequestId: prDetail.pullRequestId,
        revisionId: prDetail.revisionId,
        approvalState: state,
      });
      await reloadApprovals(prDetail.pullRequestId, prDetail.revisionId);
    },
    (err, state?: "APPROVE" | "REVOKE") =>
      formatErrorMessage(err, "approval", state === "APPROVE" ? "approve" : "revoke"),
  );

  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [commitDifferences, setCommitDifferences] = useState<Difference[]>([]);
  const [commitDiffTexts, setCommitDiffTexts] = useState<
    Map<string, { before: string; after: string }>
  >(new Map());
  const [isLoadingCommitDiff, setIsLoadingCommitDiff] = useState(false);

  const detailLoadRef = useRef(0);
  const commitLoadRef = useRef(0);

  const [reactionsByComment, setReactionsByComment] = useState<ReactionsByComment>(new Map());

  const postCommentAction = useAsyncAction(
    async (content: string) => {
      if (!prDetail) return;
      const target = prDetail.pullRequestTargets?.[0];
      if (!target?.destinationCommit || !target?.sourceCommit) return;
      await postComment(client, {
        pullRequestId: prDetail.pullRequestId!,
        repositoryName: selectedRepo,
        beforeCommitId: target.destinationCommit,
        afterCommitId: target.sourceCommit,
        content,
      });
      await reloadComments(prDetail.pullRequestId!);
    },
    (err) => formatErrorMessage(err, "comment"),
  );

  const postInlineCommentAction = useAsyncAction(
    async (
      content: string,
      location: { filePath: string; filePosition: number; relativeFileVersion: "BEFORE" | "AFTER" },
    ) => {
      if (!prDetail) return;
      const target = prDetail.pullRequestTargets?.[0];
      if (!target?.destinationCommit || !target?.sourceCommit) return;
      await postComment(client, {
        pullRequestId: prDetail.pullRequestId!,
        repositoryName: selectedRepo,
        beforeCommitId: target.destinationCommit,
        afterCommitId: target.sourceCommit,
        content,
        location,
      });
      await reloadComments(prDetail.pullRequestId!);
    },
    (err) => formatErrorMessage(err, "comment"),
  );

  const postReplyAction = useAsyncAction(
    async (inReplyTo: string, content: string) => {
      if (!prDetail?.pullRequestId) return;
      await postCommentReply(client, { inReplyTo, content });
      await reloadComments(prDetail.pullRequestId);
    },
    (err) => formatErrorMessage(err, "reply"),
  );

  const mergeAction = useAsyncAction(
    async (strategy: MergeStrategy) => {
      if (!prDetail?.pullRequestId) return;
      const target = prDetail.pullRequestTargets?.[0];
      await mergePullRequest(client, {
        pullRequestId: prDetail.pullRequestId,
        repositoryName: selectedRepo,
        sourceCommitId: target?.sourceCommit,
        strategy,
      });
      // On success, remove merged PR from local state and go back to PR list
      setPullRequests((prev) => prev.filter((pr) => pr.pullRequestId !== prDetail.pullRequestId));
      setScreen("prs");
    },
    (err) => formatErrorMessage(err, "merge"),
  );

  const closePRAction = useAsyncAction(
    async () => {
      if (!prDetail?.pullRequestId) return;
      await closePullRequest(client, { pullRequestId: prDetail.pullRequestId });
      // On success, remove closed PR from local state and go back to PR list
      setPullRequests((prev) => prev.filter((pr) => pr.pullRequestId !== prDetail.pullRequestId));
      setScreen("prs");
    },
    (err) => formatErrorMessage(err, "close"),
  );

  const updateCommentAction = useAsyncAction(
    async (commentId: string, content: string) => {
      if (!prDetail?.pullRequestId) return;
      await updateComment(client, { commentId, content });
      await reloadComments(prDetail.pullRequestId);
    },
    (err) => formatErrorMessage(err, "edit"),
  );

  const deleteCommentAction = useAsyncAction(
    async (commentId: string) => {
      if (!prDetail?.pullRequestId) return;
      await deleteComment(client, { commentId });
      await reloadComments(prDetail.pullRequestId);
    },
    (err) => formatErrorMessage(err, "delete"),
  );

  const reactAction = useAsyncAction(
    async (commentId: string, reactionValue: string) => {
      await putReaction(client, { commentId, reactionValue });
      await reloadReactions(commentThreads);
    },
    (err) => formatErrorMessage(err, "reaction"),
  );

  // v0.4: activity timeline
  const [activityEvents, setActivityEvents] = useState<PrActivityEvent[]>([]);
  const [activityNextToken, setActivityNextToken] = useState<string | undefined>(undefined);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  // v0.8: filter, search, pagination
  const [statusFilter, setStatusFilter] = useState<PullRequestDisplayStatus>("OPEN");
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState<PaginationState>(createInitialPagination);

  function isDetailLoadStale(loadId: number): boolean {
    return detailLoadRef.current !== loadId;
  }

  function isCommitLoadStale(loadId: number): boolean {
    return commitLoadRef.current !== loadId;
  }

  function beginDetailLoad(): number {
    const loadId = detailLoadRef.current + 1;
    detailLoadRef.current = loadId;
    commitLoadRef.current += 1;
    return loadId;
  }

  async function reloadReactions(threads: CommentThread[], loadId = detailLoadRef.current) {
    const allCommentIds = threads.flatMap((t) =>
      t.comments.map((c) => c.commentId).filter((id): id is string => !!id),
    );
    if (allCommentIds.length > 0) {
      const reactions = await getReactionsForComments(client, allCommentIds);
      if (isDetailLoadStale(loadId)) return;
      setReactionsByComment(reactions);
    } else {
      if (isDetailLoadStale(loadId)) return;
      setReactionsByComment(new Map());
    }
  }

  /**
   * Wrapper for async operations with automatic loading/error state management.
   * Eliminates repetitive try-catch-finally patterns.
   */
  async function withLoadingState<T>(
    operation: () => Promise<T>,
    onError?: (err: unknown) => void,
  ): Promise<T | undefined> {
    setLoading(true);
    setError(null);
    try {
      return await operation();
    } catch (err) {
      if (onError) {
        onError(err);
      } else {
        setError(formatErrorMessage(err));
      }
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialRepo) {
      loadPullRequests(initialRepo);
    } else {
      loadRepositories();
    }
  }, []);

  async function loadRepositories() {
    await withLoadingState(async () => {
      const repos = await listRepositories(client);
      setRepositories(repos);
    });
  }

  async function fetchPullRequestPage(
    repoName: string,
    status: PullRequestDisplayStatus,
    cursor: PaginationCursor,
  ): Promise<{
    pullRequests: PullRequestSummary[];
    nextCursor: PaginationCursor;
    hasNextPage: boolean;
  }> {
    if (status === "OPEN") {
      const result = await listPullRequests(client, repoName, cursor.apiToken, "OPEN");
      return {
        pullRequests: result.pullRequests,
        nextCursor: createPaginationCursor(result.nextToken),
        hasNextPage: result.nextToken != null,
      };
    }

    const filteredPullRequests = [...cursor.pending];
    let nextToken = cursor.apiToken;
    let canFetch = cursor.apiToken !== undefined || cursor.pending.length === 0;

    while (filteredPullRequests.length < PAGE_SIZE && canFetch) {
      const result = await listPullRequests(client, repoName, nextToken, "CLOSED");
      filteredPullRequests.push(...filterPullRequestsByStatus(result.pullRequests, status));
      nextToken = result.nextToken;
      canFetch = nextToken !== undefined;
    }

    const pullRequests = filteredPullRequests.slice(0, PAGE_SIZE);
    const remaining = filteredPullRequests.slice(PAGE_SIZE);

    return {
      pullRequests,
      nextCursor: createPaginationCursor(nextToken, remaining),
      hasNextPage: remaining.length > 0 || nextToken !== undefined,
    };
  }

  async function loadPullRequests(
    repoName: string,
    status: PullRequestDisplayStatus = "OPEN",
    cursor: PaginationCursor = createPaginationCursor(),
  ) {
    await withLoadingState(
      async () => {
        const result = await fetchPullRequestPage(repoName, status, cursor);
        setPullRequests(result.pullRequests);
        setPagination((prev) => ({
          ...prev,
          nextCursor: result.nextCursor,
          hasNextPage: result.hasNextPage,
        }));
      },
      (err) => {
        if (err instanceof Error && err.name === "InvalidContinuationTokenException") {
          setError("Page token expired. Returning to first page.");
          setPagination(createInitialPagination());
        } else {
          setError(formatErrorMessage(err));
        }
      },
    );
  }

  async function loadPullRequestDetail(pullRequestId: string) {
    const loadId = beginDetailLoad();

    await withLoadingState(async () => {
      const detail = await getPullRequestDetail(client, pullRequestId, selectedRepo);
      if (isDetailLoadStale(loadId)) return;

      setPrDetail(detail.pullRequest);
      setPrDifferences(detail.differences);
      setCommentThreads(detail.commentThreads);
      setDiffTexts(new Map());
      setApprovals([]);
      setApprovalEvaluation(null);
      setReactionsByComment(new Map());

      const status = new Map<string, "loading" | "loaded" | "error">();
      for (const diff of detail.differences) {
        status.set(blobKey(diff), "loading");
      }
      setDiffTextStatus(status);
      setCommits([]);
      setCommitDifferences([]);
      setCommitDiffTexts(new Map());

      // Background: blob texts
      void streamBlobTexts(client, selectedRepo, detail.differences, {
        isStale: () => isDetailLoadStale(loadId),
        onLoaded: (key, texts) => {
          setDiffTexts((prev) => new Map(prev).set(key, texts));
          setDiffTextStatus((prev) => new Map(prev).set(key, "loaded"));
        },
        onError: (key) => {
          setDiffTextStatus((prev) => new Map(prev).set(key, "error"));
        },
      });

      // Background: approvals
      const revisionId = detail.pullRequest.revisionId;
      if (revisionId) {
        void Promise.all([
          getApprovalStates(client, { pullRequestId, revisionId }),
          evaluateApprovalRules(client, { pullRequestId, revisionId }).catch(() => null),
        ]).then(([states, evaluation]) => {
          if (isDetailLoadStale(loadId)) return;
          setApprovals(states);
          setApprovalEvaluation(evaluation);
        });
      }

      // Background: reactions
      void reloadReactions(detail.commentThreads, loadId);
    });
  }

  function handleSelectRepo(repoName: string) {
    setSelectedRepo(repoName);
    setScreen("prs");
    setStatusFilter("OPEN");
    setSearchQuery("");
    setPagination(createInitialPagination());
    void loadPullRequests(repoName, "OPEN", createPaginationCursor());
  }

  function handleSelectPR(pullRequestId: string) {
    setScreen("detail");
    loadPullRequestDetail(pullRequestId);
  }

  function handleChangeStatusFilter(filter: PullRequestDisplayStatus) {
    setStatusFilter(filter);
    setSearchQuery("");
    setPagination(createInitialPagination());
    void loadPullRequests(selectedRepo, filter, createPaginationCursor());
  }

  function handleNextPage() {
    if (!pagination.hasNextPage) return;
    const nextCursor = pagination.nextCursor;

    setPagination((prev) => ({
      ...prev,
      previousCursors: [...prev.previousCursors, prev.currentCursor],
      currentCursor: nextCursor,
      currentPage: prev.currentPage + 1,
      hasPreviousPage: true,
    }));

    void loadPullRequests(selectedRepo, statusFilter, nextCursor);
  }

  function handlePreviousPage() {
    if (pagination.previousCursors.length === 0) return;

    const newPreviousCursors = [...pagination.previousCursors];
    const prevCursor = newPreviousCursors.pop();
    if (!prevCursor) return;

    setPagination((prev) => ({
      ...prev,
      previousCursors: newPreviousCursors,
      currentCursor: prevCursor,
      currentPage: prev.currentPage - 1,
      hasPreviousPage: newPreviousCursors.length > 0,
    }));

    void loadPullRequests(selectedRepo, statusFilter, prevCursor);
  }

  async function reloadComments(pullRequestId: string, loadId = detailLoadRef.current) {
    // Optimized: fetch only comments instead of full PR detail
    const target = prDetail?.pullRequestTargets?.[0];
    const threads = await getComments(client, pullRequestId, {
      repositoryName: selectedRepo,
      ...(target?.sourceCommit && target?.destinationCommit
        ? {
            afterCommitId: target.sourceCommit,
            beforeCommitId: target.destinationCommit,
          }
        : {}),
    });
    if (isDetailLoadStale(loadId)) return;
    setCommentThreads(threads);
    await reloadReactions(threads, loadId);
  }

  async function reloadApprovals(
    pullRequestId: string,
    revisionId: string,
    loadId = detailLoadRef.current,
  ) {
    const [approvalStates, evaluation] = await Promise.all([
      getApprovalStates(client, { pullRequestId, revisionId }),
      /* v8 ignore next -- defensive: evaluation failure should not block approval */
      evaluateApprovalRules(client, { pullRequestId, revisionId }).catch(() => null),
    ]);
    if (isDetailLoadStale(loadId)) return;
    setApprovals(approvalStates);
    setApprovalEvaluation(evaluation);
  }

  async function handleCheckConflicts(strategy: MergeStrategy): Promise<ConflictSummary> {
    const target = prDetail?.pullRequestTargets?.[0];
    if (!target?.sourceCommit || !target?.destinationCommit) {
      return { mergeable: true, conflictCount: 0, conflictFiles: [] };
    }
    return await getMergeConflicts(client, {
      repositoryName: selectedRepo,
      sourceCommitId: target.sourceCommit,
      destinationCommitId: target.destinationCommit,
      strategy,
    });
  }

  async function handleLoadCommitDiff(commitIndex: number) {
    const loadId = commitLoadRef.current + 1;
    commitLoadRef.current = loadId;

    setIsLoadingCommitDiff(true);
    setCommitDifferences([]);
    setCommitDiffTexts(new Map());
    try {
      let currentCommits = commits;
      if (currentCommits.length === 0) {
        const sourceCommit = prDetail?.pullRequestTargets?.[0]?.sourceCommit;
        const mergeBase = prDetail?.pullRequestTargets?.[0]?.mergeBase;
        /* v8 ignore start -- UI prevents calling without sourceCommit/mergeBase */
        if (!sourceCommit || !mergeBase) return;
        /* v8 ignore stop */
        currentCommits = await getCommitsForPR(client, selectedRepo, sourceCommit, mergeBase);
        if (isCommitLoadStale(loadId)) return;
        setCommits(currentCommits);
      }

      const commit = currentCommits[commitIndex];
      if (!commit || commit.parentIds.length === 0) return;

      const parentId = commit.parentIds[0]!;
      const diffs = await getCommitDifferences(client, selectedRepo, parentId, commit.commitId);
      if (isCommitLoadStale(loadId)) return;
      setCommitDifferences(diffs);

      const texts = await fetchBlobTexts(client, selectedRepo, diffs);
      if (isCommitLoadStale(loadId)) return;
      setCommitDiffTexts(texts);
    } finally {
      if (!isCommitLoadStale(loadId)) {
        setIsLoadingCommitDiff(false);
      }
    }
  }

  async function loadActivity(pullRequestId: string, nextToken?: string) {
    setIsLoadingActivity(true);
    setActivityError(null);
    try {
      const result = await getPullRequestActivity(client, {
        pullRequestId,
        ...(nextToken !== undefined ? { nextToken } : {}),
        maxResults: 50,
      });
      if (nextToken) {
        setActivityEvents((prev) => [...prev, ...result.events]);
      } else {
        setActivityEvents(result.events);
      }
      setActivityNextToken(result.nextToken);
    } catch (err) {
      /* v8 ignore start -- defensive: retry on stale continuation token */
      if (err instanceof Error && err.name === "InvalidContinuationTokenException") {
        setActivityEvents([]);
        setActivityNextToken(undefined);
        void loadActivity(pullRequestId);
        return;
      }
      /* v8 ignore stop */
      setActivityError(formatErrorMessage(err, "activity"));
    } finally {
      setIsLoadingActivity(false);
    }
  }

  function handleShowActivity() {
    if (!prDetail?.pullRequestId) return;
    setScreen("activity");
    setActivityEvents([]);
    setActivityNextToken(undefined);
    setActivityError(null);
    void loadActivity(prDetail.pullRequestId);
  }

  function handleLoadNextActivityPage() {
    if (!prDetail?.pullRequestId || !activityNextToken || isLoadingActivity) return;
    void loadActivity(prDetail.pullRequestId, activityNextToken);
  }

  function handleBack() {
    if (screen === "detail") {
      setScreen("prs");
    } else if (screen === "prs") {
      if (initialRepo) {
        process.exit(0);
      }
      setStatusFilter("OPEN");
      setSearchQuery("");
      setPagination(createInitialPagination());
      setScreen("repos");
      setDiffTexts(new Map());
      setDiffTextStatus(new Map());
    } /* v8 ignore start */ else {
      process.exit(0);
    }
    /* v8 ignore stop */
  }

  if (showHelp) {
    return <Help onClose={() => setShowHelp(false)} />;
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>
          Error: {error}
        </Text>
        <Text dimColor>Press Ctrl+C to exit.</Text>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box padding={1}>
        <Text color="cyan">Loading...</Text>
      </Box>
    );
  }

  switch (screen) {
    case "repos":
      return (
        <RepositoryList
          repositories={repositories}
          onSelect={handleSelectRepo}
          onQuit={() => process.exit(0)}
          onHelp={() => setShowHelp(true)}
        />
      );
    case "prs":
      return (
        <PullRequestList
          repositoryName={selectedRepo}
          pullRequests={pullRequests}
          onSelect={handleSelectPR}
          onBack={handleBack}
          onHelp={() => setShowHelp(true)}
          statusFilter={statusFilter}
          onChangeStatusFilter={handleChangeStatusFilter}
          searchQuery={searchQuery}
          onChangeSearchQuery={setSearchQuery}
          pagination={{
            currentPage: pagination.currentPage,
            hasNextPage: pagination.hasNextPage,
            hasPreviousPage: pagination.hasPreviousPage,
          }}
          onNextPage={handleNextPage}
          onPreviousPage={handlePreviousPage}
        />
      );
    case "detail":
      if (!prDetail) return null;
      return (
        <PullRequestDetail
          pullRequest={prDetail}
          differences={prDifferences}
          commentThreads={commentThreads}
          diffTexts={diffTexts}
          diffTextStatus={diffTextStatus}
          onBack={handleBack}
          onHelp={() => setShowHelp(true)}
          onShowActivity={handleShowActivity}
          comment={{
            onPost: postCommentAction.execute,
            isProcessing: postCommentAction.isProcessing,
            error: postCommentAction.error,
            onClearError: postCommentAction.clearError,
          }}
          inlineComment={{
            onPost: postInlineCommentAction.execute,
            isProcessing: postInlineCommentAction.isProcessing,
            error: postInlineCommentAction.error,
            onClearError: postInlineCommentAction.clearError,
          }}
          reply={{
            onPost: postReplyAction.execute,
            isProcessing: postReplyAction.isProcessing,
            error: postReplyAction.error,
            onClearError: postReplyAction.clearError,
          }}
          approval={{
            approvals,
            evaluation: approvalEvaluation,
            onApprove: () => approvalAction.execute("APPROVE"),
            onRevoke: () => approvalAction.execute("REVOKE"),
            isProcessing: approvalAction.isProcessing,
            error: approvalAction.error,
            onClearError: approvalAction.clearError,
          }}
          merge={{
            onMerge: mergeAction.execute,
            onCheckConflicts: handleCheckConflicts,
            isProcessing: mergeAction.isProcessing,
            error: mergeAction.error,
            onClearError: mergeAction.clearError,
          }}
          close={{
            onClose: closePRAction.execute,
            isProcessing: closePRAction.isProcessing,
            error: closePRAction.error,
            onClearError: closePRAction.clearError,
          }}
          commitView={{
            commits,
            differences: commitDifferences,
            diffTexts: commitDiffTexts,
            isLoading: isLoadingCommitDiff,
            onLoad: handleLoadCommitDiff,
            commitsAvailable: !!(
              prDetail?.pullRequestTargets?.[0]?.sourceCommit &&
              prDetail?.pullRequestTargets?.[0]?.mergeBase
            ),
          }}
          editComment={{
            onUpdate: updateCommentAction.execute,
            isProcessing: updateCommentAction.isProcessing,
            error: updateCommentAction.error,
            onClearError: updateCommentAction.clearError,
          }}
          deleteComment={{
            onDelete: deleteCommentAction.execute,
            isProcessing: deleteCommentAction.isProcessing,
            error: deleteCommentAction.error,
            onClearError: deleteCommentAction.clearError,
          }}
          reaction={{
            byComment: reactionsByComment,
            onReact: reactAction.execute,
            isProcessing: reactAction.isProcessing,
            error: reactAction.error,
            onClearError: reactAction.clearError,
          }}
        />
      );
    case "activity":
      return (
        <ActivityTimeline
          pullRequestTitle={prDetail?.title ?? ""}
          events={activityEvents}
          isLoading={isLoadingActivity}
          error={activityError}
          hasNextPage={!!activityNextToken}
          onLoadNextPage={handleLoadNextActivityPage}
          onBack={() => setScreen("detail")}
        />
      );
  }
}
