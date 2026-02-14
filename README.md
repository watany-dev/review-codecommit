# titmouse

A TUI tool for reviewing AWS CodeCommit pull requests in your terminal.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

## Overview

titmouse lets you browse AWS CodeCommit repositories, view open pull requests, and inspect diffs and comments — all without leaving the terminal. Built with [Ink](https://github.com/vadimdemedes/ink) (React for CLI).

## Features

- List and select AWS CodeCommit repositories
- Browse open pull requests
- View PR details with color-coded unified diffs (green for additions, red for deletions)
- Read PR comments inline
- Post comments on pull requests (`c` key in PR detail view)
- Post inline comments on specific diff lines (`C` key at cursor position)
- View inline comments displayed under matching diff lines
- Reply to comments with threaded display (`R` key)
- Fold/unfold long comment threads (`o` key, auto-folds 4+ comments)
- Approve / revoke pull requests (`a`/`r` keys with confirmation prompt)
- View approval status and approval rule evaluation
- Cursor-based diff navigation with `>` marker
- Vim-style keybindings (`j`/`k` navigation)
- AWS profile and region configuration

## Prerequisites

- [Bun](https://bun.sh/) (runtime and package manager)
- AWS credentials configured (`aws configure` or environment variables)
- IAM permissions for CodeCommit read operations, `codecommit:PostCommentForPullRequest` for comment posting, `codecommit:PostCommentReply` for reply posting, and `codecommit:UpdatePullRequestApprovalState`, `codecommit:GetPullRequestApprovalStates`, `codecommit:EvaluatePullRequestApprovalRules` for approval operations

## Installation

```bash
bun install -g titmouse
```

Or run directly:

```bash
npx titmouse
```

## Usage

```bash
# Interactive repository selection
titmouse

# Jump directly to a repository's PR list
titmouse <repo-name>

# Specify AWS profile
titmouse --profile <profile-name>

# Specify AWS region
titmouse --region <region>
```

## Keybindings

| Key | Action | Screen |
|-----|--------|--------|
| `j` / `↓` | Move cursor down | All |
| `k` / `↑` | Move cursor up | All |
| `Enter` | Select / confirm / submit comment | List screens / Comment input |
| `q` / `Esc` | Go back / cancel | All / Comment input / Confirm prompt |
| `c` | Post comment | PR Detail |
| `C` | Post inline comment at cursor line | PR Detail |
| `R` | Reply to comment at cursor line | PR Detail |
| `o` | Toggle thread fold/unfold | PR Detail |
| `a` | Approve PR (with confirmation) | PR Detail |
| `r` | Revoke approval (with confirmation) | PR Detail |
| `Ctrl+C` | Exit immediately | All |
| `?` | Toggle help | All |

## Screen Flow

```
Start
 │
 ├─ with arg ─────────────────┐
 │                             ▼
 └─ no arg ──→ [1. Repo List] ──→ [2. PR List] ──→ [3. PR Detail]
                  │                  │                 │
                  │ q/Esc: exit      │ q/Esc: 1        │ q/Esc: 2
                  ▼                  ▼                 ▼
                Exit              Back to 1         Back to 2
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Run tests in watch mode
bun run test:watch

# Lint
bun run lint

# Type check
bun run check

# Build
bun run build
```

## Tech Stack

| Category | Choice |
|----------|--------|
| Runtime | Bun |
| Language | TypeScript |
| TUI Framework | Ink (React for CLI) |
| AWS SDK | @aws-sdk/client-codecommit v3 |
| Test Framework | Vitest |
| Linter | oxlint |

## Roadmap

| Version | Feature | Status |
|---------|---------|--------|
| v0.1 | Browse repositories, PRs, diffs, and comments | ✅ Released |
| v0.2 | Post comments on pull requests | ✅ Released |
| v0.3 | Approve / Revoke operations | ✅ Released |
| v0.4 | Inline comments (file-line specific) | ✅ Released |
| v0.5 | Comment replies (threads) | ✅ Released |
| v0.6 | Merge operations | Planned |
| v0.7 | Comment edit / delete | Planned |
| v0.8 | PR status filter and search | Planned |

See [docs/roadmap.md](docs/roadmap.md) for details.

## License

[MIT](LICENSE)