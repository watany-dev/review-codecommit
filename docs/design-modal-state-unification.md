# 設計負債A: PullRequestDetail モーダル状態の union 型統合 設計書

**ステータス**: 未着手
**最終更新**: 2026-03-02

## 概要

`PullRequestDetail` コンポーネント内の 13 個のモーダル関連 `useState` を、1 つの discriminated union 型 `ModalState` に統合する。

## 背景

### 現状の問題

`PullRequestDetail.tsx` (994行) のモーダル管理には以下の 13 個の `useState` が使われている:

| # | 変数名 | 型 | 用途 |
|---|--------|------|------|
| 1 | `isCommenting` | `boolean` | 一般コメント入力中 |
| 2 | `inlineCommentLocation` | `InlineLocation \| null` | インラインコメント入力中 |
| 3 | `replyTarget` | `{ commentId, author, content } \| null` | 返信入力中 |
| 4 | `approvalAction` | `"approve" \| "revoke" \| null` | 承認/取消確認中 |
| 5 | `mergeStep` | `"strategy" \| "confirm" \| null` | マージフロー段階 |
| 6 | `selectedStrategy` | `MergeStrategy` | 選択されたマージ戦略 |
| 7 | `conflictSummary` | `ConflictSummary \| null` | コンフリクト情報 |
| 8 | `isCheckingConflicts` | `boolean` | コンフリクト確認中 |
| 9 | `isClosing` | `boolean` | PR クローズ確認中 |
| 10 | `editTarget` | `{ commentId, content } \| null` | コメント編集中 |
| 11 | `deleteTarget` | `{ commentId } \| null` | コメント削除確認中 |
| 12 | `reactionTarget` | `string \| null` | リアクション選択中 |
| 13 | `showFileList` | `boolean` | ファイル一覧表示中 |

これらは**排他的**である。つまり、同時に2つ以上がアクティブになることはない。しかし、現在の実装ではこの不変条件がコードで表現されておらず、以下の問題がある:

**1. ガード条件の冗長性** — 10個の変数を列挙するガード条件が3箇所に重複している:

```typescript
// visibleLineCount の計算 (362-374行)
isCommenting || inlineCommentLocation || replyTarget || editTarget ||
deleteTarget || approvalAction || mergeStep || isClosing || reactionTarget || showFileList

// useInput のガード (393-404行)
isCommenting || inlineCommentLocation || replyTarget || editTarget ||
deleteTarget || approvalAction || mergeStep || isClosing || reactionTarget

// フッターの空文字条件 (881-891行)
isCommenting || inlineCommentLocation || replyTarget || editTarget ||
deleteTarget || approvalAction || mergeStep || isClosing || reactionTarget || showFileList
```

新しいモーダルを追加する際、3箇所すべてを正しく更新しなければならない。1箇所でも漏れるとバグになる。

**2. マージフローの状態散逸** — マージ処理に関連する状態が4変数に分散している（`mergeStep`, `selectedStrategy`, `conflictSummary`, `isCheckingConflicts`）。`handleStrategySelect` では4つの `setState` を適切な順序で呼ぶ必要があり、状態の整合性を人間が保証しなければならない。

**3. useAsyncDismiss のコールバック重複** — 9個の `useAsyncDismiss` フックすべてが「モーダルを閉じる」同じ意図のコールバックを持つが、それぞれ異なる `setState` 関数を呼んでいる。

### なぜ今か

- 変更が `PullRequestDetail.tsx` 内で**完結**する。Props インターフェースは変更しない
- 既存テスト（7,561行）がそのまま回帰テストとして機能する
- 次にモーダル（例: Split View 設定、PR description 編集）を追加する際の修正箇所が **13箇所 → 1箇所** に減る
- マージフローの状態散逸を根本的に解消できる

## スコープ

### 今回やること

- `ModalState` discriminated union 型の定義
- 13個の `useState` を `const [modal, setModal] = useState<ModalState>({ type: "none" })` に置換
- `useInput` のガード条件を `modal.type !== "none"` に統一（file-list は独自ハンドリングを維持）
- `visibleLineCount` の計算を `modal.type === "none"` で簡素化
- フッターの表示条件を `modal.type` で簡素化
- `handleStrategySelect` のアトミックな状態遷移への書き換え
- `useAsyncDismiss` のコールバックを共通化
- 各モーダルのレンダリング条件を `modal.type` ベースに変更

### 今回やらないこと

- Props インターフェースの変更（外部から見た振る舞いは維持）
- `fileListCursor` の ModalState への統合（カーソル状態はモーダル識別とは概念が異なるため分離を維持）
- `cursorIndex`, `viewIndex`, `collapsedThreads`, `diffLineLimits` の変更（これらはモーダル状態ではない）
- `diffCacheRef` の変更
- コンポーネント分割（設計負債Aのスコープ外）
- テストの追加（既存テストで回帰を検出。型安全性はコンパイラが保証）

## 設計

### ModalState 型定義

