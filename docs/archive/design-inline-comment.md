# インラインコメント機能 設計書

## 実装ステータス

> **✅ 実装完了** (2026-02-14)
>
> diff 行へのインラインコメント投稿・表示、カーソルモデル、CommentThread データモデルをすべて実装。263テスト通過、ブランチカバレッジ96.48%。

## 概要

diff の特定の行にコメントを付け、精密なコードレビューを可能にする。v0.2 の一般コメント（PR 全体へのコメント）を拡張し、ファイル・行単位のインラインコメントに対応する。

## スコープ

### 今回やること

- diff 表示中のカーソル行へのインラインコメント投稿（`C` キー）
- diff の該当行の直下にインラインコメントをインライン表示
- 同一行への複数コメントをスレッド形式で表示
- diff 行へのカーソルナビゲーション（行単位の選択）

### 今回やらないこと

- コメント返信の投稿（`inReplyTo` パラメータの使用）→ v0.5
- スレッドの折りたたみ/展開 → v0.5
- コメント編集・削除 → v0.7

## AWS SDK API

### PostCommentForPullRequestCommand（既存 API の location パラメータ追加）

v0.2 で使用済みの `PostCommentForPullRequestCommand` に `location` パラメータを追加してインラインコメントを実現する。新しい API コールは不要。

```typescript
// Input（location パラメータを追加）
{
  pullRequestId: string;
  repositoryName: string;
  beforeCommitId: string;
  afterCommitId: string;
  content: string;
  location: {                                     // v0.4 追加
    filePath: string;                             // 対象ファイルパス
    filePosition: number;                         // 行番号（1-based）
    relativeFileVersion: "BEFORE" | "AFTER";      // 変更前/後
  };
}
```

**location パラメータの意味**:

| フィールド | 説明 |
|-----------|------|
| `filePath` | コメント対象のファイルパス（例: `src/auth.ts`） |
| `filePosition` | ファイル内の行番号（1-based） |
| `relativeFileVersion` | `"BEFORE"` = 変更前ファイル（destination ブランチ）、`"AFTER"` = 変更後ファイル（source ブランチ） |

**diff 行種別と location の対応**:

| diff 行の種別 | relativeFileVersion | filePosition |
|--------------|---------------------|-------------|
| 削除行（`-`） | `"BEFORE"` | beforeLineNumber |
| 追加行（`+`） | `"AFTER"` | afterLineNumber |
| コンテキスト行（` `） | `"AFTER"` | afterLineNumber |

コンテキスト行は BEFORE/AFTER どちらも有効だが、`"AFTER"` を統一的に使用する。変更後のコードに対するコメントという意味で直感的。

### GetCommentsForPullRequestCommand（既存、レスポンス構造の活用）

既存の API レスポンスには `CommentsForPullRequestData.location` フィールドが含まれているが、v0.3 まではフラット化して無視していた。v0.4 ではスレッド構造と location 情報を保持する。

```typescript
// CommentsForPullRequestData（AWS SDK 型、既存）
interface CommentsForPullRequestData {
  pullRequestId?: string;
  repositoryName?: string;
  beforeCommitId?: string;
  afterCommitId?: string;
  beforeBlobId?: string;
  afterBlobId?: string;
  location?: Location;       // ← v0.4 で活用
  comments?: Comment[];      // スレッド内のコメント群
}
```

## データモデル変更

### CommentThread 型（新規）

AWS SDK の `CommentsForPullRequestData` から必要な情報を抽出した簡潔な内部型を定義する。

```typescript
// src/services/codecommit.ts に追加
export interface CommentThread {
  location: {
    filePath: string;
    filePosition: number;
    relativeFileVersion: "BEFORE" | "AFTER";
  } | null;                    // null = 一般コメント（location なし）
  comments: Comment[];         // スレッド内のコメント（時系列順）
}
```

**一般コメントとインラインコメントの区別**:

| 種類 | `location` | 表示位置 |
|------|-----------|---------|
| 一般コメント | `null` | 画面下部の Comments セクション（従来通り） |
| インラインコメント | `{ filePath, filePosition, relativeFileVersion }` | diff の該当行の直下 |

### 既存データフローの変更

**Before（v0.3）**:
```
getPullRequestDetail → { comments: Comment[] }
                                    ↓ フラット化
PullRequestDetail(comments: Comment[])
                                    ↓
buildDisplayLines → 画面下部に一括表示
```

**After（v0.4）**:
```
getPullRequestDetail → { commentThreads: CommentThread[] }
                                    ↓ スレッド構造を保持
PullRequestDetail(commentThreads: CommentThread[])
                                    ↓
buildDisplayLines → インラインコメント: diff 行の直下
                  → 一般コメント: 画面下部
```

## 画面設計

### PR 詳細画面（カーソル付き diff 表示）

