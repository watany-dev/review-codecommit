/**
 * Rendering cost of list screens.
 *
 * PullRequestDetail and ActivityTimeline slice to ~30 visible rows before
 * rendering. PullRequestList does not, but listPullRequests caps a page at 25.
 */
import { render } from "ink-testing-library";
import React from "react";
import { bench, describe } from "vitest";
import { ActivityTimeline } from "../src/components/ActivityTimeline.js";
import { PullRequestList } from "../src/components/PullRequestList.js";
import type { PrActivityEvent, PullRequestSummary } from "../src/services/codecommit.js";

const noop = () => {};
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

const EVENT_TYPES = [
  "PULL_REQUEST_CREATED",
  "PULL_REQUEST_STATUS_CHANGED",
  "PULL_REQUEST_SOURCE_REFERENCE_UPDATED",
  "PULL_REQUEST_APPROVAL_STATE_CHANGED",
  "PULL_REQUEST_MERGE_STATE_CHANGED",
];

function makeEvents(count: number): PrActivityEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    eventDate: new Date(Date.UTC(2026, 1, 1, 0, i % 60)),
    eventType: EVENT_TYPES[i % EVENT_TYPES.length]!,
    actorArn: `arn:aws:iam::123456789012:user/reviewer-${i % 7}`,
    description: `did something notable number ${i}`,
  }));
}

function makePullRequests(count: number): PullRequestSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    pullRequestId: String(1000 + i),
    title: `feat: implement the thing number ${i}`,
    authorArn: `arn:aws:iam::123456789012:user/author-${i % 7}`,
    creationDate: new Date(Date.UTC(2026, 1, 1, 0, i % 60)),
    status: "OPEN" as const,
  }));
}

function renderTimeline(events: PrActivityEvent[]) {
  return render(
    <ActivityTimeline
      pullRequestTitle="perf: benchmark fixture"
      events={events}
      isLoading={false}
      error={null}
      hasNextPage={false}
      onLoadNextPage={noop}
      onBack={noop}
    />,
  );
}

function renderList(pullRequests: PullRequestSummary[]) {
  return render(
    <PullRequestList
      repositoryName="bench-repo"
      pullRequests={pullRequests}
      onSelect={noop}
      onBack={noop}
      onHelp={noop}
      statusFilter="OPEN"
      onChangeStatusFilter={noop}
      searchQuery=""
      onChangeSearchQuery={noop}
      pagination={{ currentPage: 1, hasNextPage: false, hasPreviousPage: false }}
      onNextPage={noop}
      onPreviousPage={noop}
    />,
  );
}

describe("ActivityTimeline", () => {
  for (const count of [50, 150, 300]) {
    const events = makeEvents(count);

    bench(`${count} events — initial mount`, async () => {
      const instance = renderTimeline(events);
      await flush();
      instance.unmount();
    });

    const instance = renderTimeline(events);
    let down = true;
    bench(`${count} events — j/k keystroke`, async () => {
      instance.stdin.write(down ? "j" : "k");
      down = !down;
      await flush();
    });
  }
});

describe("PullRequestList", () => {
  for (const count of [25, 100, 250]) {
    const pullRequests = makePullRequests(count);

    bench(`${count} PRs — initial mount`, async () => {
      const instance = renderList(pullRequests);
      await flush();
      instance.unmount();
    });

    const instance = renderList(pullRequests);
    let down = true;
    bench(`${count} PRs — j/k keystroke`, async () => {
      instance.stdin.write(down ? "j" : "k");
      down = !down;
      await flush();
    });
  }
});