```typescript
type InlineLocation = {
  filePath: string;
  filePosition: number;
  relativeFileVersion: "BEFORE" | "AFTER";
};

type ModalState =
  | { type: "none" }
  | { type: "commenting" }
  | { type: "inline-commenting"; location: InlineLocation }
  | { type: "replying"; commentId: string; author: string; content: string }
  | { type: "approving"; action: "approve" | "revoke" }
  | { type: "merging"; step: "strategy" }
  | { type: "merging"; step: "checking"; strategy: MergeStrategy }
  | { type: "merging"; step: "conflict"; strategy: MergeStrategy; conflicts: ConflictSummary }
  | { type: "merging"; step: "confirm"; strategy: MergeStrategy }
  | { type: "closing" }
  | { type: "editing"; commentId: string; content: string }
  | { type: "deleting"; commentId: string }
  | { type: "reacting"; commentId: string }
  | { type: "file-list" };
```

### 設計判断

#### 1. マージフローの表現方法

| 選択肢 | 評価 |
|--------|------|
| **`type: "merging"` + `step` による二段階 discriminant（採用）** | `modal.type === "merging"` で全マージ状態を一括判定でき、`modal.step` で詳細を判別可能。TypeScript の narrowing が正しく機能する |
| 別々の type（`"merge-strategy"`, `"merge-checking"`, `"merge-confirm"`） | `isMerging` 相当の判定が `modal.type.startsWith("merge")` のようなパターンになり型安全でない |
| マージ状態を別の `useState` で管理 | 現状と同じ状態散逸問題が残る |

TypeScript の型 narrowing 動作:

```typescript
if (modal.type === "merging") {
  // modal: { type: "merging"; step: "strategy" }
  //       | { type: "merging"; step: "checking"; strategy: MergeStrategy }
  //       | { type: "merging"; step: "conflict"; strategy: MergeStrategy; conflicts: ConflictSummary }
  //       | { type: "merging"; step: "confirm"; strategy: MergeStrategy }

  if (modal.step === "confirm") {
    // modal: { type: "merging"; step: "confirm"; strategy: MergeStrategy }
    onMerge(modal.strategy); // ✅ strategy にアクセス可能
  }
}
```

#### 2. `fileListCursor` の扱い

| 選択肢 | 評価 |
|--------|------|
| **ModalState の外に維持（採用）** | カーソル位置はモーダルの「種類」ではなくモーダル内の「操作状態」。j/k キーで頻繁に更新されるため、モーダル全体のオブジェクト再生成を避ける。ファイルリストを開くたびに `setFileListCursor(0)` で初期化する既存パターンと整合 |
| `{ type: "file-list"; cursor: number }` として統合 | カーソル更新のたびに `setModal({ type: "file-list", cursor: newValue })` が必要。技術的には動作するが、概念的に異なる関心事を混合する |

#### 3. 状態管理パターンの選択

| 選択肢 | 評価 |
|--------|------|
| **`useState<ModalState>`（採用）** | 排他的モーダルの表現に最小限の変更で対応。各遷移が `setModal({ type: "..." })` の1行で完結し、`useReducer` の action/reducer 定義が不要。モーダル遷移ロジックは `useInput` 内のキーハンドラに閉じており、reducer に抽出する動機が薄い |
| `useReducer` + action 型 | モーダル遷移を action（`{ type: "OPEN_COMMENT" }`, `{ type: "CLOSE_MODAL" }` 等）として定義し、reducer で状態遷移を管理する。遷移ロジックが reducer に集約される利点があるが、action 型 + reducer 関数の追加コードが必要（推定 60-80 行増）。現状の遷移パターンは「キー入力 → 直接状態設定」が主であり、reducer を経由する利点が限定的。将来的にモーダル遷移が複雑化した場合に再検討 |

`useState<ModalState>` を選択した主な理由:
- 変更の最小化: 既存の `setXxx(value)` → `setModal({ type: "..." })` の機械的な置換で済む
- コード増加量: ModalState 型定義のみ（約 15 行）。reducer + action 型だと約 80 行増加
- テスト影響: ゼロ。`useReducer` にすると reducer のテストが新たに必要になる可能性がある
- `handleStrategySelect` の async 処理: `useState` なら async 関数内で直接 `setModal` を呼べる。`useReducer` でも dispatch 可能だが、async の成功/失敗で異なる action を dispatch するパターンは `useState` と実質同じ

#### 4. `InlineLocation` 型の配置

`InlineLocation` 型は変更しない。現在と同じファイル冒頭で定義し、ModalState と JSX 内の両方から参照する。

#### 5. `ModalState` のエクスポート方針

