# コメント返信機能 設計書

## 概要

既存コメントへの返信を投稿し、コメントスレッドでの会話を可能にする。v0.4 のインラインコメント表示を拡張し、返信のインデント表示・長いスレッドの折りたたみに対応する。これにより、非同期レビューのやり取りをターミナル上で完結できる。

## スコープ

### 今回やること

- 既存コメントへの返信投稿（`R` キー）
- 返信をインデント付きのスレッド表示（`└` プレフィックス）
- 長いスレッドの折りたたみ/展開（`o` キー）
- インラインコメント・一般コメント両方のスレッドに対応

### 今回やらないこと

- コメント編集・削除 → v0.7
- ネスト返信（返信への返信の階層表示）→ CodeCommit のスレッドモデルがフラットなため非対応
- コメントリアクション（絵文字リアクション）→ スコープ外

## AWS SDK API

### PostCommentReplyCommand（新規）

既存コメントへの返信を投稿する。`PostCommentForPullRequestCommand` とは異なり、PR ID やリポジトリ名の指定は不要。返信先コメント ID と本文のみで投稿可能。

```typescript
import { PostCommentReplyCommand } from "@aws-sdk/client-codecommit";

// Input
{
  inReplyTo: string;    // 必須: 返信先コメント ID
  content: string;      // 必須: 返信本文
  clientRequestToken?: string;  // 任意: 冪等性トークン
}

// Output
{
  comment?: Comment;    // 投稿された返信コメント
}

// 返却される Comment の inReplyTo フィールドに返信先 ID が設定される
```

**API の特徴**:

| 項目 | 内容 |
|------|------|
| PR ID 不要 | `inReplyTo` のコメント ID だけでスレッドが特定される |
| 返信先 | スレッド内の任意のコメント ID を指定可能 |
| スレッドモデル | CodeCommit のスレッドはフラット構造。返信先の指定に関わらず、同一スレッドに追加される |
| 冪等性 | `clientRequestToken` で同一リクエストの重複投稿を防止可能（v0.5 では使用しない） |

### GetCommentsForPullRequestCommand（既存、レスポンスの活用拡大）

既存の API レスポンス内の `Comment.inReplyTo` フィールドを活用する。v0.4 までは無視していたが、v0.5 で返信の識別に使用する。

```typescript
// Comment 型（AWS SDK 既存）の関連フィールド
interface Comment {
  commentId?: string;       // コメント ID
  inReplyTo?: string;       // 返信先コメント ID（ルートコメントは undefined）
  authorArn?: string;       // 投稿者 ARN
  content?: string;         // コメント本文
  creationDate?: Date;      // 作成日時
  deleted?: boolean;        // 削除済みフラグ
}
```

**スレッド内のコメント構造**:

`GetCommentsForPullRequestCommand` のレスポンスでは、`CommentsForPullRequestData.comments` 配列にスレッド内の全コメントが時系列順で含まれる。

| インデックス | `inReplyTo` | 役割 |
|-------------|-------------|------|
| `comments[0]` | `undefined` | ルートコメント（スレッドの起点） |
| `comments[1]` | ルートの `commentId` | 返信1 |
| `comments[2]` | ルートまたは返信の `commentId` | 返信2 |
| ... | ... | ... |

v0.5 では `inReplyTo` が `undefined` かどうかでルートコメントと返信を区別する。

## データモデル変更

### CommentThread 型（変更なし）

v0.4 で導入した `CommentThread` 型はそのまま使用する。`comments` 配列内の各コメントの `inReplyTo` フィールドで返信を識別する。

```typescript
// 既存（変更なし）
export interface CommentThread {
  location: {
    filePath: string;
    filePosition: number;
    relativeFileVersion: "BEFORE" | "AFTER";
  } | null;
  comments: Comment[];   // comments[0] がルート、comments[1..n] が返信
}
```

### DisplayLine の拡張

```typescript
interface DisplayLine {
  type:
    | "header"
    | "separator"
    | "add"
    | "delete"
    | "context"
    | "comment-header"
    | "comment"
    | "inline-comment"
    | "inline-reply"        // v0.5 追加: インラインコメントの返信
    | "comment-reply"       // v0.5 追加: 一般コメントの返信
    | "fold-indicator";     // v0.5 追加: 折りたたみインジケーター
  text: string;
  filePath?: string;
  beforeLineNumber?: number;
  afterLineNumber?: number;
  // v0.5 追加
  threadIndex?: number;     // commentThreads 配列内のインデックス
  commentId?: string;       // このコメントの ID（返信投稿時に使用）
}
```

**新規フィールドの用途**:

| フィールド | 用途 |
|-----------|------|
| `threadIndex` | 折りたたみ状態の管理。どの `CommentThread` に属するか識別 |
| `commentId` | `R` キー押下時の返信先コメント ID 特定。v0.7（編集・削除）でも使用予定 |

### 新規 DisplayLine タイプ

| タイプ | 説明 | 表示例 |
|--------|------|--------|
| `inline-reply` | diff 行直下のインラインコメントスレッド内の返信 | `  └ watany: 次のPRで対応します` |
| `comment-reply` | 画面下部の一般コメントスレッド内の返信 | `  └ taro: 設定値は定数にしませんか？` |
| `fold-indicator` | 折りたたまれた返信の件数表示 | `  [+3 replies]` |

## 画面設計

### PR 詳細画面（スレッド表示付き）

ルートコメントは従来通り、返信は `└` プレフィックスでインデント表示する。

```
┌─ PR #42: fix: login timeout ────────────────┐
│  Author: watany  Status: OPEN   2h ago       │
│  main ← feature/fix-login                    │
│  Approvals: taro ✓                           │
│──────────────────────────────────────────────│
│  src/auth.ts                                 │
│  ──────────────────────────────────────────  │
│     const config = {                         │
│ > -   timeout: 3000,                         │
│     💬 taro: この値はconfigから取る方が良さそう │
│       └ watany: 次のPRで対応します             │
│       └ hanako: 同意です                      │
│   +   timeout: 10000,                        │
│     };                                       │
│                                              │
│──────────────────────────────────────────────│
│  Comments (4):                               │
│  watany: タイムアウトを延長しました           │
│    └ taro: 設定値は定数にしませんか？          │
│    └ watany: 次のPRで対応します               │
│  hanako: LGTMです                            │
│                                              │
│  ↑↓ cursor  c comment  C inline  R reply     │
│  o fold  a approve  r revoke  q back  ? help │
└──────────────────────────────────────────────┘
```

