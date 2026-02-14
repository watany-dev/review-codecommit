# コメント編集・削除 設計書

## 実装ステータス

> **✅ 実装完了** (2026-02-14)
>
> コメント編集（`e` キー）・削除（`d` キー）を実装。サービス層、CommentInput 拡張、PullRequestDetail UI 統合、App ハンドラ、Help 更新の全 5 Step を TDD で完了。396 テスト通過、カバレッジ 95% 以上。

## 概要

投稿済みコメントの編集・削除を可能にし、レビューコメントの管理を完成させる。v0.6 までで PR ライフサイクル（閲覧→コメント→承認→マージ）が完結したが、コメントの修正や取り消しにはブラウザへの切り替えが必要だった。v0.7 でコメント編集・削除を追加し、コメント管理をターミナル内で完結させる。

## スコープ

### 今回やること

- 自分のコメントを編集（`e` キー）
- コメントを削除（`d` キー → 確認プロンプト → `y` で実行）
- 削除後のコメント一覧自動リロード
- 編集後のコメント一覧自動リロード
- 編集時の既存コメント内容プリフィル
- エラーハンドリング（権限不足、他人のコメント編集不可、削除済みコメント等）

### 今回やらないこと

- コメントのリアクション（絵文字）追加 → 将来検討（`PutCommentReaction` API）
- コメントの取得（`GetComment`）による最新状態の確認 → コメントリロードで代替
- 削除済みコメントの復元 → CodeCommit API に復元機能なし（`DeleteCommentContent` はソフトデリートだが、API による復元は不可）

## AWS SDK API

### UpdateCommentCommand（新規）

コメント内容を更新する。**コメント作成者のみ**が実行可能。

```typescript
import { UpdateCommentCommand } from "@aws-sdk/client-codecommit";

// Input
{
  commentId: string;    // 必須: コメントID
  content: string;      // 必須: 新しいコメント内容
}

// Output
{
  comment?: Comment;    // 更新後のコメント
}
```

**特徴**:
- コメント作成者以外が実行すると `CommentNotCreatedByCallerException` がスローされる
- 削除済みコメントの編集は `CommentDeletedException` がスローされる
- コメント内容の最大長は 10,240 文字（`CommentContentSizeLimitExceededException`）

### DeleteCommentContentCommand（新規）

コメント内容を削除する。**ソフトデリート**であり、コメントのシェル（ID・作成者・作成日時）は残る。

```typescript
import { DeleteCommentContentCommand } from "@aws-sdk/client-codecommit";

// Input
{
  commentId: string;    // 必須: コメントID
}

// Output
{
  comment?: Comment;    // 削除後のコメント（deleted: true）
}
```

**特徴**:
- ソフトデリート: コメントの `content` が空になり、`deleted` が `true` になる
- スレッド構造は維持される（返信があるコメントを削除しても、返信は残る）
- `DeleteCommentContent` は**作成者制限がない**。IAM の `codecommit:DeleteCommentContent` 権限があれば誰でも削除可能
- 既に削除済みのコメントを再度削除すると `CommentDeletedException` がスローされる

### API 比較

| 項目 | UpdateComment | DeleteCommentContent |
|------|--------------|---------------------|
| 操作種別 | 書き込み | 書き込み |
| 作成者制限 | あり（`CommentNotCreatedByCallerException`） | **なし**（IAM 権限のみ） |
| 必須パラメータ | 2（commentId, content） | 1（commentId） |
| 結果 | コメント内容が更新される | コメント内容が空になり `deleted: true` |
| 復元可能性 | - | 不可（API なし） |

### API エラー一覧

#### UpdateComment

| 例外 | HTTP | 説明 |
|------|------|------|
| `CommentContentRequiredException` | 400 | `content` が空 |
| `CommentContentSizeLimitExceededException` | 400 | `content` が 10,240 文字超 |
| `CommentDeletedException` | 400 | コメントが既に削除済み |
| `CommentDoesNotExistException` | 400 | コメントが存在しない |
| `CommentIdRequiredException` | 400 | `commentId` が未指定 |
| `CommentNotCreatedByCallerException` | 400 | 呼び出し元がコメント作成者ではない |
| `InvalidCommentIdException` | 400 | `commentId` のフォーマットが不正 |

#### DeleteCommentContent

| 例外 | HTTP | 説明 |
|------|------|------|
| `CommentDeletedException` | 400 | コメントが既に削除済み |
| `CommentDoesNotExistException` | 400 | コメントが存在しない |
| `CommentIdRequiredException` | 400 | `commentId` が未指定 |
| `InvalidCommentIdException` | 400 | `commentId` のフォーマットが不正 |

## データモデル

### 既存型への影響

v0.7 では新規のデータ型は不要。既存の `Comment` 型（AWS SDK 提供）と `CommentThread` 型をそのまま使用する。

`Comment` 型には以下のフィールドが関連:
- `commentId`: 編集・削除対象の識別に使用
- `content`: 編集時のプリフィルに使用
- `deleted`: 削除済みコメントの判定に使用
- `authorArn`: 将来的な作成者判定の参考（v0.7 では API に委任）

### DisplayLine 型への影響

既存の `DisplayLine` 型はそのまま使用。`commentId` フィールドが既に存在するため、編集・削除対象のコメントIDを取得できる。

## 画面設計

### コメント編集（`e` キー押下後）