`ModalState` 型はエクスポートしない。この型は `PullRequestDetail` コンポーネント内部の状態管理専用であり、外部から参照する必要がない。Props インターフェースに変更がないため、型のエクスポートは不要。

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/components/PullRequestDetail.tsx` | `ModalState` 型定義、useState 統合、ガード条件・レンダリング条件・コールバックの書き換え |

他のファイルへの変更はない。

### 詳細変更箇所

#### 1. useState の置換

##### Before (13個の useState)

```typescript
const [isCommenting, setIsCommenting] = useState(false);
const [inlineCommentLocation, setInlineCommentLocation] = useState<InlineLocation | null>(null);
const [replyTarget, setReplyTarget] = useState<{
  commentId: string; author: string; content: string;
} | null>(null);
const [approvalAction, setApprovalAction] = useState<"approve" | "revoke" | null>(null);
const [mergeStep, setMergeStep] = useState<"strategy" | "confirm" | null>(null);
const [selectedStrategy, setSelectedStrategy] = useState<MergeStrategy>("fast-forward");
const [conflictSummary, setConflictSummary] = useState<ConflictSummary | null>(null);
const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
const [isClosing, setIsClosing] = useState(false);
const [editTarget, setEditTarget] = useState<{
  commentId: string; content: string;
} | null>(null);
const [deleteTarget, setDeleteTarget] = useState<{ commentId: string } | null>(null);
const [reactionTarget, setReactionTarget] = useState<string | null>(null);
const [showFileList, setShowFileList] = useState(false);
```

##### After (1個の useState)

```typescript
const [modal, setModal] = useState<ModalState>({ type: "none" });
```

#### 2. useAsyncDismiss の簡素化

##### Before (9個のコールバック)

```typescript
useAsyncDismiss(isPostingComment, commentError, () => setIsCommenting(false));
useAsyncDismiss(isPostingInlineComment, inlineCommentError, () => setInlineCommentLocation(null));
useAsyncDismiss(isPostingReply, replyError, () => setReplyTarget(null));
useAsyncDismiss(isApproving, approvalError, () => setApprovalAction(null));
useAsyncDismiss(isMerging, mergeError, () => setMergeStep(null));
useAsyncDismiss(isClosingPR, closePRError, () => setIsClosing(false));
useAsyncDismiss(isUpdatingComment, updateCommentError, () => setEditTarget(null));
useAsyncDismiss(isDeletingComment, deleteCommentError, () => setDeleteTarget(null));
useAsyncDismiss(isReacting, reactionError, () => setReactionTarget(null));
```

##### After (共通コールバック)

```typescript
const closeModal = () => setModal({ type: "none" });

useAsyncDismiss(isPostingComment, commentError, closeModal);
useAsyncDismiss(isPostingInlineComment, inlineCommentError, closeModal);
useAsyncDismiss(isPostingReply, replyError, closeModal);
useAsyncDismiss(isApproving, approvalError, closeModal);
useAsyncDismiss(isMerging, mergeError, closeModal);
useAsyncDismiss(isClosingPR, closePRError, closeModal);
useAsyncDismiss(isUpdatingComment, updateCommentError, closeModal);
useAsyncDismiss(isDeletingComment, deleteCommentError, closeModal);
useAsyncDismiss(isReacting, reactionError, closeModal);
```

`useAsyncDismiss` は内部で `onDismissRef.current = onDismiss` により最新のコールバックを保持するため、`closeModal` が毎レンダーで再生成されても問題ない。

#### 3. visibleLineCount の簡素化

##### Before

```typescript
const visibleLineCount =
  isCommenting ||
  inlineCommentLocation ||
  replyTarget ||
  editTarget ||
  deleteTarget ||
  approvalAction ||
  mergeStep ||
  isClosing ||
  reactionTarget ||
  showFileList
    ? 20
    : 30;