カーソル（`>`）が diff 行上を移動する。インラインコメントは該当行の直下に表示。

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
│     💬 watany: 次のPRで対応します             │
│   +   timeout: 10000,                        │
│     };                                       │
│                                              │
│──────────────────────────────────────────────│
│  Comments (1):                               │
│  hanako: LGTMです                            │
│                                              │
│  ↑↓ cursor  c comment  C inline  a approve   │
│  r revoke  q back  ? help                    │
└──────────────────────────────────────────────┘
```

**表示の規則**:

| 要素 | 表示 |
|------|------|
| カーソル行 | 行頭に `>` マーカー、テキストを bold 表示 |
| 非カーソル行 | 行頭に空白（`  `） |
| インラインコメント | `  💬 author: content` 形式で diff 行の直下に挿入 |
| 一般コメント | 従来通り画面下部の Comments セクション |

### インラインコメント入力モード

`C` キー押下でコメント入力モードに遷移。既存の `CommentInput` コンポーネントを再利用する。

```
│ > -   timeout: 3000,                         │
│──────────────────────────────────────────────│
│  Inline comment on src/auth.ts:16            │
│  New Comment:                                │
│  > _                                         │
│  Enter submit  Esc cancel                    │
└──────────────────────────────────────────────┘
```

コメント対象のファイルパスと行番号を表示し、どの行にコメントしているか明確にする。

### インラインコメント投稿成功後

投稿成功後はコメント入力モードを閉じ、コメントスレッドを再取得して diff 表示を更新。投稿したコメントが該当行の直下にインライン表示される。

### エラー時

既存の `CommentInput` のエラーハンドリングをそのまま使用。エラー表示後に任意キーで入力モードに復帰する（v0.2 と同じパターン）。

### `C` キーが無効な行

カーソルが diff 行（add/delete/context）以外にある場合（header, separator, comment-header, comment, inline-comment）、`C` キーは無視される。

## データフロー

```
App (状態管理)
 │
 ├─ commentThreads: CommentThread[]     // v0.4: フラットからスレッドに変更
 │
 └─→ PullRequestDetail (表示 + カーソル管理)
      │
      ├─ cursorIndex: number                // v0.4: diff 行カーソル位置
      ├─ isInlineCommenting: boolean        // v0.4: インライン入力モード
      ├─ inlineCommentLocation: {...} | null // v0.4: 投稿先の location 情報
      │
      ├─ Props から受け取る (v0.4 変更/追加):
      │   ├─ commentThreads ──→ buildDisplayLines で inline/general 分離
      │   ├─ onPostInlineComment(content, location) ──→ App.handlePostInlineComment()
      │   ├─ isPostingInlineComment ──→ ローディング表示
      │   └─ inlineCommentError ──→ エラー表示
      │
      └─→ CommentInput (既存コンポーネント再利用)
           │
           └─ インラインコメント投稿時も同じ UI を使用
```

### インラインコメント投稿シーケンス

```
ユーザー          PullRequestDetail   CommentInput      App              CodeCommit API
  │                    │                   │            │                    │
  │─── j/k キー ──────→│                   │            │                    │
  │                    │── cursorIndex     │            │                    │
  │                    │   更新            │            │                    │
  │                    │── スクロール追従  │            │                    │
  │                    │                   │            │                    │
  │─── C キー ────────→│                   │            │                    │
  │                    │── カーソル行の    │            │                    │
  │                    │   location 取得   │            │                    │
  │                    │── isInlineComm.  │            │                    │
  │                    │   = true          │            │                    │
  │                    │── render ─────────→│            │                    │
  │                    │                   │「Inline    │                    │
  │                    │                   │ comment on │                    │
  │                    │                   │ file:line」│                    │
  │                    │                   │            │                    │
  │─── テキスト入力 ──→│                   │            │                    │
  │─── Enter ─────────→│                   │            │                    │
  │                    │← onSubmit() ─────│            │                    │
  │                    │── onPostInline   │            │                    │
  │                    │   Comment() ──────────────────→│                    │
  │                    │                   │            │── isPostingInline  │
  │                    │                   │            │   = true           │
  │                    │                   │← isPosting │                    │
  │                    │                   │  =true     │                    │
  │                    │                   │「Posting   │── postComment()    │
  │                    │                   │ ...」表示  │   (with location)  │
  │                    │                   │            │───────────────────→│
  │                    │                   │            │←── success ────────│
  │                    │                   │            │── reloadComments() │
  │                    │                   │            │── isPostingInline  │
  │                    │                   │            │   = false          │
  │                    │── useEffect発火 ──│            │                    │
  │                    │   isInlineComm.   │            │                    │
  │                    │   = false         │            │                    │
  │                    │← diff 更新       │            │                    │
  │                    │  (inline comment  │            │                    │
  │                    │   が表示される)    │            │                    │
```

## コンポーネント設計

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/services/codecommit.ts` | `CommentThread` 型を追加。`getPullRequestDetail` / `getComments` の返却型をスレッド構造に変更。`postComment` に `location` パラメータを追加 |
| `src/services/codecommit.test.ts` | スレッド構造の返却テスト追加。`postComment` の location パラメータテスト追加 |
| `src/components/PullRequestDetail.tsx` | Props 変更（`commentThreads`）。カーソルモデル追加。インラインコメント表示。`C` キーハンドラ。`buildDisplayLines` の大幅変更 |
| `src/components/PullRequestDetail.test.tsx` | カーソルナビゲーション、インラインコメント表示、`C` キーのテスト追加 |
| `src/app.tsx` | `commentThreads` への移行。`handlePostInlineComment` ハンドラ追加。`reloadComments` のスレッド対応 |
| `src/app.test.tsx` | インラインコメント投稿フローの統合テスト追加 |
| `src/components/Help.tsx` | `C` キーバインドの追加 |
| `src/components/Help.test.tsx` | ヘルプ表示テスト更新 |

### 1. サービス層の変更

#### CommentThread 型（新規）

```typescript
// src/services/codecommit.ts に追加
export interface CommentThread {
  location: {
    filePath: string;
    filePosition: number;
    relativeFileVersion: "BEFORE" | "AFTER";
  } | null;
  comments: Comment[];
}
```

#### getPullRequestDetail の変更

```typescript
export interface PullRequestDetail {
  pullRequest: PullRequest;
  differences: Difference[];
  commentThreads: CommentThread[];  // v0.4: Comment[] → CommentThread[]
}

export async function getPullRequestDetail(
  client: CodeCommitClient,
  pullRequestId: string,
  repositoryName: string,
): Promise<PullRequestDetail> {
  // ... 既存の PR 取得・diff 取得処理 ...

  // v0.4: スレッド構造を保持してコメントを取得
  const commentThreads: CommentThread[] = [];
  const commentsCommand = new GetCommentsForPullRequestCommand({
    pullRequestId,
    repositoryName,
  });
  const commentsResponse = await client.send(commentsCommand);
  for (const thread of commentsResponse.commentsForPullRequestData ?? []) {
    const location = thread.location?.filePath
      ? {
          filePath: thread.location.filePath,
          filePosition: thread.location.filePosition ?? 0,
          relativeFileVersion:
            (thread.location.relativeFileVersion as "BEFORE" | "AFTER") ?? "AFTER",
        }
      : null;
    commentThreads.push({
      location,
      comments: thread.comments ?? [],
    });
  }

  return { pullRequest, differences, commentThreads };
}
```

