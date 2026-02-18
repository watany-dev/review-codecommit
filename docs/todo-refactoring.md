# Refactoring TODO

コードレビューにより抽出された冗長処理・不要処理・リファクタリング対象の一覧。

## 未対応（優先度順）

### 高優先度

#### 1. `PullRequestDetail.tsx` が巨大すぎる（~1,200行）
- **場所**: `src/components/PullRequestDetail.tsx`
- **分割候補**:
  - `buildDisplayLines`, `findMatchingThreadEntries`, `appendThreadLines` → `utils/displayLines.ts`
  - `computeSimpleDiff` → `utils/formatDiff.ts` に統合
  - `renderDiffLine` → `components/DiffLine.tsx`
  - `ConflictDisplay` → 別ファイル
  - `formatStrategyName`, `formatReactionBadge` → ユーティリティ
  - `getLocationFromLine`, `getReplyTargetFromLine` → ヘルパーファイル

#### 2. `App` の useState 爆発（30+個）
- **場所**: `src/app.tsx:69-123`
- **対策**: `useReducer` でグループ化、または `useAsyncAction()` カスタムフック

#### 3. 9つの同一パターン `useEffect`（~100行）
- **場所**: `src/components/PullRequestDetail.tsx:185-287`
- **対策**: `useAsyncDismiss(isProcessing, error, onDismiss)` カスタムフックに抽出

#### 4. Blob取得ロジックの重複（~18行 x 2箇所）
- **場所**: `src/app.tsx:220-238`, `src/app.tsx:515-533`
- **対策**: `fetchBlobTexts(client, repo, diffs)` ヘルパー関数に抽出

---

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
