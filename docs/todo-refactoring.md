# Refactoring TODO

コードレビューにより抽出された冗長処理・不要処理・リファクタリング対象の一覧。
描画バグ観点での詳細分析は `docs/audit-complexity-rendering.md` を参照。

## 未対応（優先度順）

### 最高優先度（描画バグ直結）

#### 0-A. background blob load でカーソルが飛ぶ ⛔ 即対応
- **場所**: `src/app.tsx:352-426`（`loadDiffTextsInBackground`）、`src/components/PullRequestDetail.tsx:623`
- **症状**: PR を開いて blob が順次ロードされる間、カーソルが勝手に別の行に移動する
- **原因**: blob がロードされると `lines` 配列が伸長するが `cursorIndex` は補正されない
- **修正候補**: blob ロード完了時に行数の増分分 `cursorIndex` を補正する
- **詳細**: `audit-complexity-rendering.md` S-1 参照

#### 0-B. `visibleLines` の key が位置ベースでフリッカー発生 ⛔ 即対応
- **場所**: `src/components/PullRequestDetail.tsx:714`
- **症状**: j/k スクロールのたびに全行が React によって破棄・再生成され、Ink のフリッカーを誘発
- **原因**: `key={globalIndex}` はスクロールで全 key が入れ替わる
- **修正候補**: `line.type + line.diffKey + line.beforeLineNumber + line.afterLineNumber + line.threadIndex` などを組み合わせた安定 key
- **詳細**: `audit-complexity-rendering.md` S-2 / `performance-analysis.md` #12 参照

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

#### 1-A. `collapsedThreads` がコメントリロード後に古いインデックスを参照
- **場所**: `src/components/PullRequestDetail.tsx:232-240`
- **症状**: コメント投稿後に新スレッドが自動折りたたみされない
- **原因**: `useState` の初期化関数で1回だけ設定、`commentThreads` 変化時に追従しない
- **修正候補**: `useEffect([commentThreads])` で差分更新。長期的には `threadIndex` でなく `commentId` をキーにする
- **詳細**: `audit-complexity-rendering.md` A-1 参照

#### 1-B. `getReplyTargetFromLine` のテキスト逆パース＋ `u` フラグなし正規表現
- **場所**: `src/components/PullRequestDetail.tsx:956-977`
- **症状**: コンテンツに `": "` が含まれると著者名・内容が化ける。`u` フラグなし絵文字処理は偶然動作
- **即時修正**: 正規表現を `/^[💬└\s]+/u` に変更（1行変更、リスクなし）
- **根本修正**: `DisplayLine` に `authorArn?` / `rawContent?` フィールドを追加して逆パースを廃止
- **詳細**: `audit-complexity-rendering.md` A-2 参照

#### 1-C. `handleApprovalAction` が `useAsyncAction` パターンを手動再実装
- **場所**: `src/app.tsx:498-517`
- **症状**: 他のアクションと非統一で、承認 UI のクローズタイミングが微妙にずれる可能性
- **修正候補**: `useAsyncAction` に移行（`reloadApprovals` を action 内に含める）
- **詳細**: `audit-complexity-rendering.md` A-3 参照

#### 1-D. `appendThreadLines` の `.find()` が `sortCommentsRootFirst` の保証を無視
- **場所**: `src/utils/displayLines.ts:39-40`
- **症状**: 複数 root コメントが存在する場合、描画順が崩れる
- **修正候補**: `const [rootComment, ...replies] = comments;` に置き換え（1行変更）
- **詳細**: `audit-complexity-rendering.md` A-4 参照

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
