import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatErrorMessage } from "./formatError.js";

function makeError(name: string, message = "test"): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

describe("formatErrorMessage", () => {
  describe("non-Error input", () => {
    it("returns string representation with context", () => {
      expect(formatErrorMessage("raw error", "comment")).toBe("raw error");
    });

    it("returns generic message without context", () => {
      expect(formatErrorMessage(42)).toBe("An unexpected error occurred.");
    });
  });

  describe("reply context", () => {
    it("returns message for CommentContentRequiredException", () => {
      expect(formatErrorMessage(makeError("CommentContentRequiredException"), "reply")).toBe(
        "Reply cannot be empty.",
      );
    });

    it("returns message for CommentContentSizeLimitExceededException", () => {
      expect(
        formatErrorMessage(makeError("CommentContentSizeLimitExceededException"), "reply"),
      ).toBe("Reply exceeds the 10,240 character limit.");
    });

    it("returns message for CommentDoesNotExistException", () => {
      expect(formatErrorMessage(makeError("CommentDoesNotExistException"), "reply")).toBe(
        "The comment you are replying to no longer exists.",
      );
    });

    it("returns message for InvalidCommentIdException", () => {
      expect(formatErrorMessage(makeError("InvalidCommentIdException"), "reply")).toBe(
        "Invalid comment ID format.",
      );
    });

    it("falls through to general handler for unknown reply error", () => {
      expect(formatErrorMessage(makeError("UnknownException", "some reply error"), "reply")).toBe(
        "some reply error",
      );
    });
  });

  describe("edit context", () => {
    it("returns message for CommentNotCreatedByCallerException", () => {
      expect(formatErrorMessage(makeError("CommentNotCreatedByCallerException"), "edit")).toBe(
        "You can only edit your own comments.",
      );
    });

    it("returns message for CommentContentSizeLimitExceededException", () => {
      expect(
        formatErrorMessage(makeError("CommentContentSizeLimitExceededException"), "edit"),
      ).toBe("Comment exceeds the 10,240 character limit.");
    });

    it("returns message for CommentDeletedException", () => {
      expect(formatErrorMessage(makeError("CommentDeletedException"), "edit")).toBe(
        "Comment has already been deleted.",
      );
    });

    it("returns message for CommentDoesNotExistException", () => {
      expect(formatErrorMessage(makeError("CommentDoesNotExistException"), "edit")).toBe(
        "Comment no longer exists.",
      );
    });

    it("falls through to general handler for unknown edit error", () => {
      expect(formatErrorMessage(makeError("UnknownException", "edit problem"), "edit")).toBe(
        "edit problem",
      );
    });
  });

  describe("delete context", () => {
    it("returns message for CommentDeletedException", () => {
      expect(formatErrorMessage(makeError("CommentDeletedException"), "delete")).toBe(
        "Comment has already been deleted.",
      );
    });

    it("returns message for CommentDoesNotExistException", () => {
      expect(formatErrorMessage(makeError("CommentDoesNotExistException"), "delete")).toBe(
        "Comment no longer exists.",
      );
    });

    it("falls through to general handler for unknown delete error", () => {
      expect(formatErrorMessage(makeError("UnknownException", "delete problem"), "delete")).toBe(
        "delete problem",
      );
    });
  });

  describe("comment context", () => {
    it("returns message for CommentContentRequiredException", () => {
      expect(formatErrorMessage(makeError("CommentContentRequiredException"), "comment")).toBe(
        "Comment cannot be empty.",
      );
    });

    it("returns message for CommentContentSizeLimitExceededException", () => {
      expect(
        formatErrorMessage(makeError("CommentContentSizeLimitExceededException"), "comment"),
      ).toBe("Comment exceeds the 10,240 character limit.");
    });

    it("returns message for PullRequestDoesNotExistException", () => {
      expect(formatErrorMessage(makeError("PullRequestDoesNotExistException"), "comment")).toBe(
        "Pull request not found.",
      );
    });

    it("falls through to general handler for unknown comment error", () => {
      expect(formatErrorMessage(makeError("UnknownException", "comment problem"), "comment")).toBe(
        "comment problem",
      );
    });
  });

  describe("approval context", () => {
    it("returns message for PullRequestDoesNotExistException", () => {
      expect(formatErrorMessage(makeError("PullRequestDoesNotExistException"), "approval")).toBe(
        "Pull request not found.",
      );
    });

    it("returns message for RevisionIdRequiredException", () => {
      expect(formatErrorMessage(makeError("RevisionIdRequiredException"), "approval")).toBe(
        "Invalid revision. The PR may have been updated. Go back and reopen.",
      );
    });

    it("returns message for InvalidRevisionIdException", () => {
      expect(formatErrorMessage(makeError("InvalidRevisionIdException"), "approval")).toBe(
        "Invalid revision. The PR may have been updated. Go back and reopen.",
      );
    });

    it("returns approve message for PullRequestCannotBeApprovedByAuthorException", () => {
      expect(
        formatErrorMessage(
          makeError("PullRequestCannotBeApprovedByAuthorException"),
          "approval",
          "approve",
        ),
      ).toBe("Cannot approve your own pull request.");
    });

    it("returns revoke message for PullRequestCannotBeApprovedByAuthorException", () => {
      expect(
        formatErrorMessage(
          makeError("PullRequestCannotBeApprovedByAuthorException"),
          "approval",
          "revoke",
        ),
      ).toBe("Cannot revoke approval on your own pull request.");
    });

    it("returns message for PullRequestAlreadyClosedException", () => {
      expect(formatErrorMessage(makeError("PullRequestAlreadyClosedException"), "approval")).toBe(
        "Pull request is already closed.",
      );
    });

    it("returns message for EncryptionKeyAccessDeniedException", () => {
      expect(formatErrorMessage(makeError("EncryptionKeyAccessDeniedException"), "approval")).toBe(
        "Encryption key access denied.",
      );
    });

    it("falls through to general handler for unknown approval error", () => {
      expect(
        formatErrorMessage(makeError("UnknownException", "approval problem"), "approval"),
      ).toBe("approval problem");
    });
  });

  describe("merge context", () => {
    it("returns message for ManualMergeRequiredException", () => {
      expect(formatErrorMessage(makeError("ManualMergeRequiredException"), "merge")).toBe(
        "Conflicts detected. Cannot auto-merge. Resolve conflicts manually.",
      );
    });

    it("returns message for PullRequestApprovalRulesNotSatisfiedException", () => {
      expect(
        formatErrorMessage(makeError("PullRequestApprovalRulesNotSatisfiedException"), "merge"),
      ).toBe("Approval rules not satisfied. Get required approvals first.");
    });

    it("returns message for TipOfSourceReferenceIsDifferentException", () => {
      expect(
        formatErrorMessage(makeError("TipOfSourceReferenceIsDifferentException"), "merge"),
      ).toBe("Source branch has been updated. Go back and reopen the PR.");
    });

    it("returns message for ConcurrentReferenceUpdateException", () => {
      expect(formatErrorMessage(makeError("ConcurrentReferenceUpdateException"), "merge")).toBe(
        "Branch was updated concurrently. Try again.",
      );
    });

    it("returns message for TipsDivergenceExceededException", () => {
      expect(formatErrorMessage(makeError("TipsDivergenceExceededException"), "merge")).toBe(
        "Branches have diverged too much. Merge manually.",
      );
    });

    it("returns message for PullRequestAlreadyClosedException", () => {
      expect(formatErrorMessage(makeError("PullRequestAlreadyClosedException"), "merge")).toBe(
        "Pull request is already closed.",
      );
    });

    it("returns message for PullRequestDoesNotExistException", () => {
      expect(formatErrorMessage(makeError("PullRequestDoesNotExistException"), "merge")).toBe(
        "Pull request not found.",
      );
    });

    it("returns message for EncryptionKeyAccessDeniedException", () => {
      expect(formatErrorMessage(makeError("EncryptionKeyAccessDeniedException"), "merge")).toBe(
        "Encryption key access denied.",
      );
    });

    it("falls through to general handler for unknown merge error", () => {
      expect(formatErrorMessage(makeError("UnknownException", "merge problem"), "merge")).toBe(
        "merge problem",
      );
    });
  });

  describe("reaction context", () => {
    it("returns message for CommentDeletedException", () => {
      expect(formatErrorMessage(makeError("CommentDeletedException"), "reaction")).toBe(
        "Comment has already been deleted.",
      );
    });

    it("returns message for CommentDoesNotExistException", () => {
      expect(formatErrorMessage(makeError("CommentDoesNotExistException"), "reaction")).toBe(
        "Comment no longer exists.",
      );
    });

    it("returns message for ReactionValueRequiredException", () => {
      expect(formatErrorMessage(makeError("ReactionValueRequiredException"), "reaction")).toBe(
        "Reaction value is required.",
      );
    });

    it("returns message for InvalidReactionValueException", () => {
      expect(formatErrorMessage(makeError("InvalidReactionValueException"), "reaction")).toBe(
        "Invalid reaction value.",
      );
    });

    it("falls through to general handler for unknown reaction error", () => {
      expect(
        formatErrorMessage(makeError("UnknownException", "reaction problem"), "reaction"),
      ).toBe("reaction problem");
    });
  });

  describe("close context", () => {
    it("returns message for PullRequestAlreadyClosedException", () => {
      expect(formatErrorMessage(makeError("PullRequestAlreadyClosedException"), "close")).toBe(
        "Pull request is already closed.",
      );
    });

    it("returns message for PullRequestDoesNotExistException", () => {
      expect(formatErrorMessage(makeError("PullRequestDoesNotExistException"), "close")).toBe(
        "Pull request not found.",
      );
    });

    it("falls through to general handler for unknown close error", () => {
      expect(formatErrorMessage(makeError("UnknownException", "close problem"), "close")).toBe(
        "close problem",
      );
    });
  });

  describe("general AWS errors", () => {
    it("returns auth message for CredentialsProviderError", () => {
      expect(formatErrorMessage(makeError("CredentialsProviderError"))).toBe(
        "AWS authentication failed. Run `aws configure` to set up credentials.",
      );
    });

    it("returns auth message for CredentialError", () => {
      expect(formatErrorMessage(makeError("CredentialError"))).toBe(
        "AWS authentication failed. Run `aws configure` to set up credentials.",
      );
    });

    it("returns message for RepositoryDoesNotExistException", () => {
      expect(formatErrorMessage(makeError("RepositoryDoesNotExistException"))).toBe(
        "Repository not found.",
      );
    });
  });

  describe("access control errors", () => {
    it("returns comment-specific access denied for comment context", () => {
      expect(formatErrorMessage(makeError("AccessDeniedException"), "comment")).toBe(
        "Access denied. Check your IAM policy allows CodeCommit write access.",
      );
    });

    it("returns generic access denied for non-comment context", () => {
      expect(formatErrorMessage(makeError("AccessDeniedException"), "merge")).toBe(
        "Access denied. Check your IAM policy.",
      );
    });

    it("returns access denied for UnauthorizedException", () => {
      expect(formatErrorMessage(makeError("UnauthorizedException"))).toBe(
        "Access denied. Check your IAM policy.",
      );
    });
  });

  describe("network errors", () => {
    it("returns network error for NetworkingError", () => {
      expect(formatErrorMessage(makeError("NetworkingError"))).toBe(
        "Network error. Check your connection.",
      );
    });

    it("returns network error for ECONNREFUSED", () => {
      expect(formatErrorMessage(makeError("Error", "ECONNREFUSED"))).toBe(
        "Network error. Check your connection.",
      );
    });

    it("returns network error for ETIMEDOUT", () => {
      expect(formatErrorMessage(makeError("Error", "ETIMEDOUT"))).toBe(
        "Network error. Check your connection.",
      );
    });
  });

  describe("default sanitization", () => {
    it("sanitizes ARNs in error messages", () => {
      expect(
        formatErrorMessage(makeError("Error", "Resource arn:aws:codecommit:us-east-1:123 error")),
      ).toBe("Resource [ARN] error");
    });

    it("sanitizes account IDs", () => {
      expect(formatErrorMessage(makeError("Error", "Account 123456789012 denied"))).toBe(
        "Account [ACCOUNT_ID] denied",
      );
    });

    it("sanitizes access keys", () => {
      expect(formatErrorMessage(makeError("Error", "Key AKIAIOSFODNN7EXAMPLE invalid"))).toBe(
        "Key [ACCESS_KEY] invalid",
      );
    });

    it("sanitizes region names", () => {
      expect(formatErrorMessage(makeError("Error", "Region us-east-1 unavailable"))).toBe(
        "Region [REGION] unavailable",
      );
    });

    it("returns plain message for generic errors", () => {
      expect(formatErrorMessage(makeError("Error", "Something went wrong"))).toBe(
        "Something went wrong",
      );
    });
  });
});

