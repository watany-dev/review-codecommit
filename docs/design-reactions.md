# リアクション設計書

**バージョン**: v0.2.0
**ステータス**: 未実装
**最終更新**: 2026-02-14

## 概要

コメントへの絵文字リアクション（👍👎😄🎉😕❤️🚀👀）を追加・削除・表示する機能を実装する。テキストを書かずに意思を示す軽量フィードバック手段であり、LGTM の代替としても有効。PR レビューのコミュニケーション効率を向上させることが目的。

## スコープ

### 今回やること

- コメントにリアクションを追加する（`g` キー → 絵文字選択 → 送信）
- コメント末尾にリアクションバッジを表示（例: 👍×2 🎉×1）
- 同じリアクションを再選択で削除（トグル動作）
- PR 詳細読み込み時にリアクション情報を一括取得
- リアクション追加/削除後のリアクション情報自動リロード
- エラーハンドリング（権限不足、コメント削除済み等）

### 今回やらないこと

- リアクションしたユーザーの一覧表示（カーソルを合わせて詳細表示等） → 将来検討
- カスタム絵文字の追加 → CodeCommit API が定義済みリアクションのみサポート
- リアクション数によるコメントのソートやフィルタリング → 将来検討
- コミットビュー（viewIndex >= 0）でのリアクション操作 → コメントが表示されないため不要

## AWS SDK API

### PutCommentReactionCommand（新規）

コメントにリアクションを追加する。同じユーザーが同じリアクションを再送信すると**削除（トグル）**される。呼び出し元のユーザーのリアクションのみ操作可能。

```typescript
import { PutCommentReactionCommand } from "@aws-sdk/client-codecommit";

// Input
{
  commentId: string;      // 必須: コメントID
  reactionValue: string;  // 必須: リアクション値（emoji short code）
}

// Output
// HTTP 200 のみ（レスポンスボディなし）
```

**特徴**:
- 自分のリアクションのみ操作可能（他人のリアクションは追加・削除不可）
- 同じ `reactionValue` を再送信するとリアクションが削除される（トグル動作）
- `reactionValue` に空文字列または `null` を送信するとリアクション削除
- レスポンスボディなし（`$metadata` のみ）

**`reactionValue` の値**: CodeCommit は以下の emoji short code をサポートする:
- `:thumbsup:` → 👍
- `:thumbsdown:` → 👎
- `:confused:` → 😕
- `:heart:` → ❤️
- `:rocket:` → 🚀
- `:eyes:` → 👀
- `:hooray:` → 🎉
- `:laugh:` → 😄

### GetCommentReactionsCommand（新規）

コメントのリアクション一覧を取得する。

```typescript
import { GetCommentReactionsCommand } from "@aws-sdk/client-codecommit";

// Input
{
  commentId: string;           // 必須: コメントID
  maxResults?: number;         // 任意: 最大件数（デフォルト・上限: 1000）
  nextToken?: string;          // 任意: ページネーショントークン
  reactionUserArn?: string;    // 任意: 特定ユーザーのリアクションのみ取得
}

// Output
{
  reactionsForComment?: ReactionForComment[];  // リアクション一覧
  nextToken?: string;                          // 次ページトークン
}
```

**`ReactionForComment` 型**:

```typescript
interface ReactionForComment {
  reaction?: {
    emoji?: string;       // 絵文字（例: "👍"）
    shortCode?: string;   // ショートコード（例: ":thumbsup:"）
    unicode?: string;     // Unicode コードポイント
  };
  reactionUsers?: string[];              // リアクションしたユーザーの ARN 一覧
  reactionsFromDeletedUsersCount?: number; // 削除されたユーザーからのリアクション数
}
```

### API 比較

| 項目 | PutCommentReaction | GetCommentReactions |
|------|-------------------|-------------------|
| 操作種別 | 書き込み | 読み取り |
| 必須パラメータ | 2（commentId, reactionValue） | 1（commentId） |
| レスポンス | なし（HTTP 200 のみ） | リアクション一覧 |
| トグル動作 | あり（同じリアクションを再送信で削除） | - |
| ページネーション | - | あり（nextToken） |

### API エラー一覧

#### PutCommentReaction

| 例外 | HTTP | 説明 |
|------|------|------|
| `CommentDeletedException` | 400 | コメントが既に削除済み |
| `CommentDoesNotExistException` | 400 | コメントが存在しない |
| `CommentIdRequiredException` | 400 | `commentId` が未指定 |
| `InvalidCommentIdException` | 400 | `commentId` のフォーマットが不正 |
| `InvalidReactionValueException` | 400 | `reactionValue` が不正 |

#### GetCommentReactions

| 例外 | HTTP | 説明 |
|------|------|------|
| `CommentDeletedException` | 400 | コメントが既に削除済み |
| `CommentDoesNotExistException` | 400 | コメントが存在しない |
| `CommentIdRequiredException` | 400 | `commentId` が未指定 |
| `InvalidCommentIdException` | 400 | `commentId` のフォーマットが不正 |
| `InvalidContinuationTokenException` | 400 | ページネーショントークンが不正 |
| `InvalidMaxResultsException` | 400 | `maxResults` の値が不正 |
| `InvalidReactionUserArnException` | 400 | `reactionUserArn` が不正 |

## データモデル

### 新規型

```typescript
// src/services/codecommit.ts に追加

/** コメントごとのリアクション集約情報 */
export interface ReactionSummary {
  emoji: string;       // 表示用絵文字（例: "👍"）
  shortCode: string;   // API 用ショートコード（例: ":thumbsup:"）
  count: number;       // リアクション数（削除済みユーザー含む）
  userArns: string[];  // リアクションしたユーザーの ARN 一覧
}

/** commentId → ReactionSummary[] のマッピング */
export type ReactionsByComment = Map<string, ReactionSummary[]>;
```

### 既存型への影響

#### CommentThread

変更なし。リアクション情報はコメントスレッドとは別に `ReactionsByComment` として管理する。理由:
- `GetCommentReactionsCommand` はコメントIDごとに個別呼び出しが必要
- `GetCommentsForPullRequestCommand` のレスポンスにはリアクション情報が含まれない
- コメントスレッドの更新（`reloadComments`）とリアクション更新のタイミングを独立させるため