```

##### After

```typescript
const visibleLineCount = modal.type !== "none" ? 20 : 30;
```

#### 4. useInput ガード条件の簡素化

##### Before

```typescript
useInput((input, key) => {
  // File list mode
  if (showFileList) {
    // ... file list handling ...
    return;
  }

  if (
    isCommenting ||
    inlineCommentLocation ||
    replyTarget ||
    editTarget ||
    deleteTarget ||
    approvalAction ||
    mergeStep ||
    isClosing ||
    reactionTarget
  )
    return;

  // ... key handlers ...
});
```

##### After

```typescript
useInput((input, key) => {
  // File list mode
  if (modal.type === "file-list") {
    if (input === "j" || key.downArrow) {
      setFileListCursor((prev) => Math.min(prev + 1, fileNames.length - 1));
    } else if (input === "k" || key.upArrow) {
      setFileListCursor((prev) => Math.max(prev - 1, 0));
    } else if (key.return) {
      const targetIndex = headerIndices[fileListCursor];
      if (targetIndex !== undefined) setCursorIndex(targetIndex);
      setModal({ type: "none" });
    } else if (key.escape || input === "f" || input === "q") {
      setModal({ type: "none" });
    }
    return;
  }

  if (modal.type !== "none") return;

  // ... key handlers ...
});
```

#### 5. キーハンドラの書き換え

各キーハンドラの `setState` 呼び出しを `setModal` に置換する。

##### Before

```typescript
if (input === "c") {
  if (viewIndex >= 0) return;
  setIsCommenting(true);
  return;
}
if (input === "C") {
  if (viewIndex >= 0) return;
  const currentLine = lines[cursorIndex];
  if (!currentLine) return;
  const location = getLocationFromLine(currentLine);
  if (!location) return;
  setInlineCommentLocation(location);
  return;
}
if (input === "R") {
  const currentLine = lines[cursorIndex];
  if (!currentLine) return;
  const target = getReplyTargetFromLine(currentLine);
  if (!target) return;
  setReplyTarget(target);
  return;
}
if (input === "a") {
  setApprovalAction("approve");
  return;
}
if (input === "r") {
  setApprovalAction("revoke");
  return;
}
if (input === "m") {
  setMergeStep("strategy");
  return;
}
if (input === "x") {
  setIsClosing(true);
  return;
}
if (input === "e") {
  const currentLine = lines[cursorIndex];
  if (!currentLine) return;
  const editInfo = getCommentIdFromLine(currentLine);
  if (!editInfo) return;
  const content = findCommentContent(commentThreads, editInfo.commentId);
  setEditTarget({ commentId: editInfo.commentId, content });
  return;
}
if (input === "d") {
  const currentLine = lines[cursorIndex];
  if (!currentLine) return;
  const delInfo = getCommentIdFromLine(currentLine);
  if (!delInfo) return;
  setDeleteTarget(delInfo);
  return;
}
if (input === "g") {
  if (viewIndex >= 0) return;
  const currentLine = lines[cursorIndex];
  if (!currentLine) return;
  if (!COMMENT_LINE_TYPES.has(currentLine.type)) return;
  if (!currentLine.commentId) return;
  setReactionTarget(currentLine.commentId);
  return;
}
if (input === "f") {
  if (viewIndex >= 0) return;
  setShowFileList(true);
  setFileListCursor(0);
  return;
}
```

##### After

```typescript
if (input === "c") {
  if (viewIndex >= 0) return;
  setModal({ type: "commenting" });
  return;
}
if (input === "C") {
  if (viewIndex >= 0) return;
  const currentLine = lines[cursorIndex];
  if (!currentLine) return;
  const location = getLocationFromLine(currentLine);
  if (!location) return;
  setModal({ type: "inline-commenting", location });
  return;
}
if (input === "R") {
  const currentLine = lines[cursorIndex];
  if (!currentLine) return;
  const target = getReplyTargetFromLine(currentLine);
  if (!target) return;
  setModal({ type: "replying", ...target });
  return;
}
if (input === "a") {
  setModal({ type: "approving", action: "approve" });
  return;
}
if (input === "r") {
  setModal({ type: "approving", action: "revoke" });
  return;
}
if (input === "m") {
  setModal({ type: "merging", step: "strategy" });
  return;
}
if (input === "x") {
  setModal({ type: "closing" });
  return;
}
if (input === "e") {
  const currentLine = lines[cursorIndex];
  if (!currentLine) return;
  const editInfo = getCommentIdFromLine(currentLine);
  if (!editInfo) return;
  const content = findCommentContent(commentThreads, editInfo.commentId);
  setModal({ type: "editing", commentId: editInfo.commentId, content });
  return;
}
if (input === "d") {
  const currentLine = lines[cursorIndex];
  if (!currentLine) return;
  const delInfo = getCommentIdFromLine(currentLine);
  if (!delInfo) return;
  setModal({ type: "deleting", commentId: delInfo.commentId });
  return;
}
if (input === "g") {
  if (viewIndex >= 0) return;
  const currentLine = lines[cursorIndex];
  if (!currentLine) return;
  if (!COMMENT_LINE_TYPES.has(currentLine.type)) return;
  if (!currentLine.commentId) return;
  setModal({ type: "reacting", commentId: currentLine.commentId });
  return;
}
if (input === "f") {
  if (viewIndex >= 0) return;
  setModal({ type: "file-list" });
  setFileListCursor(0);
  return;
}
```

#### 6. handleStrategySelect のアトミック化

##### Before (4つの setState を順次呼び出し)

```typescript
async function handleStrategySelect(strategy: MergeStrategy) {
  setSelectedStrategy(strategy);
  setIsCheckingConflicts(true);
  setConflictSummary(null);

  try {
    const summary = await onCheckConflicts(strategy);
    setConflictSummary(summary);
    setIsCheckingConflicts(false);

    if (summary.mergeable) {
      setMergeStep("confirm");
    }
  } catch {
    setIsCheckingConflicts(false);
    setMergeStep(null);
  }
}
```

##### After (各遷移が1つの setModal)

```typescript
async function handleStrategySelect(strategy: MergeStrategy) {
  setModal({ type: "merging", step: "checking", strategy });

  try {
    const summary = await onCheckConflicts(strategy);
    if (summary.mergeable) {
      setModal({ type: "merging", step: "confirm", strategy });
    } else {
      setModal({ type: "merging", step: "conflict", strategy, conflicts: summary });
    }
  } catch {
    setModal({ type: "none" });
  }
}
```

**改善点**:
- 各状態遷移が1つの `setModal` 呼び出しで完結する（アトミック）
- `conflictSummary` のクリア忘れが構造的に不可能（状態に含まれない variant では参照できない）
- マージフローの状態遷移が明示的に読み取れる: `strategy → checking → confirm|conflict`

#### 7. レンダリング条件の書き換え

##### Before

```tsx
{isCommenting && (
  <CommentInput
    onSubmit={onPostComment}
    onCancel={() => setIsCommenting(false)}
    isPosting={isPostingComment}
    error={commentError}
    onClearError={onClearCommentError}
  />
)}
{inlineCommentLocation && (
  <Box flexDirection="column">
    <Text dimColor>
      Inline comment on {inlineCommentLocation.filePath}:{inlineCommentLocation.filePosition}
    </Text>
    <CommentInput
      onSubmit={(content) => onPostInlineComment(content, inlineCommentLocation)}
      onCancel={() => setInlineCommentLocation(null)}
      ...
    />
  </Box>
)}
{replyTarget && (
  <Box flexDirection="column">
    <Text dimColor>
      Replying to {replyTarget.author}: {replyTarget.content.slice(0, 50)}
      {replyTarget.content.length > 50 ? "..." : ""}
    </Text>
    <CommentInput
      onSubmit={(content) => onPostReply(replyTarget.commentId, content)}
      onCancel={() => { setReplyTarget(null); onClearReplyError(); }}
      ...
    />
  </Box>
)}
{approvalAction && (
  <ConfirmPrompt
    message={approvalAction === "approve" ? "Approve this pull request?" : "Revoke your approval?"}
    onConfirm={approvalAction === "approve" ? onApprove : onRevoke}
    onCancel={() => { setApprovalAction(null); onClearApprovalError(); }}
    ...
  />
)}
{mergeStep === "strategy" && !isCheckingConflicts && !conflictSummary && (
  <MergeStrategySelector ... />
)}
{isCheckingConflicts && (
  <Box><Text color="cyan">Checking for conflicts...</Text></Box>
)}
{conflictSummary && !conflictSummary.mergeable && (
  <ConflictDisplay
    conflictSummary={conflictSummary}
    onDismiss={() => { setConflictSummary(null); setMergeStep(null); }}
  />
)}
{mergeStep === "confirm" && (
  <ConfirmPrompt
    message={`Merge ... using ${formatStrategyName(selectedStrategy)}?`}
    onConfirm={() => onMerge(selectedStrategy)}
    onCancel={() => { setMergeStep(null); setConflictSummary(null); onClearMergeError(); }}
    ...
  />
)}
{isClosing && (
  <ConfirmPrompt
    message="Close this pull request without merging?"
    onConfirm={onClosePR}
    onCancel={() => { setIsClosing(false); onClearClosePRError(); }}
    ...
  />
)}
{editTarget && (
  <CommentInput
    onSubmit={(content) => onUpdateComment(editTarget.commentId, content)}
    onCancel={() => { setEditTarget(null); onClearUpdateCommentError(); }}
    initialValue={editTarget.content}
    ...
  />
)}
{deleteTarget && (
  <ConfirmPrompt
    message="Delete this comment?"
    onConfirm={() => onDeleteComment(deleteTarget.commentId)}
    onCancel={() => { setDeleteTarget(null); onClearDeleteCommentError(); }}
    ...
  />
)}
{reactionTarget && (
  <ReactionPicker
    onSelect={(shortCode) => onReact(reactionTarget, shortCode)}
    onCancel={() => { setReactionTarget(null); onClearReactionError(); }}
    currentReactions={reactionsByComment.get(reactionTarget) ?? []}
    ...
  />
)}
{showFileList && (
  <Box flexDirection="column">
    <Text bold>Files ({fileNames.length}):</Text>
    {fileNames.map((name, i) => (
      <Text key={name}>{i === fileListCursor ? "> " : "  "}{name}</Text>
    ))}
    <Text dimColor>j/k move Enter select Esc close</Text>
  </Box>
)}
```

##### After

```tsx
{modal.type === "commenting" && (
  <CommentInput
    onSubmit={onPostComment}
    onCancel={closeModal}
    isPosting={isPostingComment}
    error={commentError}
    onClearError={onClearCommentError}
  />
)}
{modal.type === "inline-commenting" && (
  <Box flexDirection="column">
    <Text dimColor>
      Inline comment on {modal.location.filePath}:{modal.location.filePosition}
    </Text>
    <CommentInput
      onSubmit={(content) => onPostInlineComment(content, modal.location)}
      onCancel={closeModal}
      ...
    />
  </Box>
)}
{modal.type === "replying" && (
  <Box flexDirection="column">
    <Text dimColor>
      Replying to {modal.author}: {modal.content.slice(0, 50)}
      {modal.content.length > 50 ? "..." : ""}
    </Text>
    <CommentInput
      onSubmit={(content) => onPostReply(modal.commentId, content)}
      onCancel={() => { closeModal(); onClearReplyError(); }}
      ...
    />
  </Box>
)}
{modal.type === "approving" && (
  <ConfirmPrompt
    message={modal.action === "approve" ? "Approve this pull request?" : "Revoke your approval?"}
    onConfirm={modal.action === "approve" ? onApprove : onRevoke}
    onCancel={() => { closeModal(); onClearApprovalError(); }}
    ...
  />
)}
{modal.type === "merging" && modal.step === "strategy" && (
  <MergeStrategySelector
    sourceRef={sourceRef}
    destRef={destRef}
    onSelect={handleStrategySelect}
    onCancel={closeModal}
  />
)}
{modal.type === "merging" && modal.step === "checking" && (
  <Box><Text color="cyan">Checking for conflicts...</Text></Box>
)}
{modal.type === "merging" && modal.step === "conflict" && (
  <ConflictDisplay
    conflictSummary={modal.conflicts}
    onDismiss={closeModal}
  />
)}
{modal.type === "merging" && modal.step === "confirm" && (
  <ConfirmPrompt
    message={`Merge ${sourceRef} into ${destRef} using ${formatStrategyName(modal.strategy)}?`}
    onConfirm={() => onMerge(modal.strategy)}
    onCancel={() => { closeModal(); onClearMergeError(); }}
    isProcessing={isMerging}
    processingMessage="Merging..."
    error={mergeError}
    onClearError={() => { onClearMergeError(); closeModal(); }}
  />
)}
{modal.type === "closing" && (
  <ConfirmPrompt
    message="Close this pull request without merging?"
    onConfirm={onClosePR}
    onCancel={() => { closeModal(); onClearClosePRError(); }}
    isProcessing={isClosingPR}
    processingMessage="Closing..."
    error={closePRError}
    onClearError={() => { onClearClosePRError(); closeModal(); }}
  />
)}
{modal.type === "editing" && (
  <Box flexDirection="column">
    <CommentInput
      onSubmit={(content) => onUpdateComment(modal.commentId, content)}
      onCancel={() => { closeModal(); onClearUpdateCommentError(); }}
      isPosting={isUpdatingComment}
      error={updateCommentError}
      onClearError={onClearUpdateCommentError}
      initialValue={modal.content}
      label="Edit Comment:"
      postingMessage="Updating comment..."
      errorPrefix="Failed to update comment:"
    />
  </Box>
)}
{modal.type === "deleting" && (
  <ConfirmPrompt
    message="Delete this comment?"
    onConfirm={() => onDeleteComment(modal.commentId)}
    onCancel={() => { closeModal(); onClearDeleteCommentError(); }}
    isProcessing={isDeletingComment}
    processingMessage="Deleting comment..."
    error={deleteCommentError}
    onClearError={() => { onClearDeleteCommentError(); closeModal(); }}
  />
)}
{modal.type === "reacting" && (
  <ReactionPicker
    onSelect={(shortCode) => onReact(modal.commentId, shortCode)}
    onCancel={() => { closeModal(); onClearReactionError(); }}
    isProcessing={isReacting}
    error={reactionError}
    onClearError={() => { onClearReactionError(); closeModal(); }}
    currentReactions={reactionsByComment.get(modal.commentId) ?? []}
  />
)}
{modal.type === "file-list" && (
  <Box flexDirection="column">
    <Text bold>Files ({fileNames.length}):</Text>
    {fileNames.map((name, i) => (
      <Text key={name}>{i === fileListCursor ? "> " : "  "}{name}</Text>
    ))}
    <Text dimColor>j/k move Enter select Esc close</Text>
  </Box>
)}
```

**改善点**:
- 各レンダリングブロックの条件が `modal.type === "..."` の単一チェックに統一（マージのみ `step` の追加チェック）
- `onCancel` コールバックが `closeModal` を呼ぶだけになり簡潔
- マージフローのレンダリング条件が複合条件（`mergeStep === "strategy" && !isCheckingConflicts && !conflictSummary`）から単純な `modal.step === "strategy"` に改善
- TypeScript の narrowing により、`modal.commentId`, `modal.location`, `modal.strategy` 等のプロパティアクセスが型安全に保証される

#### 8. フッター条件の簡素化

##### Before

```tsx
<Text dimColor>
  {isCommenting ||
  inlineCommentLocation ||
  replyTarget ||
  editTarget ||
  deleteTarget ||
  approvalAction ||
  mergeStep ||
  isClosing ||
  reactionTarget ||
  showFileList
    ? ""
    : viewIndex === -1 && (commits.length > 0 || commitsAvailable)
      ? "Tab view ..."
      : viewIndex >= 0
        ? "Tab next ..."
        : "↑↓ ..."}