// --- Property-Based Tests ---

// Creates an Error that falls through to the default sanitization path.
// Uses a name not matched by any known error handler, and a message
// that avoids ECONNREFUSED/ETIMEDOUT to prevent network error branching.
function unknownError(message: string): Error {
  const err = new Error(message);
  err.name = "SomeUnknownError";
  return err;
}

// Safe character set: lowercase only, so ECONNREFUSED/ETIMEDOUT can't appear
const safeChars = fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz ");
const safeString = fc.stringOf(safeChars, { maxLength: 15 });

describe("formatErrorMessage (property-based)", () => {
  it("never throws on any non-Error input", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
        ),
        (value) => {
          expect(() => formatErrorMessage(value)).not.toThrow();
        },
      ),
    );
  });

  it("always replaces ARN patterns in fallback path", () => {
    // ARN suffix: lowercase + digits + :/.-_ (no spaces/quotes so regex matches greedily)
    const arnBody = fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789:/.-_"), {
      minLength: 1,
      maxLength: 30,
    });
    fc.assert(
      fc.property(safeString, arnBody, safeString, (prefix, body, suffix) => {
        const message = `${prefix} arn:${body} ${suffix}`;
        const result = formatErrorMessage(unknownError(message));
        expect(result).not.toMatch(/arn:/i);
        expect(result).toContain("[ARN]");
      }),
    );
  });

  it("always replaces 12-digit account IDs in fallback path", () => {
    fc.assert(
      fc.property(safeString, safeString, (prefix, suffix) => {
        // Space separators guarantee word boundaries around the 12-digit number
        const message = `${prefix} 123456789012 ${suffix}`;
        const result = formatErrorMessage(unknownError(message));
        expect(result).not.toMatch(/\b\d{12}\b/);
      }),
    );
  });

  it("does not replace 11-digit or 13-digit numbers", () => {
    fc.assert(
      fc.property(fc.constantFrom("12345678901", "1234567890123"), (num) => {
        const message = `error ${num} occurred`;
        const result = formatErrorMessage(unknownError(message));
        expect(result).toContain(num);
      }),
    );
  });
});