#### DisplayLine

`reactionText` フィールドを追加する。

```typescript
interface DisplayLine {
  type: /* 既存の型すべて */;
  text: string;
  filePath?: string;
  beforeLineNumber?: number;
  afterLineNumber?: number;
  threadIndex?: number | undefined;
  commentId?: string | undefined;
  reactionText?: string;  // v0.2.0 追加: リアクション表示テキスト（例: "👍×2 🎉×1"）
}
```

## 画面設計

### リアクションバッジ表示

コメント行の末尾にリアクションバッジを表示する。

```
│  Comments (3):                               │
│  watany: タイムアウトを延長しました  👍×2     │
│    └ taro: LGTMです  🎉×1                    │
│  hanako: テスト追加をお願いします             │
│                                              │
│  ↑↓ scroll  g react  c comment  q back       │
```

インラインコメントの場合:

```
│  src/auth.ts                                 │
│   +   timeout: 10000,                        │
│    💬 taro: この値はconfigから取る方が良さそう  👍×1 🚀×1│
│                                              │
```

### リアクション選択画面（`g` キー押下後）

カーソルがコメント行にある状態で `g` キーを押すと、リアクションピッカーが表示される。

```
│  Comments (3):                               │
│  watany: タイムアウトを延長しました  👍×2     │
│    └ taro: LGTMです  🎉×1                    │
│ > hanako: テスト追加をお願いします            │  ← カーソルがここにある状態で g キー
│                                              │
│──────────────────────────────────────────────│
│  React to comment:                           │
│  > 👍  👎  😄  🎉  😕  ❤️  🚀  👀           │
│  ←→ select  Enter send  Esc cancel           │
```

既にリアクションが付いている絵文字には件数バッジを表示（どのリアクションが付いているか一目でわかる）:

```
│  React to comment:                           │
│  > 👍(2)  👎  😄  🎉  😕  ❤️  🚀  👀        │
│  ←→ select  Enter send  Esc cancel           │
```

### リアクション送信中

```
│  Adding reaction...                          │
```

### リアクションエラー

```
│  Failed to add reaction: Comment has already │
│  been deleted.                               │
│  Press any key to return                     │
```

### 非コメント行での `g` 操作

カーソルがコメント行以外（diff 行、ヘッダー行、セパレーター行）にある場合、`g` キーは何もしない（無視される）。

## データフロー

```
App (状態管理)
 │
 ├─ 既存の state すべて（変更なし）
 │
 ├─ 新規 state (v0.2.0):
 │   ├─ reactionsByComment: ReactionsByComment   // コメントごとのリアクション情報
 │   ├─ isReacting: boolean                      // リアクション送信中
 │   └─ reactionError: string | null             // リアクションエラー
 │
 └─→ PullRequestDetail (表示 + 操作管理)
      │
      ├─ 既存の state すべて（変更なし）
      │
      ├─ 新規 local state (v0.2.0):
      │   ├─ isPickingReaction: boolean                    // リアクションピッカー表示中
      │   ├─ reactionTarget: { commentId: string } | null  // リアクション対象コメント
      │   └─ wasReacting: boolean                          // リアクション完了検知用
      │
      ├─ Props から受け取る (v0.2.0 追加):
      │   ├─ reactionsByComment ──→ リアクションバッジ表示
      │   ├─ onReact(commentId, reactionValue) ──→ App.handleReact()
      │   ├─ isReacting ──→ 送信中表示
      │   ├─ reactionError ──→ エラー表示
      │   └─ onClearReactionError
      │
      └─→ ReactionPicker（新規コンポーネント）
           │
           ├─ local state:
           │   └─ selectedIndex: number  // ピッカー内の選択位置
           │
           └─ 絵文字選択 UI
```

### リアクション追加/削除シーケンス

```
ユーザー          PullRequestDetail   ReactionPicker    App              CodeCommit API
  │                    │                 │              │                    │
  │─── g キー ────────→│                 │              │                    │
  │                    │── reactionTarget│              │                    │
  │                    │   設定          │              │                    │
  │                    │── isPickingReaction             │                    │
  │                    │   = true        │              │                    │
  │                    │── render ───────→│              │                    │
  │                    │                 │ React to     │                    │
  │                    │                 │ comment:     │                    │
  │                    │                 │ > 👍 👎 ...  │                    │
  │                    │                 │              │                    │
  │─── ←→ で選択 ────→│                 │              │                    │
  │                    │                 │ 選択位置更新 │                    │
  │                    │                 │              │                    │
  │─── Enter ─────────→│                 │              │                    │
  │                    │← onSelect ─────│              │                    │
  │                    │── onReact(commentId, shortCode)→│                    │
  │                    │                 │              │── PutComment ─────→│
  │                    │                 │              │   Reaction         │
  │                    │                 │              │←── HTTP 200 ───────│
  │                    │                 │              │── reloadReactions  │
  │                    │                 │              │   (該当コメント)    │
  │                    │                 │              │───────────────────→│
  │                    │                 │              │←── reactions ──────│
  │                    │                 │              │                    │
  │                    │← isReacting     │              │                    │
  │                    │   = false       │              │                    │
  │                    │── isPickingReaction             │                    │
  │                    │   = false       │              │                    │
```

### リアクション情報の取得タイミング

```
PR 詳細読み込み時
  │
  ├─ getPullRequestDetail()        ← 既存
  │   ├─ fetchCommentThreads()     ← 既存
  │   └─ fetchBlobContents()       ← 既存
  │
  └─ loadReactionsForComments()    ← 新規
      │
      └─ コメントIDリストを抽出
          │
          └─ 各コメントに対して GetCommentReactionsCommand を並列実行
              │
              └─ ReactionsByComment Map を構築
```

**パフォーマンス考慮**: コメント数が多い場合、`GetCommentReactionsCommand` の並列呼び出しが API レートリミットに抵触する可能性がある。`Promise.all` で並列化するが、コメント数が 20 を超える場合はバッチ化（5 件ずつ `Promise.all`）を検討する。初期実装では `Promise.all` でシンプルに実装し、レートリミットが問題になった場合にバッチ化する。