カーソルがコメント行にある状態で `e` キーを押すと、CommentInput が既存内容をプリフィルした状態で開く。

```
│  Comments (3):                               │
│  watany: タイムアウトを延長しました          │
│     └ taro: LGTMです                         │
│ > hanako: 他も確認してください                │  ← カーソルがここにある状態で e キー
│                                              │
│──────────────────────────────────────────────│
│  Edit Comment:                               │
│  > 他の箇所も確認してください                │  ← 既存コメント内容がプリフィルされる
│  Enter submit  Esc cancel (16/10240)         │
```

インラインコメントの場合:
```
│  src/auth.ts                                 │
│   +   timeout: 10000,                        │
│ >  💬 taro: この値はconfigから取る方が良さそう│  ← カーソルがここにある状態で e キー
│                                              │
│──────────────────────────────────────────────│
│  Edit Comment:                               │
│  > この値は環境変数から取る方が良さそう       │  ← 既存内容を修正
│  Enter submit  Esc cancel (20/10240)         │
```

### コメント削除確認（`d` キー押下後）

```
│  Comments (3):                               │
│  watany: タイムアウトを延長しました          │
│     └ taro: LGTMです                         │
│ > hanako: 他も確認してください                │  ← カーソルがここにある状態で d キー
│                                              │
│──────────────────────────────────────────────│
│  Delete this comment? (y/n)                  │
```

### 削除実行中

```
│  Deleting comment...                         │
```

### 編集実行中

```
│  Updating comment...                         │
```

### 編集エラー（他人のコメント）

```
│  Failed to update comment: You can only edit │
│  your own comments.                          │
│  Press any key to return                     │
```

### 削除エラー（削除済み）

```
│  Comment has already been deleted.           │
│  Press any key to return                     │
```

### 非コメント行での `e` / `d` 操作

カーソルがコメント行以外（diff 行、ヘッダー行、セパレーター行）にある場合、`e` / `d` キーは何もしない（無視される）。

## データフロー

```
App (状態管理)
 │
 ├─ 既存の state すべて（変更なし）
 │
 ├─ 新規 state (v0.7):
 │   ├─ isUpdatingComment: boolean       // コメント更新中
 │   ├─ updateCommentError: string | null // 更新エラー
 │   ├─ isDeletingComment: boolean       // コメント削除中
 │   └─ deleteCommentError: string | null // 削除エラー
 │
 └─→ PullRequestDetail (表示 + 操作管理)
      │
      ├─ 既存の state すべて（変更なし）
      │
      ├─ 新規 local state (v0.7):
      │   ├─ isEditing: boolean              // 編集モード中
      │   ├─ editTarget: { commentId, content } | null  // 編集対象
      │   ├─ wasUpdating: boolean            // 更新完了検知用
      │   ├─ isDeleting: boolean             // 削除確認中
      │   ├─ deleteTarget: { commentId } | null  // 削除対象
      │   └─ wasDeleting: boolean            // 削除完了検知用
      │
      ├─ Props から受け取る (v0.7 追加):
      │   ├─ onUpdateComment(commentId, content) ──→ App.handleUpdateComment()
      │   ├─ isUpdatingComment ──→ 更新中表示
      │   ├─ updateCommentError ──→ エラー表示
      │   ├─ onClearUpdateCommentError
      │   ├─ onDeleteComment(commentId) ──→ App.handleDeleteComment()
      │   ├─ isDeletingComment ──→ 削除中表示
      │   ├─ deleteCommentError ──→ エラー表示
      │   └─ onClearDeleteCommentError
      │
      ├─→ CommentInput（既存コンポーネント拡張）
      │    │
      │    └─ initialValue prop 追加 + label prop 追加
      │
      └─→ ConfirmPrompt（既存コンポーネント再利用）
           │
           └─ 削除確認
```

### 編集シーケンス

```
ユーザー          PullRequestDetail   CommentInput    App              CodeCommit API
  │                    │                 │             │                    │
  │─── e キー ────────→│                 │             │                    │
  │                    │── editTarget    │             │                    │
  │                    │   設定          │             │                    │
  │                    │── isEditing     │             │                    │
  │                    │   = true        │             │                    │
  │                    │── render ───────→│             │                    │
  │                    │                 │ Edit        │                    │
  │                    │                 │ Comment:    │                    │
  │                    │                 │ > (既存内容) │                    │
  │                    │                 │             │                    │
  │─── 内容を修正 ───→│                 │             │                    │
  │                    │                 │ 入力反映    │                    │
  │                    │                 │             │                    │
  │─── Enter ─────────→│                 │             │                    │
  │                    │← onSubmit ──────│             │                    │
  │                    │── onUpdateComment(id, content)→│                    │
  │                    │                 │             │── UpdateComment ──→│
  │                    │                 │             │←── response ───────│
  │                    │                 │             │── reloadComments   │
  │                    │                 │             │───────────────────→│
  │                    │                 │             │←── comments ───────│
  │                    │                 │             │                    │
  │                    │← isUpdating     │             │                    │
  │                    │   = false       │             │                    │
  │                    │── isEditing     │             │                    │
  │                    │   = false       │             │                    │
```

### 削除シーケンス

