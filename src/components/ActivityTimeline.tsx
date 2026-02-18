import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import type { PrActivityEvent } from "../services/codecommit.js";
import { extractAuthorName, formatRelativeDate } from "../utils/formatDate.js";

interface Props {
  pullRequestTitle: string;
  events: PrActivityEvent[];
  isLoading: boolean;
  error: string | null;
  hasNextPage: boolean;
  onLoadNextPage: () => void;
  onBack: () => void;
}

export function ActivityTimeline({
  pullRequestTitle,
  events,
  isLoading,
  error,
  hasNextPage,
  onLoadNextPage,
  onBack,
}: Props) {
  const [cursorIndex, setCursorIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === "q") {
      onBack();
      return;
    }

    if (input === "j" || key.downArrow) {
      setCursorIndex((prev) => Math.min(prev + 1, events.length - 1));
      return;
    }

    if (input === "k" || key.upArrow) {
      setCursorIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (input === "n" && hasNextPage && !isLoading) {
      onLoadNextPage();
      return;
    }
  });

  if (isLoading && events.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>Activity: {pullRequestTitle}</Text>
        <Text color="cyan">Loading activity...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text bold>Activity: {pullRequestTitle}</Text>
        <Text color="red">Failed to load activity:</Text>
        <Text color="red">{error}</Text>
        <Text dimColor>Press q to go back</Text>
      </Box>
    );
  }

  if (events.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>Activity: {pullRequestTitle}</Text>
        <Text dimColor>No activity events found.</Text>
        <Text dimColor>q back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Activity: {pullRequestTitle}</Text>
      <Box flexDirection="column" marginTop={1}>
        {events.map((event, i) => (
          <ActivityEventRow
            key={`${event.eventDate.toISOString()}-${i}`}
            event={event}
            isCursor={i === cursorIndex}
          />
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {isLoading
            ? "Loading more events..."
            : hasNextPage
              ? "↑↓ scroll  n next page  q back"
              : "↑↓ scroll  q back"}
        </Text>
      </Box>
    </Box>
  );
}

function ActivityEventRow({ event, isCursor }: { event: PrActivityEvent; isCursor: boolean }) {
  const icon = getEventIcon(event.eventType);
  const timeAgo = formatRelativeDate(event.eventDate);
  const actorName = extractAuthorName(event.actorArn);
  const actorDisplay = actorName.length > 12 ? `${actorName.slice(0, 11)}…` : actorName.padEnd(12);

  return (
    <Box>
      <Text>{isCursor ? "> " : "  "}</Text>
      <Text>{icon} </Text>
      <Text color="cyan">{actorDisplay} </Text>
      <Text>{event.description.padEnd(40)}</Text>
      <Text dimColor>{timeAgo}</Text>
    </Box>
  );
}

function getEventIcon(eventType: string): string {
  const iconMap: Record<string, string> = {
    PULL_REQUEST_CREATED: "📝",
    PULL_REQUEST_STATUS_CHANGED: "🔄",
    PULL_REQUEST_SOURCE_REFERENCE_UPDATED: "🔀",
    PULL_REQUEST_MERGE_STATE_CHANGED: "✅",
    PULL_REQUEST_APPROVAL_RULE_CREATED: "📋",
    PULL_REQUEST_APPROVAL_RULE_DELETED: "🗑️",
    PULL_REQUEST_APPROVAL_RULE_UPDATED: "✏️",
    PULL_REQUEST_APPROVAL_RULE_OVERRIDDEN: "🔓",
    PULL_REQUEST_APPROVALS_RESET: "🔃",
    PULL_REQUEST_APPROVAL_STATE_CHANGED: "✅",
  };
  return iconMap[eventType] ?? "ℹ️";
}