## コンポーネント設計

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/services/codecommit.ts` | `putReaction`, `getReactionsForComment`, `getReactionsForComments` 関数を追加。新規 Command の import 追加。`ReactionSummary`, `ReactionsByComment` 型を追加 |
| `src/services/codecommit.test.ts` | 上記関数のテスト追加 |
| `src/components/ReactionPicker.tsx` | **新規**: 絵文字選択コンポーネント |
| `src/components/ReactionPicker.test.tsx` | **新規**: ReactionPicker のテスト |
| `src/components/PullRequestDetail.tsx` | `g` キーハンドラ、リアクションバッジ表示、ReactionPicker 統合、Props 追加。`DisplayLine` に `reactionText` フィールド追加。`buildDisplayLines` にリアクション情報を渡す |
| `src/components/PullRequestDetail.test.tsx` | リアクション関連のテスト追加 |
| `src/app.tsx` | `handleReact` ハンドラ追加。state 追加。リアクション一括取得。エラーハンドリング |
| `src/app.test.tsx` | リアクション統合テスト追加 |
| `src/components/Help.tsx` | `g` キーバインドの追加 |
| `src/components/Help.test.tsx` | テスト更新 |

### 1. サービス層の変更

#### 型定義（新規）

```typescript
// src/services/codecommit.ts に追加

export interface ReactionSummary {
  emoji: string;
  shortCode: string;
  count: number;
  userArns: string[];
}

export type ReactionsByComment = Map<string, ReactionSummary[]>;
```

#### putReaction（新規）

```typescript
import {
  // 既存の import に追加
  PutCommentReactionCommand,
  GetCommentReactionsCommand,
} from "@aws-sdk/client-codecommit";

export async function putReaction(
  client: CodeCommitClient,
  params: {
    commentId: string;
    reactionValue: string;
  },
): Promise<void> {
  const command = new PutCommentReactionCommand({
    commentId: params.commentId,
    reactionValue: params.reactionValue,
  });
  await client.send(command);
}
```

**設計判断**: `PutCommentReactionCommand` はレスポンスボディを返さない（HTTP 200 のみ）。返り値は `void` とし、成功/失敗のみを呼び出し側に伝える。

#### getReactionsForComment（新規）

```typescript
export async function getReactionsForComment(
  client: CodeCommitClient,
  commentId: string,
): Promise<ReactionSummary[]> {
  const command = new GetCommentReactionsCommand({
    commentId,
  });
  const response = await client.send(command);

  return (response.reactionsForComment ?? []).map((r) => ({
    emoji: r.reaction?.emoji ?? "",
    shortCode: r.reaction?.shortCode ?? "",
    count: (r.reactionUsers?.length ?? 0) + (r.reactionsFromDeletedUsersCount ?? 0),
    userArns: r.reactionUsers ?? [],
  }));
}
```

#### getReactionsForComments（新規）

複数コメントのリアクションを一括取得する。

```typescript
export async function getReactionsForComments(
  client: CodeCommitClient,
  commentIds: string[],
): Promise<ReactionsByComment> {
  const results: ReactionsByComment = new Map();

  const fetches = commentIds.map(async (commentId) => {
    try {
      const reactions = await getReactionsForComment(client, commentId);
      return { commentId, reactions };
    } catch {
      // 個別のコメントでエラーが発生しても他のコメントの取得は続行
      return { commentId, reactions: [] };
    }
  });

  const settled = await Promise.all(fetches);
  for (const { commentId, reactions } of settled) {
    if (reactions.length > 0) {
      results.set(commentId, reactions);
    }
  }

  return results;
}
```

**設計判断**:
- `GetCommentReactionsCommand` はコメントIDごとに個別呼び出しが必要（バッチ API なし）
- 個別のエラー（削除済みコメント等）は無視し、取得できたリアクションのみ返す
- リアクションが 0 件のコメントは Map に含めない（メモリ効率）

### 2. ReactionPicker コンポーネント（新規）

#### Props

```typescript
// src/components/ReactionPicker.tsx

