import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { PullRequestList } from "./PullRequestList.js";

describe("PullRequestList", () => {
  const pullRequests = [
    {
      pullRequestId: "42",
      title: "fix: login timeout",
      authorArn: "arn:aws:iam::123456789012:user/watany",
      creationDate: new Date("2026-02-13T10:00:00Z"),
      status: "OPEN" as const,
    },
    {
      pullRequestId: "43",
      title: "feat: add dashboard",
      authorArn: "arn:aws:iam::123456789012:user/taro",
      creationDate: new Date("2026-02-12T10:00:00Z"),
      status: "OPEN" as const,
    },
  ];

  const defaultProps = {
    repositoryName: "my-service",
    pullRequests,
    onSelect: vi.fn(),
    onBack: vi.fn(),
    onHelp: vi.fn(),
    statusFilter: "OPEN" as const,
    onChangeStatusFilter: vi.fn(),
    searchQuery: "",
    onChangeSearchQuery: vi.fn(),
    pagination: { currentPage: 1, hasNextPage: false, hasPreviousPage: false },
    onNextPage: vi.fn(),
    onPreviousPage: vi.fn(),
  };

  it("renders pull request titles", () => {
    const { lastFrame } = render(<PullRequestList {...defaultProps} />);
    const output = lastFrame();
    expect(output).toContain("fix: login timeout");
    expect(output).toContain("feat: add dashboard");
  });

  it("shows repository name and PR count", () => {
    const { lastFrame } = render(<PullRequestList {...defaultProps} />);
    const output = lastFrame();
    expect(output).toContain("my-service");
    expect(output).toContain("Open Pull Requests");
    expect(output).toContain("(2)");
  });

  it("shows empty message when no PRs", () => {
    const { lastFrame } = render(<PullRequestList {...defaultProps} pullRequests={[]} />);
    expect(lastFrame()).toContain("No open pull requests");
  });

  it("highlights first item by default", () => {
    const { lastFrame } = render(<PullRequestList {...defaultProps} />);
    expect(lastFrame()).toContain("> ");
    expect(lastFrame()).toContain("#42");
  });

  it("shows navigation hints", () => {
    const { lastFrame } = render(<PullRequestList {...defaultProps} />);
    expect(lastFrame()).toContain("navigate");
    expect(lastFrame()).toContain("back");
    expect(lastFrame()).toContain("help");
  });

  it("navigates down with j key", () => {
    const { lastFrame, stdin } = render(<PullRequestList {...defaultProps} />);
    stdin.write("j");
    expect(lastFrame()).toContain("> ");
    expect(lastFrame()).toContain("#43");
  });

  it("navigates up with k key", () => {
    const { lastFrame, stdin } = render(<PullRequestList {...defaultProps} />);
    stdin.write("j");
    stdin.write("k");
    const output = lastFrame();
    expect(output).toContain("#42");
  });

  it("calls onSelect on enter", () => {
    const onSelect = vi.fn();
    const { stdin } = render(<PullRequestList {...defaultProps} onSelect={onSelect} />);
    stdin.write("\r");
    expect(onSelect).toHaveBeenCalledWith("42");
  });

  it("calls onBack on q key", () => {
    const onBack = vi.fn();
    const { stdin } = render(<PullRequestList {...defaultProps} onBack={onBack} />);
    stdin.write("q");
    expect(onBack).toHaveBeenCalled();
  });

  it("calls onHelp on ? key", () => {
    const onHelp = vi.fn();
    const { stdin } = render(<PullRequestList {...defaultProps} onHelp={onHelp} />);
    stdin.write("?");
    expect(onHelp).toHaveBeenCalled();
  });

  it("does not go below last item", () => {
    const { lastFrame, stdin } = render(<PullRequestList {...defaultProps} />);
    stdin.write("j");
    stdin.write("j");
    stdin.write("j");
    expect(lastFrame()).toContain("#43");
  });

  it("does not go above first item", () => {
    const { lastFrame, stdin } = render(<PullRequestList {...defaultProps} />);
    stdin.write("k");
    expect(lastFrame()).toContain("#42");
  });

  // Status filter tests
  describe("status filter", () => {
    it("shows current filter as highlighted", () => {
      const { lastFrame } = render(<PullRequestList {...defaultProps} statusFilter="OPEN" />);
      expect(lastFrame()).toContain("[Open]");
    });

    it("calls onChangeStatusFilter with CLOSED when f key pressed from OPEN", () => {
      const onChangeStatusFilter = vi.fn();
      const { stdin } = render(
        <PullRequestList {...defaultProps} onChangeStatusFilter={onChangeStatusFilter} />,
      );
      stdin.write("f");
      expect(onChangeStatusFilter).toHaveBeenCalledWith("CLOSED");
    });

    it("calls onChangeStatusFilter with MERGED when f key pressed from CLOSED", () => {
      const onChangeStatusFilter = vi.fn();
      const { stdin } = render(
        <PullRequestList
          {...defaultProps}
          statusFilter="CLOSED"
          onChangeStatusFilter={onChangeStatusFilter}
        />,
      );
      stdin.write("f");
      expect(onChangeStatusFilter).toHaveBeenCalledWith("MERGED");
    });

    it("calls onChangeStatusFilter with OPEN when f key pressed from MERGED", () => {
      const onChangeStatusFilter = vi.fn();
      const { stdin } = render(
        <PullRequestList
          {...defaultProps}
          statusFilter="MERGED"
          onChangeStatusFilter={onChangeStatusFilter}
        />,
      );
      stdin.write("f");
      expect(onChangeStatusFilter).toHaveBeenCalledWith("OPEN");
    });

    it("shows Closed header when filter is CLOSED", () => {
      const { lastFrame } = render(
        <PullRequestList {...defaultProps} statusFilter="CLOSED" pullRequests={[]} />,
      );
      expect(lastFrame()).toContain("Closed Pull Requests");
      expect(lastFrame()).toContain("No closed pull requests");
    });

    it("shows Merged header when filter is MERGED", () => {
      const { lastFrame } = render(
        <PullRequestList {...defaultProps} statusFilter="MERGED" pullRequests={[]} />,
      );
      expect(lastFrame()).toContain("Merged Pull Requests");
      expect(lastFrame()).toContain("No merged pull requests");
    });

    it("shows CLOSED badge for closed PRs", () => {
      const closedPRs = [
        {
          pullRequestId: "35",
          title: "fix: typos",
          authorArn: "arn:aws:iam::123456789012:user/hanako",
          creationDate: new Date("2026-02-09T10:00:00Z"),
          status: "CLOSED" as const,
        },
      ];
      const { lastFrame } = render(
        <PullRequestList {...defaultProps} statusFilter="CLOSED" pullRequests={closedPRs} />,
      );
      expect(lastFrame()).toContain("CLOSED");
    });

    it("shows MERGED badge for merged PRs", () => {
      const mergedPRs = [
        {
          pullRequestId: "40",
          title: "feat: auth",
          authorArn: "arn:aws:iam::123456789012:user/watany",
          creationDate: new Date("2026-02-11T10:00:00Z"),
          status: "MERGED" as const,
        },
      ];
      const { lastFrame } = render(
        <PullRequestList {...defaultProps} statusFilter="MERGED" pullRequests={mergedPRs} />,
      );
      expect(lastFrame()).toContain("MERGED");
    });

    it("shows no badge for open PRs", () => {
      const { lastFrame } = render(<PullRequestList {...defaultProps} />);
      const output = lastFrame() ?? "";
      // Open PRs should not have CLOSED or MERGED badge
      const lines = output.split("\n");
      const prLine = lines.find((l: string) => l.includes("#42"));
      expect(prLine).not.toContain("CLOSED");
      expect(prLine).not.toContain("MERGED");
    });

    it("shows footer with filter keybind", () => {
      const { lastFrame } = render(<PullRequestList {...defaultProps} />);
      expect(lastFrame()).toContain("f filter");
    });
  });

  // Search tests
  describe("search", () => {
    it("enters search mode on / key", async () => {
      const { lastFrame, stdin } = render(<PullRequestList {...defaultProps} />);
      stdin.write("/");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Search:");
      });
    });

    it("shows search footer in search mode", async () => {
      const { lastFrame, stdin } = render(<PullRequestList {...defaultProps} />);
      stdin.write("/");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Esc clear search");
      });
    });

    it("exits search mode and clears query on Esc", async () => {
      const onChangeSearchQuery = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestList {...defaultProps} onChangeSearchQuery={onChangeSearchQuery} />,
      );
      stdin.write("/");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Search:");
      });
      stdin.write("\x1b"); // Esc
      await vi.waitFor(() => {
        expect(lastFrame()).not.toContain("Search:");
      });
      expect(onChangeSearchQuery).toHaveBeenCalledWith("");
    });

    it("filters by title when searchQuery is set", () => {
      const { lastFrame } = render(<PullRequestList {...defaultProps} searchQuery="login" />);
      expect(lastFrame()).toContain("fix: login timeout");
      expect(lastFrame()).not.toContain("feat: add dashboard");
      expect(lastFrame()).toContain('matching "login"');
      expect(lastFrame()).toContain("(1)");
    });

    it("filters by author name when searchQuery matches", () => {
      const { lastFrame } = render(<PullRequestList {...defaultProps} searchQuery="taro" />);
      expect(lastFrame()).toContain("feat: add dashboard");
      expect(lastFrame()).not.toContain("fix: login timeout");
    });

    it("is case insensitive", () => {
      const { lastFrame } = render(<PullRequestList {...defaultProps} searchQuery="LOGIN" />);
      expect(lastFrame()).toContain("fix: login timeout");
    });

    it("shows no matching message when search has no results", () => {
      const { lastFrame } = render(<PullRequestList {...defaultProps} searchQuery="nonexistent" />);
      expect(lastFrame()).toContain("No matching pull requests");
    });

    it("ignores f key in search mode", async () => {
      const onChangeStatusFilter = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestList {...defaultProps} onChangeStatusFilter={onChangeStatusFilter} />,
      );
      stdin.write("/");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Search:");
      });
      stdin.write("f");
      expect(onChangeStatusFilter).not.toHaveBeenCalled();
    });

    it("ignores n key in search mode", async () => {
      const onNextPage = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestList
          {...defaultProps}
          onNextPage={onNextPage}
          pagination={{ currentPage: 1, hasNextPage: true, hasPreviousPage: false }}
        />,
      );
      stdin.write("/");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Search:");
      });
      stdin.write("n");
      expect(onNextPage).not.toHaveBeenCalled();
    });

    it("ignores p key in search mode", async () => {
      const onPreviousPage = vi.fn();
      const { lastFrame, stdin } = render(
        <PullRequestList
          {...defaultProps}
          onPreviousPage={onPreviousPage}
          pagination={{ currentPage: 2, hasNextPage: false, hasPreviousPage: true }}
        />,
      );
      stdin.write("/");
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Search:");
      });
      stdin.write("p");
      expect(onPreviousPage).not.toHaveBeenCalled();
    });

    it("shows PR count in header", () => {
      const { lastFrame } = render(<PullRequestList {...defaultProps} />);
      expect(lastFrame()).toContain("(2)");
    });
  });

  // Pagination tests
  describe("pagination", () => {
    it("shows page number", () => {
      const { lastFrame } = render(<PullRequestList {...defaultProps} />);
      expect(lastFrame()).toContain("Page 1");
    });

    it("calls onNextPage on n key when hasNextPage", () => {
      const onNextPage = vi.fn();
      const { stdin } = render(
        <PullRequestList
          {...defaultProps}
          onNextPage={onNextPage}
          pagination={{ currentPage: 1, hasNextPage: true, hasPreviousPage: false }}
        />,
      );
      stdin.write("n");
      expect(onNextPage).toHaveBeenCalled();
    });

    it("calls onPreviousPage on p key when hasPreviousPage", () => {
      const onPreviousPage = vi.fn();
      const { stdin } = render(
        <PullRequestList
          {...defaultProps}
          onPreviousPage={onPreviousPage}
          pagination={{ currentPage: 2, hasNextPage: false, hasPreviousPage: true }}
        />,
      );
      stdin.write("p");
      expect(onPreviousPage).toHaveBeenCalled();
    });

    it("does not call onNextPage when no next page", () => {
      const onNextPage = vi.fn();
      const { stdin } = render(
        <PullRequestList
          {...defaultProps}
          onNextPage={onNextPage}
          pagination={{ currentPage: 1, hasNextPage: false, hasPreviousPage: false }}
        />,
      );
      stdin.write("n");
      expect(onNextPage).not.toHaveBeenCalled();
    });

    it("does not call onPreviousPage when no previous page", () => {
      const onPreviousPage = vi.fn();
      const { stdin } = render(
        <PullRequestList
          {...defaultProps}
          onPreviousPage={onPreviousPage}
          pagination={{ currentPage: 1, hasNextPage: false, hasPreviousPage: false }}
        />,
      );
      stdin.write("p");
      expect(onPreviousPage).not.toHaveBeenCalled();
    });

    it("shows n next when hasNextPage", () => {
      const { lastFrame } = render(
        <PullRequestList
          {...defaultProps}
          pagination={{ currentPage: 1, hasNextPage: true, hasPreviousPage: false }}
        />,
      );
      expect(lastFrame()).toContain("n next");
    });

    it("shows p prev when hasPreviousPage", () => {
      const { lastFrame } = render(
        <PullRequestList
          {...defaultProps}
          pagination={{ currentPage: 2, hasNextPage: false, hasPreviousPage: true }}
        />,
      );
      expect(lastFrame()).toContain("p prev");
    });

    it("shows both n next and p prev on middle page", () => {
      const { lastFrame } = render(
        <PullRequestList
          {...defaultProps}
          pagination={{ currentPage: 2, hasNextPage: true, hasPreviousPage: true }}
        />,
      );
      expect(lastFrame()).toContain("p prev");
      expect(lastFrame()).toContain("n next");
      expect(lastFrame()).toContain("Page 2");
    });
  });

  it("does not call onSelect when pressing enter on empty list", () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <PullRequestList {...defaultProps} pullRequests={[]} onSelect={onSelect} />,
    );
    stdin.write("\r");
    expect(onSelect).not.toHaveBeenCalled();
  });
});
