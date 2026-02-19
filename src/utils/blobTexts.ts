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

export function blobKey(diff: Difference): string {
  return `${diff.beforeBlob?.blobId ?? ""}:${diff.afterBlob?.blobId ?? ""}`;
}

interface StreamCallbacks {
  isStale: () => boolean;
  onLoaded: (key: string, texts: { before: string; after: string }) => void;
  onError: (key: string) => void;
}

/**
 * Streams blob text fetches with incremental callbacks and a stale-load guard.
 * Uses a worker pool pattern with configurable concurrency.
 */
export async function streamBlobTexts(
  client: CodeCommitClient,
  repoName: string,
  differences: Difference[],
  callbacks: StreamCallbacks,
  concurrency = 6,
): Promise<void> {
  let index = 0;

  async function processNext(): Promise<void> {
    const currentIndex = index;
    index += 1;
    if (currentIndex >= differences.length) return;

    const diff = differences[currentIndex]!;
    const beforeBlobId = diff.beforeBlob?.blobId;
    const afterBlobId = diff.afterBlob?.blobId;
    const key = blobKey(diff);

    /* v8 ignore start -- no-blob path rarely occurs; stale-load guard hard to test deterministically */
    if (!beforeBlobId && !afterBlobId) {
      if (!callbacks.isStale()) {
        callbacks.onLoaded(key, { before: "", after: "" });
      }
      return processNext();
    }
    /* v8 ignore stop */

    try {
      const [before, after] = await Promise.all([
        beforeBlobId ? getBlobContent(client, repoName, beforeBlobId) : Promise.resolve(""),
        afterBlobId ? getBlobContent(client, repoName, afterBlobId) : Promise.resolve(""),
      ]);

      /* v8 ignore start -- stale-load guard hard to test deterministically */
      if (!callbacks.isStale()) {
        callbacks.onLoaded(key, { before, after });
      }
      /* v8 ignore stop */
    } catch {
      /* v8 ignore start -- stale-load guard + error path hard to test deterministically */
      if (!callbacks.isStale()) {
        callbacks.onError(key);
      }
      /* v8 ignore stop */
    }

    return processNext();
  }

  const workerCount = Math.min(concurrency, differences.length);
  const workers = Array.from({ length: workerCount }, () => processNext());
  await Promise.all(workers);
}
