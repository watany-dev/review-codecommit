# review-codecommit

A TUI tool for reviewing AWS CodeCommit pull requests in your terminal.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

## Overview

review-codecommit lets you browse AWS CodeCommit repositories, view pull requests (open, closed, and merged), and inspect diffs and comments — all without leaving the terminal. Built with [Ink](https://github.com/vadimdemedes/ink) (React for CLI).

## Features

- List and select AWS CodeCommit repositories
- Browse pull requests with status filter (Open / Closed / Merged, `f` key cycle)
- Search pull requests by title or author (`/` key)
- Paginate through PR lists (`n`/`p` keys)
- View PR details with color-coded unified diffs (green for additions, red for deletions)
- Read PR comments inline
- Post comments on pull requests (`c` key in PR detail view)
- Post inline comments on specific diff lines (`C` key at cursor position)
- View inline comments displayed under matching diff lines
- Reply to comments with threaded display (`R` key)
- Fold/unfold long comment threads (`o` key, auto-folds 4+ comments)
- Edit comments (`e` key, with content pre-fill)
- Delete comments (`d` key, with confirmation prompt)
- React to comments with emoji (`g` key, 8 reactions: 👍👎😄🎉😕❤️🚀👀)
- View reaction badges on comments (e.g., 👍×2 🎉×1)
- Approve / revoke pull requests (`a`/`r` keys with confirmation prompt)
- View approval status and approval rule evaluation
- Merge PRs with strategy selection (Fast-forward / Squash / Three-way) (`m` key)
- Pre-merge conflict detection and display
- Close PRs without merging (`x` key)
- Commit-level review with Tab/Shift+Tab navigation between "All changes" and individual commits
- Cursor-based diff navigation with `>` marker
- Shell completion for bash, zsh, and fish (`--completions` option)
- Vim-style keybindings (`j`/`k` navigation)
- AWS profile and region configuration

## Prerequisites

- [Bun](https://bun.sh/) (runtime and package manager)
- AWS credentials configured (`aws configure` or environment variables)
- IAM permissions for CodeCommit read operations (`codecommit:GetCommit` for commit-level review), `codecommit:PostCommentForPullRequest` for comment posting, `codecommit:PostCommentReply` for reply posting, `codecommit:UpdateComment` and `codecommit:DeleteCommentContent` for comment edit/delete, `codecommit:PutCommentReaction` and `codecommit:GetCommentReactions` for reactions, `codecommit:UpdatePullRequestApprovalState`, `codecommit:GetPullRequestApprovalStates`, `codecommit:EvaluatePullRequestApprovalRules` for approval operations, and `codecommit:MergePullRequestByFastForward`, `codecommit:MergePullRequestBySquash`, `codecommit:MergePullRequestByThreeWay`, `codecommit:GetMergeConflicts`, `codecommit:UpdatePullRequestStatus` for merge and close operations

## Installation

```bash
bun install -g review-codecommit
```

Or run directly:

```bash
npx review-codecommit
```

## Usage

```bash
# Interactive repository selection
review-codecommit

# Jump directly to a repository's PR list
review-codecommit <repo-name>

# Specify AWS profile
review-codecommit --profile <profile-name>

# Specify AWS region
review-codecommit --region <region>

# Generate shell completion script
review-codecommit --completions bash|zsh|fish
```

## Shell Completion

Generate shell completion scripts for tab completion of CLI options, AWS profiles, and regions.

```bash
# Bash
review-codecommit --completions bash > ~/.bash_completion.d/review-codecommit
# or add to .bashrc:
echo 'eval "$(review-codecommit --completions bash)"' >> ~/.bashrc

# Zsh
review-codecommit --completions zsh > ~/.zsh/completions/_review-codecommit
# or add to .zshrc:
echo 'eval "$(review-codecommit --completions zsh)"' >> ~/.zshrc

# Fish
review-codecommit --completions fish > ~/.config/fish/completions/review-codecommit.fish
```

Completions support:
- CLI options (`--profile`, `--region`, `--help`, `--version`, `--completions`)
- AWS profile names (dynamically read from `~/.aws/config`)
- AWS CodeCommit regions (25+ supported regions)

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
| `e` | Edit comment (with content pre-fill) | PR Detail |
| `d` | Delete comment (with confirmation) | PR Detail |
| `g` | React to comment (emoji picker) | PR Detail |
| `h` / `←` | Select previous reaction | Reaction Picker |
| `l` / `→` | Select next reaction | Reaction Picker |
| `a` | Approve PR (with confirmation) | PR Detail |
| `r` | Revoke approval (with confirmation) | PR Detail |
| `m` | Merge PR (strategy selection) | PR Detail |
| `x` | Close PR without merge | PR Detail |
| `Tab` | Next view (All changes / Commits) | PR Detail |
| `Shift+Tab` | Previous view | PR Detail |
| `f` | Cycle status filter (Open → Closed → Merged) | PR List |
| `/` | Search by title or author (Esc to clear) | PR List |
| `n` | Next page | PR List |
| `p` | Previous page | PR List |
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
| v0.6 | Merge operations | ✅ Released |
| v0.6.1 | Commit-level review | ✅ Released |
| v0.7 | Comment edit / delete | ✅ Released |
| v0.8 | PR status filter, search, and pagination | ✅ Released |
| v0.2.0 | Emoji reactions on comments | ✅ Released |
| v0.3.0 | Shell completion (bash, zsh, fish) | ✅ Released |

See [docs/roadmap.md](docs/roadmap.md) for details.

## Release Process

This project uses automated npm publishing via GitHub Actions with Trusted Publishers (OIDC).

### Release Steps

1. Update the `version` field in `package.json` (following [semver](https://semver.org/))
2. Update the lockfile: `bun install`
3. Run all CI checks locally: `bun run ci`
4. Commit the changes: `git commit -m "chore: bump version to X.Y.Z"`
5. Create a git tag: `git tag vX.Y.Z`
6. Push the tag: `git push origin main vX.Y.Z`

GitHub Actions will automatically:
- Validate that the git tag matches the package.json version
- Re-run build and test suite
- Publish to npm with provenance attestation

### Verifying Published Package

After publishing, verify on npmjs.com:
- The new version is live at https://www.npmjs.com/package/review-codecommit
- The "Provenance" badge is displayed (links to the GitHub Actions run)

You can also verify locally:
```bash
npx review-codecommit@X.Y.Z --version
```

## License

[MIT](LICENSE)