# Refactoring TODO

コードレビューにより抽出された冗長処理・不要処理・リファクタリング対象の一覧。

## 完了済み

| 項目 | 内容 |
|------|------|
| `getEditTarget` / `getDeleteTarget` 統合 | `getCommentIdFromLine` に統一 |
| `commentTypes` 定数化 | `COMMENT_LINE_TYPES` として一箇所に定義 |
| リアクション再取得ロジック統合 | `reloadReactions(threads)` ヘルパーに抽出 |
| `handleApprove` / `handleRevoke` 統合 | `handleApprovalAction(state)` に統合 |
| Props グループ化 | 機能グループごとにオブジェクトにまとめた（AsyncAction パターン） |
| `formatDiff.ts` 整理 | デッドコード削除・`computeSimpleDiff` と統合 |
| 型定義統一 | `StatusFilter` と `PullRequestDisplayStatus` を統一 |
| `approvals.filter` 二重実行 | `useMemo` で一度だけ計算 |
| `getComments` パススルー削除 | `fetchCommentThreads` を直接エクスポート |
| `withLoadingState` 一貫使用 | `loadPullRequests` でも利用 |
| エラーラッパーインライン化 | `formatErrorMessage` を直接呼び出し |
| `createClient` 簡素化 | オプション構築をシンプルに |
| `PullRequestDetail` の diff 行構築 | `buildDisplayLines` / `findMatchingThreadEntries` / `appendThreadLines` を `src/utils/displayLines.ts` に分割済み |
| `App` の非同期アクション | `useAsyncAction` でローディング・エラー処理を共通化済み |
| 同一パターンの dismiss `useEffect` | `useAsyncDismiss` に抽出済み |
| Blob 取得ロジックの重複 | `fetchBlobTexts`（および `streamBlobTexts`）に抽出済み |