**表示の規則**:

| 要素 | 表示 |
|------|------|
| ルートコメント（インライン） | `💬 author: content`（従来通り） |
| 返信（インライン） | `  └ author: content`（magenta、インデント付き） |
| ルートコメント（一般） | `author: content`（従来通り） |
| 返信（一般） | `  └ author: content`（インデント付き） |
| 折りたたみインジケーター | `  [+N replies]`（dimColor） |

### スレッド折りたたみ

スレッド内のコメントが 4 件以上（ルート + 3 返信以上）の場合、デフォルトで折りたたまれる。

**折りたたみ時**:

```
│     💬 taro: この値はconfigから取る方が良さそう │
│       [+5 replies]                            │
```

インラインの折りたたみ時はルートコメントのみ表示し、返信は件数インジケーターにまとめる。

**展開時**:

```
│     💬 taro: この値はconfigから取る方が良さそう │
│       └ watany: 次のPRで対応します             │
│       └ hanako: 同意です                      │
│       └ taro: 承知しました                    │
│       └ watany: 修正しました                  │
│       └ hanako: 確認しました                  │
```

一般コメントでも同様:

**折りたたみ時**:

```
│  Comments (7):                               │
│  watany: タイムアウトを延長しました           │
│    [+5 replies]                              │
│  hanako: LGTMです                            │
```

**展開時**:

```
│  Comments (7):                               │
│  watany: タイムアウトを延長しました           │
│    └ taro: 設定値は定数にしませんか？          │
│    └ watany: 次のPRで対応します               │
│    └ hanako: 同意です                        │
│    └ taro: 承知しました                      │
│    └ watany: 修正しました                    │
│  hanako: LGTMです                            │
```

### 返信入力モード

`R` キー押下でコメント返信入力モードに遷移。返信先のコメントを表示し、コンテキストを明確にする。

```
│ > 💬 taro: この値はconfigから取る方が良さそう │
│──────────────────────────────────────────────│
│  Replying to taro: この値はconfigから取る...  │
│  New Reply:                                  │
│  > _                                         │
│  Enter submit  Esc cancel                    │
└──────────────────────────────────────────────┘
```

返信先のコメントは先頭 40 文字を表示し、長いコメントは `...` で省略する。

### 返信投稿成功後

投稿成功後は入力モードを閉じ、コメントスレッドを再取得して表示を更新。投稿した返信がスレッド内にインデント表示される。

### エラー時

既存の `CommentInput` のエラーハンドリングをそのまま使用。エラー表示後に任意キーで入力モードに復帰する（v0.2 と同じパターン）。

### `R` キーが無効な行

カーソルがコメント行（`comment`, `inline-comment`, `comment-reply`, `inline-reply`）以外にある場合、`R` キーは無視される。`fold-indicator` 行上では `R` は無視し、`o` キーのみ有効とする。

### `o` キーが無効な行

カーソルがコメント関連行（`comment`, `inline-comment`, `comment-reply`, `inline-reply`, `fold-indicator`）以外にある場合、`o` キーは無視される。

## データフロー

```
App (状態管理)
 │
 ├─ commentThreads: CommentThread[]     // 既存（変更なし）
 │
 └─→ PullRequestDetail (表示 + カーソル管理 + 折りたたみ管理)
      │
      ├─ cursorIndex: number                // 既存
      ├─ isReplying: boolean               // v0.5: 返信入力モード
      ├─ replyTarget: { commentId, author, content } | null  // v0.5: 返信先情報
      ├─ collapsedThreads: Set<number>     // v0.5: 折りたたまれたスレッドのインデックス
      │
      ├─ Props から受け取る (v0.5 変更/追加):
      │   ├─ commentThreads ──→ buildDisplayLines で返信表示・折りたたみ処理
      │   ├─ onPostReply(inReplyTo, content) ──→ App.handlePostReply()
      │   ├─ isPostingReply ──→ ローディング表示
      │   └─ replyError ──→ エラー表示
      │
      └─→ CommentInput (既存コンポーネント再利用)
           │
           └─ 返信入力時も同じ UI を使用
```

### 返信投稿シーケンス

```
ユーザー          PullRequestDetail   CommentInput      App              CodeCommit API
  │                    │                   │            │                    │
  │─── j/k キー ──────→│                   │            │                    │
  │                    │── cursorIndex     │            │                    │
  │                    │   更新            │            │                    │
  │                    │                   │            │                    │
  │─── R キー ────────→│                   │            │                    │
  │                    │── カーソル行の    │            │                    │
  │                    │   commentId 取得  │            │                    │
  │                    │── replyTarget     │            │                    │
  │                    │   設定            │            │                    │
  │                    │── isReplying      │            │                    │
  │                    │   = true          │            │                    │
  │                    │── render ─────────→│            │                    │
  │                    │                   │「Replying  │                    │
  │                    │                   │ to author: │                    │
  │                    │                   │ content」  │                    │
  │                    │                   │            │                    │
  │─── テキスト入力 ──→│                   │            │                    │
  │─── Enter ─────────→│                   │            │                    │
  │                    │← onSubmit() ─────│            │                    │
  │                    │── onPostReply    │            │                    │
  │                    │   (commentId,    │            │                    │
  │                    │    content) ──────────────────→│                    │
  │                    │                   │            │── isPostingReply   │
  │                    │                   │            │   = true           │
  │                    │                   │← isPosting │                    │
  │                    │                   │  =true     │                    │
  │                    │                   │「Posting   │── postCommentReply │
  │                    │                   │ ...」表示  │   (inReplyTo,     │
  │                    │                   │            │    content)        │
  │                    │                   │            │───────────────────→│
  │                    │                   │            │←── success ────────│
  │                    │                   │            │── reloadComments() │
  │                    │                   │            │── isPostingReply   │
  │                    │                   │            │   = false          │
  │                    │── useEffect発火 ──│            │                    │
  │                    │   isReplying      │            │                    │
  │                    │   = false         │            │                    │
  │                    │← diff 更新       │            │                    │
  │                    │  (返信が          │            │                    │
  │                    │   スレッド内に     │            │                    │
  │                    │   表示される)      │            │                    │
```

### 折りたたみトグルシーケンス

```
ユーザー          PullRequestDetail
  │                    │
  │─── o キー ────────→│
  │                    │── カーソル行の threadIndex 取得
  │                    │── collapsedThreads を更新
  │                    │   （Set に含まれていれば削除、なければ追加）
  │                    │── buildDisplayLines が再計算
  │                    │← 表示更新
```

