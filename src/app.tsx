import type {
  Approval,
  CodeCommitClient,
  Comment,
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
  evaluateApprovalRules,
  getApprovalStates,
  getBlobContent,
  getPullRequestDetail,
  listPullRequests,
  listRepositories,
  type PullRequestSummary,
  postComment,
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
  const [prComments, setPrComments] = useState<Comment[]>([]);
  const [diffTexts, setDiffTexts] = useState<Map<string, { before: string; after: string }>>(
    new Map(),
  );

  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [approvalEvaluation, setApprovalEvaluation] = useState<Evaluation | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRepo) {
      loadPullRequests(initialRepo);
    } else {
      loadRepositories();
    }
  }, []);

  async function loadRepositories() {
    setLoading(true);
    setError(null);
    try {
      const repos = await listRepositories(client);
      setRepositories(repos);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadPullRequests(repoName: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await listPullRequests(client, repoName);
      setPullRequests(result.pullRequests);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadPullRequestDetail(pullRequestId: string) {
    setLoading(true);
    setError(null);
    try {
      const detail = await getPullRequestDetail(client, pullRequestId, selectedRepo);
      setPrDetail(detail.pullRequest);
      setPrDifferences(detail.differences);
      setPrComments(detail.comments);

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

      const texts = new Map<string, { before: string; after: string }>();
      for (const diff of detail.differences) {
        const beforeBlobId = diff.beforeBlob?.blobId;
        const afterBlobId = diff.afterBlob?.blobId;
        const key = `${beforeBlobId ?? ""}:${afterBlobId ?? ""}`;
        const before = beforeBlobId ? await getBlobContent(client, selectedRepo, beforeBlobId) : "";
        const after = afterBlobId ? await getBlobContent(client, selectedRepo, afterBlobId) : "";
        texts.set(key, { before, after });
      }
      setDiffTexts(texts);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
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
    const detail = await getPullRequestDetail(client, pullRequestId, selectedRepo);
    setPrComments(detail.comments);
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
      setApprovalError(formatApprovalError(err));
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
      setApprovalError(formatApprovalError(err));
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
          comments={prComments}
          diffTexts={diffTexts}
          onBack={handleBack}
          onHelp={() => setShowHelp(true)}
          onPostComment={handlePostComment}
          isPostingComment={isPostingComment}
          commentError={commentError}
          onClearCommentError={() => setCommentError(null)}
          approvals={approvals}
          approvalEvaluation={approvalEvaluation}
          onApprove={handleApprove}
          onRevoke={handleRevoke}
          isApproving={isApproving}
          approvalError={approvalError}
          onClearApprovalError={() => setApprovalError(null)}
        />
      );
  }
}

function formatApprovalError(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name;
    if (name === "PullRequestDoesNotExistException") {
      return "Pull request not found.";
    }
    if (name === "RevisionIdRequiredException" || name === "InvalidRevisionIdException") {
      return "Invalid revision. The PR may have been updated. Go back and reopen.";
    }
    if (name === "PullRequestCannotBeApprovedByAuthorException") {
      return "Cannot approve your own pull request.";
    }
    if (name === "AccessDeniedException" || name === "UnauthorizedException") {
      return "Access denied. Check your IAM policy.";
    }
    if (name === "PullRequestAlreadyClosedException") {
      return "Pull request is already closed.";
    }
    if (name === "EncryptionKeyAccessDeniedException") {
      return "Encryption key access denied.";
    }
    return err.message;
  }
  return String(err);
}

function formatCommentError(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name;
    if (name === "CommentContentRequiredException") {
      return "Comment cannot be empty.";
    }
    if (name === "CommentContentSizeLimitExceededException") {
      return "Comment exceeds the 10,240 character limit.";
    }
    if (name === "AccessDeniedException" || name === "UnauthorizedException") {
      return "Access denied. Check your IAM policy allows CodeCommit write access.";
    }
    if (name === "PullRequestDoesNotExistException") {
      return "Pull request not found.";
    }
    return err.message;
  }
  return String(err);
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name;
    if (name === "CredentialsProviderError" || name === "CredentialError") {
      return "AWS authentication failed. Run `aws configure` to set up credentials.";
    }
    if (name === "RepositoryDoesNotExistException") {
      return "Repository not found.";
    }
    if (name === "AccessDeniedException" || name === "UnauthorizedException") {
      return "Access denied. Check your IAM policy allows CodeCommit access.";
    }
    if (
      name === "NetworkingError" ||
      err.message.includes("ECONNREFUSED") ||
      err.message.includes("ETIMEDOUT")
    ) {
      return "Network error. Check your connection.";
    }
    return sanitizeErrorMessage(err.message);
  }
  return "An unexpected error occurred.";
}

function sanitizeErrorMessage(message: string): string {
  return message.replace(/arn:[^\s"')]+/gi, "[ARN]").replace(/\b\d{12}\b/g, "[ACCOUNT_ID]");
}
