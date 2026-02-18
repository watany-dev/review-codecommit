# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-02-18

### Added

#### Activity Timeline
- View PR event history as a timeline from the PR detail screen (`A` key)
- Displays icon, actor name (truncated to 12 chars), event description, and relative time for each event
- Supports 10 event types: PR created, status changed (open/close), source branch updated, merge state changed, approval rule created/deleted/updated/overridden, approvals reset, and approval state changed (approve/revoke)
- j/k navigation and arrow key support within the timeline
- Pagination with `n` key (next token-based append mode — loaded events are kept while new ones are appended)
- Loading state for initial fetch and subsequent page loads
- Error state with `q` to go back
- Empty state message when no events are found
- `q`/`Esc` returns to PR detail screen

#### Service Layer
- `getPullRequestActivity` function added to `src/services/codecommit.ts` using `DescribePullRequestEventsCommand`
- `PrActivityEvent` and `PullRequestActivityResult` types exported from the service layer

#### IAM
- New IAM permission required: `codecommit:DescribePullRequestEvents`

### Changed
- `PullRequestDetail` footer now shows `A activity` hint
- Help screen updated with `A - Activity timeline` keybinding entry
- `formatErrorMessage` extended with `"activity"` context for activity-specific error messages

### Tests
- 20 new `ActivityTimeline` component tests (snapshots, navigation, pagination, error/empty states)
- 15+ new `getPullRequestActivity` service tests covering all event types
- 6 new `App` integration tests for activity screen transitions and data loading
- CI coverage maintained at 95.12%

---

## [0.1.1] - 2026-02-18

### Fixed
- Address security vulnerabilities across the codebase
- Add property-based tests for `mapWithLimit` and `formatErrorMessage` sanitization

### Performance
- Use spread copy instead of mutating cached `DisplayLine` objects (#8)
- Pass pre-computed `headerIndices` to `find*HeaderIndex` functions (#7)
- Add `Map` cache to `extractAuthorName` (#16)
- Use module-level `TextDecoder` singleton (#13)
- Stabilize `diffTextStatus` default value with module-level constant (#10)

---

## [0.1.0] - 2026-02-15

### Highlights

First stable release! This version includes a comprehensive TUI for reviewing AWS CodeCommit pull requests with full CRUD operations on comments, approval workflows, merge capabilities, and enhanced navigation features.

### Added

#### Core Review Features
- Browse and select AWS CodeCommit repositories
- View pull requests with status filtering (Open / Closed / Merged)
- Color-coded unified diffs (green for additions, red for deletions)
- Cursor-based diff navigation with visual marker
- Commit-level review with Tab/Shift+Tab navigation between "All changes" and individual commits

#### Comment System
- Post general comments on pull requests
- Post inline comments on specific diff lines
- Reply to comments with threaded display
- Edit comments with content pre-fill
- Delete comments with confirmation prompt
- Fold/unfold long comment threads (auto-folds 4+ comments)

#### Reactions & Approval
- React to comments with 8 emoji reactions (👍👎😄🎉😕❤️🚀👀)
- View reaction badges on comments
- Approve pull requests with confirmation
- Revoke approval with confirmation
- View approval status and approval rule evaluation

#### Merge & Close
- Merge PRs with strategy selection (Fast-forward / Squash / Three-way)
- Pre-merge conflict detection and display
- Close PRs without merging

#### Search & Navigation
- Search pull requests by title or author
- Paginate through PR lists
- Vim-style keybindings (j/k navigation)

#### Shell Integration
- Shell completion for bash, zsh, and fish
- AWS profile and region configuration via CLI options

#### Developer Experience
- Local CI gate (`bun run ci`) to prevent push-time CI failures
- 95%+ test coverage with comprehensive unit, snapshot, and property-based tests
- Content sanitization and input validation

### Changed
- Project renamed from `titmouse` to `review-codecommit`
- Optimized cursor navigation performance with memoized `buildDisplayLines`

### Fixed
- Reply display showing as comment instead of reply
- Error message when revoking approval on own pull request
- `GetCommentsForPullRequest` now passes commit IDs to prevent `CommitIdRequiredException`
- Removed `repositoryName` from `GetCommentsForPullRequest` to prevent exception

### Security
- Enhanced content sanitization and validation
- Improved input validation for user-provided content

## [0.0.3] - 2026-02-14

### Added
- PR merge functionality with strategy selection (Fast-forward, Squash, Three-way)
- PR close functionality
- Comment reply functionality with thread folding
- Local CI gate (`bun run ci`) to prevent push-time CI failures

### Changed
- Project renamed from `titmouse` to `review-codecommit`
- Memoized `buildDisplayLines` for optimized cursor navigation performance

### Fixed
- Reply display showing as comment instead of reply
- Error message when revoking approval on own pull request
- `GetCommentsForPullRequest` now passes commit IDs to prevent `CommitIdRequiredException`
- Removed `repositoryName` from `GetCommentsForPullRequest` to prevent exception

### Security
- Added content sanitization and validation improvements
- Enhanced input validation for user-provided content

## [0.0.2] - 2026-01-XX

### Added
- Initial TUI implementation for CodeCommit PR review
- Vim-style navigation (j/k keys)
- PR list view and detail view
- Basic comment viewing