interface Props {
  onSelect: (shortCode: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
  error: string | null;
  onClearError: () => void;
  currentReactions: ReactionSummary[];  // 対象コメントの既存リアクション情報
}
```

**設計判断**: `currentReactions` は対象コメントに既に付いているリアクションの情報であり、リアクション済みの絵文字に件数バッジを表示するために使用する。

なお、自分がリアクション済みかの判定（`*` マーカー表示）は v0.2.0 では**実装しない**。理由:
- 現在のユーザー ARN を取得するには `STS:GetCallerIdentity` の呼び出しが必要
- 最小依存の方針に従い、STS への依存追加は避ける
- トグル動作自体は API が正しく処理するため、`*` マーカーがなくても機能的には問題ない
- 将来の改善として `currentUserArn` を Props に追加し、`*` マーカー表示を実装可能

#### 実装

```typescript
import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import type { ReactionSummary } from "../services/codecommit.js";

const REACTIONS = [
  { emoji: "👍", shortCode: ":thumbsup:" },
  { emoji: "👎", shortCode: ":thumbsdown:" },
  { emoji: "😄", shortCode: ":laugh:" },
  { emoji: "🎉", shortCode: ":hooray:" },
  { emoji: "😕", shortCode: ":confused:" },
  { emoji: "❤️", shortCode: ":heart:" },
  { emoji: "🚀", shortCode: ":rocket:" },
  { emoji: "👀", shortCode: ":eyes:" },
] as const;

export { REACTIONS };

export function ReactionPicker({
  onSelect,
  onCancel,
  isProcessing,
  error,
  onClearError,
  currentReactions,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 既存リアクションのショートコード → カウント のマップ（バッジ表示用）
  const reactionCounts = new Map<string, number>();
  for (const r of currentReactions) {
    if (r.count > 0) {
      reactionCounts.set(r.shortCode, r.count);
    }
  }

  useInput((input, key) => {
    if (error) {
      onClearError();
      return;
    }

    if (isProcessing) return;

    if (key.escape || input === "q") {
      onCancel();
      return;
    }

    if (key.leftArrow || input === "h") {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : REACTIONS.length - 1));
      return;
    }

    if (key.rightArrow || input === "l") {
      setSelectedIndex((prev) => (prev < REACTIONS.length - 1 ? prev + 1 : 0));
      return;
    }

    if (key.return) {
      onSelect(REACTIONS[selectedIndex]!.shortCode);
      return;
    }
  });

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Failed to add reaction: {error}</Text>
        <Text dimColor>Press any key to return</Text>
      </Box>
    );
  }

  if (isProcessing) {
    return (
      <Box>
        <Text color="cyan">Adding reaction...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>React to comment:</Text>
      <Box>
        {REACTIONS.map((r, i) => {
          const count = reactionCounts.get(r.shortCode);
          return (
            <Text key={r.shortCode}>
              {i === selectedIndex ? "> " : "  "}
              {r.emoji}
              {count ? `(${count})` : ""}
              {"  "}
            </Text>
          );
        })}
      </Box>
      <Text dimColor>←→ select  Enter send  Esc cancel</Text>
    </Box>
  );
}
```

**設計判断**:
- `h`/`l` キーも `←`/`→` の代替として使用可能（Vim 風操作の一貫性）
- リアクション一覧は定数として定義し、コンポーネントとサービス層で共有
- ピッカーは単一行の水平リストで表示（コンパクトさを優先）
- エラー表示は ConfirmPrompt パターンに倣い、任意のキー入力でクリア

### 3. PullRequestDetail の変更

#### Props の変更

v0.2.0 で 5 つの Props を追加する。既存の Props はすべて維持。

```typescript
interface Props {
  // ... 既存の Props すべて ...
  // v0.2.0 追加
  reactionsByComment: ReactionsByComment;
  onReact: (commentId: string, reactionValue: string) => void;
  isReacting: boolean;
  reactionError: string | null;
  onClearReactionError: () => void;
}
```

#### 状態管理の追加

```typescript
const [isPickingReaction, setIsPickingReaction] = useState(false);
const [reactionTarget, setReactionTarget] = useState<{
  commentId: string;
} | null>(null);
const [wasReacting, setWasReacting] = useState(false);
```

#### useEffect（リアクション完了検知）

```typescript
// v0.2.0: リアクション完了でピッカーを閉じる
useEffect(() => {
  if (isReacting) {
    setWasReacting(true);
  } else if (wasReacting && !reactionError) {
    setIsPickingReaction(false);
    setReactionTarget(null);
    setWasReacting(false);
  } else {
    setWasReacting(false);
  }
}, [isReacting, reactionError]);
```

#### useInput の変更

```typescript
useInput((input, key) => {
  if (
    isCommenting ||
    isInlineCommenting ||
    isReplying ||
    isEditing ||
    isDeleting ||
    isPickingReaction ||     // v0.2.0 追加
    approvalAction ||
    mergeStep ||
    isClosing
  )
    return;

  // ... 既存のキーバインド ...

  if (input === "g") {                                     // v0.2.0 追加
    if (viewIndex >= 0) return;  // コミットビューではリアクション不可
    const currentLine = lines[cursorIndex];
    if (!currentLine) return;
    const target = getReactionTargetFromLine(currentLine);
    if (!target) return;
    setReactionTarget(target);
    setIsPickingReaction(true);
    return;
  }
});
```

#### getReactionTargetFromLine（新規ヘルパー）

```typescript
function getReactionTargetFromLine(line: DisplayLine): { commentId: string } | null {
  const commentTypes = ["inline-comment", "comment", "inline-reply", "comment-reply"];
  if (!commentTypes.includes(line.type)) return null;
  if (!line.commentId) return null;
  return { commentId: line.commentId };
}
```

#### buildDisplayLines の変更

`reactionsByComment` を引数に追加し、コメント行にリアクションテキストを付与する。

```typescript
function buildDisplayLines(
  differences: Difference[],
  diffTexts: Map<string, { before: string; after: string }>,
  commentThreads: CommentThread[],
  collapsedThreads: Set<number>,
  reactionsByComment: ReactionsByComment,  // v0.2.0 追加
): DisplayLine[] {
  // ... 既存のロジック ...
}
```

#### useMemo 呼び出し箇所の変更

`buildDisplayLines` は `useMemo` 内で呼ばれている。`reactionsByComment` を引数と依存配列に追加する。

```typescript
const lines = useMemo(() => {
  if (viewIndex === -1) {
    return buildDisplayLines(differences, diffTexts, commentThreads, collapsedThreads, reactionsByComment);
  }
  // コミットビューではリアクション表示なし（コメントが表示されないため）
  return buildDisplayLines(commitDifferences, commitDiffTexts, [], new Set(), new Map());
}, [
  viewIndex,
  differences,
  diffTexts,
  commentThreads,
  collapsedThreads,
  reactionsByComment,  // v0.2.0 追加
  commitDifferences,
  commitDiffTexts,
]);
```

#### appendThreadLines の変更

コメント行の生成時にリアクションテキストを付与する。

```typescript
function appendThreadLines(
  lines: DisplayLine[],
  thread: CommentThread,
  threadIndex: number,
  collapsedThreads: Set<number>,
  mode: "inline" | "general",
  reactionsByComment: ReactionsByComment,  // v0.2.0 追加
): void {
  // ... 既存のロジック（rootComment の処理）...

  const rootReactions = reactionsByComment.get(rootComment.commentId ?? "");
  const rootReactionText = formatReactionBadge(rootReactions);

  if (mode === "inline") {
    lines.push({
      type: "inline-comment",
      text: `💬 ${rootAuthor}: ${rootContent}`,
      threadIndex,
      commentId: rootComment.commentId,
      reactionText: rootReactionText,  // v0.2.0 追加
    });
  } else {
    lines.push({
      type: "comment",
      text: `${rootAuthor}: ${rootContent}`,
      threadIndex,
      commentId: rootComment.commentId,
      reactionText: rootReactionText,  // v0.2.0 追加
    });
  }

  // ... 返信のループ内でも同様にリアクション情報を付与 ...
  for (const reply of replies) {
    const replyReactions = reactionsByComment.get(reply.commentId ?? "");
    const replyReactionText = formatReactionBadge(replyReactions);

    // lines.push に reactionText を追加
  }
}
```

#### formatReactionBadge（新規ヘルパー）

リアクション情報をバッジ文字列にフォーマットする。

```typescript
function formatReactionBadge(reactions: ReactionSummary[] | undefined): string {
  if (!reactions || reactions.length === 0) return "";
  return reactions
    .filter((r) => r.count > 0)
    .map((r) => `${r.emoji}×${r.count}`)
    .join(" ");
}
```

#### renderDiffLine の変更

コメント行のレンダリングにリアクションバッジを追加する。

```typescript
function renderDiffLine(line: DisplayLine, isCursor = false): React.ReactNode {
  // ... 既存の switch 文 ...

  case "comment":
    return (
      <Text>
        {" "}{line.text}
        {line.reactionText ? <Text dimColor>  {line.reactionText}</Text> : null}
      </Text>
    );
  case "inline-comment":
    return (
      <Text color="magenta">
        {" "}{line.text}
        {line.reactionText ? <Text dimColor>  {line.reactionText}</Text> : null}
      </Text>
    );
  case "inline-reply":
    return (
      <Text color="magenta">
        {"   "}{line.text}
        {line.reactionText ? <Text dimColor>  {line.reactionText}</Text> : null}
      </Text>
    );
  case "comment-reply":
    return (
      <Text>
        {"   "}{line.text}
        {line.reactionText ? <Text dimColor>  {line.reactionText}</Text> : null}
      </Text>
    );
  // 他の case（header, separator, add, delete, context, comment-header, fold-indicator）は変更なし
}
```

#### レンダリングの変更

```tsx
{/* リアクションピッカー */}
{isPickingReaction && reactionTarget && (
  <ReactionPicker
    onSelect={(shortCode) => onReact(reactionTarget.commentId, shortCode)}
    onCancel={() => {
      setIsPickingReaction(false);
      setReactionTarget(null);
      onClearReactionError();
    }}
    isProcessing={isReacting}
    error={reactionError}
    onClearError={() => {
      onClearReactionError();
      setIsPickingReaction(false);
      setReactionTarget(null);
    }}
    currentReactions={reactionsByComment.get(reactionTarget.commentId) ?? []}
  />
)}
```

#### visibleLineCount の調整

```typescript
const visibleLineCount =
  isCommenting ||
  isInlineCommenting ||
  isReplying ||
  isEditing ||
  isDeleting ||
  isPickingReaction ||     // v0.2.0 追加
  approvalAction ||
  mergeStep ||
  isClosing
    ? 20
    : 30;
