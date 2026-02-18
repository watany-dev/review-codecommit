/**
 * Unified error formatter with context-specific messages.
 *
 * @param err - The error to format
 * @param context - Optional context for specific error messages
 * @returns User-friendly error message
 */
export function formatErrorMessage(
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
    .replace(/(?:us|eu|ap|sa|ca|me|af)-[a-z]+-\d+/g, "[REGION]")
    .replace(/(?<=[^A-Za-z0-9/+=]|^)[A-Za-z0-9/+=]{40}(?=[^A-Za-z0-9/+=]|$)/g, "[SECRET_KEY]")
    .replace(/IQoJb2lnaW5[A-Za-z0-9/+=]+/g, "[SESSION_TOKEN]")
    .replace(/vpce-[a-z0-9]+/gi, "[VPC_ENDPOINT]");
  return sanitized;
}