```
ユーザー          PullRequestDetail   ConfirmPrompt    App              CodeCommit API
  │                    │                 │              │                    │
  │─── d キー ────────→│                 │              │                    │
  │                    │── deleteTarget  │              │                    │
  │                    │   設定          │              │                    │
  │                    │── isDeleting    │              │                    │
  │                    │   = true        │              │                    │
  │                    │── render ───────→│              │                    │
  │                    │                 │ "Delete this │                    │
  │                    │                 │  comment?"   │                    │
  │                    │                 │  (y/n)       │                    │
  │                    │                 │              │                    │
  │─── y キー ────────→│                 │              │                    │
  │                    │← onConfirm ────│              │                    │
  │                    │── onDeleteComment(id) ─────────→│                    │
  │                    │                 │              │── DeleteComment ──→│
  │                    │                 │              │   Content          │
  │                    │                 │              │←── response ───────│
  │                    │                 │              │── reloadComments   │
  │                    │                 │              │───────────────────→│
  │                    │                 │              │←── comments ───────│
  │                    │                 │              │                    │
  │                    │← isDeleting     │              │                    │
  │                    │   = false       │              │                    │
  │                    │── isDeleting    │              │                    │
  │                    │   = false       │              │                    │
```

## コンポーネント設計

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/services/codecommit.ts` | `updateComment`, `deleteComment` 関数を追加。新規 Command の import 追加 |
| `src/services/codecommit.test.ts` | 上記関数のテスト追加 |
| `src/components/CommentInput.tsx` | `initialValue` prop と `label` prop を追加 |
| `src/components/CommentInput.test.tsx` | 新規 prop のテスト追加 |
| `src/components/PullRequestDetail.tsx` | `e` / `d` キーハンドラ、編集・削除 UI 統合、Props 追加 |
| `src/components/PullRequestDetail.test.tsx` | 編集・削除のテスト追加 |
| `src/app.tsx` | `handleUpdateComment`, `handleDeleteComment` ハンドラ追加。state 追加。エラーハンドリング |
| `src/app.test.tsx` | 編集・削除の統合テスト追加 |
| `src/components/Help.tsx` | `e` / `d` キーバインドの追加 |
| `src/components/Help.test.tsx` | テスト更新 |

### 1. サービス層の変更

#### updateComment（新規）

```typescript
// src/services/codecommit.ts に追加
import {
  // 既存の import に追加
  UpdateCommentCommand,
  DeleteCommentContentCommand,
} from "@aws-sdk/client-codecommit";

export async function updateComment(
  client: CodeCommitClient,
  params: {
    commentId: string;
    content: string;
  },
): Promise<Comment> {
  const command = new UpdateCommentCommand({
    commentId: params.commentId,
    content: params.content,
  });
  const response = await client.send(command);
  return response.comment!;
}
```

#### deleteComment（新規）

```typescript
export async function deleteComment(
  client: CodeCommitClient,
  params: {
    commentId: string;
  },
): Promise<Comment> {
  const command = new DeleteCommentContentCommand({
    commentId: params.commentId,
  });
  const response = await client.send(command);
  return response.comment!;
}
```

**設計判断**: 関数名は `deleteComment`（`deleteCommentContent` ではなく）とする。呼び出し側は「コメントを削除する」という意図で呼ぶのであり、API の実装詳細（content だけが消える）は隠蔽する。

### 2. CommentInput コンポーネントの変更

#### Props の変更

```typescript
interface Props {
  onSubmit: (content: string) => void;
  onCancel: () => void;
  isPosting: boolean;
  error: string | null;
  onClearError: () => void;
  initialValue?: string;    // v0.7 追加: 編集時のプリフィル値
  label?: string;           // v0.7 追加: ラベル（デフォルト: "New Comment:"）
  postingMessage?: string;  // v0.7 追加: 投稿中メッセージ（デフォルト: "Posting comment..."）
  errorPrefix?: string;     // v0.7 追加: エラープレフィックス（デフォルト: "Failed to post comment:"）
}
```

#### 実装の変更

```typescript
export function CommentInput({
  onSubmit,
  onCancel,
  isPosting,
  error,
  onClearError,
  initialValue = "",
  label = "New Comment:",
  postingMessage = "Posting comment...",
  errorPrefix = "Failed to post comment:",
}: Props) {
  const [value, setValue] = useState(initialValue);
  // ... 残りは既存のまま
```

**設計判断**:
- `initialValue` はデフォルト空文字列で、既存の動作を維持する
- `label`、`postingMessage`、`errorPrefix` のデフォルト値を既存の表示文字列と一致させ、後方互換を保つ
- 既存の CommentInput 利用箇所（一般コメント投稿、インラインコメント投稿、返信投稿）は変更不要

### 3. PullRequestDetail の変更

#### Props の変更

v0.7 で 8 つの Props を追加する。既存の Props はすべて維持。

```typescript
interface Props {
  // ... 既存の Props すべて ...
  // v0.7 追加
  onUpdateComment: (commentId: string, content: string) => void;
  isUpdatingComment: boolean;
  updateCommentError: string | null;
  onClearUpdateCommentError: () => void;
  onDeleteComment: (commentId: string) => void;
  isDeletingComment: boolean;
  deleteCommentError: string | null;
  onClearDeleteCommentError: () => void;
}
```

#### 状態管理の追加

```typescript
const [isEditing, setIsEditing] = useState(false);
const [editTarget, setEditTarget] = useState<{
  commentId: string;
  content: string;
} | null>(null);
const [wasUpdating, setWasUpdating] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);
const [deleteTarget, setDeleteTarget] = useState<{
  commentId: string;
} | null>(null);
const [wasDeleting, setWasDeleting] = useState(false);
```

#### useEffect（編集完了検知）

```typescript
// v0.7: コメント更新完了で編集モードを閉じる
useEffect(() => {
  if (isUpdatingComment) {
    setWasUpdating(true);
  } else if (wasUpdating && !updateCommentError) {
    setIsEditing(false);
    setEditTarget(null);
    setWasUpdating(false);
  } else {
    setWasUpdating(false);
  }
}, [isUpdatingComment, updateCommentError]);

