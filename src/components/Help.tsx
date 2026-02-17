import { Box, Text, useInput } from "ink";
import React from "react";

interface Props {
  onClose: () => void;
}

const KEY_WIDTH = 14;

function KeyRow({ keyName, description }: { keyName: string; description: string }) {
  return (
    <Box>
      <Box minWidth={KEY_WIDTH}>
        <Text> {keyName}</Text>
      </Box>
      <Text>{description}</Text>
    </Box>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text bold color="yellow">
      === {title} ===
    </Text>
  );
}

export function Help({ onClose }: Props) {
  useInput((input, key) => {
    if (input === "?" || input === "q" || key.escape || key.return) {
      onClose();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          review-codecommit — Help
        </Text>
      </Box>
      <Box flexDirection="column">
        <SectionHeader title="Navigation" />
        <KeyRow keyName="j / ↓" description="Cursor down" />
        <KeyRow keyName="k / ↑" description="Cursor up" />
        <KeyRow keyName="Ctrl+d" description="Half page down" />
        <KeyRow keyName="Ctrl+u" description="Half page up" />
        <KeyRow keyName="G" description="Jump to end" />
        <KeyRow keyName="Tab" description="Next file" />
        <KeyRow keyName="Shift+Tab" description="Previous file" />
        <KeyRow keyName="f" description="File list" />
        <KeyRow keyName="Enter" description="Select / confirm" />
        <KeyRow keyName="q / Esc" description="Back / quit" />
        <KeyRow keyName="Ctrl+C" description="Exit immediately" />
        <KeyRow keyName="?" description="Toggle this help" />
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <SectionHeader title="Comments (PR Detail)" />
        <KeyRow keyName="c" description="Post comment" />
        <KeyRow keyName="C" description="Post inline comment" />
        <KeyRow keyName="R" description="Reply to comment" />
        <KeyRow keyName="o" description="Toggle thread fold" />
        <KeyRow keyName="e" description="Edit comment" />
        <KeyRow keyName="d" description="Delete comment" />
        <KeyRow keyName="g" description="React to comment" />
        <KeyRow keyName="← / h" description="Previous reaction" />
        <KeyRow keyName="→ / l" description="Next reaction" />
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <SectionHeader title="PR Actions (PR Detail)" />
        <KeyRow keyName="a" description="Approve PR" />
        <KeyRow keyName="r" description="Revoke approval" />
        <KeyRow keyName="m" description="Merge PR" />
        <KeyRow keyName="x" description="Close PR without merge" />
        <KeyRow keyName="n" description="Next commit view" />
        <KeyRow keyName="N" description="Previous commit view" />
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <SectionHeader title="PR List" />
        <KeyRow keyName="f" description="Filter by status" />
        <KeyRow keyName="/" description="Search pull requests" />
        <KeyRow keyName="n" description="Next page" />
        <KeyRow keyName="p" description="Previous page" />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press any key to close</Text>
      </Box>
    </Box>
  );
}