## コンポーネント設計

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/services/codecommit.ts` | `postCommentReply` 関数を追加。`PostCommentReplyCommand` の import 追加 |
| `src/services/codecommit.test.ts` | `postCommentReply` のテスト追加 |
| `src/components/PullRequestDetail.tsx` | DisplayLine 拡張。返信表示・折りたたみロジック。`R` / `o` キーハンドラ。Props 追加 |
| `src/components/PullRequestDetail.test.tsx` | 返信表示、折りたたみ、`R` / `o` キーのテスト追加 |
| `src/app.tsx` | `handlePostReply` ハンドラ追加。返信投稿状態管理 |
| `src/app.test.tsx` | 返信投稿フローの統合テスト追加 |
| `src/components/Help.tsx` | `R` / `o` キーバインドの追加 |
| `src/components/Help.test.tsx` | ヘルプ表示テスト更新 |

### 1. サービス層の変更

#### postCommentReply（新規）

```typescript
// src/services/codecommit.ts に追加
import {
  // 既存の import に追加
  PostCommentReplyCommand,
} from "@aws-sdk/client-codecommit";

export async function postCommentReply(
  client: CodeCommitClient,
  params: {
    inReplyTo: string;
    content: string;
  },
): Promise<Comment> {
  const command = new PostCommentReplyCommand({
    inReplyTo: params.inReplyTo,
    content: params.content,
  });
  const response = await client.send(command);
  return response.comment!;
}
```

**`PostCommentForPullRequestCommand` との差異**:

| 項目 | `PostCommentForPullRequest` | `PostCommentReply` |
|------|---------------------------|-------------------|
| 用途 | 新規コメント（一般・インライン） | 既存コメントへの返信 |
| 必須パラメータ | pullRequestId, repositoryName, beforeCommitId, afterCommitId, content | inReplyTo, content |
| location | 任意（インラインコメント時に指定） | なし（返信先のスレッドに自動配置） |
| スレッド | 新しいスレッドを作成 | 既存スレッドに追加 |

`PostCommentReply` は `inReplyTo` だけでスレッドを特定するため、PR ID やリポジトリ名は不要。API のシンプルさがサービス層にも反映される。

### 2. DisplayLine の拡張

```typescript
// src/components/PullRequestDetail.tsx 内

interface DisplayLine {
  type:
    | "header"
    | "separator"
    | "add"
    | "delete"
    | "context"
    | "comment-header"
    | "comment"
    | "inline-comment"
    | "inline-reply"        // v0.5 追加
    | "comment-reply"       // v0.5 追加
    | "fold-indicator";     // v0.5 追加
  text: string;
  filePath?: string;
  beforeLineNumber?: number;
  afterLineNumber?: number;
  threadIndex?: number;     // v0.5 追加
  commentId?: string;       // v0.5 追加
}
```

### 3. buildDisplayLines の変更

インラインコメントと一般コメントの両方で、返信をインデント表示し、折りたたみを適用する。

```typescript
function buildDisplayLines(
  differences: Difference[],
  diffTexts: Map<string, { before: string; after: string }>,
  commentThreads: CommentThread[],
  collapsedThreads: Set<number>,  // v0.5 追加
): DisplayLine[] {
  const lines: DisplayLine[] = [];

  // インラインコメントをファイルパス・行番号・バージョンでインデックス化
  // v0.5: threadIndex も保持
  const inlineThreadsByKey = new Map<string, { thread: CommentThread; index: number }[]>();
  for (let i = 0; i < commentThreads.length; i++) {
    const thread = commentThreads[i]!;
    if (thread.location) {
      const key = `${thread.location.filePath}:${thread.location.filePosition}:${thread.location.relativeFileVersion}`;
      const existing = inlineThreadsByKey.get(key) ?? [];
      existing.push({ thread, index: i });
      inlineThreadsByKey.set(key, existing);
    }
  }

  for (const diff of differences) {
    const filePath = diff.afterBlob?.path ?? diff.beforeBlob?.path ?? "(unknown file)";
    lines.push({ type: "header", text: filePath });
    lines.push({ type: "separator", text: "─".repeat(50) });

    const blobKey = `${diff.beforeBlob?.blobId ?? ""}:${diff.afterBlob?.blobId ?? ""}`;
    const texts = diffTexts.get(blobKey);

    if (texts) {
      const beforeLines = texts.before.split("\n");
      const afterLines = texts.after.split("\n");
      const diffLines = computeSimpleDiff(beforeLines, afterLines);

      for (const dl of diffLines) {
        dl.filePath = filePath;
        lines.push(dl);

        // v0.5: インラインコメント + 返信表示
        const matchingEntries = findMatchingThreadEntries(
          inlineThreadsByKey, filePath, dl,
        );
        for (const { thread, index: threadIdx } of matchingEntries) {
          appendThreadLines(lines, thread, threadIdx, collapsedThreads, "inline");
        }
      }
    }

    lines.push({ type: "separator", text: "" });
  }

  // 一般コメント（location なし）
  const generalThreads = commentThreads
    .map((t, i) => ({ thread: t, index: i }))
    .filter(({ thread }) => thread.location === null);

  if (generalThreads.length > 0) {
    const totalComments = generalThreads.reduce(
      (sum, { thread }) => sum + thread.comments.length, 0,
    );
    lines.push({ type: "separator", text: "─".repeat(50) });
    lines.push({ type: "comment-header", text: `Comments (${totalComments}):` });
    for (const { thread, index: threadIdx } of generalThreads) {
      appendThreadLines(lines, thread, threadIdx, collapsedThreads, "general");
    }
  }

  return lines;
}
```

#### appendThreadLines ヘルパー

スレッド内のコメントを DisplayLine に変換する。折りたたみ状態に応じて表示を切り替える。

```typescript
const FOLD_THRESHOLD = 4; // 4件以上（ルート + 3返信以上）で折りたたみ対象

