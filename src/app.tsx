import type {
  Approval,
  CodeCommitClient,
  Difference,
  Evaluation,
  PullRequest,
  RepositoryNameIdPair,
} from "@aws-sdk/client-codecommit";
import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";
import { Help } from "./components/Help.js";
import { PullRequestDetail } from "./components/PullRequestDetail.js";
import { PullRequestList } from "./components/PullRequestList.js";
import { RepositoryList } from "./components/RepositoryList.js";
import {
  type CommentThread,
  type ConflictSummary,
  closePullRequest,
  evaluateApprovalRules,
  getApprovalStates,
  getBlobContent,
  getComments,
  getMergeConflicts,
  getPullRequestDetail,
  listPullRequests,
  listRepositories,
  type MergeStrategy,
  mergePullRequest,
  type PullRequestSummary,
  postComment,
  postCommentReply,
  updateApprovalState,
} from "./services/codecommit.js";

type Screen = "repos" | "prs" | "detail";

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

  /**
   * Wrapper for async operations with automatic loading/error state management.
   * Eliminates repetitive try-catch-finally patterns.
   */
  async function withLoadingState<T>(operation: () => Promise<T>): Promise<T | undefined> {
    setLoading(true);
    setError(null);
    try {
      return await operation();
    } catch (err) {
      setError(formatError(err));
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

  async function loadPullRequests(repoName: string) {
    await withLoadingState(async () => {
      const result = await listPullRequests(client, repoName);
      setPullRequests(result.pullRequests);
    });
  }

  async function loadPullRequestDetail(pullRequestId: string) {
    await withLoadingState(async () => {
      const detail = await getPullRequestDetail(client, pullRequestId, selectedRepo);
      setPrDetail(detail.pullRequest);
      setPrDifferences(detail.differences);
      setCommentThreads(detail.commentThreads);

      // v0.3: 承認状態を取得
      const revisionId = detail.pullRequest.revisionId;
      if (revisionId) {
        const [approvalStates, evaluation] = await Promise.all([
          getApprovalStates(client, { pullRequestId, revisionId }),
          evaluateApprovalRules(client, { pullRequestId, revisionId }).catch(() => null),
        ]);
        setApprovals(approvalStates);
        setApprovalEvaluation(evaluation);
      }

      // Parallelize blob content fetching for better performance
      const blobFetches = detail.differences.map(async (diff) => {
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
      setDiffTexts(texts);
    });
  }

  function handleSelectRepo(repoName: string) {
    setSelectedRepo(repoName);
    setScreen("prs");
    loadPullRequests(repoName);
  }

  function handleSelectPR(pullRequestId: string) {
    setScreen("detail");
    loadPullRequestDetail(pullRequestId);
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
      setCommentError(formatCommentError(err));
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
      setInlineCommentError(formatCommentError(err));
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
      setReplyError(formatReplyError(err));
    } finally {
      setIsPostingReply(false);
    }
  }

  async function handleApprove() {
    if (!prDetail?.pullRequestId || !prDetail?.revisionId) return;

    setIsApproving(true);
    setApprovalError(null);
    try {
      await updateApprovalState(client, {
        pullRequestId: prDetail.pullRequestId,
        revisionId: prDetail.revisionId,
        approvalState: "APPROVE",
      });
      await reloadApprovals(prDetail.pullRequestId, prDetail.revisionId);
    } catch (err) {
      setApprovalError(formatApprovalError(err, "approve"));
    } finally {
      setIsApproving(false);
    }
  }

  async function handleRevoke() {
    if (!prDetail?.pullRequestId || !prDetail?.revisionId) return;

    setIsApproving(true);
    setApprovalError(null);
    try {
      await updateApprovalState(client, {
        pullRequestId: prDetail.pullRequestId,
        revisionId: prDetail.revisionId,
        approvalState: "REVOKE",
      });
      await reloadApprovals(prDetail.pullRequestId, prDetail.revisionId);
    } catch (err) {
      setApprovalError(formatApprovalError(err, "revoke"));
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
      // On success, reload PR list and go back to PR list
      setScreen("prs");
      loadPullRequests(selectedRepo);
    } catch (err) {
      setMergeError(formatMergeError(err));
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
      // On success, reload PR list and go back to PR list
      setScreen("prs");
      loadPullRequests(selectedRepo);
    } catch (err) {
      setClosePRError(formatCloseError(err));
    } finally {
      setIsClosingPR(false);
    }
  }

  function handleBack() {
    if (screen === "detail") {
      setScreen("prs");
    } else if (screen === "prs") {
      if (initialRepo) {
        process.exit(0);
      }
      setScreen("repos");
    } else {
      process.exit(0);
    }
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
          onBack={handleBack}
          onHelp={() => setShowHelp(true)}
          onPostComment={handlePostComment}
          isPostingComment={isPostingComment}
          commentError={commentError}
          onClearCommentError={() => setCommentError(null)}
          onPostInlineComment={handlePostInlineComment}
          isPostingInlineComment={isPostingInlineComment}
          inlineCommentError={inlineCommentError}
          onClearInlineCommentError={() => setInlineCommentError(null)}
          onPostReply={handlePostReply}
          isPostingReply={isPostingReply}
          replyError={replyError}
          onClearReplyError={() => setReplyError(null)}
          approvals={approvals}
          approvalEvaluation={approvalEvaluation}
          onApprove={handleApprove}
          onRevoke={handleRevoke}
          isApproving={isApproving}
          approvalError={approvalError}
          onClearApprovalError={() => setApprovalError(null)}
          onMerge={handleMerge}
          isMerging={isMerging}
          mergeError={mergeError}
          onClearMergeError={() => setMergeError(null)}
          onCheckConflicts={handleCheckConflicts}
          onClosePR={handleClosePR}
          isClosingPR={isClosingPR}
          closePRError={closePRError}
          onClearClosePRError={() => setClosePRError(null)}
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
  context?: "comment" | "reply" | "approval" | "merge" | "close",
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
    .replace(/\b\d{12}\b/g, "[ACCOUNT_ID]");
  return context ? err.message : sanitized;
}

// Context-specific wrappers
function formatReplyError(err: unknown): string {
  return formatErrorMessage(err, "reply");
}

function formatCommentError(err: unknown): string {
  return formatErrorMessage(err, "comment");
}

function formatApprovalError(err: unknown, action: "approve" | "revoke"): string {
  return formatErrorMessage(err, "approval", action);
}

function formatMergeError(err: unknown): string {
  return formatErrorMessage(err, "merge");
}

function formatCloseError(err: unknown): string {
  return formatErrorMessage(err, "close");
}

function formatError(err: unknown): string {
  return formatErrorMessage(err);
}
