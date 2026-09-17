/**
 * Latency-bound service paths.
 *
 * These calls are dominated by round trips to CodeCommit, not CPU. The fake
 * client below charges a fixed latency per `send()` so a bench result reads
 * directly as "how many round trips deep is this call". LATENCY is deliberately
 * small to keep the suite fast; multiply by your real RTT to get wall time.
 */
import { bench, describe } from "vitest";
import {
  getCommitsForPR,
  getReactionsForComments,
  listPullRequests,
} from "../src/services/codecommit.js";

/** Per-request latency in ms. Real CodeCommit RTTs are typically 30-150ms. */
const LATENCY = 1;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface FakeResponses {
  pullRequestIds?: string[];
  commitChain?: number;
}

/**
 * Minimal stand-in for CodeCommitClient: every send() costs LATENCY and
 * returns a canned shape based on the command's constructor name.
 */
function makeFakeClient(config: FakeResponses) {
  let calls = 0;
  const client = {
    async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
      calls++;
      await sleep(LATENCY);
      const name = command.constructor.name;

      if (name === "ListPullRequestsCommand") {
        return { pullRequestIds: config.pullRequestIds ?? [] };
      }
      if (name === "GetPullRequestCommand") {
        return {
          pullRequest: {
            pullRequestId: String(command.input["pullRequestId"]),
            title: "bench PR",
            authorArn: "arn:aws:iam::123456789012:user/author",
            creationDate: new Date(),
            pullRequestStatus: "OPEN",
            pullRequestTargets: [{}],
          },
        };
      }
      if (name === "GetCommitCommand") {
        const commitId = String(command.input["commitId"]);
        const index = Number(commitId.replace("commit-", ""));
        const isLast = index >= (config.commitChain ?? 0) - 1;
        return {
          commit: {
            commitId,
            message: "bench commit",
            author: { name: "author", date: "2026-02-13T10:00:00Z" },
            parents: isLast ? ["merge-base"] : [`commit-${index + 1}`],
          },
        };
      }
      if (name === "GetCommentReactionsCommand") {
        return { reactionsForComment: [] };
      }
      return {};
    },
    get callCount() {
      return calls;
    },
  };
  return client as unknown as Parameters<typeof listPullRequests>[0] & { callCount: number };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `pr-${i}`);

describe("listPullRequests (1 List + N GetPullRequest, concurrency 10)", () => {
  for (const count of [10, 25]) {
    bench(`${count} PRs on the page`, async () => {
      const client = makeFakeClient({ pullRequestIds: ids(count) });
      await listPullRequests(client, "bench-repo");
    });
  }
});

describe("getCommitsForPR (sequential parent-chain walk)", () => {
  for (const count of [10, 50, 100]) {
    bench(`${count}-commit PR`, async () => {
      const client = makeFakeClient({ commitChain: count });
      await getCommitsForPR(client, "bench-repo", "commit-0", "merge-base");
    });
  }
});

describe("getReactionsForComments (1 call per comment, concurrency 15)", () => {
  for (const count of [20, 100]) {
    const commentIds = Array.from({ length: count }, (_, i) => `comment-${i}`);
    bench(`${count} comments`, async () => {
      const client = makeFakeClient({});
      await getReactionsForComments(client, commentIds);
    });
  }
});