**判定ロジック**: `thread.location?.filePath` が存在する場合はインラインコメント、存在しない場合は一般コメントとして `location: null` とする。`filePath` がインラインコメントの必須条件であるため、これを判定基準にする。

#### getComments の変更

```typescript
export async function getComments(
  client: CodeCommitClient,
  pullRequestId: string,
  repositoryName: string,
): Promise<CommentThread[]> {  // v0.4: Comment[] → CommentThread[]
  const commentThreads: CommentThread[] = [];
  const commentsCommand = new GetCommentsForPullRequestCommand({
    pullRequestId,
    repositoryName,
  });
  const commentsResponse = await client.send(commentsCommand);
  for (const thread of commentsResponse.commentsForPullRequestData ?? []) {
    const location = thread.location?.filePath
      ? {
          filePath: thread.location.filePath,
          filePosition: thread.location.filePosition ?? 0,
          relativeFileVersion:
            (thread.location.relativeFileVersion as "BEFORE" | "AFTER") ?? "AFTER",
        }
      : null;
    commentThreads.push({
      location,
      comments: thread.comments ?? [],
    });
  }
  return commentThreads;
}
```

#### postComment の変更

```typescript
export async function postComment(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    repositoryName: string;
    beforeCommitId: string;
    afterCommitId: string;
    content: string;
    location?: {                              // v0.4 追加: optional
      filePath: string;
      filePosition: number;
      relativeFileVersion: "BEFORE" | "AFTER";
    };
  },
): Promise<Comment> {
  const command = new PostCommentForPullRequestCommand({
    pullRequestId: params.pullRequestId,
    repositoryName: params.repositoryName,
    beforeCommitId: params.beforeCommitId,
    afterCommitId: params.afterCommitId,
    content: params.content,
    location: params.location                 // v0.4 追加
      ? {
          filePath: params.location.filePath,
          filePosition: params.location.filePosition,
          relativeFileVersion: params.location.relativeFileVersion,
        }
      : undefined,
  });
  const response = await client.send(command);
  return response.comment!;
}
```

