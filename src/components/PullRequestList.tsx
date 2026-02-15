import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import React, { useEffect, useMemo, useState } from "react";
import type { PullRequestDisplayStatus, PullRequestSummary } from "../services/codecommit.js";
import { extractAuthorName, formatRelativeDate } from "../utils/formatDate.js";

interface PaginationViewState {
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface Props {
  repositoryName: string;
  pullRequests: PullRequestSummary[];
  onSelect: (pullRequestId: string) => void;
  onBack: () => void;
  onHelp: () => void;
  statusFilter: PullRequestDisplayStatus;
  onChangeStatusFilter: (filter: PullRequestDisplayStatus) => void;
  searchQuery: string;
  onChangeSearchQuery: (query: string) => void;
  pagination: PaginationViewState;
  onNextPage: () => void;
  onPreviousPage: () => void;
}

const STATUS_CYCLE: PullRequestDisplayStatus[] = ["OPEN", "CLOSED", "MERGED"];

function nextStatusFilter(current: PullRequestDisplayStatus): PullRequestDisplayStatus {
  const index = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length]!;
}

function statusLabel(filter: PullRequestDisplayStatus): string {
  switch (filter) {
    case "OPEN":
      return "Open";
    case "CLOSED":
      return "Closed";
    case "MERGED":
      return "Merged";
  }
}

function statusBadge(status: PullRequestDisplayStatus): string {
  switch (status) {
    case "OPEN":
      return "";
    case "CLOSED":
      return "CLOSED  ";
    case "MERGED":
      return "MERGED  ";
  }
}

export function PullRequestList({
  repositoryName,
  pullRequests,
  onSelect,
  onBack,
  onHelp,
  statusFilter,
  onChangeStatusFilter,
  searchQuery,
  onChangeSearchQuery,
  pagination,
  onNextPage,
  onPreviousPage,
}: Props) {
  const [isSearching, setIsSearching] = useState(false);
  const [cursor, setCursor] = useState(0);

  const filteredPullRequests = useMemo(() => {
    if (!searchQuery) return pullRequests;
    const query = searchQuery.toLowerCase();
    return pullRequests.filter(
      (pr) =>
        pr.title.toLowerCase().includes(query) ||
        extractAuthorName(pr.authorArn).toLowerCase().includes(query),
    );
  }, [pullRequests, searchQuery]);

  useEffect(() => {
    setCursor((prev) => Math.min(prev, Math.max(filteredPullRequests.length - 1, 0)));
  }, [filteredPullRequests.length]);

  useInput((input, key) => {
    if (isSearching) {
      if (key.escape) {
        setIsSearching(false);
        onChangeSearchQuery("");
      }
      return;
    }

    if (input === "q" || key.escape) {
      onBack();
      return;
    }
    if (input === "?") {
      onHelp();
      return;
    }
    if (input === "f") {
      onChangeStatusFilter(nextStatusFilter(statusFilter));
      return;
    }
    if (input === "/") {
      setIsSearching(true);
      return;
    }
    if (input === "n" && pagination.hasNextPage) {
      onNextPage();
      return;
    }
    if (input === "p" && pagination.hasPreviousPage) {
      onPreviousPage();
      return;
    }
    if (input === "j" || key.downArrow) {
      setCursor((prev) => Math.min(prev + 1, filteredPullRequests.length - 1));
      return;
    }
    if (input === "k" || key.upArrow) {
      setCursor((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.return) {
      const item = filteredPullRequests[cursor];
      if (item) {
        onSelect(item.pullRequestId);
      }
    }
  });

  const label = statusLabel(statusFilter);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          review-codecommit
        </Text>
        <Text> — </Text>
        <Text bold>{repositoryName}</Text>
      </Box>

      {/* Status filter tabs */}
      <Box marginBottom={1}>
        {STATUS_CYCLE.map((s) => (
          <Text key={s}>
            {s === statusFilter ? (
              <Text bold color="green">
                [{statusLabel(s)}]
              </Text>
            ) : (
              <Text dimColor> {statusLabel(s)} </Text>
            )}
            {"  "}
          </Text>
        ))}
      </Box>

      {/* Search input */}
      {isSearching && (
        <Box marginBottom={1}>
          <Text>Search: </Text>
          <TextInput value={searchQuery} onChange={onChangeSearchQuery} />
        </Box>
      )}

      {/* PR list header */}
      <Box marginBottom={1}>
        <Text bold>
          {label} Pull Requests{searchQuery ? ` matching "${searchQuery}"` : ""} (
          {filteredPullRequests.length}):
        </Text>
      </Box>

      {/* PR list */}
      {filteredPullRequests.length === 0 ? (
        <Box>
          <Text dimColor>
            {searchQuery
              ? "No matching pull requests."
              : `No ${label.toLowerCase()} pull requests.`}
          </Text>
        </Box>
      ) : (
        filteredPullRequests.map((pr, index) => (
          <Box key={pr.pullRequestId}>
            <Text {...(index === cursor ? { color: "green" as const } : {})}>
              {index === cursor ? "> " : "  "}#{pr.pullRequestId} {statusBadge(pr.status)}
              {pr.title}
              {"  "}
              <Text dimColor>
                {extractAuthorName(pr.authorArn)} {formatRelativeDate(pr.creationDate)}
              </Text>
            </Text>
          </Box>
        ))
      )}

      {/* Pagination info */}
      <Box marginTop={1}>
        <Text dimColor>
          Page {pagination.currentPage}
          {pagination.hasPreviousPage ? "  p prev" : ""}
          {pagination.hasNextPage ? "  n next" : ""}
        </Text>
      </Box>

      {/* Footer */}
      <Box marginTop={0}>
        <Text dimColor>
          {isSearching
            ? "Enter select  Esc clear search"
            : "↑↓ navigate  Enter view  f filter  / search  n next  p prev  q back  ? help"}
        </Text>
      </Box>
    </Box>
  );
}
