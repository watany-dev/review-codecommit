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
- Vim-style keybindings (`j`/`k` navigation)
- AWS profile and region configuration

## Prerequisites

- [Bun](https://bun.sh/) (runtime and package manager)
- AWS credentials configured (`aws configure` or environment variables)
- IAM permissions for CodeCommit read operations

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
| `Enter` | Select / confirm | List screens |
| `q` / `Esc` | Go back | All |
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

The following features are planned for future releases:

- Post comments on pull requests
- Approve / Revoke operations
- Merge operations

## License

[MIT](LICENSE)