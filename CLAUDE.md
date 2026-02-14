# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

titmouse is a TUI tool for reviewing AWS CodeCommit pull requests in the terminal. Built with Ink (React for CLI).

## Tech Stack

- **Runtime**: Bun
- **Framework**: Ink (React for CLI)
- **Language**: TypeScript
- **AWS SDK**: @aws-sdk/client-codecommit (v3)
- **Testing**: Vitest (unit, snapshot, property-based)
- **Linter**: oxlint

## Common Commands

```bash
bun run build         # Build for production (bun build + tsc declarations)
bun run test          # Run unit tests
bun run test:coverage # Run tests with coverage (95% threshold)
bun run test:watch    # Run tests in watch mode
bun run lint          # Check for lint errors (oxlint)
bun run format:check  # Check formatting (Biome)
bun run check         # TypeScript type check
bun run dead-code     # Detect unused exports (knip)
bun run audit         # Dependency vulnerability audit
bun run ci            # Run ALL CI checks locally (recommended before push)
```

## Completion Requirements

Before committing, **must** run `bun run ci` to execute all checks that CI will run:
```bash
bun run ci
```

This runs the following in order (matching the GitHub Actions pipeline exactly):
1. `lint` — oxlint
2. `format:check` — Biome formatting
3. `check` — TypeScript type check
4. `dead-code` — knip unused export detection
5. `audit` — dependency vulnerability check
6. `test:coverage` — Vitest with 95% coverage threshold
7. `build` — production build

**Do not skip any of these steps.** CI failures on push are caused by missing checks locally.

## プロジェクト基本方針

### 目的
AWS CodeCommitのプルリクエストをターミナル上で快適にレビューする。

### 技術方針
- **最小依存**: Ink + AWS SDK のみに依存し、軽量で高速な実装を維持
- **Vim風操作**: j/k ナビゲーション等、ターミナルユーザーに馴染みのあるキーバインド
- **テスト品質**: カバレッジ95%以上を維持。AWS SDKはモック、UIはink-testing-libraryでテスト
- **段階的リリース**: v0.1で閲覧機能、v0.2以降でコメント投稿・Approve等を対応

## TDDサイクル
各機能は以下のサイクルで実装します:
1. **Red**: テストを書く（失敗する）
2. **Green**: 最小限の実装でテストを通す
3. **Refactor**: コードを改善する

## Tidy First? (Kent Beck)
機能変更の前に、まずコードを整理（tidy）するかを検討します:

**原則**:
- **構造的変更と機能的変更を分離する**: tidyingは別コミットで行う
- **小さく整理してから変更する**: 大きなリファクタリングより、小さな整理を積み重ねる
- **読みやすさを優先**: 次の開発者（未来の自分を含む）のために整理する

**Tidying パターン**:
1. **Guard Clauses**: ネストを減らすために早期リターンを使う
2. **Dead Code**: 使われていないコードを削除
3. **Normalize Symmetries**: 似た処理は同じ形式で書く
4. **Extract Helper**: 再利用可能な部分を関数に抽出
5. **One Pile**: 散らばった関連コードを一箇所にまとめる
6. **Explaining Comments**: 理解しにくい箇所にコメントを追加
7. **Explaining Variables**: 複雑な式を説明的な変数に分解

**タイミング**:
- 変更対象のコードが読みにくい → Tidy First
- 変更が簡単にできる状態 → そのまま実装
- Tidyingのコストが高すぎる → 機能変更後に検討

## イテレーション単位
機能を最小単位に分割し、各イテレーションで1つの機能を完成させます。各イテレーションでコミットを行います。
