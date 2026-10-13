/**
 * Latency-bound paths around the PR detail screen.
 *
 * Same fake-client approach as serviceRoundTrips.bench.ts: every send() costs
 * LATENCY ms, so results read as "how many round trips deep". GetBlob can be
 * made slow for one blob to model a large file.
 */
import type { Difference } from "@aws-sdk/client-codecommit";
import { bench, describe } from "vitest";
import { getAllDifferences, getPullRequestDetail } from "../src/services/codecommit.js";
import { fetchBlobTexts, streamBlobTexts } from "../src/utils/blobTexts.js";

const LATENCY = 2;
const SLOW_BLOB_LATENCY = 40;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface FakeConfig {
  files: number;
  diffPageSize: number;
  commentPages: number;
  slowBlobId?: string;
}

function makeFakeClient(config: FakeConfig) {
  let calls = 0;
  const byName = new Map<string, number>();
  const client = {
    async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
      calls++;
      const name = command.constructor.name;
      byName.set(name, (byName.get(name) ?? 0) + 1);
      const blobId = command.input["blobId"];
      const isSlow = blobId !== undefined && blobId === config.slowBlobId;
      await sleep(isSlow ? SLOW_BLOB_LATENCY : LATENCY);

      if (name === "GetPullRequestCommand") {
        return {
          pullRequest: {
            pullRequestId: "1",
            pullRequestTargets: [{ sourceCommit: "src", destinationCommit: "dst" }],
          },
        };
      }
      if (name === "GetDifferencesCommand") {
        const page = Number(command.input["NextToken"] ?? 0);
        const start = page * config.diffPageSize;
        const end = Math.min(start + config.diffPageSize, config.files);
        const differences: Difference[] = [];
        for (let f = start; f < end; f++) {
          differences.push({
            beforeBlob: { blobId: `b${f}`, path: `f${f}.ts` },
            afterBlob: { blobId: `a${f}`, path: `f${f}.ts` },
            changeType: "M",
          });
        }
        return { differences, NextToken: end < config.files ? String(page + 1) : undefined };
      }
      if (name === "GetCommentsForPullRequestCommand") {
        const page = Number(command.input["nextToken"] ?? 0);
        return {
          commentsForPullRequestData: [],
          nextToken: page + 1 < config.commentPages ? String(page + 1) : undefined,
        };
      }
      if (name === "GetBlobCommand") {
        return { content: new TextEncoder().encode(`blob ${String(blobId)}\n`) };
      }
      return {};
    },
    get callCount() {
      return calls;
    },
    byName,
  };
  return client as unknown as Parameters<typeof getAllDifferences>[0] & {
    callCount: number;
    byName: Map<string, number>;
  };
}

// 300 changed files -> GetDifferences returns 100 per page -> 3 pages.
const detailConfig: FakeConfig = { files: 300, diffPageSize: 100, commentPages: 2 };

/** Current flow: detail (PR -> all diff pages || all comment pages) -> stream blobs. */
async function timeToFirstBlobCurrent() {
  const client = makeFakeClient(detailConfig);
  let firstAt = 0;
  const start = performance.now();
  const detail = await getPullRequestDetail(client, "1", "repo");
  await new Promise<void>((resolve) => {
    void streamBlobTexts(client, "repo", detail.differences, {
      isStale: () => false,
      onLoaded: () => {
        if (!firstAt) {
          firstAt = performance.now() - start;
          resolve();
        }
      },
      onError: () => {},
    });
  });
  return firstAt;
}

describe("PR detail open: time to first diff text (300 files, 3 diff pages, 2 comment pages)", () => {
  bench("current: blobs start after every diff and comment page", async () => {
    await timeToFirstBlobCurrent();
  });
  bench("reference: first diff page + first blob only (2 round trips)", async () => {
    const client = makeFakeClient({ ...detailConfig, files: 100 });
    await getAllDifferences(client, "repo", "dst", "src");
    await new Promise<void>((resolve) => {
      void streamBlobTexts(
        client,
        "repo",
        [{ beforeBlob: { blobId: "b0" }, afterBlob: { blobId: "a0" } }],
        { isStale: () => false, onLoaded: () => resolve(), onError: () => {} },
      );
    });
  });
});

// Commit view: 15 files, one of which is slow (e.g. a large generated file).
const commitConfig: FakeConfig = {
  files: 15,
  diffPageSize: 100,
  commentPages: 1,
  slowBlobId: "a14",
};

describe("commit view: time to first diff text (15 files, 1 slow blob)", () => {
  bench("current: fetchBlobTexts (all-or-nothing, concurrency 5)", async () => {
    const client = makeFakeClient(commitConfig);
    const diffs = await getAllDifferences(client, "repo", "p", "c");
    await fetchBlobTexts(client, "repo", diffs);
  });
  bench("streamBlobTexts (first file)", async () => {
    const client = makeFakeClient(commitConfig);
    const diffs = await getAllDifferences(client, "repo", "p", "c");
    await new Promise<void>((resolve) => {
      void streamBlobTexts(client, "repo", diffs, {
        isStale: () => false,
        onLoaded: () => resolve(),
        onError: () => {},
      });
    });
  });
});

/** Mirrors handleLoadCommitDiff: no per-commit cache, so every Tab refetches. */
async function visitCommit(client: ReturnType<typeof makeFakeClient>) {
  const diffs = await getAllDifferences(client, "repo", "p", "c");
  await fetchBlobTexts(client, "repo", diffs);
}

describe("commit view: Tab back and forth over 3 commits twice (6 visits, 15 files each)", () => {
  bench("current: refetch differences + all blobs on every visit", async () => {
    const client = makeFakeClient({ ...commitConfig, slowBlobId: undefined });
    for (let i = 0; i < 6; i++) await visitCommit(client);
  });
  bench("with a per-commit cache (3 cold visits)", async () => {
    const client = makeFakeClient({ ...commitConfig, slowBlobId: undefined });
    for (let i = 0; i < 3; i++) await visitCommit(client);
  });
});

// Round-trip counts (printed once so the issue can cite them).
{
  const detailClient = makeFakeClient(detailConfig);
  const t0 = performance.now();
  await getPullRequestDetail(detailClient, "1", "repo");
  const detailMs = performance.now() - t0;
  const first = await timeToFirstBlobCurrent();
  const tabClient = makeFakeClient({ ...commitConfig, slowBlobId: undefined });
  for (let i = 0; i < 6; i++) await visitCommit(tabClient);
  console.log(
    JSON.stringify({
      detailCalls: Object.fromEntries(detailClient.byName),
      detailMs: Math.round(detailMs),
      firstBlobMs: Math.round(first),
      tabSixVisitsCalls: Object.fromEntries(tabClient.byName),
    }),
  );
}