既存の一般コメント投稿は `location` を渡さないため後方互換。

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
    | "inline-comment";          // v0.4 追加
  text: string;
  // v0.4 追加: diff 行のメタデータ
  filePath?: string;
  beforeLineNumber?: number;     // BEFORE ファイルでの行番号（1-based）
  afterLineNumber?: number;      // AFTER ファイルでの行番号（1-based）
}
```

**メタデータの用途**:

1. **インラインコメントの位置マッチング**: `filePath` + `filePosition` + `relativeFileVersion` でスレッドを diff 行に紐付ける
2. **インラインコメント投稿時の location 決定**: カーソル行のメタデータから location パラメータを構築

### 3. computeSimpleDiff の変更

行番号トラッキングを追加する。

```typescript
function computeSimpleDiff(beforeLines: string[], afterLines: string[]): DisplayLine[] {
  const result: DisplayLine[] = [];
  let bi = 0; // before 行インデックス（0-based）
  let ai = 0; // after 行インデックス（0-based）

  while (bi < beforeLines.length || ai < afterLines.length) {
    const beforeLine = beforeLines[bi];
    const afterLine = afterLines[ai];

    if (bi < beforeLines.length && ai < afterLines.length && beforeLine === afterLine) {
      result.push({
        type: "context",
        text: ` ${beforeLine}`,
        beforeLineNumber: bi + 1,  // v0.4: 1-based
        afterLineNumber: ai + 1,   // v0.4: 1-based
      });
      bi++;
      ai++;
    } else {
      // 削除行
      while (...既存の条件...) {
        result.push({
          type: "delete",
          text: `-${bl}`,
          beforeLineNumber: bi + 1,  // v0.4
        });
        bi++;
      }

      // 追加行
      while (...既存の条件...) {
        result.push({
          type: "add",
          text: `+${al}`,
          afterLineNumber: ai + 1,   // v0.4
        });
        ai++;
      }
    }
  }

  return result;
}
```

### 4. buildDisplayLines の変更

インラインコメントを diff 行の直下に挿入する。

```typescript
function buildDisplayLines(
  differences: Difference[],
  diffTexts: Map<string, { before: string; after: string }>,
  commentThreads: CommentThread[],  // v0.4: Comment[] → CommentThread[]
): DisplayLine[] {
  const lines: DisplayLine[] = [];

  // インラインコメントをファイルパス・行番号・バージョンでインデックス化
  const inlineThreadsByKey = new Map<string, CommentThread[]>();
  for (const thread of commentThreads) {
    if (thread.location) {
      const key = `${thread.location.filePath}:${thread.location.filePosition}:${thread.location.relativeFileVersion}`;
      const existing = inlineThreadsByKey.get(key) ?? [];
      existing.push(thread);
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
        // filePath をメタデータに設定
        dl.filePath = filePath;
        lines.push(dl);

        // v0.4: この diff 行に対応するインラインコメントを挿入
        const matchingThreads = findMatchingThreads(
          inlineThreadsByKey, filePath, dl
        );
        for (const thread of matchingThreads) {
          for (const comment of thread.comments) {
            const author = extractAuthorName(comment.authorArn ?? "unknown");
            const content = comment.content ?? "";
            lines.push({
              type: "inline-comment",
              text: `💬 ${author}: ${content}`,
            });
          }
        }
      }
    }

    lines.push({ type: "separator", text: "" });
  }

  // 一般コメント（location なし）は従来通り画面下部に表示
  const generalComments = commentThreads
    .filter((t) => t.location === null)
    .flatMap((t) => t.comments);

  if (generalComments.length > 0) {
    lines.push({ type: "separator", text: "─".repeat(50) });
    lines.push({ type: "comment-header", text: `Comments (${generalComments.length}):` });
    for (const comment of generalComments) {
      const author = extractAuthorName(comment.authorArn ?? "unknown");
      const content = comment.content ?? "";
      lines.push({ type: "comment", text: `${author}: ${content}` });
    }
  }

  return lines;
}
```

#### findMatchingThreads

diff 行のメタデータからインラインコメントスレッドを検索する。

```typescript
function findMatchingThreads(
  threadsByKey: Map<string, CommentThread[]>,
  filePath: string,
  line: DisplayLine,
): CommentThread[] {
  const results: CommentThread[] = [];

  // 削除行: BEFORE で検索
  if (line.type === "delete" && line.beforeLineNumber) {
    const key = `${filePath}:${line.beforeLineNumber}:BEFORE`;
    results.push(...(threadsByKey.get(key) ?? []));
  }

  // 追加行: AFTER で検索
  if (line.type === "add" && line.afterLineNumber) {
    const key = `${filePath}:${line.afterLineNumber}:AFTER`;
    results.push(...(threadsByKey.get(key) ?? []));
  }

  // コンテキスト行: BEFORE と AFTER 両方で検索
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

### 5. PullRequestDetail の変更

#### Props の変更

```typescript
interface Props {
  pullRequest: PullRequest;
  differences: Difference[];
  commentThreads: CommentThread[];           // v0.4: comments → commentThreads
  diffTexts: Map<string, { before: string; after: string }>;
  onBack: () => void;
  onHelp: () => void;
  onPostComment: (content: string) => void;
  isPostingComment: boolean;
  commentError: string | null;
  onClearCommentError: () => void;
  onPostInlineComment: (                     // v0.4 追加
    content: string,
    location: {
      filePath: string;
      filePosition: number;
      relativeFileVersion: "BEFORE" | "AFTER";
    },
  ) => void;
  isPostingInlineComment: boolean;           // v0.4 追加
  inlineCommentError: string | null;         // v0.4 追加
  onClearInlineCommentError: () => void;     // v0.4 追加
  approvals: Approval[];
  approvalEvaluation: Evaluation | null;
  onApprove: () => void;
  onRevoke: () => void;
  isApproving: boolean;
  approvalError: string | null;
  onClearApprovalError: () => void;
}
```

#### import の変更

```typescript
// 既存の import に useMemo を追加
import React, { useEffect, useMemo, useState } from "react";
// CommentThread 型を追加
import type { CommentThread } from "../services/codecommit.js";
```

#### 状態管理の追加

```typescript
const [cursorIndex, setCursorIndex] = useState(0);                // v0.4: カーソル位置
const [isInlineCommenting, setIsInlineCommenting] = useState(false); // v0.4: インライン入力モード
const [inlineCommentLocation, setInlineCommentLocation] = useState<{
  filePath: string;
  filePosition: number;
  relativeFileVersion: "BEFORE" | "AFTER";
} | null>(null);
const [wasPostingInline, setWasPostingInline] = useState(false);  // v0.4: 投稿完了検知
```

#### カーソルモデル

```typescript
// スクロールオフセットはカーソル位置から自動計算
const scrollOffset = useMemo(() => {
  const halfVisible = Math.floor(visibleLineCount / 2);
  const maxOffset = Math.max(0, lines.length - visibleLineCount);
  const idealOffset = cursorIndex - halfVisible;
  return Math.max(0, Math.min(idealOffset, maxOffset));
}, [cursorIndex, lines.length, visibleLineCount]);
```

カーソルを画面中央付近に保ち、端に到達するまでスクロールしない（vim の `scrolloff` 相当）。

**visibleLineCount の調整**:

```typescript
const visibleLineCount = isCommenting || isInlineCommenting || approvalAction ? 20 : 30;
```

インラインコメント入力中は `CommentInput` が表示領域を占有するため、diff の表示行数を削減する。

#### useInput の変更

```typescript
useInput((input, key) => {
  if (isCommenting || isInlineCommenting || approvalAction) return;

  if (input === "q" || key.escape) {
    onBack();
    return;
  }
  if (input === "?") {
    onHelp();
    return;
  }
  if (input === "j" || key.downArrow) {
    setCursorIndex((prev) => Math.min(prev + 1, lines.length - 1));
    return;
  }
  if (input === "k" || key.upArrow) {
    setCursorIndex((prev) => Math.max(prev - 1, 0));
    return;
  }
  if (input === "c") {
    setIsCommenting(true);
    return;
  }
  if (input === "C") {                                   // v0.4 追加
    const currentLine = lines[cursorIndex];
    if (!currentLine) return;
    const location = getLocationFromLine(currentLine);
    if (!location) return;  // コメント不可な行では無視
    setInlineCommentLocation(location);
    setIsInlineCommenting(true);
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
});
```

#### getLocationFromLine ヘルパー

```typescript
function getLocationFromLine(line: DisplayLine): {
  filePath: string;
  filePosition: number;
  relativeFileVersion: "BEFORE" | "AFTER";
} | null {
  if (!line.filePath) return null;

  if (line.type === "delete" && line.beforeLineNumber) {
    return {
      filePath: line.filePath,
      filePosition: line.beforeLineNumber,
      relativeFileVersion: "BEFORE",
    };
  }
  if (line.type === "add" && line.afterLineNumber) {
    return {
      filePath: line.filePath,
      filePosition: line.afterLineNumber,
      relativeFileVersion: "AFTER",
    };
  }
  if (line.type === "context" && line.afterLineNumber) {
    return {
      filePath: line.filePath,
      filePosition: line.afterLineNumber,
      relativeFileVersion: "AFTER",
    };
  }

  return null;  // header, separator, comment 等はコメント不可
}
```

#### useEffect（投稿完了検知）

```typescript
// v0.4: インラインコメント投稿完了で入力モードを閉じる
useEffect(() => {
  if (isPostingInlineComment) {
    setWasPostingInline(true);
  } else if (wasPostingInline && !inlineCommentError) {
    setIsInlineCommenting(false);
    setInlineCommentLocation(null);
    setWasPostingInline(false);
  } else {
    setWasPostingInline(false);
  }
}, [isPostingInlineComment, inlineCommentError]);
```

#### レンダリングの変更

**カーソル表示**:

```tsx
<Box flexDirection="column">
  {visibleLines.map((line, index) => {
    const globalIndex = scrollOffset + index;
    const isCursor = globalIndex === cursorIndex;
    return (
      <Box key={globalIndex}>
        <Text>{isCursor ? "> " : "  "}</Text>
        {renderDiffLine(line, isCursor)}
      </Box>
    );
  })}
</Box>
```

**renderDiffLine の変更**:

```typescript
function renderDiffLine(line: DisplayLine, isCursor?: boolean): React.ReactNode {
  const bold = isCursor ?? false;
  switch (line.type) {
    case "header":
      return <Text bold color="yellow">{line.text}</Text>;
    case "separator":
      return <Text dimColor>{line.text}</Text>;
    case "add":
      return <Text color="green" bold={bold}>{line.text}</Text>;
    case "delete":
      return <Text color="red" bold={bold}>{line.text}</Text>;
    case "context":
      return <Text bold={bold}>{line.text}</Text>;
    case "comment-header":
      return <Text bold>{line.text}</Text>;
    case "comment":
      return <Text> {line.text}</Text>;
    case "inline-comment":                                  // v0.4 追加
      return <Text color="magenta">  {line.text}</Text>;
  }
}
```

`bold` パラメータはカーソル行のハイライトに使用する。diff 行（add/delete/context）のみカーソル時に bold を適用し、ヘッダーやコメント行では無視する。

**インラインコメント入力**:

```tsx
{isInlineCommenting && inlineCommentLocation && (
  <Box flexDirection="column">
    <Text dimColor>
      Inline comment on {inlineCommentLocation.filePath}:
      {inlineCommentLocation.filePosition}
    </Text>
    <CommentInput
      onSubmit={(content) => onPostInlineComment(content, inlineCommentLocation)}
      onCancel={() => {
        setIsInlineCommenting(false);
        setInlineCommentLocation(null);
      }}
      isPosting={isPostingInlineComment}
      error={inlineCommentError}
      onClearError={onClearInlineCommentError}
    />
  </Box>
)}
```

**フッターの変更**:

```tsx
<Box marginTop={1}>
  <Text dimColor>
    {isCommenting || isInlineCommenting || approvalAction
      ? ""
      : "↑↓ cursor  c comment  C inline  a approve  r revoke  q back  ? help"}
  </Text>
</Box>
```

### 6. App の変更

#### import の変更

```typescript
// 既存の codecommit.js import に CommentThread を追加
import {
  // ... 既存の import ...
  type CommentThread,           // v0.4 追加
} from "./services/codecommit.js";
```

`@aws-sdk/client-codecommit` からの `Comment` import は引き続き必要（`CommentThread.comments` の型として使用）。

#### state の変更

```typescript
// v0.4: Comment[] → CommentThread[]
const [commentThreads, setCommentThreads] = useState<CommentThread[]>([]);

// v0.4: インラインコメント投稿状態
const [isPostingInlineComment, setIsPostingInlineComment] = useState(false);
const [inlineCommentError, setInlineCommentError] = useState<string | null>(null);
```

#### loadPullRequestDetail の変更

```typescript
async function loadPullRequestDetail(pullRequestId: string) {
  await withLoadingState(async () => {
    const detail = await getPullRequestDetail(client, pullRequestId, selectedRepo);
    setPrDetail(detail.pullRequest);
    setPrDifferences(detail.differences);
    setCommentThreads(detail.commentThreads);  // v0.4: setPrComments → setCommentThreads
    // ... 既存の承認状態取得・blob 取得 ...
  });
}
```

#### handlePostInlineComment（新規）

```typescript
async function handlePostInlineComment(
  content: string,
  location: {
    filePath: string;
    filePosition: number;
    relativeFileVersion: "BEFORE" | "AFTER";
  },
) {
  if (!prDetail) return;
  const target = prDetail.pullRequestTargets?.[0];
  if (!target?.destinationCommit || !target?.sourceCommit) return;

  setIsPostingInlineComment(true);
  setInlineCommentError(null);
  try {
    await postComment(client, {
      pullRequestId: prDetail.pullRequestId!,
      repositoryName: selectedRepo,
      beforeCommitId: target.destinationCommit,
      afterCommitId: target.sourceCommit,
      content,
      location,
    });
    await reloadComments(prDetail.pullRequestId!);
  } catch (err) {
    setInlineCommentError(formatCommentError(err));
  } finally {
    setIsPostingInlineComment(false);
  }
}
```

一般コメントのエラーフォーマッタ（`formatCommentError`）をインラインコメントでも共用する。同じ API を使用しているため、発生するエラーの種類は同一。

#### reloadComments の変更

```typescript
async function reloadComments(pullRequestId: string) {
  const threads = await getComments(client, pullRequestId, selectedRepo);
  setCommentThreads(threads);  // v0.4: setPrComments → setCommentThreads
}
```

#### PullRequestDetail への Props 渡し

```tsx
case "detail":
  if (!prDetail) return null;
  return (
    <PullRequestDetail
      pullRequest={prDetail}
      differences={prDifferences}
      commentThreads={commentThreads}            // v0.4: comments → commentThreads
      diffTexts={diffTexts}
      onBack={handleBack}
      onHelp={() => setShowHelp(true)}
      onPostComment={handlePostComment}
      isPostingComment={isPostingComment}
      commentError={commentError}
      onClearCommentError={() => setCommentError(null)}
      onPostInlineComment={handlePostInlineComment}         // v0.4 追加
      isPostingInlineComment={isPostingInlineComment}       // v0.4 追加
      inlineCommentError={inlineCommentError}               // v0.4 追加
      onClearInlineCommentError={() => setInlineCommentError(null)}  // v0.4 追加
      approvals={approvals}
      approvalEvaluation={approvalEvaluation}
      onApprove={handleApprove}
      onRevoke={handleRevoke}
      isApproving={isApproving}
      approvalError={approvalError}
      onClearApprovalError={() => setApprovalError(null)}
    />
  );
```

### 7. Help の変更

```typescript
<Text> c          Post comment (PR Detail)</Text>
<Text> C          Inline comment at cursor (PR Detail)</Text>   // v0.4 追加
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
| `a` | PR を承認（確認プロンプト表示） | PR 詳細画面 |
| `r` | 承認を取り消し（確認プロンプト表示） | PR 詳細画面 |

## エラーハンドリング

### インラインコメント投稿エラー

一般コメントと同じ `PostCommentForPullRequestCommand` を使用するため、エラーの種類は v0.2 と同一。`formatCommentError` を共用する。

| エラー | 表示メッセージ |
|--------|---------------|
| `CommentContentRequiredException` | "Comment cannot be empty." |
| `CommentContentSizeLimitExceededException` | "Comment exceeds the 10,240 character limit." |
| `PullRequestDoesNotExistException` | "Pull request not found." |
| `AccessDeniedException` / `UnauthorizedException` | "Access denied. Check your IAM policy allows CodeCommit write access." |
| その他 | エラーメッセージをそのまま表示 |

### エッジケースと対処方針

| ケース | 対処 |
|--------|------|
| diff 行以外（header, separator, comment 等）で `C` キー | `getLocationFromLine` が `null` を返すため無視。何も起きない |
| `filePath` が取得できない diff 行 | `getLocationFromLine` が `null` を返すため無視 |
| 同一行に複数スレッド | すべてのスレッドのコメントを順番に表示 |
| 新規ファイル追加（beforeBlob なし） | 削除行がないため問題なし。追加行は afterLineNumber で正常に機能 |
| ファイル削除（afterBlob なし） | 追加行がないため問題なし。削除行は beforeLineNumber で正常に機能 |
| コメント入力中に j/k | `isInlineCommenting` チェックにより無効化 |
| インラインコメント入力中に `c` / `a` / `r` | `isInlineCommenting` チェックにより無効化 |
| 一般コメント入力中に `C` | `isCommenting` チェックにより無効化 |
| カーソルが表示行数を超える位置 | `setCursorIndex` の `Math.min` でクランプ |
| 行数 0 の diff | カーソルは 0 に固定。操作は無視される |
| インラインコメントの投稿後にカーソル位置がずれる | コメント再取得で `buildDisplayLines` が再計算。カーソルインデックスは維持するが、行数が変わるため位置がずれる可能性あり。大きな問題にはならない |
| diff に含まれないファイルへのインラインコメント | diff 対象外のファイルにはコメントを表示する場所がない。このケースでは `findMatchingThreads` のマッチ対象が存在せず、コメントは非表示になる。CodeCommit Web コンソールとの差異として許容する（v0.4 スコープ外） |
| 大量のインラインコメント | 各 diff 行の直下にコメントを挿入するため、コメント数が多いと `lines` 配列が大幅に増加する。Ink の仮想レンダリングと `visibleLineCount` によるスライスで表示パフォーマンスは維持される。メモリ上のリスト構築コストは O(diff行数 + コメント数) で実用上問題ない |
| コメントのページネーション（nextToken） | `GetCommentsForPullRequestCommand` にはページネーション（`nextToken`）が存在するが、v0.3 以前から未対応。v0.4 でも対応しない（v0.8 のページネーション改善で一括対応予定）。通常の PR では全コメントが 1 ページに収まる |

## セキュリティ考慮

### IAM 権限

v0.4 で追加の IAM 権限は不要。既存の `PostCommentForPullRequest` 権限で `location` 付きのコメントも投稿可能。

### 認証

既存の AWS SDK 標準認証チェーン（環境変数、`~/.aws/credentials`、`--profile` オプション）をそのまま使用する。インラインコメント投稿のために追加の認証フローは不要。一般コメント投稿と同一の認証コンテキストで `PostCommentForPullRequestCommand` を実行する。

### 入力バリデーション

- **コメント内容**: 既存の `CommentInput` がバリデーション（空文字チェック、trim）を担当。変更不要
- **location パラメータ**: コード内部で算出した値のみを API に渡す。ユーザー入力から直接構築しないため、インジェクションリスクはない
- **filePosition**: `computeSimpleDiff` が算出した行番号（1-based 正整数）のみ使用

## 技術選定

### 新規依存パッケージ: なし

v0.4 では新規依存パッケージの追加は不要。インラインコメントの投稿には既存の `PostCommentForPullRequestCommand` の `location` パラメータを使うだけであり、表示は既存の Ink/React コンポーネントで実現可能。

### カーソルモデル: scrollOffset からの自動計算方式

| 選択肢 | 評価 |
|--------|------|
| **cursorIndex + 自動スクロール（採用）** | vim 風のカーソルモデル。cursorIndex が主、scrollOffset は cursorIndex から計算。直感的で、既存の j/k 操作と自然に統合。`scrolloff` 的な余白制御も容易 |
| scrollOffset + viewport 内カーソル | スクロールとカーソルが分離して制御が複雑化。端の挙動が非直感的 |
| scrollOffset のみ（カーソルなし、行選択は別モード） | `C` キーで「カーソルモード」に入る必要があり、操作ステップが増える。UX が悪化 |

**j/k の振る舞い変更について**: v0.3 では j/k はスクロールのみだったが、v0.4 ではカーソル移動になる。スクロールはカーソルに追従する形になるため、実質的にユーザー体験は大きく変わらない（カーソルが常に画面内にあるためスクロールも自然に発生する）。カーソル表示（`>` マーカー）が追加される点のみが視覚的な変化。

### インラインコメント入力: CommentInput の再利用

| 選択肢 | 評価 |
|--------|------|
| **CommentInput 再利用（採用）** | 一般コメントとインラインコメントのテキスト入力 UI は同一。`onSubmit` のコールバックで区別する。コード重複を避けられる |
| 専用 InlineCommentInput コンポーネント | テキスト入力部分が完全に重複。不必要な抽象化 |

### コメントデータモデル: スレッド構造

| 選択肢 | 評価 |
|--------|------|
| **CommentThread[] に統一（採用）** | スレッド構造を保持することで、インラインコメントの location マッチングが自然に実現可能。v0.5（コメント返信）への拡張も容易。一般コメントは `location: null` で区別 |
| Comment[] と InlineComment[] を分離 | 2つの配列を管理する必要があり、再取得時の同期が複雑化 |
| Comment に location を直接付与 | AWS SDK の構造と不一致。同一スレッド内の複数コメントが同じ location を共有する設計を表現できない |

### インラインコメントの表示色

| 選択肢 | 評価 |
|--------|------|
| **magenta（採用）** | diff の green（追加）/red（削除）/default（コンテキスト）と明確に区別可能。目立ちすぎず、コメントであることが分かる |
| cyan | ローディング表示やタイトルと被る |
| yellow | ファイルヘッダーと被る |
| dimColor | 目立たなすぎて見落とす可能性 |

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `getComments`（スレッド構造） | location あり/なしのスレッドが正しく構築されるかテスト |
| `getPullRequestDetail`（スレッド構造） | commentThreads が正しく返るかテスト |
| `postComment`（location 付き） | location パラメータが正しく渡されるかテスト |
| `computeSimpleDiff`（行番号付き） | 行番号メタデータが正しく設定されるかテスト |
| `buildDisplayLines`（インライン表示） | インラインコメントが正しい diff 行の直下に挿入されるかテスト |
| `findMatchingThreads` | BEFORE/AFTER/context 各種マッチングが正しく動作するかテスト |
| `getLocationFromLine` | diff 行種別から正しい location が生成されるかテスト |
| `PullRequestDetail`（カーソル） | j/k でカーソル移動、`>` マーカー表示をテスト |
| `PullRequestDetail`（`C` キー） | diff 行で `C` → CommentInput 表示、非 diff 行で `C` → 無視をテスト |
| `PullRequestDetail`（インライン表示） | スレッドが diff 行直下に表示されるかスナップショットテスト |
| `App`（統合テスト） | インラインコメント投稿→リロード→表示の一連の流れをテスト |

カバレッジ 95% 以上を維持する。

### 具体的なテストケース

#### サービス層

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `getComments`: location 付きスレッドと location なしスレッドが混在 | `CommentThread[]` が正しく構築される |
| 2 | `getComments`: location.filePath が undefined のスレッド | `location: null` として扱われる |
| 3 | `getComments`: スレッド内に複数コメント | `comments` 配列に全コメントが含まれる |
| 4 | `postComment`: location パラメータあり | `PostCommentForPullRequestCommand` に location が渡される |
| 5 | `postComment`: location パラメータなし（既存の一般コメント） | `PostCommentForPullRequestCommand` に location: undefined で従来通り |

#### computeSimpleDiff（行番号メタデータ）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | コンテキスト行 | `beforeLineNumber` と `afterLineNumber` が両方設定される |
| 2 | 削除行 | `beforeLineNumber` が設定され、`afterLineNumber` は未設定 |
| 3 | 追加行 | `afterLineNumber` が設定され、`beforeLineNumber` は未設定 |
| 4 | 複数変更箇所 | 行番号が正しくインクリメントされる |
| 5 | 空ファイル同士の diff | 空配列が返る |

#### buildDisplayLines（インラインコメント挿入）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 削除行に BEFORE コメント | 削除行の直後に inline-comment 行が挿入される |
| 2 | 追加行に AFTER コメント | 追加行の直後に inline-comment 行が挿入される |
| 3 | コンテキスト行に BEFORE/AFTER コメント | コンテキスト行の直後に inline-comment 行が挿入される |
| 4 | 同一行に複数スレッド | すべてのコメントが順番に挿入される |
| 5 | 一般コメントのみ（inline なし） | 従来通り画面下部に表示 |
| 6 | inline + 一般コメント混在 | inline は diff 行直下、一般は画面下部 |

#### getLocationFromLine

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 削除行 | `{ filePath, filePosition: beforeLineNumber, relativeFileVersion: "BEFORE" }` |
| 2 | 追加行 | `{ filePath, filePosition: afterLineNumber, relativeFileVersion: "AFTER" }` |
| 3 | コンテキスト行 | `{ filePath, filePosition: afterLineNumber, relativeFileVersion: "AFTER" }` |
| 4 | ヘッダー行 | `null` |
| 5 | セパレーター行 | `null` |
| 6 | コメント行 | `null` |
| 7 | filePath が未設定の行 | `null` |

#### PullRequestDetail（コンポーネント）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 初期表示でカーソルマーカー `>` が最初の行に表示 | `>` が 1 行目に表示される |
| 2 | `j` キーでカーソルが下に移動 | `>` マーカーが次の行に移動 |
| 3 | `k` キーでカーソルが上に移動 | `>` マーカーが前の行に移動 |
| 4 | カーソルが先頭で `k` | カーソルは 0 のまま（クランプ） |
| 5 | カーソルが末尾で `j` | カーソルは最終行のまま（クランプ） |
| 6 | diff 行上で `C` キー | インラインコメント入力が表示される |
| 7 | ヘッダー行上で `C` キー | 何も起きない |
| 8 | インラインコメント入力中に `j` キー | カーソルは移動しない |
| 9 | インラインコメント投稿の location ラベル | 「Inline comment on file:line」が表示される |
| 10 | `isPostingInlineComment` が true→false（エラーなし） | 入力モードが自動的に閉じる |
| 11 | インラインコメントがスレッド形式で表示 | 💬 マーカー付きで diff 行直下に表示 |
| 12 | フッターに `C inline` が表示 | ナビゲーションヒントが更新されている |
| 13 | 一般コメント入力中に `C` キー | 無視される（`isCommenting` ガード） |

#### App（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | PR 詳細ロード時に commentThreads が取得される | スレッド構造でコメントが返る |
| 2 | インラインコメント投稿成功 | `postComment` が location 付きで呼ばれ、コメントがリロードされる |
| 3 | インラインコメント投稿失敗 | エラーメッセージが表示される |
| 4 | 一般コメント投稿（従来フロー） | location なしで `postComment` が呼ばれる（後方互換） |

#### Help

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | ヘルプ画面表示 | `C` キーバインドが表示される |

## 実装順序

### Step 1: Tidy — コメントデータモデルのスレッド化（構造的変更）

`CommentThread` 型を追加し、`getPullRequestDetail` / `getComments` の返却型をフラットな `Comment[]` から `CommentThread[]` に変更する。`buildDisplayLines` は一般コメントを従来通り画面下部に表示する（機能的な変化なし）。App と PullRequestDetail の Props を更新する。

**この Step で変更するファイル**:
- `src/services/codecommit.ts`: `CommentThread` 型追加、`getPullRequestDetail` / `getComments` の返却型変更
- `src/services/codecommit.test.ts`: スレッド構造のテスト追加
- `src/components/PullRequestDetail.tsx`: Props 変更（`comments` → `commentThreads`）、`buildDisplayLines` の引数変更
- `src/components/PullRequestDetail.test.tsx`: Props 更新
- `src/app.tsx`: state 変更（`prComments` → `commentThreads`）、`reloadComments` 更新
- `src/app.test.tsx`: テスト更新

**この Step の完了条件**: 既存のテストが全て通過し、画面表示は変わらない。

### Step 2: Tidy — DisplayLine に行番号メタデータ追加（構造的変更）

`computeSimpleDiff` に行番号トラッキングを追加し、`DisplayLine` に `filePath`, `beforeLineNumber`, `afterLineNumber` フィールドを追加する。

**この Step で変更するファイル**:
- `src/components/PullRequestDetail.tsx`: `DisplayLine` 型拡張、`computeSimpleDiff` に行番号トラッキング追加、`buildDisplayLines` で filePath 設定
- `src/components/PullRequestDetail.test.tsx`: 行番号メタデータのテスト追加

**この Step の完了条件**: 既存のテストが全て通過し、画面表示は変わらない。行番号メタデータのユニットテスト追加。

### Step 3: インラインコメント表示（機能追加 — 読み取り側）

`buildDisplayLines` にインラインコメントのマッチング・挿入ロジックを追加する。`findMatchingThreads` 関数を実装。`renderDiffLine` に `inline-comment` タイプを追加。

**この Step で変更するファイル**:
- `src/components/PullRequestDetail.tsx`: `buildDisplayLines` にインラインコメント挿入ロジック追加、`findMatchingThreads` 実装、`renderDiffLine` に inline-comment 追加
- `src/components/PullRequestDetail.test.tsx`: インライン表示テスト追加

**この Step の完了条件**: インラインコメント付きの diff が正しく表示されるテストが通過。

### Step 4: カーソルモデル追加（機能追加）

`cursorIndex` state を追加。j/k でカーソル移動。スクロールオフセットをカーソルから自動計算。カーソルマーカー `>` の表示。

**この Step で変更するファイル**:
- `src/components/PullRequestDetail.tsx`: `cursorIndex` state、j/k ハンドラ変更、スクロールオフセット計算、カーソル表示
- `src/components/PullRequestDetail.test.tsx`: カーソルナビゲーションテスト追加

**この Step の完了条件**: j/k でカーソルが移動し、スクロールが追従するテストが通過。

### Step 5: インラインコメント投稿（機能追加 — 書き込み側）

`C` キーハンドラ追加。`getLocationFromLine` 実装。`postComment` に `location` パラメータ追加。App に `handlePostInlineComment` 追加。

**この Step で変更するファイル**:
- `src/services/codecommit.ts`: `postComment` に `location` パラメータ追加
- `src/services/codecommit.test.ts`: location 付き postComment テスト追加
- `src/components/PullRequestDetail.tsx`: `C` キーハンドラ、`getLocationFromLine`、インラインコメント入力 UI、Props 追加
- `src/components/PullRequestDetail.test.tsx`: `C` キーのテスト追加
- `src/app.tsx`: `handlePostInlineComment` 追加、Props 渡し
- `src/app.test.tsx`: インラインコメント投稿の統合テスト

**この Step の完了条件**: インラインコメントの投稿→リロード→表示の一連のフローがテストで通過。

### Step 6: Help 更新

`C` キーバインドを追加。

**この Step で変更するファイル**:
- `src/components/Help.tsx`: `C` キーバインドの行追加
- `src/components/Help.test.tsx`: テスト更新

### Step 7: 全体テスト・カバレッジ確認

```bash
bun run ci
```

カバレッジ 95% 以上を確認。

### Step 8: ドキュメント更新

要件定義書（`docs/requirements.md`）と README（`README.md`）を更新。