</Text>
```

##### After

```tsx
<Text dimColor>
  {modal.type !== "none"
    ? ""
    : viewIndex === -1 && (commits.length > 0 || commitsAvailable)
      ? "Tab view ..."
      : viewIndex >= 0
        ? "Tab next ..."
        : "↑↓ ..."}
</Text>
```

## 状態遷移図

```
                    ┌──────────┐
          ┌─────── │   none   │ ←──────────────────────────────┐
          │        └──────────┘                                │
          │         │ │ │ │ │ │ │ │ │ │                        │
          │         │ │ │ │ │ │ │ │ │ └── f ──→ file-list ─────┤
          │         │ │ │ │ │ │ │ │ └──── g ──→ reacting ──────┤
          │         │ │ │ │ │ │ │ └────── d ──→ deleting ──────┤
          │         │ │ │ │ │ │ └──────── e ──→ editing ───────┤
          │         │ │ │ │ │ └────────── x ──→ closing ───────┤
          │         │ │ │ │ └──────────── r ──→ approving ─────┤
          │         │ │ │ └────────────── a ──→ approving ─────┤
          │         │ │ └──────────────── R ──→ replying ──────┤
          │         │ └────────────────── C ──→ inline-comm ───┤
          │         └──────────────────── c ──→ commenting ────┤
          │                                                    │
          │ m                                                  │
          │                                                    │
          ▼                                                    │
  ┌──────────────┐    select     ┌──────────────┐             │
  │   merging    │──────────────→│   merging    │             │
  │ step=strategy│               │ step=checking│             │
  └──────────────┘               └──────────────┘             │
          │ Esc                     │         │               │
          └─────────────────────────┼─────────┼───────────────┤
                                    │         │               │
                           mergeable│         │ !mergeable    │
                                    ▼         ▼               │
                            ┌────────────┐ ┌────────────┐     │
                            │  merging   │ │  merging   │     │
                            │step=confirm│ │step=conflict│    │
                            └────────────┘ └────────────┘     │
                                 │ Esc          │ dismiss     │
                                 └──────────────┴─────────────┘

         ※ 各モーダルの Esc / キャンセル / async完了 → none に遷移
         ※ useAsyncDismiss による自動遷移: isProcessing true→false (error=null) → none