function appendThreadLines(
  lines: DisplayLine[],
  thread: CommentThread,
  threadIndex: number,
  collapsedThreads: Set<number>,
  mode: "inline" | "general",
): void {
  const comments = thread.comments;
  if (comments.length === 0) return;

  const rootComment = comments[0]!;
  const replies = comments.slice(1);
  const isCollapsed = collapsedThreads.has(threadIndex);
  const shouldFold = comments.length >= FOLD_THRESHOLD;

  // ルートコメントを追加
  const rootAuthor = extractAuthorName(rootComment.authorArn ?? "unknown");
  const rootContent = rootComment.content ?? "";

  if (mode === "inline") {
    lines.push({
      type: "inline-comment",
      text: `💬 ${rootAuthor}: ${rootContent}`,
      threadIndex,
      commentId: rootComment.commentId,
    });
  } else {
    lines.push({
      type: "comment",
      text: `${rootAuthor}: ${rootContent}`,
      threadIndex,
      commentId: rootComment.commentId,
    });
  }

  // 折りたたみ対象 & 折りたたまれている場合
  if (shouldFold && isCollapsed) {
    lines.push({
      type: "fold-indicator",
      text: `[+${replies.length} replies]`,
      threadIndex,
    });
    return;
  }

  // 返信を追加（展開時またはしきい値未満）
  for (const reply of replies) {
    const author = extractAuthorName(reply.authorArn ?? "unknown");
    const content = reply.content ?? "";

    if (mode === "inline") {
      lines.push({
        type: "inline-reply",
        text: `└ ${author}: ${content}`,
        threadIndex,
        commentId: reply.commentId,
      });
    } else {
      lines.push({
        type: "comment-reply",
        text: `└ ${author}: ${content}`,
        threadIndex,
        commentId: reply.commentId,
      });
    }
  }
}
```

#### findMatchingThreadEntries（findMatchingThreads の拡張）

threadIndex を含むエントリを返すように変更。

```typescript
function findMatchingThreadEntries(
  threadsByKey: Map<string, { thread: CommentThread; index: number }[]>,
  filePath: string,
  line: DisplayLine,
): { thread: CommentThread; index: number }[] {
  const results: { thread: CommentThread; index: number }[] = [];

  if (line.type === "delete" && line.beforeLineNumber) {
    const key = `${filePath}:${line.beforeLineNumber}:BEFORE`;
    results.push(...(threadsByKey.get(key) ?? []));
  }

  if (line.type === "add" && line.afterLineNumber) {
    const key = `${filePath}:${line.afterLineNumber}:AFTER`;
    results.push(...(threadsByKey.get(key) ?? []));
  }

  if (line.type === "context") {
    if (line.beforeLineNumber) {
      const key = `${filePath}:${line.beforeLineNumber}:BEFORE`;
      results.push(...(threadsByKey.get(key) ?? []));
    }
    if (line.afterLineNumber) {
      const key = `${filePath}:${line.afterLineNumber}:AFTER`;
      results.push(...(threadsByKey.get(key) ?? []));
    }
  }

  return results;
}
```

### 4. PullRequestDetail の変更

#### Props の変更

v0.5 で 4 つの Props を追加する。既存の Props はすべて維持。

```typescript
interface Props {
  pullRequest: PullRequest;
  differences: Difference[];
  commentThreads: CommentThread[];
  diffTexts: Map<string, { before: string; after: string }>;
  onBack: () => void;
  onHelp: () => void;
  onPostComment: (content: string) => void;
  isPostingComment: boolean;
  commentError: string | null;
  onClearCommentError: () => void;
  onPostInlineComment: (
    content: string,
    location: {
      filePath: string;
      filePosition: number;
      relativeFileVersion: "BEFORE" | "AFTER";
    },
  ) => void;
  isPostingInlineComment: boolean;
  inlineCommentError: string | null;
  onClearInlineCommentError: () => void;
  approvals: Approval[];
  approvalEvaluation: Evaluation | null;
  onApprove: () => void;
  onRevoke: () => void;
  isApproving: boolean;
  approvalError: string | null;
  onClearApprovalError: () => void;
  // v0.5 追加
  onPostReply: (inReplyTo: string, content: string) => void;
  isPostingReply: boolean;
  replyError: string | null;
  onClearReplyError: () => void;
}
```

#### import の変更

```typescript
// 既存の import に変更なし（CommentThread は既にインポート済み）
```

#### CommentInput 再利用時のラベル問題

既存の `CommentInput` コンポーネントは「New Comment:」「Posting comment...」「Failed to post comment:」のラベルがハードコードされている。返信投稿時もこれらのラベルがそのまま表示される。

**対応方針**: CommentInput のラベルを props でカスタマイズ可能にすることは v0.5 のスコープ外とする。理由:
- ラベルの不整合は機能上の影響はない（投稿自体は正しく動作する）
- 返信入力 UI には「Replying to author: content」のコンテキスト行が表示されるため、ユーザーは返信であることを認識できる
- v0.7（コメント編集）でも CommentInput を再利用する際にラベルカスタマイズが必要になるため、その時点でまとめて対応するのが効率的

**v0.7 で検討する改善案**:

```typescript
// 将来の CommentInput Props 拡張案
interface Props {
  onSubmit: (content: string) => void;
  onCancel: () => void;
  isPosting: boolean;
  error: string | null;
  onClearError: () => void;
  // v0.7 で追加検討
  promptLabel?: string;      // デフォルト: "New Comment:"
  postingLabel?: string;     // デフォルト: "Posting comment..."
  errorPrefix?: string;      // デフォルト: "Failed to post comment:"
}
```

#### 状態管理の追加

```typescript
const [isReplying, setIsReplying] = useState(false);              // v0.5: 返信入力モード
const [replyTarget, setReplyTarget] = useState<{
  commentId: string;
  author: string;
  content: string;
} | null>(null);
const [wasPostingReply, setWasPostingReply] = useState(false);    // v0.5: 投稿完了検知
const [collapsedThreads, setCollapsedThreads] = useState<Set<number>>(() => {
  // 初期状態: 4件以上のスレッドを折りたたみ
  const collapsed = new Set<number>();
  for (let i = 0; i < commentThreads.length; i++) {
    if ((commentThreads[i]?.comments.length ?? 0) >= FOLD_THRESHOLD) {
      collapsed.add(i);
    }
  }
  return collapsed;
});
```

**`collapsedThreads` の初期化とライフサイクル**:

`useState` の初期化コールバックでコンポーネントマウント時の `commentThreads` を元に折りたたみ状態を設定する。`PullRequestDetail` は `App` 側で `prDetail` が非 null のときのみレンダリングされるため、マウント時点で `commentThreads` は取得済みである。

**コメント再取得後（返信投稿成功後）の挙動**:

`reloadComments()` により `commentThreads` が更新されても、`collapsedThreads` はリセットしない。ユーザーが展開したスレッドは展開されたままとする。新しい返信によりスレッドが折りたたみしきい値を超えた場合でも、手動で `o` キーを押すまで展開状態を維持する。

この設計の根拠:
- **ユーザーの意図を尊重**: 展開操作は意図的な行為であり、返信追加で自動折りたたみされるのは不自然
- **シンプルさ**: useEffect での差分管理は複雑になりやすく、v0.5 の範囲では不要
- **PR 詳細画面の再訪問時**: 画面遷移で `PullRequestDetail` がアンマウント→再マウントされるため、`useState` 初期化コールバックが再実行され、最新の `commentThreads` でリセットされる

#### useEffect（返信投稿完了検知）

```typescript
// v0.5: 返信投稿完了で入力モードを閉じる
useEffect(() => {
  if (isPostingReply) {
    setWasPostingReply(true);
  } else if (wasPostingReply && !replyError) {
    setIsReplying(false);
    setReplyTarget(null);
    setWasPostingReply(false);
  } else {
    setWasPostingReply(false);
  }
}, [isPostingReply, replyError]);
```

#### buildDisplayLines の呼び出し変更

```typescript
const lines = buildDisplayLines(differences, diffTexts, commentThreads, collapsedThreads);
```

#### useInput の変更

```typescript
useInput((input, key) => {
  if (isCommenting || isInlineCommenting || isReplying || approvalAction) return;

  // ... 既存のキーバインド ...

  if (input === "R") {                                   // v0.5 追加
    const currentLine = lines[cursorIndex];
    if (!currentLine) return;
    const target = getReplyTargetFromLine(currentLine);
    if (!target) return;  // コメント行以外では無視
    setReplyTarget(target);
    setIsReplying(true);
    return;
  }
  if (input === "o") {                                   // v0.5 追加
    const currentLine = lines[cursorIndex];
    if (!currentLine) return;
    if (currentLine.threadIndex === undefined) return;  // コメント関連行以外では無視
    toggleThreadFold(currentLine.threadIndex);
    return;
  }
});
```

#### getReplyTargetFromLine ヘルパー

```typescript
function getReplyTargetFromLine(line: DisplayLine): {
  commentId: string;
  author: string;
  content: string;
} | null {
  // コメント関連行のみ返信可能
  if (
    line.type !== "comment" &&
    line.type !== "inline-comment" &&
    line.type !== "comment-reply" &&
    line.type !== "inline-reply"
  ) {
    return null;
  }

  if (!line.commentId) return null;

  // text からauthor と content を抽出
  // inline-comment: "💬 author: content"
  // inline-reply / comment-reply: "└ author: content"
  // comment: "author: content"
  //
  // 注意: 💬 は surrogate pair（U+1F4AC）のため JavaScript では 2 文字。
  //       "💬 " は 3 文字（"💬".length === 2 + " " === 1）。
  //       "└" は BMP 内（U+2514）のため 1 文字。"└ " は 2 文字。
  let displayText = line.text;
  const speechBalloonPrefix = "💬 ";
  const replyPrefix = "└ ";
  if (displayText.startsWith(speechBalloonPrefix)) {
    displayText = displayText.slice(speechBalloonPrefix.length);  // "💬 " (3文字) を除去
  }
  if (displayText.startsWith(replyPrefix)) {
    displayText = displayText.slice(replyPrefix.length);  // "└ " (2文字) を除去
  }

  const colonIndex = displayText.indexOf(": ");
  if (colonIndex === -1) return null;

  const author = displayText.slice(0, colonIndex);
  const content = displayText.slice(colonIndex + 2);

  return {
    commentId: line.commentId,
    author,
    content,
  };
}
```

#### toggleThreadFold ヘルパー

```typescript
function toggleThreadFold(threadIndex: number) {
  setCollapsedThreads((prev) => {
    const next = new Set(prev);
    if (next.has(threadIndex)) {
      next.delete(threadIndex);
    } else {
      next.add(threadIndex);
    }
    return next;
  });
}
```

#### レンダリングの変更

**返信入力 UI**:

```tsx
{isReplying && replyTarget && (
  <Box flexDirection="column">
    <Text dimColor>
      Replying to {replyTarget.author}: {truncate(replyTarget.content, 40)}
    </Text>
    <CommentInput
      onSubmit={(content) => onPostReply(replyTarget.commentId, content)}
      onCancel={() => {
        setIsReplying(false);
        setReplyTarget(null);
      }}
      isPosting={isPostingReply}
      error={replyError}
      onClearError={onClearReplyError}
    />
  </Box>
)}
```

#### truncate ヘルパー

```typescript
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
```

**renderDiffLine の変更**:

```typescript
function renderDiffLine(line: DisplayLine, isCursor = false): React.ReactNode {
  const bold = isCursor;
  switch (line.type) {
    // ... 既存の case すべて ...

    case "inline-reply":                                  // v0.5 追加
      return <Text color="magenta">    {line.text}</Text>;
    case "comment-reply":                                 // v0.5 追加
      return <Text>   {line.text}</Text>;
    case "fold-indicator":                                // v0.5 追加
      return <Text dimColor>    {line.text}</Text>;
  }
}
```

`inline-reply` は `inline-comment` と同じ magenta 色だが、追加のインデント（4スペース）で返信であることを視覚的に区別する。

**visibleLineCount の調整**:

```typescript
const visibleLineCount =
  isCommenting || isInlineCommenting || isReplying || approvalAction ? 20 : 30;