// v0.7: コメント削除完了で削除確認を閉じる
useEffect(() => {
  if (isDeletingComment) {
    setWasDeleting(true);
  } else if (wasDeleting && !deleteCommentError) {
    setIsDeleting(false);
    setDeleteTarget(null);
    setWasDeleting(false);
  } else {
    setWasDeleting(false);
  }
}, [isDeletingComment, deleteCommentError]);
```

#### useInput の変更

```typescript
useInput((input, key) => {
  if (
    isCommenting ||
    isInlineCommenting ||
    isReplying ||
    isEditing ||         // v0.7 追加
    isDeleting ||        // v0.7 追加
    approvalAction ||
    mergeStep ||
    isClosing
  )
    return;

  // ... 既存のキーバインド ...

  if (input === "e") {                                   // v0.7 追加
    const currentLine = lines[cursorIndex];
    if (!currentLine) return;
    const target = getEditTargetFromLine(currentLine);
    if (!target) return;
    const content = findCommentContent(commentThreads, target.commentId);
    setEditTarget({ commentId: target.commentId, content });
    setIsEditing(true);
    return;
  }
  if (input === "d") {                                   // v0.7 追加
    const currentLine = lines[cursorIndex];
    if (!currentLine) return;
    const target = getDeleteTargetFromLine(currentLine);
    if (!target) return;
    setDeleteTarget(target);
    setIsDeleting(true);
    return;
  }
});
```

#### getEditTargetFromLine（新規ヘルパー）

コメント行から `commentId` のみを取得する。コメント内容は `findCommentContent` で `commentThreads` から検索し、表示テキストのフォーマット（`💬`、`└` プレフィックス等）に依存しない正確な内容を取得する。

```typescript
function getEditTargetFromLine(
  line: DisplayLine,
): { commentId: string } | null {
  const commentTypes = ["inline-comment", "comment", "inline-reply", "comment-reply"];
  if (!commentTypes.includes(line.type)) return null;
  if (!line.commentId) return null;
  return { commentId: line.commentId };
}
```

#### findCommentContent（新規ヘルパー）

`commentThreads` からコメントIDで内容を検索する。編集時のプリフィル値として使用。

```typescript
function findCommentContent(commentThreads: CommentThread[], commentId: string): string {
  for (const thread of commentThreads) {
    for (const comment of thread.comments) {
      if (comment.commentId === commentId) {
        return comment.content ?? "";
      }
    }
  }
  return "";
}
```

**設計判断**: `getReplyTargetFromLine` は表示テキストからコメント内容をパースするが、`getEditTargetFromLine` ではこの方法を採用しない。理由:
- 編集のプリフィルには**正確な原文**が必要（表示用フォーマットではなく）
- `commentThreads` は `reloadComments` で常に最新化されており、信頼できるソース
- 表示テキストのパースはプレフィックス除去ロジックが壊れやすい

#### getDeleteTargetFromLine（新規ヘルパー）

```typescript
function getDeleteTargetFromLine(
  line: DisplayLine,
): { commentId: string } | null {
  const commentTypes = ["inline-comment", "comment", "inline-reply", "comment-reply"];
  if (!commentTypes.includes(line.type)) return null;
  if (!line.commentId) return null;
  return { commentId: line.commentId };
}
```

#### レンダリングの変更

```tsx
{/* コメント編集 */}
{isEditing && editTarget && (
  <Box flexDirection="column">
    <CommentInput
      onSubmit={(content) => onUpdateComment(editTarget.commentId, content)}
      onCancel={() => {
        setIsEditing(false);
        setEditTarget(null);
        onClearUpdateCommentError();
      }}
      isPosting={isUpdatingComment}
      error={updateCommentError}
      onClearError={onClearUpdateCommentError}
      initialValue={editTarget.content}
      label="Edit Comment:"
      postingMessage="Updating comment..."
      errorPrefix="Failed to update comment:"
    />
  </Box>
)}

{/* コメント削除確認 */}
{isDeleting && deleteTarget && (
  <ConfirmPrompt
    message="Delete this comment?"
    onConfirm={() => onDeleteComment(deleteTarget.commentId)}
    onCancel={() => {
      setIsDeleting(false);
      setDeleteTarget(null);
      onClearDeleteCommentError();
    }}
    isProcessing={isDeletingComment}
    processingMessage="Deleting comment..."
    error={deleteCommentError}
    onClearError={() => {
      onClearDeleteCommentError();
      setIsDeleting(false);
      setDeleteTarget(null);
    }}
  />
)}
```

#### visibleLineCount の調整

```typescript
const visibleLineCount =
  isCommenting || isInlineCommenting || isReplying || isEditing || isDeleting ||
  approvalAction || mergeStep || isClosing
    ? 20
    : 30;
