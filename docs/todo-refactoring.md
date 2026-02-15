# Refactoring TODO

コードレビューにより抽出された冗長処理・不要処理・リファクタリング対象の一覧。

## 1. 重複コード

### 1.1 `getEditTargetFromLine` / `getDeleteTargetFromLine` が完全同一
- **場所**: `src/components/PullRequestDetail.tsx:806-818`
- **対策**: `getCommentIdFromLine` のような単一関数に統合

### 1.2 `commentTypes` 配列が4箇所で重複定義
- **場所**: `src/components/PullRequestDetail.tsx:807, 814, 836, 464`
- **対策**: `COMMENT_LINE_TYPES` 定数として一箇所に定義

### 1.3 Blob取得ロジックの重複（~18行 x 2箇所）
- **場所**: `src/app.tsx:220-238`, `src/app.tsx:515-533`
- **対策**: `fetchBlobTexts(client, repo, diffs)` ヘルパー関数に抽出

### 1.4 リアクション再取得ロジックの重複（3箇所）
- **場所**: `src/app.tsx:209-217`, `src/app.tsx:346-354`, `src/app.tsx:575-581`
- **対策**: `reloadReactions(threads)` ヘルパーに抽出

### 1.5 `handleApprove` / `handleRevoke` がほぼ同一
- **場所**: `src/app.tsx:403-439`
- **対策**: `handleApprovalAction(state: "APPROVE" | "REVOKE")` に統合

### 1.6 9つの同一パターン `useEffect`（~100行）
- **場所**: `src/components/PullRequestDetail.tsx:185-287`
- **対策**: `useAsyncDismiss(isProcessing, error, onDismiss)` カスタムフックに抽出

## 2. 不要な処理

### 2.1 `approvals.filter` の二重実行
- **場所**: `src/components/PullRequestDetail.tsx:513-518`
- **対策**: `useMemo` で一度だけ計算

### 2.2 `getComments` がただのパススルー
- **場所**: `src/services/codecommit.ts:215-225`
- **対策**: `fetchCommentThreads` を直接エクスポートするか統一

### 2.3 `StatusFilter` と `PullRequestDisplayStatus` が同一型
- **場所**: `src/components/PullRequestList.tsx:7`, `src/services/codecommit.ts:37`
- **対策**: 一方に統一

### 2.4 `withLoadingState` が一貫して使われていない
- **場所**: `src/app.tsx:129-140` (定義), `src/app.tsx:157-188` (未使用)
- **対策**: `loadPullRequests` でも利用するか、ラッパーを拡張

### 2.5 `formatDiff.ts` が未使用（179行のデッドコード候補）
- **場所**: `src/utils/formatDiff.ts`
- **対策**: プロダクションコードで未使用。`computeSimpleDiff` と統合するか削除

## 3. リファクタリング対象

### 3.1 `PullRequestDetail.tsx` が巨大すぎる（1,252行）
- **分割候補**:
  - `buildDisplayLines`, `findMatchingThreadEntries`, `appendThreadLines` → `utils/displayLines.ts`
  - `computeSimpleDiff` → `utils/formatDiff.ts` に統合
  - `renderDiffLine` → `components/DiffLine.tsx`
  - `ConflictDisplay` → 別ファイル
  - `formatStrategyName`, `formatReactionBadge` → ユーティリティ
  - `getLocationFromLine`, `getReplyTargetFromLine` → ヘルパーファイル

### 3.2 `App` の useState 爆発（30+個）
- **場所**: `src/app.tsx:69-123`
- **対策**: `useReducer` でグループ化、または `useAsyncAction()` カスタムフック

### 3.3 `PullRequestDetail` の Props 爆発（53個）
- **場所**: `src/components/PullRequestDetail.tsx:18-78`
- **対策**: 機能グループごとにオブジェクトにまとめる（AsyncAction パターン）

### 3.4 `useListNavigation` フックの活用不足
- **場所**: `src/hooks/useListNavigation.ts`
- **対策**: `PullRequestList` でも利用できるよう拡張するか、inline化して削除

### 3.5 エラーフォーマッタのラッパー関数群（8個）
- **場所**: `src/app.tsx:904-938`
- **対策**: `formatErrorMessage` を直接呼び出しインライン化

### 3.6 `createClient` のオプション構築が過剰
- **場所**: `src/services/codecommit.ts:62-67`
- **対策**: `new CodeCommitClient({ region: config.region, profile: config.profile })` に簡素化

## 優先度

| 優先度 | 項目 | 種類 | 効果 |
|--------|------|------|------|
| 高 | 3.1 PullRequestDetail 分割 | リファクタ | 可読性・保守性 |
| 高 | 3.2 App useState → useReducer | リファクタ | 可読性・保守性 |
| 高 | 1.6 useEffect 9個 → カスタムフック | 重複排除 | ~100行削減 |
| 高 | 1.3 Blob取得ロジック統合 | 重複排除 | ~20行削減 |
| 中 | 1.1 getEditTarget/getDeleteTarget 統合 | 重複排除 | 関数1つ削減 |
| 中 | 1.2 commentTypes 定数化 | 重複排除 | 4箇所統一 |
| 中 | 1.4 リアクション再取得統合 | 重複排除 | 3箇所統一 |
| 中 | 1.5 handleApprove/Revoke 統合 | 重複排除 | 関数1つ削減 |
| 中 | 3.3 Props グループ化 | リファクタ | 可読性 |
| 中 | 2.5 formatDiff.ts 整理 | デッドコード | 179行 |
| ~~低~~ | ~~2.3 型定義統一~~ | ~~一貫性~~ | ~~型1つ削減~~ ✅ |
| ~~低~~ | ~~2.1 approvals.filter 二重実行~~ | ~~不要処理~~ | ~~微パフォ改善~~ ✅ |
| ~~低~~ | ~~2.2 getComments パススルー削除~~ | ~~不要コード~~ | ~~関数1つ削減~~ ✅ |
| ~~低~~ | ~~2.4 withLoadingState 一貫使用~~ | ~~一貫性~~ | ~~コード統一~~ ✅ |
| ~~低~~ | ~~3.5 エラーラッパーインライン化~~ | ~~不要コード~~ | ~~8関数削減~~ ✅ |
| ~~低~~ | ~~3.6 createClient 簡素化~~ | ~~過剰処理~~ | ~~3行削減~~ ✅ |
