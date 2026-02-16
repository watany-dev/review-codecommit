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
import { Help } from "./components/Help.js";
import { PullRequestDetail } from "./components/PullRequestDetail.js";
import { PullRequestList } from "./components/PullRequestList.js";
import { RepositoryList } from "./components/RepositoryList.js";
import {
  type CommentThread,
  type CommitInfo,
  type ConflictSummary,
  closePullRequest,
  deleteComment,
  evaluateApprovalRules,
  getApprovalStates,
  getBlobContent,
  getComments,
  getCommitDifferences,
  getCommitsForPR,
  getMergeConflicts,
  getPullRequestDetail,
  getReactionsForComments,
  listPullRequests,
  listRepositories,
  type MergeStrategy,
  mergePullRequest,
  type PullRequestDisplayStatus,
  type PullRequestSummary,
  postComment,
  postCommentReply,
  putReaction,
  type ReactionsByComment,
  updateApprovalState,
  updateComment,
} from "./services/codecommit.js";

type Screen = "repos" | "prs" | "detail";

interface PaginationState {
  currentPage: number;
  currentToken: string | undefined;
  nextToken: string | undefined;
  previousTokens: (string | undefined)[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const initialPagination: PaginationState = {
  currentPage: 1,
  currentToken: undefined,
  nextToken: undefined,
  previousTokens: [],
  hasNextPage: false,
  hasPreviousPage: false,
};

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

  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [isPostingInlineComment, setIsPostingInlineComment] = useState(false);
  const [inlineCommentError, setInlineCommentError] = useState<string | null>(null);

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [approvalEvaluation, setApprovalEvaluation] = useState<Evaluation | null>(null);
  const [isPostingReply, setIsPostingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isClosingPR, setIsClosingPR] = useState(false);
  const [closePRError, setClosePRError] = useState<string | null>(null);

  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [commitDifferences, setCommitDifferences] = useState<Difference[]>([]);
  const [commitDiffTexts, setCommitDiffTexts] = useState<
    Map<string, { before: string; after: string }>
  >(new Map());
  const [isLoadingCommitDiff, setIsLoadingCommitDiff] = useState(false);

  const diffLoadRef = useRef(0);

  const [isUpdatingComment, setIsUpdatingComment] = useState(false);
  const [updateCommentError, setUpdateCommentError] = useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  const [deleteCommentError, setDeleteCommentError] = useState<string | null>(null);

  const [reactionsByComment, setReactionsByComment] = useState<ReactionsByComment>(new Map());
  const [isReacting, setIsReacting] = useState(false);
  const [reactionError, setReactionError] = useState<string | null>(null);

  // v0.8: filter, search, pagination
  const [statusFilter, setStatusFilter] = useState<PullRequestDisplayStatus>("OPEN");
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState<PaginationState>(initialPagination);

  async function reloadReactions(threads: CommentThread[]) {
    const allCommentIds = threads.flatMap((t) =>
      t.comments.map((c) => c.commentId).filter((id): id is string => !!id),
    );
    if (allCommentIds.length > 0) {
      const reactions = await getReactionsForComments(client, allCommentIds);
      setReactionsByComment(reactions);
    } else {
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

  async function loadPullRequests(
    repoName: string,
    status?: PullRequestDisplayStatus,
    pageToken?: string,
  ) {
    const apiStatus = status === "MERGED" || status === "CLOSED" ? "CLOSED" : "OPEN";

    await withLoadingState(
      async () => {
        const result = await listPullRequests(client, repoName, pageToken, apiStatus);

        let filtered = result.pullRequests;
        if (status === "CLOSED") {
          filtered = result.pullRequests.filter((pr) => pr.status === "CLOSED");
        } else if (status === "MERGED") {
          filtered = result.pullRequests.filter((pr) => pr.status === "MERGED");
        }

        setPullRequests(filtered);
        setPagination((prev) => ({
          ...prev,
          nextToken: result.nextToken,
          hasNextPage: !!result.nextToken,
        }));
      },
      (err) => {
        if (err instanceof Error && err.name === "InvalidContinuationTokenException") {
          setError("Page token expired. Returning to first page.");
          setPagination(initialPagination);
        } else {
          setError(formatErrorMessage(err));
        }
      },
    );
  }

  async function loadPullRequestDetail(pullRequestId: string) {
    const loadId = diffLoadRef.current + 1;
    diffLoadRef.current = loadId;

    await withLoadingState(async () => {
      const detail = await getPullRequestDetail(client, pullRequestId, selectedRepo);
      setPrDetail(detail.pullRequest);
      setPrDifferences(detail.differences);
      setCommentThreads(detail.commentThreads);
      setDiffTexts(new Map());

      // Parallelize independent operations: approvals, reactions, commits
      const revisionId = detail.pullRequest.revisionId;
      const sourceCommit = detail.pullRequest.pullRequestTargets?.[0]?.sourceCommit;
      const mergeBase = detail.pullRequest.pullRequestTargets?.[0]?.mergeBase;

      const approvalPromise = revisionId
        ? Promise.all([
            getApprovalStates(client, { pullRequestId, revisionId }),
            evaluateApprovalRules(client, { pullRequestId, revisionId }).catch(() => null),
          ])
        : Promise.resolve(undefined);

      const reactionsPromise = reloadReactions(detail.commentThreads);

      const commitsPromise =
        sourceCommit && mergeBase
          ? getCommitsForPR(client, selectedRepo, sourceCommit, mergeBase)
          : Promise.resolve([]);

      const [approvalResult, , commitList] = await Promise.all([
        approvalPromise,
        reactionsPromise,
        commitsPromise,
      ]);

      if (approvalResult) {
        setApprovals(approvalResult[0]);
        setApprovalEvaluation(approvalResult[1]);
      }

      const status = new Map<string, "loading" | "loaded" | "error">();
      for (const diff of detail.differences) {
        const key = `${diff.beforeBlob?.blobId ?? ""}:${diff.afterBlob?.blobId ?? ""}`;
        status.set(key, "loading");
      }
      setDiffTextStatus(status);
      setCommits(commitList);
      setCommitDifferences([]);
      setCommitDiffTexts(new Map());
      void loadDiffTextsInBackground(detail.differences, selectedRepo, loadId);
    });
  }

  async function loadDiffTextsInBackground(
    differences: Difference[],
    repoName: string,
    loadId: number,
  ) {
    const concurrency = 6;
    let index = 0;

    async function processNext(): Promise<void> {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= differences.length) return;

      const diff = differences[currentIndex]!;
      const beforeBlobId = diff.beforeBlob?.blobId;
      const afterBlobId = diff.afterBlob?.blobId;
      const key = `${beforeBlobId ?? ""}:${afterBlobId ?? ""}`;

      /* v8 ignore next 14 -- no-blob path rarely occurs; stale-load guard hard to test deterministically */
      if (!beforeBlobId && !afterBlobId) {
        if (diffLoadRef.current === loadId) {
          setDiffTexts((prev) => {
            const next = new Map(prev);
            next.set(key, { before: "", after: "" });
            return next;
          });
          setDiffTextStatus((prev) => {
            const next = new Map(prev);
            next.set(key, "loaded");
            return next;
          });
        }
        return processNext();
      }

      try {
        const [before, after] = await Promise.all([
          beforeBlobId ? getBlobContent(client, repoName, beforeBlobId) : Promise.resolve(""),
          afterBlobId ? getBlobContent(client, repoName, afterBlobId) : Promise.resolve(""),
        ]);

        if (diffLoadRef.current === loadId) {
          setDiffTexts((prev) => {
            const next = new Map(prev);
            next.set(key, { before, after });
            return next;
          });
          setDiffTextStatus((prev) => {
            const next = new Map(prev);
            next.set(key, "loaded");
            return next;
          });
        }
      } catch {
        if (diffLoadRef.current === loadId) {
          setDiffTextStatus((prev) => {
            const next = new Map(prev);
            next.set(key, "error");
            return next;
          });
        }
      }

      return processNext();
    }

    const workerCount = Math.min(concurrency, differences.length);
    const workers = Array.from({ length: workerCount }, () => processNext());
    await Promise.all(workers);
  }

  function handleSelectRepo(repoName: string) {
    setSelectedRepo(repoName);
    setScreen("prs");
    setStatusFilter("OPEN");
    setSearchQuery("");
    setPagination(initialPagination);
    loadPullRequests(repoName, "OPEN");
  }

  function handleSelectPR(pullRequestId: string) {
    setScreen("detail");
    loadPullRequestDetail(pullRequestId);
  }

  function handleChangeStatusFilter(filter: PullRequestDisplayStatus) {
    setStatusFilter(filter);
    setSearchQuery("");
    setPagination(initialPagination);
    loadPullRequests(selectedRepo, filter);
  }

  function handleNextPage() {
    if (!pagination.nextToken) return;

    const nextToken = pagination.nextToken;

    setPagination((prev) => ({
      ...prev,
      previousTokens: [...prev.previousTokens, prev.currentToken],
      currentToken: nextToken,
      currentPage: prev.currentPage + 1,
      hasPreviousPage: true,
    }));

    loadPullRequests(selectedRepo, statusFilter, nextToken);
  }

  function handlePreviousPage() {
    if (pagination.previousTokens.length === 0) return;

    const newPreviousTokens = [...pagination.previousTokens];
    const prevToken = newPreviousTokens.pop();

    setPagination((prev) => ({
      ...prev,
      previousTokens: newPreviousTokens,
      currentToken: prevToken,
      currentPage: prev.currentPage - 1,
      hasPreviousPage: newPreviousTokens.length > 0,
    }));

    loadPullRequests(selectedRepo, statusFilter, prevToken);
  }

  async function handlePostComment(content: string) {
    if (!prDetail) return;
    const target = prDetail.pullRequestTargets?.[0];
    if (!target?.destinationCommit || !target?.sourceCommit) return;

    setIsPostingComment(true);
    setCommentError(null);
    try {
      await postComment(client, {
        pullRequestId: prDetail.pullRequestId!,
        repositoryName: selectedRepo,
        beforeCommitId: target.destinationCommit,
        afterCommitId: target.sourceCommit,
        content,
      });
      await reloadComments(prDetail.pullRequestId!);
    } catch (err) {
      setCommentError(formatErrorMessage(err, "comment"));
    } finally {
      setIsPostingComment(false);
    }
  }

  async function reloadComments(pullRequestId: string) {
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
    setCommentThreads(threads);
    await reloadReactions(threads);
  }

  async function handlePostInlineComment(
    content: string,
    location: {
      filePath: string;
      filePosition: number;
      relativeFileVersion: "BEFORE" | "AFTER";
    },
  ) {
    if (!prDetail) return;
    const target = prDetail.pullRequestTargets?.[0];
    if (!target?.destinationCommit || !target?.sourceCommit) return;

    setIsPostingInlineComment(true);
    setInlineCommentError(null);
    try {
      await postComment(client, {
        pullRequestId: prDetail.pullRequestId!,
        repositoryName: selectedRepo,
        beforeCommitId: target.destinationCommit,
        afterCommitId: target.sourceCommit,
        content,
        location,
      });
      await reloadComments(prDetail.pullRequestId!);
    } catch (err) {
      setInlineCommentError(formatErrorMessage(err, "comment"));
    } finally {
      setIsPostingInlineComment(false);
    }
  }

  async function handlePostReply(inReplyTo: string, content: string) {
    if (!prDetail?.pullRequestId) return;

    setIsPostingReply(true);
    setReplyError(null);
    try {
      await postCommentReply(client, { inReplyTo, content });
      await reloadComments(prDetail.pullRequestId);
    } catch (err) {
      setReplyError(formatErrorMessage(err, "reply"));
    } finally {
      setIsPostingReply(false);
    }
  }

  async function handleApprovalAction(state: "APPROVE" | "REVOKE") {
    if (!prDetail?.pullRequestId || !prDetail?.revisionId) return;

    setIsApproving(true);
    setApprovalError(null);
    try {
      await updateApprovalState(client, {
        pullRequestId: prDetail.pullRequestId,
        revisionId: prDetail.revisionId,
        approvalState: state,
      });
      await reloadApprovals(prDetail.pullRequestId, prDetail.revisionId);
    } catch (err) {
      setApprovalError(
        formatErrorMessage(err, "approval", state === "APPROVE" ? "approve" : "revoke"),
      );
    } finally {
      setIsApproving(false);
    }
  }

  async function reloadApprovals(pullRequestId: string, revisionId: string) {
    const [approvalStates, evaluation] = await Promise.all([
      getApprovalStates(client, { pullRequestId, revisionId }),
      evaluateApprovalRules(client, { pullRequestId, revisionId }).catch(() => null),
    ]);
    setApprovals(approvalStates);
    setApprovalEvaluation(evaluation);
  }

  async function handleMerge(strategy: MergeStrategy) {
    if (!prDetail?.pullRequestId) return;
    const target = prDetail.pullRequestTargets?.[0];

    setIsMerging(true);
    setMergeError(null);
    try {
      await mergePullRequest(client, {
        pullRequestId: prDetail.pullRequestId,
        repositoryName: selectedRepo,
        sourceCommitId: target?.sourceCommit,
        strategy,
      });
      // On success, remove merged PR from local state and go back to PR list
      setPullRequests((prev) => prev.filter((pr) => pr.pullRequestId !== prDetail.pullRequestId));
      setScreen("prs");
    } catch (err) {
      setMergeError(formatErrorMessage(err, "merge"));
    } finally {
      setIsMerging(false);
    }
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

  async function handleClosePR() {
    if (!prDetail?.pullRequestId) return;

    setIsClosingPR(true);
    setClosePRError(null);
    try {
      await closePullRequest(client, {
        pullRequestId: prDetail.pullRequestId,
      });
      // On success, remove closed PR from local state and go back to PR list
      setPullRequests((prev) => prev.filter((pr) => pr.pullRequestId !== prDetail.pullRequestId));
      setScreen("prs");
    } catch (err) {
      setClosePRError(formatErrorMessage(err, "close"));
    } finally {
      setIsClosingPR(false);
    }
  }

  async function handleLoadCommitDiff(commitIndex: number) {
    const commit = commits[commitIndex];
    if (!commit || commit.parentIds.length === 0) return;

    setIsLoadingCommitDiff(true);
    try {
      const parentId = commit.parentIds[0]!;
      const diffs = await getCommitDifferences(client, selectedRepo, parentId, commit.commitId);
      setCommitDifferences(diffs);

      const blobFetches = diffs.map(async (diff) => {
        const beforeBlobId = diff.beforeBlob?.blobId;
        const afterBlobId = diff.afterBlob?.blobId;
        const key = `${beforeBlobId ?? ""}:${afterBlobId ?? ""}`;

        const [before, after] = await Promise.all([
          beforeBlobId ? getBlobContent(client, selectedRepo, beforeBlobId) : Promise.resolve(""),
          afterBlobId ? getBlobContent(client, selectedRepo, afterBlobId) : Promise.resolve(""),
        ]);

        return { key, before, after };
      });

      const blobResults = await Promise.all(blobFetches);
      const texts = new Map<string, { before: string; after: string }>();
      for (const result of blobResults) {
        texts.set(result.key, { before: result.before, after: result.after });
      }
      setCommitDiffTexts(texts);
    } finally {
      setIsLoadingCommitDiff(false);
    }
  }

  async function handleUpdateComment(commentId: string, content: string) {
    if (!prDetail?.pullRequestId) return;

    setIsUpdatingComment(true);
    setUpdateCommentError(null);
    try {
      await updateComment(client, { commentId, content });
      await reloadComments(prDetail.pullRequestId);
    } catch (err) {
      setUpdateCommentError(formatErrorMessage(err, "edit"));
    } finally {
      setIsUpdatingComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!prDetail?.pullRequestId) return;

    setIsDeletingComment(true);
    setDeleteCommentError(null);
    try {
      await deleteComment(client, { commentId });
      await reloadComments(prDetail.pullRequestId);
    } catch (err) {
      setDeleteCommentError(formatErrorMessage(err, "delete"));
    } finally {
      setIsDeletingComment(false);
    }
  }

  async function handleReact(commentId: string, reactionValue: string) {
    setIsReacting(true);
    setReactionError(null);
    try {
      await putReaction(client, { commentId, reactionValue });
      await reloadReactions(commentThreads);
    } catch (err) {
      setReactionError(formatErrorMessage(err, "reaction"));
    } finally {
      setIsReacting(false);
    }
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
      setPagination(initialPagination);
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
          comment={{
            onPost: handlePostComment,
            isProcessing: isPostingComment,
            error: commentError,
            onClearError: () => setCommentError(null),
          }}
          inlineComment={{
            onPost: handlePostInlineComment,
            isProcessing: isPostingInlineComment,
            error: inlineCommentError,
            onClearError: () => setInlineCommentError(null),
          }}
          reply={{
            onPost: handlePostReply,
            isProcessing: isPostingReply,
            error: replyError,
            onClearError: () => setReplyError(null),
          }}
          approval={{
            approvals,
            evaluation: approvalEvaluation,
            onApprove: () => handleApprovalAction("APPROVE"),
            onRevoke: () => handleApprovalAction("REVOKE"),
            isProcessing: isApproving,
            error: approvalError,
            onClearError: () => setApprovalError(null),
          }}
          merge={{
            onMerge: handleMerge,
            onCheckConflicts: handleCheckConflicts,
            isProcessing: isMerging,
            error: mergeError,
            onClearError: () => setMergeError(null),
          }}
          close={{
            onClose: handleClosePR,
            isProcessing: isClosingPR,
            error: closePRError,
            onClearError: () => setClosePRError(null),
          }}
          commitView={{
            commits,
            differences: commitDifferences,
            diffTexts: commitDiffTexts,
            isLoading: isLoadingCommitDiff,
            onLoad: handleLoadCommitDiff,
          }}
          editComment={{
            onUpdate: handleUpdateComment,
            isProcessing: isUpdatingComment,
            error: updateCommentError,
            onClearError: () => setUpdateCommentError(null),
          }}
          deleteComment={{
            onDelete: handleDeleteComment,
            isProcessing: isDeletingComment,
            error: deleteCommentError,
            onClearError: () => setDeleteCommentError(null),
          }}
          reaction={{
            byComment: reactionsByComment,
            onReact: handleReact,
            isProcessing: isReacting,
            error: reactionError,
            onClearError: () => setReactionError(null),
          }}
        />
      );
  }
}

/**
 * Unified error formatter with context-specific messages.
 *
 * @param err - The error to format
 * @param context - Optional context ('comment' or 'approval' for specific errors)
 * @returns User-friendly error message
 */
function formatErrorMessage(
  err: unknown,
  context?: "comment" | "reply" | "approval" | "merge" | "close" | "edit" | "delete" | "reaction",
  approvalAction?: "approve" | "revoke",
): string {
  if (!(err instanceof Error)) {
    return context ? String(err) : "An unexpected error occurred.";
  }

  const name = err.name;

  // Reply-specific errors
  if (context === "reply") {
    if (name === "CommentContentRequiredException") {
      return "Reply cannot be empty.";
    }
    if (name === "CommentContentSizeLimitExceededException") {
      return "Reply exceeds the 10,240 character limit.";
    }
    if (name === "CommentDoesNotExistException") {
      return "The comment you are replying to no longer exists.";
    }
    if (name === "InvalidCommentIdException") {
      return "Invalid comment ID format.";
    }
  }

  // Edit-specific errors
  if (context === "edit") {
    if (name === "CommentNotCreatedByCallerException") {
      return "You can only edit your own comments.";
    }
    if (name === "CommentContentSizeLimitExceededException") {
      return "Comment exceeds the 10,240 character limit.";
    }
    if (name === "CommentDeletedException") {
      return "Comment has already been deleted.";
    }
    if (name === "CommentDoesNotExistException") {
      return "Comment no longer exists.";
    }
  }

  // Delete-specific errors
  if (context === "delete") {
    if (name === "CommentDeletedException") {
      return "Comment has already been deleted.";
    }
    if (name === "CommentDoesNotExistException") {
      return "Comment no longer exists.";
    }
  }

  // Comment-specific errors
  if (context === "comment") {
    if (name === "CommentContentRequiredException") {
      return "Comment cannot be empty.";
    }
    if (name === "CommentContentSizeLimitExceededException") {
      return "Comment exceeds the 10,240 character limit.";
    }
    if (name === "PullRequestDoesNotExistException") {
      return "Pull request not found.";
    }
  }

  // Approval-specific errors
  if (context === "approval") {
    if (name === "PullRequestDoesNotExistException") {
      return "Pull request not found.";
    }
    if (name === "RevisionIdRequiredException" || name === "InvalidRevisionIdException") {
      return "Invalid revision. The PR may have been updated. Go back and reopen.";
    }
    if (name === "PullRequestCannotBeApprovedByAuthorException") {
      return approvalAction === "revoke"
        ? "Cannot revoke approval on your own pull request."
        : "Cannot approve your own pull request.";
    }
    if (name === "PullRequestAlreadyClosedException") {
      return "Pull request is already closed.";
    }
    if (name === "EncryptionKeyAccessDeniedException") {
      return "Encryption key access denied.";
    }
  }

  // Merge-specific errors
  if (context === "merge") {
    if (name === "ManualMergeRequiredException") {
      return "Conflicts detected. Cannot auto-merge. Resolve conflicts manually.";
    }
    if (name === "PullRequestApprovalRulesNotSatisfiedException") {
      return "Approval rules not satisfied. Get required approvals first.";
    }
    if (name === "TipOfSourceReferenceIsDifferentException") {
      return "Source branch has been updated. Go back and reopen the PR.";
    }
    if (name === "ConcurrentReferenceUpdateException") {
      return "Branch was updated concurrently. Try again.";
    }
    if (name === "TipsDivergenceExceededException") {
      return "Branches have diverged too much. Merge manually.";
    }
    if (name === "PullRequestAlreadyClosedException") {
      return "Pull request is already closed.";
    }
    if (name === "PullRequestDoesNotExistException") {
      return "Pull request not found.";
    }
    if (name === "EncryptionKeyAccessDeniedException") {
      return "Encryption key access denied.";
    }
  }

  // Reaction-specific errors
  if (context === "reaction") {
    if (name === "CommentDeletedException") {
      return "Comment has already been deleted.";
    }
    if (name === "CommentDoesNotExistException") {
      return "Comment no longer exists.";
    }
    if (name === "ReactionValueRequiredException") {
      return "Reaction value is required.";
    }
    if (name === "InvalidReactionValueException") {
      return "Invalid reaction value.";
    }
  }

  // Close-specific errors
  if (context === "close") {
    if (name === "PullRequestAlreadyClosedException") {
      return "Pull request is already closed.";
    }
    if (name === "PullRequestDoesNotExistException") {
      return "Pull request not found.";
    }
  }

  // General AWS errors
  if (name === "CredentialsProviderError" || name === "CredentialError") {
    return "AWS authentication failed. Run `aws configure` to set up credentials.";
  }
  if (name === "RepositoryDoesNotExistException") {
    return "Repository not found.";
  }

  // Access control errors (context-aware message)
  if (name === "AccessDeniedException" || name === "UnauthorizedException") {
    if (context === "comment") {
      return "Access denied. Check your IAM policy allows CodeCommit write access.";
    }
    return "Access denied. Check your IAM policy.";
  }

  // Network errors
  if (
    name === "NetworkingError" ||
    err.message.includes("ECONNREFUSED") ||
    err.message.includes("ETIMEDOUT")
  ) {
    return "Network error. Check your connection.";
  }

  // Default: sanitize and return original message
  const sanitized = err.message
    .replace(/arn:[^\s"')]+/gi, "[ARN]")
    .replace(/\b\d{12}\b/g, "[ACCOUNT_ID]")
    .replace(/AKIA[0-9A-Z]{16}/g, "[ACCESS_KEY]")
    .replace(/(?:us|eu|ap|sa|ca|me|af)-[a-z]+-\d+/g, "[REGION]");
  return sanitized;
}