```

## 影響範囲の分析

### コンポーネント・Props への影響: なし

| コンポーネント | Props 変更 | レンダリング変更 |
|--------------|-----------|----------------|
| `PullRequestDetail` | なし（内部リファクタのみ） | なし |
| `App` | なし | なし |
| `CommentInput` | なし | なし |
| `ConfirmPrompt` | なし | なし |
| `MergeStrategySelector` | なし | なし |
| `ConflictDisplay` | なし | なし |
| `ReactionPicker` | なし | なし |

### 機能的影響: なし

- ユーザー操作のフロー: 変更なし
- キーバインド: 変更なし
- 画面表示: 変更なし
- エラーハンドリング: 変更なし
- AWS API 呼び出し: 変更なし

### 既存テストへの影響

| テストファイル | 影響 |
|---------------|------|
| `src/components/PullRequestDetail.test.tsx` | なし。テストは Props 入力とレンダリング出力を検証しており、内部の状態管理方法には依存しない |
| `src/app.test.tsx` | なし。統合テストはユーザー操作 → 画面出力の流れを検証しており、PullRequestDetail 内部の useState 構造には依存しない |
| その他のテスト | なし。PullRequestDetail 以外のファイルに変更はない |

## エッジケース

| ケース | 対処 |
|--------|------|
| マージフロー中に `handleStrategySelect` の async が完了する前にモーダルが閉じられる | ガード `modal.type !== "none"` によりキー入力が無効化されるため、async 実行中にモーダルが閉じられることはない。async 完了後の `setModal` は正常に実行される（React は unmount されていない限り setState を受け付ける） |
| `closeModal` が `useAsyncDismiss` から呼ばれた時、既に別のモーダルが開いている | 不可能。排他制御により同時に1つしかモーダルが開かない。`useAsyncDismiss` は `isProcessing` の `true→false` 遷移時にのみ呼ばれるため、async 操作完了時のモーダル状態は必ず該当モーダルである |
| `selectedStrategy` のデフォルト値 `"fast-forward"` が失われる | 不要。現状のデフォルト値はマージフロー開始前の初期値であり、ユーザーが必ず `MergeStrategySelector` で選択するため使われない。ModalState では `step: "confirm"` に `strategy` が含まれるため、選択値は常に明示的に設定される |
| `conflictSummary` のクリア忘れ | 構造的に不可能。`conflictSummary` は `{ type: "merging", step: "conflict", conflicts }` にのみ存在し、他の状態に遷移した時点で自然に消滅する |
| `fileListCursor` が file-list モーダル以外で参照される | 現状と同じ。`fileListCursor` はファイルリスト表示時のみ使用され、他の箇所では参照されない |

## リスク

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| JSX 内の `modal.*` プロパティアクセスで TypeScript narrowing が効かない | 極低 | 低 | 条件分岐で `modal.type` をチェックすれば自動的に narrowing される。コンパイラが不正アクセスを検出 |
| `setModal` の呼び出し箇所で型の不一致 | 極低 | なし | TypeScript コンパイラが `ModalState` の variant と一致しないオブジェクトを拒否する |
| `useAsyncDismiss` の `closeModal` コールバックで予期しないモーダルが閉じられる | なし | — | 排他制御により、async 操作中は該当モーダルのみがアクティブ |
| レンダリングパフォーマンスの変化 | 極低 | 極低 | 13個の `useState` → 1個の `useState` により、setState 呼び出し回数は同等。React の reconciliation に有意な差は生じない |

## セキュリティ考慮

この変更はコンポーネント内部のリファクタリングであり、セキュリティ上の影響はない。

- **入力**: 変更なし
- **出力**: 変更なし
- **認証**: 変更なし
- **データの永続化**: なし

## テスト方針

### 基本方針

既存テストの通過をもって正しさを担保する。新規テストは追加しない。

### 理由

| 観点 | 根拠 |
|------|------|
| 機能的な変化がない | Props インターフェース・レンダリング出力・ユーザー操作フローに変更がないため、既存テストがそのまま回帰テストとして機能する |
| 型安全性の保証 | `ModalState` union 型により、不正な状態遷移はコンパイル時に検出される。実行時テストで型の正しさを検証する必要がない |
| 状態遷移の網羅 | 既存テストは全モーダル（コメント・返信・承認・マージ・クローズ・編集・削除・リアクション・ファイルリスト）の開閉フローをカバーしている |

### 既存テストによるモーダルカバレッジ

以下の既存テストが各モーダルの開閉フローを検証しており、そのまま回帰テストとして機能する:

| モーダル状態 | テストファイル | カバー内容 |
|-------------|--------------|-----------|
| commenting | PullRequestDetail.test.tsx | `c` キー → CommentInput 表示 → 送信/キャンセル |
| inline-commenting | PullRequestDetail.test.tsx | `C` キー → 位置表示 → 送信/キャンセル |
| replying | PullRequestDetail.test.tsx | `R` キー → 返信先表示 → 送信/キャンセル |
| approving | PullRequestDetail.test.tsx | `a`/`r` キー → ConfirmPrompt 表示 → 確認/キャンセル |
| merging (全step) | PullRequestDetail.test.tsx + app.test.tsx | `m` キー → 戦略選択 → コンフリクト確認 → 確認/キャンセル |
| closing | PullRequestDetail.test.tsx + app.test.tsx | `x` キー → ConfirmPrompt → 確認/キャンセル |
| editing | PullRequestDetail.test.tsx | `e` キー → プリフィル表示 → 更新/キャンセル |
| deleting | PullRequestDetail.test.tsx | `d` キー → ConfirmPrompt → 削除/キャンセル |
| reacting | PullRequestDetail.test.tsx | `g` キー → ReactionPicker 表示 → 送信/キャンセル |
| file-list | PullRequestDetail.test.tsx | `f` キー → ファイル一覧 → 選択/キャンセル |

### `v8 ignore` コメントの扱い

現在のコードには以下の2箇所に `v8 ignore` コメントがある:

```typescript
/* v8 ignore next -- merge success auto-close tested in app.test.tsx */
useAsyncDismiss(isMerging, mergeError, () => setMergeStep(null));
/* v8 ignore next -- close success auto-close tested in app.test.tsx */
useAsyncDismiss(isClosingPR, closePRError, () => setIsClosing(false));
```

リファクタリング後、9個の `useAsyncDismiss` すべてが同じ `closeModal` コールバックを使用する。`closeModal` 自体は他の `useAsyncDismiss`（コメント投稿成功等）で実行されるためカバレッジ対象になる。ただし、マージ/クローズの `useAsyncDismiss` 行自体のカバレッジは PullRequestDetail のテストスコープ外（app.test.tsx でカバー）のため、`v8 ignore` コメントは維持する。

### 検証手順

```bash
bun run ci
```

全チェック（lint, format:check, check, dead-code, audit, test:coverage, build）の通過をもって完了とする。

## 実装順序

変更は `PullRequestDetail.tsx` の1ファイルに閉じるが、段階的にコミットすることで各段階での回帰を検出しやすくする。

### コミット戦略

Tidy First の原則に従い、構造的変更のみの1コミットで完結させる。全 Step を1つのコミットにまとめる理由:

- 変更が1ファイルに閉じている
- Step 1-5 は部分的に適用するとコンパイルエラーになる（旧変数参照と新変数参照が混在するため）
- 機能的変更がなく、振る舞いは同一

コミットメッセージ例: `refactor: unify PullRequestDetail modal state into discriminated union`

### Step 1: ModalState 型定義 + useState 置換

1. `ModalState` 型をファイル冒頭（`InlineLocation` 型の直後）に定義
2. 13個の `useState` を1つの `useState<ModalState>` に置換
3. `closeModal` ヘルパーを定義
4. `useAsyncDismiss` のコールバックを `closeModal` に統一

**完了条件**: `bun run check` が通過（型チェック）

### Step 2: visibleLineCount + ガード条件の書き換え

1. `visibleLineCount` の条件を `modal.type !== "none"` に変更
2. `useInput` のガード条件を `modal.type !== "none"` に変更
3. ファイルリストの `showFileList` チェックを `modal.type === "file-list"` に変更
4. フッターの条件を `modal.type !== "none"` に変更

**完了条件**: `bun run check` が通過

### Step 3: キーハンドラの書き換え

各キーハンドラの `setXxx(value)` を `setModal({ type: "...", ... })` に置換。

**完了条件**: `bun run check` が通過

### Step 4: handleStrategySelect の書き換え

マージフローの状態遷移をアトミック化。

**完了条件**: `bun run check` が通過

### Step 5: レンダリング条件の書き換え

各モーダルのレンダリング条件を `modal.type === "..."` ベースに変更。`onCancel` コールバックの `closeModal` 化。

**完了条件**: `bun run check` が通過

### Step 6: 不要な変数・import の削除

置換済みの変数参照がないことを確認し、不要なコードを削除。

**完了条件**: `bun run ci` が全チェック通過（lint, format:check, check, dead-code, audit, test:coverage, build）。カバレッジ 95% 以上を維持。
