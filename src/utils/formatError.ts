type ErrorContext =
  | "comment"
  | "reply"
  | "approval"
  | "merge"
  | "close"
  | "edit"
  | "delete"
  | "reaction"
  | "activity";

/** Context-specific error name → user-friendly message */
const contextErrors: Record<string, Record<string, string>> = {
  reply: {
    CommentContentRequiredException: "Reply cannot be empty.",
    CommentContentSizeLimitExceededException: "Reply exceeds the 10,240 character limit.",
    CommentDoesNotExistException: "The comment you are replying to no longer exists.",
    InvalidCommentIdException: "Invalid comment ID format.",
  },
  edit: {
    CommentNotCreatedByCallerException: "You can only edit your own comments.",
    CommentContentSizeLimitExceededException: "Comment exceeds the 10,240 character limit.",
    CommentDeletedException: "Comment has already been deleted.",
    CommentDoesNotExistException: "Comment no longer exists.",
  },
  delete: {
    CommentDeletedException: "Comment has already been deleted.",
    CommentDoesNotExistException: "Comment no longer exists.",
  },
  comment: {
    CommentContentRequiredException: "Comment cannot be empty.",
    CommentContentSizeLimitExceededException: "Comment exceeds the 10,240 character limit.",
    PullRequestDoesNotExistException: "Pull request not found.",
  },
  approval: {
    PullRequestDoesNotExistException: "Pull request not found.",
    RevisionIdRequiredException:
      "Invalid revision. The PR may have been updated. Go back and reopen.",
    InvalidRevisionIdException:
      "Invalid revision. The PR may have been updated. Go back and reopen.",
    PullRequestAlreadyClosedException: "Pull request is already closed.",
    EncryptionKeyAccessDeniedException: "Encryption key access denied.",
  },
  merge: {
    ManualMergeRequiredException:
      "Conflicts detected. Cannot auto-merge. Resolve conflicts manually.",
    PullRequestApprovalRulesNotSatisfiedException:
      "Approval rules not satisfied. Get required approvals first.",
    TipOfSourceReferenceIsDifferentException:
      "Source branch has been updated. Go back and reopen the PR.",
    ConcurrentReferenceUpdateException: "Branch was updated concurrently. Try again.",
    TipsDivergenceExceededException: "Branches have diverged too much. Merge manually.",
    PullRequestAlreadyClosedException: "Pull request is already closed.",
    PullRequestDoesNotExistException: "Pull request not found.",
    EncryptionKeyAccessDeniedException: "Encryption key access denied.",
  },
  reaction: {
    CommentDeletedException: "Comment has already been deleted.",
    CommentDoesNotExistException: "Comment no longer exists.",
    ReactionValueRequiredException: "Reaction value is required.",
    InvalidReactionValueException: "Invalid reaction value.",
  },
  close: {
    PullRequestAlreadyClosedException: "Pull request is already closed.",
    PullRequestDoesNotExistException: "Pull request not found.",
  },
  activity: {
    PullRequestDoesNotExistException: "Pull request not found.",
  },
};

function sanitizeMessage(message: string): string {
  return message
    .replace(/arn:[^\s"')]+/gi, "[ARN]")
    .replace(/\b\d{12}\b/g, "[ACCOUNT_ID]")
    .replace(/AKIA[0-9A-Z]{16}/g, "[ACCESS_KEY]")
    .replace(/(?:us|eu|ap|sa|ca|me|af)-[a-z]+-\d+/g, "[REGION]")
    .replace(/(?<=[^A-Za-z0-9/+=]|^)[A-Za-z0-9/+=]{40}(?=[^A-Za-z0-9/+=]|$)/g, "[SECRET_KEY]")
    .replace(/IQoJb2lnaW5[A-Za-z0-9/+=]+/g, "[SESSION_TOKEN]")
    .replace(/vpce-[a-z0-9]+/gi, "[VPC_ENDPOINT]");
}

/**
 * Unified error formatter with context-specific messages.
 *
 * @param err - The error to format
 * @param context - Optional context for specific error messages
 * @returns User-friendly error message
 */
export function formatErrorMessage(
  err: unknown,
  context?: ErrorContext,
  approvalAction?: "approve" | "revoke",
): string {
  if (!(err instanceof Error)) {
    return context ? String(err) : "An unexpected error occurred.";
  }

  const name = err.name;

  // Context-specific lookup
  if (context) {
    // Special case: approval action depends on approve/revoke
    if (context === "approval" && name === "PullRequestCannotBeApprovedByAuthorException") {
      return approvalAction === "revoke"
        ? "Cannot revoke approval on your own pull request."
        : "Cannot approve your own pull request.";
    }

    const message = contextErrors[context]?.[name];
    if (message) return message;
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
  return sanitizeMessage(err.message);
}