```

#### フッターの変更

```tsx
<Box marginTop={1}>
  <Text dimColor>
    {isCommenting || isInlineCommenting || isReplying || isEditing || isDeleting ||
    approvalAction || mergeStep || isClosing
      ? ""
      : "↑↓ cursor  c comment  C inline  R reply  o fold  e edit  d delete  a approve  r revoke  m merge  x close  q back  ? help"}
  </Text>
</Box>
```

### 4. App の変更

#### import の変更

```typescript
import {
  // 既存の import に追加
  updateComment,
  deleteComment,
} from "./services/codecommit.js";
```

#### state の追加

```typescript
// v0.7: コメント更新状態
const [isUpdatingComment, setIsUpdatingComment] = useState(false);
const [updateCommentError, setUpdateCommentError] = useState<string | null>(null);

// v0.7: コメント削除状態
const [isDeletingComment, setIsDeletingComment] = useState(false);
const [deleteCommentError, setDeleteCommentError] = useState<string | null>(null);
```

#### handleUpdateComment（新規）

```typescript
async function handleUpdateComment(commentId: string, content: string) {
  if (!prDetail?.pullRequestId) return;

  setIsUpdatingComment(true);
  setUpdateCommentError(null);
  try {
    await updateComment(client, { commentId, content });
    await reloadComments(prDetail.pullRequestId);
  } catch (err) {
    setUpdateCommentError(formatUpdateCommentError(err));
  } finally {
    setIsUpdatingComment(false);
  }
}
```

#### handleDeleteComment（新規）

```typescript
async function handleDeleteComment(commentId: string) {
  if (!prDetail?.pullRequestId) return;

  setIsDeletingComment(true);
  setDeleteCommentError(null);
  try {
    await deleteComment(client, { commentId });
    await reloadComments(prDetail.pullRequestId);
  } catch (err) {
    setDeleteCommentError(formatDeleteCommentError(err));
  } finally {
    setIsDeletingComment(false);
  }
}
```

#### formatErrorMessage の拡張

```typescript
function formatErrorMessage(
  err: unknown,
  context?: "comment" | "reply" | "approval" | "merge" | "close" | "update-comment" | "delete-comment",
  approvalAction?: "approve" | "revoke",
): string {
  // ... 既存のコード ...

  // Update-comment-specific errors (v0.7)
  if (context === "update-comment") {
    if (name === "CommentNotCreatedByCallerException") {
      return "You can only edit your own comments.";
    }
    if (name === "CommentDeletedException") {
      return "Comment has already been deleted.";
    }
    if (name === "CommentDoesNotExistException") {
      return "Comment not found.";
    }
    if (name === "CommentContentRequiredException") {
      return "Comment cannot be empty.";
    }
    if (name === "CommentContentSizeLimitExceededException") {
      return "Comment exceeds the 10,240 character limit.";
    }
    if (name === "InvalidCommentIdException") {
      return "Invalid comment ID format.";
    }
  }

  // Delete-comment-specific errors (v0.7)
  if (context === "delete-comment") {
    if (name === "CommentDeletedException") {
      return "Comment has already been deleted.";
    }
    if (name === "CommentDoesNotExistException") {
      return "Comment not found.";
    }
    if (name === "CommentIdRequiredException") {
      return "Comment ID is required.";
    }
    if (name === "InvalidCommentIdException") {
      return "Invalid comment ID format.";
    }
  }

  // ... 既存の General AWS errors ...
}
```

#### Context-specific wrappers（追加）

```typescript
function formatUpdateCommentError(err: unknown): string {
  return formatErrorMessage(err, "update-comment");
}

function formatDeleteCommentError(err: unknown): string {
  return formatErrorMessage(err, "delete-comment");
}
```

#### PullRequestDetail への Props 渡し

```tsx
case "detail":
  if (!prDetail) return null;
  return (
    <PullRequestDetail
      // ... 既存の Props すべて ...
      onUpdateComment={handleUpdateComment}                          // v0.7 追加
      isUpdatingComment={isUpdatingComment}                          // v0.7 追加
      updateCommentError={updateCommentError}                        // v0.7 追加
      onClearUpdateCommentError={() => setUpdateCommentError(null)}  // v0.7 追加
      onDeleteComment={handleDeleteComment}                          // v0.7 追加
      isDeletingComment={isDeletingComment}                          // v0.7 追加
      deleteCommentError={deleteCommentError}                        // v0.7 追加
      onClearDeleteCommentError={() => setDeleteCommentError(null)}  // v0.7 追加
    />
  );