```

#### フッターの変更

```tsx
<Box marginTop={1}>
  <Text dimColor>
    {isCommenting || isInlineCommenting || isReplying || isEditing || isDeleting ||
    isPickingReaction || approvalAction || mergeStep || isClosing
      ? ""
      : viewIndex === -1 && commits.length > 0
        ? "Tab switch view  ↑↓ cursor  c comment  C inline  R reply  o fold  e edit  d delete  g react  a approve  r revoke  m merge  x close  q back  ? help"
        : viewIndex >= 0
          ? "Tab next  S-Tab prev  ↑↓ cursor  e edit  d delete  a approve  r revoke  m merge  x close  q back  ? help"
          : "↑↓ cursor  c comment  C inline  R reply  o fold  e edit  d delete  g react  a approve  r revoke  m merge  x close  q back  ? help"}
  </Text>
</Box>
```

### 4. App の変更

#### import の変更

```typescript
import {
  // 既存の import に追加
  putReaction,
  getReactionsForComment,
  getReactionsForComments,
  type ReactionsByComment,
} from "./services/codecommit.js";
```

**注意**: `getReactionsForComment`（単数形）は `reloadReactionForComment` で使用する。`getReactionsForComments`（複数形）は `loadPullRequestDetail` と `reloadComments` で使用する。

#### state の追加

```typescript
// v0.2.0: リアクション状態
const [reactionsByComment, setReactionsByComment] = useState<ReactionsByComment>(new Map());
const [isReacting, setIsReacting] = useState(false);
const [reactionError, setReactionError] = useState<string | null>(null);
```

#### loadPullRequestDetail の変更

PR 詳細読み込み時にリアクション情報も取得する。

```typescript
async function loadPullRequestDetail(pullRequestId: string) {
  await withLoadingState(async () => {
    const detail = await getPullRequestDetail(client, pullRequestId, selectedRepo);
    // ... 既存の処理 ...

    // v0.2.0: リアクション情報を取得
    const allCommentIds = detail.commentThreads.flatMap((thread) =>
      thread.comments
        .filter((c) => c.commentId)
        .map((c) => c.commentId!),
    );
    if (allCommentIds.length > 0) {
      const reactions = await getReactionsForComments(client, allCommentIds);
      setReactionsByComment(reactions);
    } else {
      setReactionsByComment(new Map());
    }
  });
}
```

#### handleReact（新規）

```typescript
async function handleReact(commentId: string, reactionValue: string) {
  setIsReacting(true);
  setReactionError(null);
  try {
    await putReaction(client, { commentId, reactionValue });
    // リアクション後、該当コメントのリアクション情報のみリロード
    await reloadReactionForComment(commentId);
  } catch (err) {
    setReactionError(formatReactionError(err));
  } finally {
    setIsReacting(false);
  }
}
```

#### reloadReactionForComment（新規）

単一コメントのリアクション情報をリロードする。全コメントの再取得は不要。

```typescript
async function reloadReactionForComment(commentId: string) {
  try {
    const reactions = await getReactionsForComment(client, commentId);
    setReactionsByComment((prev) => {
      const next = new Map(prev);
      if (reactions.length > 0) {
        next.set(commentId, reactions);
      } else {
        next.delete(commentId);
      }
      return next;
    });
  } catch {
    // リロード失敗は無視（次の表示更新で解消される）
  }
}
```

**設計判断**: リアクション追加/削除後は、対象コメントのリアクション情報のみリロードする。全コメントの再取得は API 呼び出し数が多すぎるため不採用。

#### reloadComments の変更

コメントリロード時にリアクション情報もリロードする。

```typescript
async function reloadComments(pullRequestId: string) {
  // 既存の処理
  const target = prDetail?.pullRequestTargets?.[0];
  const threads = await getComments(client, pullRequestId, {
    repositoryName: selectedRepo,
    ...(target?.sourceCommit && target?.destinationCommit
      ? {
          afterCommitId: target.sourceCommit,
          beforeCommitId: target.destinationCommit,
        }
      : {}),
  });
  setCommentThreads(threads);

  // v0.2.0: リアクション情報もリロード
  const allCommentIds = threads.flatMap((thread) =>
    thread.comments
      .filter((c) => c.commentId)
      .map((c) => c.commentId!),
  );
  if (allCommentIds.length > 0) {
    const reactions = await getReactionsForComments(client, allCommentIds);
    setReactionsByComment(reactions);
  } else {
    setReactionsByComment(new Map());
  }
}
```

#### formatErrorMessage の拡張

```typescript
function formatErrorMessage(
  err: unknown,
  context?: "comment" | "reply" | "approval" | "merge" | "close" | "edit" | "delete" | "reaction",
  approvalAction?: "approve" | "revoke",
): string {
  // ... 既存のコード ...

  // Reaction-specific errors (v0.2.0)
  if (context === "reaction") {
    if (name === "CommentDeletedException") {
      return "Comment has already been deleted.";
    }
    if (name === "CommentDoesNotExistException") {
      return "Comment not found.";
    }
    if (name === "InvalidReactionValueException") {
      return "Invalid reaction value.";
    }
    if (name === "InvalidCommentIdException") {
      return "Invalid comment ID format.";
    }
  }

  // ... 既存の General AWS errors ...
}
```

#### Context-specific wrapper（追加）

```typescript
function formatReactionError(err: unknown): string {
  return formatErrorMessage(err, "reaction");
}
```

#### PullRequestDetail への Props 渡し

```tsx
case "detail":
  if (!prDetail) return null;
  return (
    <PullRequestDetail
      // ... 既存の Props すべて ...
      reactionsByComment={reactionsByComment}                  // v0.2.0 追加
      onReact={handleReact}                                    // v0.2.0 追加
      isReacting={isReacting}                                  // v0.2.0 追加
      reactionError={reactionError}                            // v0.2.0 追加
      onClearReactionError={() => setReactionError(null)}      // v0.2.0 追加
    />
  );