```

**フッターの変更**:

```tsx
<Box marginTop={1}>
  <Text dimColor>
    {isCommenting || isInlineCommenting || isReplying || approvalAction
      ? ""
      : "↑↓ cursor  c comment  C inline  R reply  o fold  a approve  r revoke  q back  ? help"}
  </Text>
</Box>
```

### 5. App の変更

#### import の変更

```typescript
import {
  // 既存の import に追加
  postCommentReply,
} from "./services/codecommit.js";
```

#### state の追加

```typescript
// v0.5: 返信投稿状態
const [isPostingReply, setIsPostingReply] = useState(false);
const [replyError, setReplyError] = useState<string | null>(null);
```

#### handlePostReply（新規）

```typescript
async function handlePostReply(inReplyTo: string, content: string) {
  if (!prDetail) return;

  setIsPostingReply(true);
  setReplyError(null);
  try {
    await postCommentReply(client, {
      inReplyTo,
      content,
    });
    await reloadComments(prDetail.pullRequestId!);
  } catch (err) {
    setReplyError(formatReplyError(err));
  } finally {
    setIsPostingReply(false);
  }
}
```

#### formatReplyError（新規）

```typescript
// formatErrorMessage に "reply" コンテキストを追加
function formatReplyError(err: unknown): string {
  return formatErrorMessage(err, "reply");
}
```

#### formatErrorMessage の拡張

```typescript
function formatErrorMessage(
  err: unknown,
  context?: "comment" | "approval" | "reply",
): string {
  if (!(err instanceof Error)) {
    return context ? String(err) : "An unexpected error occurred.";
  }

  const name = err.name;

  // Reply-specific errors (v0.5)
  if (context === "reply") {
    if (name === "CommentContentRequiredException") {
      return "Reply cannot be empty.";
    }
    if (name === "CommentContentSizeLimitExceededException") {
      return "Reply exceeds the 10,240 character limit.";
    }
    if (name === "CommentDoesNotExistException") {
      return "The comment you are replying to no longer exists.";
    }
    if (name === "CommentIdRequiredException") {
      return "Reply target comment ID is missing.";
    }
    if (name === "InvalidCommentIdException") {
      return "Invalid comment ID format.";
    }
  }

  // ... 既存の comment/approval エラーハンドリング ...

  // 以下変更なし
}
```

#### PullRequestDetail への Props 渡し

```tsx
case "detail":
  if (!prDetail) return null;
  return (
    <PullRequestDetail
      // ... 既存の Props すべて ...
      onPostReply={handlePostReply}                    // v0.5 追加
      isPostingReply={isPostingReply}                  // v0.5 追加
      replyError={replyError}                          // v0.5 追加
      onClearReplyError={() => setReplyError(null)}    // v0.5 追加
    />
  );
