---
name: session-start-hook
description: Claude Code Webセッション開始時に環境を検証し、CI失敗を防止するためのセットアップを行う。
---

# セッション開始フック

Claude Code（Web / CLI）でセッション開始時に実行し、開発環境が正しく構成されていることを確認する。

---

## Phase 1: 環境検証

セッション開始時に以下を確認:

```bash
bun --version
```

bunがインストールされていることを確認する。

---

## Phase 2: 依存関係のインストール

```bash
bun install --frozen-lockfile
```

`--frozen-lockfile` で lockfile との不整合を検出する。失敗した場合はユーザーに報告する。

---

## Phase 3: 全CIチェックの実行

以下のコマンドでCI全チェックを実行し、現在のコードベースの状態を確認する:

```bash
bun run ci
```

これにより以下が順番に実行される:
1. `lint` — oxlint によるリント
2. `format:check` — Biome によるフォーマットチェック
3. `check` — TypeScript 型チェック
4. `dead-code` — knip による未使用エクスポート検出
5. `audit` — 依存関係の脆弱性チェック
6. `test:coverage` — Vitest テスト（カバレッジ 95% 閾値）
7. `build` — プロダクションビルド

---

## Phase 4: 結果報告

### すべて成功した場合

ユーザーに以下を報告:
- 環境が正常であること
- すべてのCIチェックがパスしていること
- 開発を開始できる状態であること

### 失敗がある場合

失敗した項目を明確にリストアップし、修正方法を提案する。
コミット前には必ず `bun run ci` を再実行するよう促す。

---

## 注意事項

- コミット前には必ず `bun run ci` を実行すること（CLAUDE.md の Completion Requirements に記載）
- `.claude/settings.json` の PreCommit フックにより、コミット時に自動的に `bun run ci` が実行される
- CI パイプライン（`.github/workflows/ci.yml`）と `bun run ci` は同一のチェックを行う