```

### 5. Help の変更

```typescript
<Text> c          Post comment (PR Detail)</Text>
<Text> C          Post inline comment (PR Detail)</Text>
<Text> R          Reply to comment (PR Detail)</Text>
<Text> o          Toggle thread fold (PR Detail)</Text>
<Text> e          Edit comment (PR Detail)</Text>
<Text> d          Delete comment (PR Detail)</Text>
<Text> g          React to comment (PR Detail)</Text>    // v0.2.0 追加
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
| `Enter` | 選択・決定 / コメント送信 / リアクション送信 | リスト画面 / コメント入力 / リアクションピッカー |
| `q` / `Esc` | 前の画面に戻る / キャンセル | 全画面 / 各モーダル |
| `Ctrl+C` | 即座に終了 | 全画面 |
| `?` | ヘルプ表示 | 全画面（入力中・確認中は無効） |
| `c` | 一般コメント投稿 | PR 詳細画面 |
| `C` | インラインコメント投稿（カーソル行） | PR 詳細画面（diff 行上のみ） |
| `R` | コメント返信 | PR 詳細画面（コメント行上のみ） |
| `o` | スレッド折りたたみ/展開 | PR 詳細画面（コメント行上のみ） |
| `e` | コメント編集 | PR 詳細画面（コメント行上のみ） |
| `d` | コメント削除（確認プロンプト） | PR 詳細画面（コメント行上のみ） |
| `g` | リアクション追加/削除 | PR 詳細画面（コメント行上のみ） |
| `←` / `h` | リアクション選択を左へ | リアクションピッカー |
| `→` / `l` | リアクション選択を右へ | リアクションピッカー |
| `a` | PR を承認（確認プロンプト表示） | PR 詳細画面 |
| `r` | 承認を取り消し（確認プロンプト表示） | PR 詳細画面 |
| `m` | PR をマージ（戦略選択 → 確認） | PR 詳細画面 |
| `x` | PR をクローズ（確認プロンプト表示） | PR 詳細画面 |

## エラーハンドリング

### リアクションエラー

| エラー | 表示メッセージ |
|--------|---------------|
| `CommentDeletedException` | "Comment has already been deleted." |
| `CommentDoesNotExistException` | "Comment not found." |
| `InvalidReactionValueException` | "Invalid reaction value." |
| `InvalidCommentIdException` | "Invalid comment ID format." |
| `AccessDeniedException` / `UnauthorizedException` | "Access denied. Check your IAM policy." |
| その他 | エラーメッセージをサニタイズして表示 |

### エッジケースと対処方針

| ケース | 対処 |
|--------|------|
| リアクションピッカー表示中に `c` / `C` / `R` / `e` / `d` / `a` / `r` / `m` / `x` | `isPickingReaction` チェックにより無効化 |
| 他のモーダル表示中に `g` | 各モードの排他チェックにより無効化 |
| 非コメント行で `g` | `getReactionTargetFromLine` が `null` を返し、何もしない |
| 折りたたみインジケーター行（`fold-indicator`）で `g` | `commentId` がないため `null` を返し、何もしない |
| 削除済みコメントへのリアクション | API が `CommentDeletedException` を返し、エラー表示 |
| 存在しないコメントへのリアクション | API が `CommentDoesNotExistException` を返し、エラー表示 |
| 同じリアクションの再送信 | API のトグル動作により削除される（正常フロー） |
| コメント数が非常に多い場合 | `getReactionsForComments` が `Promise.all` で並列取得。レートリミット発生時は個別エラーを無視して取得可能分のみ表示 |
| リアクション送信中に Esc | `isProcessing` チェックにより入力が無効化されるため、キャンセル不可 |
| コミットビュー（viewIndex >= 0）で `g` | `viewIndex >= 0` チェックにより無視 |
| リアクション情報の取得失敗（PR 詳細読み込み時） | 該当コメントのリアクションは空として表示（エラーは発生させない） |

