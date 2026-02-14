# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [0.0.2] - 2024-01-XX

### Added
- Initial TUI implementation for CodeCommit PR review
- Vim-style navigation (j/k keys)
- PR list view and detail view
- Basic comment viewing

