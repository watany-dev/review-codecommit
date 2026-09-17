import type { CodeCommitClient, Difference } from "@aws-sdk/client-codecommit";
import { getBlobContent } from "../services/codecommit.js";
import { mapWithLimit } from "./mapWithLimit.js";

export function blobKey(diff: Difference): string {
  return `${diff.beforeBlob?.blobId ?? ""}:${diff.afterBlob?.blobId ?? ""}`;
}

async function loadBlobPair(
  client: CodeCommitClient,
  repoName: string,
  diff: Difference,
): Promise<{ key: string; before: string; after: string }> {
  const key = blobKey(diff);
  const beforeBlobId = diff.beforeBlob?.blobId;
  const afterBlobId = diff.afterBlob?.blobId;
  const [before, after] = await Promise.all([
    beforeBlobId ? getBlobContent(client, repoName, beforeBlobId) : Promise.resolve(""),
    afterBlobId ? getBlobContent(client, repoName, afterBlobId) : Promise.resolve(""),
  ]);
  return { key, before, after };
}

export async function fetchBlobTexts(
  client: CodeCommitClient,
  repoName: string,
  diffs: Difference[],
): Promise<Map<string, { before: string; after: string }>> {
  const results = await mapWithLimit(diffs, 5, (diff) => loadBlobPair(client, repoName, diff));
  return new Map(results.map(({ key, before, after }) => [key, { before, after }]));
}

interface StreamCallbacks {
  isStale: () => boolean;
  onLoaded: (key: string, texts: { before: string; after: string }) => void;
  onError: (key: string) => void;
}

export async function streamBlobTexts(
  client: CodeCommitClient,
  repoName: string,
  differences: Difference[],
  callbacks: StreamCallbacks,
  concurrency = 6,
): Promise<void> {
  const { isStale, onLoaded, onError } = callbacks;
  await mapWithLimit(differences, concurrency, async (diff) => {
    try {
      const { key, before, after } = await loadBlobPair(client, repoName, diff);
      if (!isStale()) {
        onLoaded(key, { before, after });
      }
    } catch {
      if (!isStale()) {
        onError(blobKey(diff));
      }
    }
  });
}