```

### 6. Help の変更

```typescript
<Text> c          Post comment (PR Detail)</Text>
<Text> C          Post inline comment (PR Detail)</Text>
<Text> R          Reply to comment (PR Detail)</Text>   // v0.5 追加
<Text> o          Toggle thread fold (PR Detail)</Text>  // v0.5 追加
<Text> a          Approve PR (PR Detail)</Text>
<Text> r          Revoke approval (PR Detail)</Text>
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
| `a` | PR を承認（確認プロンプト表示） | PR 詳細画面 |
| `r` | 承認を取り消し（確認プロンプト表示） | PR 詳細画面 |

## エラーハンドリング

### 返信投稿エラー

| エラー | 表示メッセージ |
|--------|---------------|
| `CommentContentRequiredException` | "Reply cannot be empty." |
| `CommentContentSizeLimitExceededException` | "Reply exceeds the 10,240 character limit." |
| `CommentDoesNotExistException` | "The comment you are replying to no longer exists." |
| `CommentIdRequiredException` | "Reply target comment ID is missing." |
| `InvalidCommentIdException` | "Invalid comment ID format." |
| `AccessDeniedException` / `UnauthorizedException` | "Access denied. Check your IAM policy." |
| その他 | エラーメッセージをそのまま表示 |

### エッジケースと対処方針

| ケース | 対処 |
|--------|------|
| コメント行以外（diff 行、header, separator）で `R` キー | `getReplyTargetFromLine` が `null` を返すため無視 |
| `fold-indicator` 行で `R` キー | `getReplyTargetFromLine` が `null` を返すため無視。`o` キーのみ有効 |
| コメント行以外で `o` キー | `threadIndex` が `undefined` のため無視 |
| 削除されたコメント（`deleted: true`）への返信 | `commentId` は有効なので API 呼び出しは成功する。CodeCommit は削除済みコメントへの返信を許可している |
| 返信先コメントが他のユーザーにより削除された | `CommentDoesNotExistException` が発生し、エラーメッセージを表示 |
| 返信入力中に `c` / `C` / `a` / `r` / `o` | `isReplying` チェックにより無効化 |
| 返信入力中に `j` / `k` | `isReplying` チェックにより無効化 |
| 一般コメント入力中に `R` | `isCommenting` チェックにより無効化 |
| インラインコメント入力中に `R` | `isInlineCommenting` チェックにより無効化 |
| 折りたたまれたスレッドへの返信追加後 | コメント再取得で `buildDisplayLines` が再計算。スレッドは折りたたまれたままだが、返信件数が更新される |
| 空のスレッド（comments が空配列） | `appendThreadLines` の先頭ガード節で早期 return |
| スレッド内コメントが 1 件（ルートのみ、返信なし）| 折りたたみ対象外。ルートコメントのみ表示 |
| 折りたたみしきい値ちょうど（4件）のスレッド | 折りたたみ対象。`[+3 replies]` と表示 |
| 折りたたみトグル後のカーソル位置 | `lines` 配列が再計算されるため行数が変わる。カーソルインデックスは維持するが、表示内容がずれる可能性がある。大きな問題にはならない |
| `commentId` が `undefined` のコメント | `getReplyTargetFromLine` が `null` を返すため `R` は無視される |
| 大量の返信（100件以上） | 折りたたみがデフォルトで適用されるため、表示は `[+100 replies]` にまとまる。展開時は全件表示だが、スクロールで対処可能 |
| コメントのページネーション（nextToken） | v0.4 以前から未対応。v0.8 で一括対応予定 |

## セキュリティ考慮

### IAM 権限

v0.5 で追加の IAM 権限が必要:

```json
{
  "Effect": "Allow",
  "Action": [
    "codecommit:PostCommentReply"
  ],
  "Resource": "arn:aws:codecommit:<region>:<account-id>:<repository-name>"
}
```

`PostCommentReply` は書き込み操作。権限不足の場合は `AccessDeniedException` がスローされ、エラーハンドリングテーブルに従いユーザーに案内する。

### 認証

既存の AWS SDK 標準認証チェーン（環境変数、`~/.aws/credentials`、`--profile` オプション）をそのまま使用する。返信投稿のために追加の認証フローは不要。

### 入力バリデーション

- **返信内容**: 既存の `CommentInput` がバリデーション（空文字チェック、trim）を担当。変更不要
- **`inReplyTo` パラメータ**: コード内部で `commentId` から取得した値のみを API に渡す。ユーザー入力から直接構築しないため、インジェクションリスクはない
- **返信先コメント**: `DisplayLine.commentId` は `GetCommentsForPullRequestCommand` のレスポンスから取得した値。改竄リスクはない

## 技術選定