## セキュリティ考慮

### IAM 権限

v0.2.0 で追加の IAM 権限が必要:

```json
{
  "Effect": "Allow",
  "Action": [
    "codecommit:PutCommentReaction",
    "codecommit:GetCommentReactions"
  ],
  "Resource": "arn:aws:codecommit:<region>:<account-id>:<repository-name>"
}
```

### 操作の安全性

#### リアクション追加

- **API レベルのユーザー制限**: `PutCommentReaction` は呼び出し元ユーザーのリアクションのみ操作可能。他人のリアクションは追加・削除不可
- **トグル動作**: 同じリアクションを再送信すると削除される。意図しない操作があっても再度送信すれば元に戻せる
- **確認プロンプトなし**: リアクションは軽量な操作であり、トグルで元に戻せるため確認プロンプトは不要

#### リアクション表示

- **ユーザー ARN のサニタイズ**: `reactionUsers` の ARN はバッジ表示には使用しない（カウントのみ表示）。将来的にユーザー一覧を表示する場合は `extractAuthorName` でサニタイズ

### 認証

既存の AWS SDK 標準認証チェーンをそのまま使用する。追加の認証フローは不要。

## 技術選定

### 新規依存パッケージ: なし

v0.2.0 では新規依存パッケージの追加は不要。`PutCommentReactionCommand` と `GetCommentReactionsCommand` は既存の `@aws-sdk/client-codecommit` パッケージに含まれている。

### リアクション情報の管理: 独立した Map vs CommentThread 内

| 選択肢 | 評価 |
|--------|------|
| **独立した `ReactionsByComment` Map（採用）** | コメントスレッドのリロードとリアクションリロードを独立して管理可能。単一コメントのリアクション更新が効率的。`GetCommentsForPullRequest` API にリアクション情報が含まれないため自然な分離 |
| `CommentThread` にリアクション情報を含める | `GetCommentsForPullRequest` がリアクション情報を返さないため、リロード時に毎回リアクションも再取得が必要。コメントスレッドの更新タイミングが制約される |

### リアクション取得: 並列 vs バッチ

| 選択肢 | 評価 |
|--------|------|
| **`Promise.all` で並列取得（採用）** | シンプルな実装。コメント数が少ない場合は最も高速。CodeCommit API にバッチ取得 API がないため、並列呼び出しが唯一の方法 |
| 逐次取得 | コメント数に比例してレイテンシが増加。UX が悪化 |
| バッチ化（5件ずつ `Promise.all`） | レートリミット対策として有効だが、初期実装では過剰。問題発生時に導入 |

### リアクションピッカーのUI: 水平リスト vs 格子

| 選択肢 | 評価 |
|--------|------|
| **水平リスト（採用）** | 8 種類のリアクションなら 1 行で表示可能。`←`/`→` で直感的に選択。実装がシンプル |
| 2行×4列の格子 | ナビゲーションが `↑↓←→` の 4 方向になり複雑。8 種類では格子のメリットが薄い |

### リアクション後のリロード範囲: 対象コメントのみ vs 全コメント

| 選択肢 | 評価 |
|--------|------|
| **対象コメントのみリロード（採用）** | API 呼び出しが 1 回で済む。レスポンスが高速。他のコメントのリアクション状態に影響しない |
| 全コメントのリアクションをリロード | コメント数分の API 呼び出しが発生。不必要に遅い |

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `putReaction` | `vi.fn()` で `client.send` をモック。正常系・エラー系のテスト |
| `getReactionsForComment` | `vi.fn()` で `client.send` をモック。リアクション集約のテスト |
| `getReactionsForComments` | 複数コメントの並列取得テスト。個別エラー時の継続テスト |
| `ReactionPicker` | 選択・送信・キャンセルの UI テスト |
| `PullRequestDetail`（`g` キー） | リアクション対象の特定 → ピッカー表示 → 送信の流れ |
| `PullRequestDetail`（バッジ表示） | リアクション情報がコメント行に正しく表示されるテスト |
| `App`（統合テスト） | リアクション成功→リロード、エラーハンドリング |

カバレッジ 95% 以上を維持する。

### 具体的なテストケース

#### サービス層

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `putReaction`: 正常送信 | `PutCommentReactionCommand` が正しいパラメータで呼ばれる |
| 2 | `putReaction`: API がエラーをスロー | エラーがそのまま上位に伝播する |
| 3 | `getReactionsForComment`: リアクションあり | `ReactionSummary[]` が正しく集約される |
| 4 | `getReactionsForComment`: リアクションなし | 空配列が返る |
| 5 | `getReactionsForComment`: 削除ユーザーのカウント | `count` に削除ユーザーのリアクション数が含まれる |
| 6 | `getReactionsForComment`: API がエラーをスロー | エラーがそのまま上位に伝播する |
| 7 | `getReactionsForComments`: 複数コメントのリアクション取得 | 各コメントのリアクションが正しく Map に格納される |
| 8 | `getReactionsForComments`: 一部コメントでエラー | エラーのコメントは空として扱い、他のコメントのリアクションは正常に返す |
| 9 | `getReactionsForComments`: コメントIDリストが空 | 空の Map が返る |

#### ReactionPicker

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 初期表示 | 8 種類のリアクションが水平に表示される。最初のアイテムが選択状態 |
| 2 | `→` で右移動 | 次のリアクションが選択される |
| 3 | `←` で左移動 | 前のリアクションが選択される |
| 4 | `l` で右移動 | `→` と同等の動作 |
| 5 | `h` で左移動 | `←` と同等の動作 |
| 6 | 右端で `→` | 左端に循環する |
| 7 | 左端で `←` | 右端に循環する |
| 8 | Enter で送信 | `onSelect` が選択中のリアクションの `shortCode` で呼ばれる |
| 9 | Esc でキャンセル | `onCancel` が呼ばれる |
| 10 | `isProcessing` が `true` | "Adding reaction..." が表示される |
| 11 | エラー表示 | エラーメッセージが表示される |
| 12 | エラー表示中にキー入力 | `onClearError` が呼ばれる |
| 13 | 送信中にキー入力 | 入力が無視される |

