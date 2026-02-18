import type { CodeCommitClient, Difference } from "@aws-sdk/client-codecommit";
import { getBlobContent } from "../services/codecommit.js";
import { mapWithLimit } from "./mapWithLimit.js";

/**
 * Fetches before/after blob content for a list of diff entries.
 * Returns a Map keyed by `${beforeBlobId}:${afterBlobId}`.
 */
export async function fetchBlobTexts(
  client: CodeCommitClient,
  repoName: string,
  diffs: Difference[],
): Promise<Map<string, { before: string; after: string }>> {
  const results = await mapWithLimit(diffs, 5, async (diff) => {
    const beforeBlobId = diff.beforeBlob?.blobId;
    const afterBlobId = diff.afterBlob?.blobId;
    const key = `${beforeBlobId ?? ""}:${afterBlobId ?? ""}`;

    const [before, after] = await Promise.all([
      beforeBlobId ? getBlobContent(client, repoName, beforeBlobId) : Promise.resolve(""),
      afterBlobId ? getBlobContent(client, repoName, afterBlobId) : Promise.resolve(""),
    ]);

    return { key, before, after };
  });

  const texts = new Map<string, { before: string; after: string }>();
  for (const result of results) {
    texts.set(result.key, { before: result.before, after: result.after });
  }
  return texts;
}