### 新規依存パッケージ: なし

v0.5 では新規依存パッケージの追加は不要。`PostCommentReplyCommand` は既存の `@aws-sdk/client-codecommit` パッケージに含まれている。

### 返信先の特定方法: commentId から直接参照

| 選択肢 | 評価 |
|--------|------|
| **DisplayLine に commentId を付与（採用）** | カーソル行から返信先を直接特定。v0.7（編集・削除）でも `commentId` を再利用可能。データフローがシンプル |
| threadIndex + comments[0].commentId | 常にルートに返信するため、返信先が不正確（ユーザーが特定のコメントを選んでいるのに無視される）|
| 別途コメント選択 UI | 操作ステップが増え、UX が悪化 |

### 折りたたみの初期状態: しきい値ベースの自動折りたたみ

| 選択肢 | 評価 |
|--------|------|
| **4件以上で自動折りたたみ（採用）** | diff 表示が長くなりすぎるのを防ぐ。一般的なレビューでは 2-3 件の返信が多いため、しきい値 4 は実用的 |
| すべて展開（デフォルト） | 長いスレッドで diff が読みにくくなる。特にインラインコメントが多い場合に問題 |
| すべて折りたたみ（デフォルト） | コメントの内容が隠れてしまい、レビューの流れが把握しにくい |

### 折りたたみトグルキー: `o`

| 選択肢 | 評価 |
|--------|------|
| **`o` キー（採用）** | vim の `zo`（fold open）を連想させる。単一キーで直感的に操作可能 |
| `Tab` | ターミナルで Tab の動作は環境依存が大きい。Ink での Tab ハンドリングが不安定な場合がある |
| `Enter` | リスト画面での「選択」と混在し、意図しない操作になるリスク |
| `z` | vim の `za`（toggle fold）に近いが、今後のキーバインドとの衝突リスク |

### 返信コンテキスト表示: 先頭 40 文字 + 省略

| 選択肢 | 評価 |
|--------|------|
| **先頭 40 文字 + `...`（採用）** | 返信先を十分に識別できる長さ。ターミナル幅 80 文字の場合でも 1 行に収まる |
| 全文表示 | 長いコメントの場合に入力エリアが圧迫される |
| コメント ID のみ | ユーザーにとって無意味。どのコメントへの返信か分からない |

### 折りたたみ時の表示: ルート + 件数インジケーター

| 選択肢 | 評価 |
|--------|------|
| **ルートコメント + `[+N replies]`（採用）** | スレッドの文脈（何についての議論か）が分かりつつ、スペースを節約 |
| ルート + 最後の返信 + `[N more]` | 最後の返信の内容が常に有用とは限らない。表示行数が増える |
| 件数のみ（ルートも隠す） | スレッドの内容が全く分からず、展開の判断ができない |

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `postCommentReply` | `vi.fn()` で `client.send` をモック。正常系・異常系をテスト |
| `appendThreadLines` | ルートのみ、ルート+返信、折りたたみ、展開の各パターンをテスト |
| `getReplyTargetFromLine` | コメント行から返信ターゲットを正しく抽出するかテスト |
| `truncate` | 文字列省略の境界値テスト |
| `buildDisplayLines`（返信表示） | スレッド内の返信が正しいタイプとインデントで表示されるかテスト |
| `buildDisplayLines`（折りたたみ） | 折りたたみ/展開の切り替えで表示行が正しく変化するかテスト |
| `PullRequestDetail`（`R` キー） | コメント行で `R` → 返信入力表示、非コメント行で `R` → 無視をテスト |
| `PullRequestDetail`（`o` キー） | コメント行で `o` → 折りたたみトグル、非コメント行で `o` → 無視をテスト |
| `PullRequestDetail`（返信表示） | スレッドのインデント表示をスナップショットテスト |
| `App`（統合テスト） | 返信投稿→リロード→表示の一連の流れをテスト |

カバレッジ 95% 以上を維持する。

### 具体的なテストケース

#### サービス層

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `postCommentReply`: 正常に返信投稿 | `PostCommentReplyCommand` が `inReplyTo` と `content` 付きで呼ばれる |
| 2 | `postCommentReply`: API がエラーをスロー | エラーがそのまま上位に伝播する |
| 3 | `postCommentReply`: `CommentDoesNotExistException` | 返信先コメントが存在しないエラーが伝播する |

#### appendThreadLines

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | コメント 1 件（ルートのみ） | ルートコメントのみ追加。返信行・折りたたみなし |
| 2 | コメント 2 件（ルート + 1 返信） | ルート + `inline-reply` / `comment-reply` 行 |
| 3 | コメント 3 件（しきい値未満） | ルート + 2 件の返信行（展開状態） |
| 4 | コメント 4 件（しきい値以上）+ 折りたたみ | ルート + `fold-indicator` 行 |
| 5 | コメント 4 件 + 展開 | ルート + 3 件の返信行 |
| 6 | コメント 0 件（空配列） | 何も追加されない |
| 7 | インラインモード | `inline-comment` + `inline-reply` タイプで追加 |
| 8 | 一般モード | `comment` + `comment-reply` タイプで追加 |

#### getReplyTargetFromLine

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `inline-comment` 行（`commentId` あり） | `{ commentId, author, content }` が返る |
| 2 | `inline-reply` 行 | `{ commentId, author, content }` が返る |
| 3 | `comment` 行 | `{ commentId, author, content }` が返る |
| 4 | `comment-reply` 行 | `{ commentId, author, content }` が返る |
| 5 | `add` 行（diff 行） | `null` |
| 6 | `header` 行 | `null` |
| 7 | `fold-indicator` 行 | `null` |
| 8 | `commentId` が `undefined` | `null` |

#### truncate

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 40 文字未満の文字列 | そのまま返る |
| 2 | ちょうど 40 文字の文字列 | そのまま返る |
| 3 | 41 文字以上の文字列 | 先頭 40 文字 + `...` |
| 4 | 空文字列 | 空文字列 |

#### buildDisplayLines（返信表示）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | インラインスレッド: ルート + 2 返信 | `inline-comment` + 2 × `inline-reply` が diff 行直下に挿入 |
| 2 | 一般スレッド: ルート + 1 返信 | `comment` + `comment-reply` が Comments セクションに追加 |
| 3 | 混在: インライン + 一般、それぞれ返信あり | 各スレッドが正しい位置に正しいタイプで表示 |
| 4 | 折りたたみ: 4 件インラインスレッド | `inline-comment` + `fold-indicator` |
| 5 | 展開: 4 件インラインスレッド | `inline-comment` + 3 × `inline-reply` |
| 6 | 返信なしのスレッドは従来通り | v0.4 と同じ表示（後方互換） |