#### formatReactionBadge

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | リアクションなし（`undefined`） | 空文字列が返る |
| 2 | リアクションなし（空配列） | 空文字列が返る |
| 3 | 単一リアクション | `"👍×2"` のような文字列が返る |
| 4 | 複数リアクション | `"👍×2 🎉×1"` のようにスペース区切りで返る |
| 5 | カウント 0 のリアクション | 表示から除外される |

#### PullRequestDetail（コンポーネント）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | コメント行で `g` キー | ReactionPicker が表示される |
| 2 | 非コメント行で `g` キー | 何も起こらない |
| 3 | fold-indicator 行で `g` キー | 何も起こらない（commentId なし） |
| 4 | コミットビュー（viewIndex >= 0）で `g` キー | 何も起こらない |
| 5 | ReactionPicker で Enter | `onReact` が commentId と shortCode で呼ばれる |
| 6 | ReactionPicker で Esc | ピッカーが閉じて通常表示に戻る |
| 7 | `isReacting` が `true` | "Adding reaction..." が表示される |
| 8 | リアクションエラー | エラーメッセージが表示される |
| 9 | リアクション完了後 | ピッカーが閉じる |
| 10 | リアクションバッジ表示 | コメント行にリアクションバッジが表示される |
| 11 | リアクションなしのコメント | バッジなし |
| 12 | ピッカー表示中に `c` / `R` 等 | 無視される |
| 13 | フッターに `g react` が表示 | ナビゲーションヒントが更新されている |

#### App（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | リアクション追加成功 | `putReaction` が呼ばれ、該当コメントのリアクションがリロードされる |
| 2 | リアクション失敗（CommentDeleted） | "Comment has already been deleted." エラーが表示される |
| 3 | リアクション失敗（InvalidReactionValue） | "Invalid reaction value." エラーが表示される |
| 4 | リアクション失敗（AccessDenied） | "Access denied..." エラーが表示される |
| 5 | PR 詳細読み込み時にリアクション取得 | `getReactionsForComments` がコメントIDリストで呼ばれる |
| 6 | コメント投稿後のリアクションリロード | `reloadComments` 内でリアクション情報もリロードされる |

#### Help

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | ヘルプ画面表示 | `g` のキーバインドが表示される |

## 実装順序

各 Step は TDD サイクル（Red → Green → Refactor）で進める。テストを先に書き、最小限の実装で通し、その後リファクタリングする。

### Step 1: サービス層 — putReaction, getReactionsForComment, getReactionsForComments 追加

`src/services/codecommit.ts` に 3 つの関数、新規 Command の import、`ReactionSummary`, `ReactionsByComment` 型を追加。テストを追加して通過を確認。

**この Step で変更するファイル**:
- `src/services/codecommit.ts`: 関数追加、import 追加、型追加
- `src/services/codecommit.test.ts`: テスト追加

**この Step の完了条件**: 全テストが通過。既存テストに影響なし。

### Step 2: ReactionPicker コンポーネント作成

新規コンポーネントとして `ReactionPicker` を作成。8 種類のリアクションを水平リスト表示し、`←`/`→` で選択、Enter で送信、Esc でキャンセル。

**この Step で変更するファイル**:
- `src/components/ReactionPicker.tsx`: 新規作成
- `src/components/ReactionPicker.test.tsx`: 新規作成

**この Step の完了条件**: ReactionPicker の全テストが通過。

### Step 3: PullRequestDetail にリアクション表示を追加

`buildDisplayLines` と `appendThreadLines` を変更し、コメント行にリアクションバッジを表示。`renderDiffLine` を変更して `reactionText` をレンダリング。`formatReactionBadge` ヘルパーを追加。

**この Step で変更するファイル**:
- `src/components/PullRequestDetail.tsx`: `buildDisplayLines`, `appendThreadLines`, `renderDiffLine` 変更。`formatReactionBadge` 追加。`DisplayLine` に `reactionText` 追加
- `src/components/PullRequestDetail.test.tsx`: リアクションバッジ表示のテスト追加

**この Step の完了条件**: リアクションバッジが正しく表示されるテストが通過。

### Step 4: PullRequestDetail にリアクション操作 UI を統合

`g` キーハンドラ追加。リアクションピッカーの統合。Props 追加。`isPickingReaction` の状態管理。

**この Step で変更するファイル**:
- `src/components/PullRequestDetail.tsx`: state 追加、キーハンドラ追加、ReactionPicker レンダリング追加、Props 追加
- `src/components/PullRequestDetail.test.tsx`: `g` キー操作のテスト追加

**この Step の完了条件**: PullRequestDetail のリアクション操作テストが通過。

### Step 5: App にリアクションハンドラを統合

`handleReact` 追加。state 追加。`loadPullRequestDetail` にリアクション取得を追加。`reloadComments` にリアクションリロードを追加。`formatErrorMessage` 拡張。

**この Step で変更するファイル**:
- `src/app.tsx`: ハンドラ追加、state 追加、Props 渡し、`formatErrorMessage` 拡張、`loadPullRequestDetail` 変更、`reloadComments` 変更
- `src/app.test.tsx`: 統合テスト追加

**この Step の完了条件**: リアクション成功→リロードの統合テストが通過。

### Step 6: Help 更新

`g` キーバインドを追加。

**この Step で変更するファイル**:
- `src/components/Help.tsx`: キーバインド行追加
- `src/components/Help.test.tsx`: スナップショットテスト更新

**この Step の完了条件**: Help 画面に `g React to comment` が表示される。

### Step 7: 全体テスト・カバレッジ確認

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

### Step 8: ドキュメント更新

**この Step で変更するファイル**:
- `docs/requirements.md`: v0.2.0 機能スコープセクション追加、キーバインド表に `g` / `←→` / `h` / `l` 追加、エラーハンドリング表にリアクションエラー追加
- `docs/roadmap.md`: v0.2.0 セクションに ✅ マーク追加
- `README.md`: 機能一覧にリアクションを追記

**この Step の完了条件**: 要件定義書・ロードマップ・README が設計書の内容と整合している。
