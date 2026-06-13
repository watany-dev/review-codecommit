import type { Difference } from "@aws-sdk/client-codecommit";
import { bench, describe } from "vitest";
import type { CommentThread } from "../src/services/codecommit.js";
import { buildDisplayLines, type DisplayLine } from "../src/utils/displayLines.js";

function makeLines(count: number, prefix: string): string {
  return Array.from({ length: count }, (_, i) => `${prefix} line ${i} with some content`).join(
    "\n",
  );
}

function makeFixture(fileCount: number, linesPerFile: number) {
  const differences: Difference[] = [];
  const diffTexts = new Map<string, { before: string; after: string }>();
  const diffTextStatus = new Map<string, "loading" | "loaded" | "error">();

  for (let f = 0; f < fileCount; f++) {
    const beforeBlobId = `before-${f}`;
    const afterBlobId = `after-${f}`;
    differences.push({
      beforeBlob: { blobId: beforeBlobId, path: `src/file-${f}.ts` },
      afterBlob: { blobId: afterBlobId, path: `src/file-${f}.ts` },
      changeType: "M",
    });
    const key = `${beforeBlobId}:${afterBlobId}`;
    const before = makeLines(linesPerFile, `f${f}-old`);
    const after = makeLines(linesPerFile, `f${f}-new`);
    diffTexts.set(key, { before, after });
    diffTextStatus.set(key, "loaded");
  }

  return { differences, diffTexts, diffTextStatus };
}

function makeInlineThreads(fileCount: number, threadsPerFile: number): CommentThread[] {
  const threads: CommentThread[] = [];
  for (let f = 0; f < fileCount; f++) {
    for (let t = 0; t < threadsPerFile; t++) {
      threads.push({
        location: {
          filePath: `src/file-${f}.ts`,
          filePosition: t * 10 + 1,
          relativeFileVersion: "AFTER",
        },
        comments: [
          {
            commentId: `c-${f}-${t}`,
            content: `comment ${t} on file ${f}`,
            authorArn: "arn:aws:iam::123456789012:user/reviewer",
          },
        ],
      });
    }
  }
  return threads;
}

const small = makeFixture(5, 100);
const large = makeFixture(20, 400);
const withComments = makeFixture(10, 200);
const inlineThreads = makeInlineThreads(10, 5);

describe("buildDisplayLines", () => {
  bench("5 files x 100 lines, no comments, cold cache", () => {
    buildDisplayLines(
      small.differences,
      small.diffTexts,
      small.diffTextStatus,
      new Map(),
      [],
      new Map(),
      new Map(),
      new Map(),
    );
  });

  bench("20 files x 400 lines, no comments, cold cache", () => {
    buildDisplayLines(
      large.differences,
      large.diffTexts,
      large.diffTextStatus,
      new Map(),
      [],
      new Map(),
      new Map(),
      new Map(),
    );
  });

  const warmCache = new Map<string, DisplayLine[]>();
  bench("20 files x 400 lines, no comments, warm cache", () => {
    buildDisplayLines(
      large.differences,
      large.diffTexts,
      large.diffTextStatus,
      new Map(),
      [],
      new Map(),
      new Map(),
      warmCache,
    );
  });

  const warmCacheComments = new Map<string, DisplayLine[]>();
  bench("10 files x 200 lines, 50 inline threads, warm cache", () => {
    buildDisplayLines(
      withComments.differences,
      withComments.diffTexts,
      withComments.diffTextStatus,
      new Map(),
      inlineThreads,
      new Map(),
      new Map(),
      warmCacheComments,
    );
  });
});