#### PullRequestDetail（コンポーネント）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | インラインコメントスレッドの返信表示 | `└` プレフィックス付きで返信が表示される |
| 2 | 一般コメントスレッドの返信表示 | `└` プレフィックス付きで返信が表示される |
| 3 | コメント行で `R` キー | 返信入力が「Replying to author: content」付きで表示される |
| 4 | diff 行で `R` キー | 何も起きない |
| 5 | `fold-indicator` 行で `R` キー | 何も起きない |
| 6 | 返信入力中に `j` / `k` | カーソルは移動しない |
| 7 | `isPostingReply` が true→false（エラーなし） | 入力モードが自動的に閉じる |
| 8 | `isPostingReply` が true→false（エラーあり） | 入力モードは閉じない |
| 9 | 4 件以上のスレッドが初期状態で折りたたまれている | `[+N replies]` が表示される |
| 10 | `o` キーで折りたたみを展開 | 返信が展開表示される |
| 11 | `o` キーで展開を折りたたみ | `[+N replies]` に戻る |
| 12 | diff 行で `o` キー | 何も起きない |
| 13 | フッターに `R reply  o fold` が表示 | ナビゲーションヒントが更新されている |
| 14 | 返信入力中に `c` / `C` / `a` / `r` | 無視される |
| 15 | 返信入力のコンテキスト表示で長いコメントが省略される | 40 文字 + `...` で表示 |

#### App（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 返信投稿成功 | `postCommentReply` が `inReplyTo` と `content` 付きで呼ばれ、コメントがリロードされる |
| 2 | 返信投稿失敗 | エラーメッセージが表示される |
| 3 | `CommentDoesNotExistException` | 「The comment you are replying to no longer exists.」が表示される |
| 4 | 返信投稿後のコメントリロード | `getComments` が呼ばれ、`commentThreads` が更新される |

#### Help

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | ヘルプ画面表示 | `R` と `o` のキーバインドが表示される |

## 実装順序

### Step 1: サービス層 — postCommentReply 追加

`src/services/codecommit.ts` に `postCommentReply` 関数と `PostCommentReplyCommand` の import を追加。テストを追加して通過を確認。

**この Step で変更するファイル**:
- `src/services/codecommit.ts`: `postCommentReply` 関数追加、import 追加
- `src/services/codecommit.test.ts`: `postCommentReply` のテスト追加

**この Step の完了条件**: `postCommentReply` のテストが通過。既存テストに影響なし。

### Step 2: Tidy — DisplayLine 拡張 + buildDisplayLines リファクタリング（構造的変更）

**Tidy First** の原則に従い、まず構造的変更のみを行う。機能的な振る舞いは変えない。

1. `DisplayLine` に `threadIndex`, `commentId` フィールドと新しいタイプ（`inline-reply`, `comment-reply`, `fold-indicator`）を追加
2. `findMatchingThreads` を `findMatchingThreadEntries` にリファクタリング（`threadIndex` を含むエントリを返すよう拡張）
3. `buildDisplayLines` のインラインコメント表示ロジックを `appendThreadLines` ヘルパーに抽出
4. `renderDiffLine` に新タイプのケースを追加（ただし、この時点ではまだ新タイプの DisplayLine は生成されない）
5. 既存コメント行に `threadIndex` と `commentId` を付与

**この Step で変更するファイル**:
- `src/components/PullRequestDetail.tsx`: `DisplayLine` 拡張、`findMatchingThreads` → `findMatchingThreadEntries` リネーム・拡張、`appendThreadLines` 抽出、`renderDiffLine` に新タイプ追加
- `src/components/PullRequestDetail.test.tsx`: リファクタリング後も既存テストが通過することを確認

**この Step の完了条件**: 既存テストがすべて通過。既存の表示に変化なし（構造的変更のみ）。

### Step 3: 返信表示（機能追加 — 読み取り側）

`appendThreadLines` で返信コメント（`inReplyTo` が設定されたコメント）を `inline-reply` / `comment-reply` タイプで表示する。

**この Step で変更するファイル**:
- `src/components/PullRequestDetail.tsx`: `appendThreadLines` に返信表示ロジックを追加
- `src/components/PullRequestDetail.test.tsx`: 返信表示テスト追加

**この Step の完了条件**: スレッド内の返信がインデント付きで表示されるテストが通過。

### Step 4: スレッド折りたたみ（機能追加）

`collapsedThreads` state を追加。`buildDisplayLines` に折りたたみ状態を渡す。`o` キーハンドラ追加。`fold-indicator` 表示。

**この Step で変更するファイル**:
- `src/components/PullRequestDetail.tsx`: `collapsedThreads` state、`o` キーハンドラ、`toggleThreadFold`、`buildDisplayLines` への引数追加
- `src/components/PullRequestDetail.test.tsx`: 折りたたみ/展開テスト追加

**この Step の完了条件**: 折りたたみ/展開が正しく動作するテストが通過。

### Step 5: 返信投稿（機能追加 — 書き込み側）

`R` キーハンドラ追加。`getReplyTargetFromLine` 実装。返信入力 UI。App に `handlePostReply` 追加。Props 追加。

**この Step で変更するファイル**:
- `src/components/PullRequestDetail.tsx`: `R` キーハンドラ、`getReplyTargetFromLine`、`replyTarget` state、返信入力 UI、Props 追加
- `src/components/PullRequestDetail.test.tsx`: `R` キーのテスト追加
- `src/app.tsx`: `handlePostReply` 追加、`formatReplyError` 追加、state 追加、Props 渡し
- `src/app.test.tsx`: 返信投稿の統合テスト追加

**この Step の完了条件**: 返信の投稿→リロード→表示の一連のフローがテストで通過。

### Step 6: Help 更新

`R` と `o` キーバインドを追加。

**この Step で変更するファイル**:
- `src/components/Help.tsx`: `R` / `o` キーバインドの行追加
- `src/components/Help.test.tsx`: テスト更新

### Step 7: 全体テスト・カバレッジ確認

```bash
bun run ci
```

カバレッジ 95% 以上を確認。

### Step 8: ドキュメント更新

要件定義書（`docs/requirements.md`）と README（`README.md`）を更新。