```

### 5. Help の変更

```typescript
<Text> c          Post comment (PR Detail)</Text>
<Text> C          Post inline comment (PR Detail)</Text>
<Text> R          Reply to comment (PR Detail)</Text>
<Text> o          Toggle thread fold (PR Detail)</Text>
<Text> e          Edit comment (PR Detail)</Text>           // v0.7 追加
<Text> d          Delete comment (PR Detail)</Text>          // v0.7 追加
<Text> a          Approve PR (PR Detail)</Text>
<Text> r          Revoke approval (PR Detail)</Text>
<Text> m          Merge PR (PR Detail)</Text>
<Text> x          Close PR without merge (PR Detail)</Text>
```

## キーバインド一覧（更新後）

| キー | 動作 | 画面 |
|------|------|------|
| `j` / `↓` | カーソル下移動 | 全画面（入力中・確認中は無効） |
| `k` / `↑` | カーソル上移動 | 全画面（入力中・確認中は無効） |
| `Enter` | 選択・決定 / コメント送信 | リスト画面 / コメント入力 |
| `q` / `Esc` | 前の画面に戻る / キャンセル | 全画面 / コメント入力 / 確認プロンプト |
| `Ctrl+C` | 即座に終了 | 全画面 |
| `?` | ヘルプ表示 | 全画面（入力中・確認中は無効） |
| `c` | 一般コメント投稿 | PR 詳細画面 |
| `C` | インラインコメント投稿（カーソル行） | PR 詳細画面（diff 行上のみ） |
| `R` | コメント返信 | PR 詳細画面（コメント行上のみ） |
| `o` | スレッド折りたたみ/展開 | PR 詳細画面（コメント行上のみ） |
| `e` | コメント編集 | PR 詳細画面（コメント行上のみ） |
| `d` | コメント削除（確認プロンプト） | PR 詳細画面（コメント行上のみ） |
| `a` | PR を承認（確認プロンプト表示） | PR 詳細画面 |
| `r` | 承認を取り消し（確認プロンプト表示） | PR 詳細画面 |
| `m` | PR をマージ（戦略選択 → 確認） | PR 詳細画面 |
| `x` | PR をクローズ（確認プロンプト表示） | PR 詳細画面 |

## エラーハンドリング

### コメント編集エラー

| エラー | 表示メッセージ |
|--------|---------------|
| `CommentNotCreatedByCallerException` | "You can only edit your own comments." |
| `CommentDeletedException` | "Comment has already been deleted." |
| `CommentDoesNotExistException` | "Comment not found." |
| `CommentContentRequiredException` | "Comment cannot be empty." |
| `CommentContentSizeLimitExceededException` | "Comment exceeds the 10,240 character limit." |
| `InvalidCommentIdException` | "Invalid comment ID format." |
| `AccessDeniedException` / `UnauthorizedException` | "Access denied. Check your IAM policy." |
| その他 | エラーメッセージをサニタイズして表示 |

### コメント削除エラー

| エラー | 表示メッセージ |
|--------|---------------|
| `CommentDeletedException` | "Comment has already been deleted." |
| `CommentDoesNotExistException` | "Comment not found." |
| `CommentIdRequiredException` | "Comment ID is required." |
| `InvalidCommentIdException` | "Invalid comment ID format." |
| `AccessDeniedException` / `UnauthorizedException` | "Access denied. Check your IAM policy." |
| その他 | エラーメッセージをサニタイズして表示 |

### エッジケースと対処方針

| ケース | 対処 |
|--------|------|
| 編集中に `c` / `C` / `R` / `a` / `r` / `m` / `x` / `d` | `isEditing` チェックにより無効化 |
| 削除確認中に `c` / `C` / `R` / `a` / `r` / `m` / `x` / `e` | `isDeleting` チェックにより無効化 |
| 非コメント行で `e` | `getEditTargetFromLine` が `null` を返し、何もしない |
| 非コメント行で `d` | `getDeleteTargetFromLine` が `null` を返し、何もしない |
| 折りたたみインジケーター行（`fold-indicator`）で `e` / `d` | `commentId` がないため `null` を返し、何もしない |
| 削除済みコメントの再削除 | API が `CommentDeletedException` を返し、エラー表示 |
| 削除済みコメントの編集 | API が `CommentDeletedException` を返し、エラー表示 |
| 他人のコメントの編集 | API が `CommentNotCreatedByCallerException` を返し、エラー表示 |
| 他人のコメントの削除 | IAM 権限に依存。権限がなければ `AccessDeniedException`、あれば削除成功 |
| 編集で空文字を送信 | CommentInput の `handleSubmit` が `trimmed.length === 0` をチェックし、送信しない |
| 編集で文字数制限超過 | CommentInput の `handleChange` が `COMMENT_MAX_LENGTH` でクリップ。超えた場合は API が `CommentContentSizeLimitExceededException` |
| コメント更新中に Esc | CommentInput の Esc ハンドラは `isPosting` 中は無効化されていないため、キャンセル可能。ただし API 呼び出しは続行する |
| コメント削除中に Esc | ConfirmPrompt の `isProcessing` 中はキー入力が無効化されるため、キャンセル不可 |
| 返信コメントの編集 | コメントの種類を問わず、`commentId` があれば編集可能 |
| 返信コメントの削除 | コメントの種類を問わず、`commentId` があれば削除可能 |

## セキュリティ考慮

### IAM 権限

v0.7 で追加の IAM 権限が必要:

```json
{
  "Effect": "Allow",
  "Action": [
    "codecommit:UpdateComment",
    "codecommit:DeleteCommentContent"
  ],
  "Resource": "arn:aws:codecommit:<region>:<account-id>:<repository-name>"
}
```

### 操作の安全性

#### 編集

- **API レベルの作成者制限**: `UpdateComment` は `CommentNotCreatedByCallerException` により、コメント作成者以外の編集を拒否する。クライアント側での事前チェックは不要
- **内容の上書き**: 編集は内容を完全に上書きする。元の内容は復元できない

#### 削除

- **ソフトデリート**: `DeleteCommentContent` はコメントの `content` を空にするだけで、コメントのシェルは残る。スレッド構造は維持される
- **作成者制限なし**: `DeleteCommentContent` は IAM 権限のみで制御される。`AWSCodeCommitFullAccess` ポリシーや `codecommit:DeleteCommentContent` 権限があれば、誰のコメントでも削除可能
- **確認プロンプト**: 削除は不可逆のため、ConfirmPrompt で確認を要求する

### 認証

既存の AWS SDK 標準認証チェーンをそのまま使用する。追加の認証フローは不要。

## 技術選定

### 新規依存パッケージ: なし

v0.7 では新規依存パッケージの追加は不要。`UpdateCommentCommand` と `DeleteCommentContentCommand` は既存の `@aws-sdk/client-codecommit` パッケージに含まれている。

### 編集時のコメント内容取得: commentThreads から検索

| 選択肢 | 評価 |
|--------|------|
| **`commentThreads` から `commentId` で検索（採用）** | 元のコメント内容を正確に取得できる。表示テキストのフォーマット（`💬`、`└` 等）に依存しない |
| 表示テキストからパース | プレフィックス除去のロジックが `getReplyTargetFromLine` と重複。フォーマット変更時に壊れやすい |
| `GetComment` API で都度取得 | 追加の API 呼び出しが必要。レイテンシが増加。commentThreads に最新データがあるため不要 |

### CommentInput の拡張: Props 追加 vs 新規コンポーネント

| 選択肢 | 評価 |
|--------|------|
| **既存 CommentInput に `initialValue` / `label` Props を追加（採用）** | 新規作成 → 編集の差異はわずか（初期値とラベルのみ）。コンポーネント増加を抑制。デフォルト値で後方互換を維持 |
| `EditCommentInput` を新規作成 | CommentInput とほぼ同一のコード。DRY 原則に反する |

### 作成者チェック: API に委任

| 選択肢 | 評価 |
|--------|------|
| **API に委任（採用）** | 最もシンプル。`CommentNotCreatedByCallerException` のエラーメッセージで十分。追加の API（`STS:GetCallerIdentity`）不要 |
| `STS:GetCallerIdentity` で事前チェック | STS への依存追加。IAM 権限追加が必要。作成者 ARN の比較ロジックも必要 |
| `authorArn` を保持して UI で制限 | 現在のユーザー ARN が不明なため比較不可。ルートユーザー / IAM ユーザー / ロール / フェデレーションで ARN 形式が異なり比較が複雑 |

### 削除済みコメントの表示

| 選択肢 | 評価 |
|--------|------|
| **リロード後に API レスポンスに従って表示（採用）** | 削除済みコメントは `content` が空または `deleted: true` で返る。`buildDisplayLines` で空コンテンツのコメントが自然に処理される。API の振る舞いに準拠 |
| ローカル state から即座に除去 | API レスポンスと state が乖離するリスク。リロードで上書きされるため一時的な対処にしかならない |

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `updateComment` | `vi.fn()` で `client.send` をモック。正常系・エラー系のテスト |
| `deleteComment` | `vi.fn()` で `client.send` をモック。正常系・エラー系のテスト |
| `CommentInput`（`initialValue` / `label`） | プリフィル・ラベル表示のテスト |
| `PullRequestDetail`（`e` キー） | 編集対象の特定 → CommentInput 表示 → 送信の流れ |
| `PullRequestDetail`（`d` キー） | 削除対象の特定 → 確認プロンプト → 削除実行の流れ |
| `App`（統合テスト） | 編集成功→リロード、削除成功→リロード |

カバレッジ 95% 以上を維持する。

### 具体的なテストケース

#### サービス層

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `updateComment`: 正常更新 | `UpdateCommentCommand` が正しいパラメータで呼ばれ、更新後のコメントが返る |
| 2 | `updateComment`: API がエラーをスロー | エラーがそのまま上位に伝播する |
| 3 | `deleteComment`: 正常削除 | `DeleteCommentContentCommand` が正しいパラメータで呼ばれ、`deleted: true` のコメントが返る |
| 4 | `deleteComment`: API がエラーをスロー | エラーがそのまま上位に伝播する |

#### CommentInput

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `initialValue` 未指定 | 入力欄が空で表示される（既存動作維持） |
| 2 | `initialValue` 指定 | 入力欄に指定値がプリフィルされる |
| 3 | `label` 未指定 | "New Comment:" が表示される（既存動作維持） |
| 4 | `label` 指定 | 指定ラベルが表示される |
| 5 | `postingMessage` 指定 | 投稿中に指定メッセージが表示される |
| 6 | `errorPrefix` 指定 | エラー時に指定プレフィックスが表示される |
| 7 | プリフィル値を編集して送信 | 編集後の値で `onSubmit` が呼ばれる |

#### findCommentContent ヘルパー

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 存在する commentId で検索 | コメントの `content` が返る |
| 2 | 存在しない commentId で検索 | 空文字列が返る |
| 3 | `content` が `undefined` のコメント | 空文字列が返る |
| 4 | 複数スレッドにまたがる検索 | 正しいスレッドのコメント内容が返る |

#### PullRequestDetail（コンポーネント）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | コメント行で `e` キー | 編集用 CommentInput が表示され、既存コメント内容がプリフィルされる |
| 2 | 非コメント行で `e` キー | 何も起こらない |
| 3 | 編集用 CommentInput で Enter | `onUpdateComment` が commentId と新しい内容で呼ばれる |
| 4 | 編集用 CommentInput で Esc | 通常表示に戻る |
| 5 | `isUpdatingComment` が `true` | "Updating comment..." が表示される |
| 6 | 更新エラー | エラーメッセージが表示される |
| 7 | コメント行で `d` キー | 削除確認プロンプトが表示される |
| 8 | 非コメント行で `d` キー | 何も起こらない |
| 9 | 削除確認で `y` | `onDeleteComment` が commentId で呼ばれる |
| 10 | 削除確認で `n` | 通常表示に戻る |
| 11 | `isDeletingComment` が `true` | "Deleting comment..." が表示される |
| 12 | 削除エラー | エラーメッセージが表示される |
| 13 | 編集中に `c` / `d` / `R` 等 | 無視される |
| 14 | 削除確認中に `e` / `c` / `R` 等 | 無視される |
| 15 | fold-indicator 行で `e` / `d` | 何も起こらない（commentId なし） |
| 16 | フッターに `e edit  d delete` が表示 | ナビゲーションヒントが更新されている |
| 17 | インラインコメント行で `e` キー | 編集用 CommentInput が表示される（コメント種類を問わず動作） |
| 18 | 返信コメント行で `d` キー | 削除確認プロンプトが表示される（返信でも動作） |

#### App（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | コメント更新成功 | `updateComment` が呼ばれ、コメントがリロードされる |
| 2 | コメント更新失敗（CommentNotCreatedByCaller） | "You can only edit your own comments." エラーが表示される |
| 3 | コメント更新失敗（CommentDeleted） | "Comment has already been deleted." エラーが表示される |
| 4 | コメント更新失敗（AccessDenied） | "Access denied..." エラーが表示される |
| 5 | コメント削除成功 | `deleteComment` が呼ばれ、コメントがリロードされる |
| 6 | コメント削除失敗（CommentDeleted） | "Comment has already been deleted." エラーが表示される |
| 7 | コメント削除失敗（CommentDoesNotExist） | "Comment not found." エラーが表示される |

#### Help

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | ヘルプ画面表示 | `e` と `d` のキーバインドが表示される |

## 実装順序

各 Step は TDD サイクル（Red → Green → Refactor）で進める。テストを先に書き、最小限の実装で通し、その後リファクタリングする。

### Step 1: サービス層 — updateComment, deleteComment 追加

`src/services/codecommit.ts` に 2 つの関数と新規 Command の import を追加。テストを追加して通過を確認。

**この Step で変更するファイル**:
- `src/services/codecommit.ts`: 関数追加、import 追加
- `src/services/codecommit.test.ts`: テスト追加

**この Step の完了条件**: 全テストが通過。既存テストに影響なし。

### Step 2: CommentInput コンポーネント拡張

`initialValue`、`label`、`postingMessage`、`errorPrefix` Props を追加。デフォルト値で既存動作を維持。

**この Step で変更するファイル**:
- `src/components/CommentInput.tsx`: Props 追加、デフォルト値設定
- `src/components/CommentInput.test.tsx`: 新規 Props のテスト追加

**この Step の完了条件**: 新規 Props のテストが通過。既存テストに影響なし。

### Step 3: PullRequestDetail に編集・削除 UI を統合

`e` / `d` キーハンドラ追加。編集モード・削除確認の状態管理。Props 追加。`findCommentContent` ヘルパー。

**この Step で変更するファイル**:
- `src/components/PullRequestDetail.tsx`: state 追加、キーハンドラ追加、レンダリング追加、Props 追加、ヘルパー関数追加
- `src/components/PullRequestDetail.test.tsx`: 編集・削除のテスト追加

**この Step の完了条件**: PullRequestDetail の編集・削除テストが通過。

### Step 4: App に編集・削除ハンドラを統合

`handleUpdateComment`, `handleDeleteComment` 追加。state 追加。`formatErrorMessage` 拡張。

**この Step で変更するファイル**:
- `src/app.tsx`: ハンドラ追加、state 追加、Props 渡し、`formatErrorMessage` 拡張
- `src/app.test.tsx`: 統合テスト追加

**この Step の完了条件**: 編集成功→リロード、削除成功→リロードの統合テストが通過。

### Step 5: Help 更新

`e` と `d` キーバインドを追加。

**この Step で変更するファイル**:
- `src/components/Help.tsx`: キーバインド行追加
- `src/components/Help.test.tsx`: スナップショットテスト更新

**この Step の完了条件**: Help 画面に `e Edit comment` と `d Delete comment` が表示される。

### Step 6: 全体テスト・カバレッジ確認

```bash
bun run ci
```

**この Step の完了条件**:
- oxlint: エラーなし
- Biome: フォーマットチェック通過
- TypeScript: 型チェック通過
- knip: 未使用 export なし
- vitest: カバレッジ 95% 以上
- build: 本番ビルド成功

### Step 7: ドキュメント更新

**この Step で変更するファイル**:
- `docs/requirements.md`: v0.7 機能スコープセクション追加、キーバインド表に `e` / `d` 追加、エラーハンドリング表にコメント編集・削除エラー追加
- `docs/roadmap.md`: v0.7 セクションに ✅ マーク追加
- `README.md`: 機能一覧にコメント編集・削除を追記

**この Step の完了条件**: 要件定義書・ロードマップ・README が設計書の内容と整合している。
