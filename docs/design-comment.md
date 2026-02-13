# コメント投稿機能 設計書

> **実装完了** (2026-02-13)
>
> 設計書通りに全機能を実装。postComment サービス関数、CommentInput コンポーネント、PullRequestDetail のコメントモード、App の状態管理、Help のキーバインド追加を完了。164テスト全パス、ブランチカバレッジ 95.85%。

## 概要

PR詳細画面からコメントを投稿する機能を追加する。v0.1 では閲覧のみだったレビューワークフローに「参加」する能力を付与する。

## スコープ

### 今回やること

- PR全体に対する一般コメントの投稿
- コメント投稿後のコメント一覧自動リロード
- 投稿中のローディング表示
- エラーハンドリング（文字数制限超過、権限不足など）

### 今回やらないこと

- ファイル行単位のインラインコメント（location指定）
- コメントの編集・削除
- コメントへの返信（inReplyTo）
- リアクション機能

## AWS SDK API

### PostCommentForPullRequestCommand

```typescript
// Input (必須パラメータ)
{
  pullRequestId: string;      // PR ID
  repositoryName: string;     // リポジトリ名
  beforeCommitId: string;     // destination commit (マージ先)
  afterCommitId: string;      // source commit (マージ元)
  content: string;            // コメント本文 (最大10,240文字)
}

// Output
{
  comment: {
    commentId: string;
    content: string;
    authorArn: string;
    creationDate: Date;
  }
}
```

**制約**: `content` は空不可・最大10,240文字。

### commit ID のマッピング

CodeCommit の `PostCommentForPullRequestCommand` では:

- `beforeCommitId` = マージ先（destination）のコミット = `pullRequestTargets[0].destinationCommit`
- `afterCommitId` = マージ元（source）のコミット = `pullRequestTargets[0].sourceCommit`

これは「before（変更前）= destination ブランチの状態」「after（変更後）= source ブランチの変更を含んだ状態」という意味。既存の `getPullRequestDetail` 関数内の `GetDifferencesCommand` でも同じマッピングを使用しており、一貫性がある。

```typescript
// 既存コード（getPullRequestDetail 内）との対応
beforeCommitSpecifier: target.destinationCommit,  // = beforeCommitId
afterCommitSpecifier: target.sourceCommit,        // = afterCommitId
```

## 画面設計

### PR詳細画面（通常モード）

既存の画面にコメント投稿キーバインドを追加する。

```
┌─ PR #42: fix: login timeout ────────────────┐
│  Author: watany  Status: OPEN   2h ago       │
│  main ← feature/fix-login                    │
│──────────────────────────────────────────────│
│  src/auth.ts                                 │
│  (diff内容...)                               │
│──────────────────────────────────────────────│
│  Comments (2):                               │
│  watany: タイムアウトを延長しました          │
│  taro: LGTMです                              │
│                                              │
│  ↑↓ scroll  c comment  q back  ? help        │
└──────────────────────────────────────────────┘
```

### PR詳細画面（コメント入力モード）

`c` キー押下でコメント入力モードに遷移。画面下部にテキスト入力エリアを表示する。

```
┌─ PR #42: fix: login timeout ────────────────┐
│  Author: watany  Status: OPEN   2h ago       │
│  main ← feature/fix-login                    │
│──────────────────────────────────────────────│
│  (diff/コメント内容、表示領域は縮小)         │
│                                              │
│──────────────────────────────────────────────│
│  New Comment:                                │
│  > This looks good, but can we add a test?█  │
│                                              │
│  Enter submit  Esc cancel                    │
└──────────────────────────────────────────────┘
```

### 投稿中（ローディング）

```
│  Posting comment...                          │
```

### 投稿成功

投稿後はコメント入力モードを閉じ、コメント一覧をリロードして通常モードに戻る。
新しく投稿したコメントがコメント一覧の末尾に表示される。

### 投稿エラー

```
│  Failed to post comment: Comment content     │
│  exceeds the 10,240 character limit.         │
│  Press any key to return                     │
```

エラー表示中に任意のキーを押すと、コメント入力モードに戻り、入力中のテキストは保持される。
これにより、文字数超過時にユーザーが内容を修正して再送信できる。

## データフロー

```
App (状態管理)
 │
 ├─ isPostingComment: boolean
 ├─ commentError: string | null
 │
 └─→ PullRequestDetail (表示 + コメントモード管理)
      │
      ├─ isCommenting: boolean (ローカル状態)
      │
      ├─ Props から受け取る:
      │   ├─ onPostComment(content) ──→ App.handlePostComment()
      │   ├─ isPostingComment ──→ CommentInput.isPosting
      │   ├─ commentError ──→ CommentInput.error
      │   └─ onClearCommentError() ──→ App.setCommentError(null)
      │
      └─→ CommentInput (テキスト入力 + 送信)
           │
           ├─ Props:
           │   ├─ onSubmit(content) ──→ App.handlePostComment() (直接)
           │   ├─ onCancel() ──→ PullRequestDetail.setIsCommenting(false)
           │   ├─ isPosting ──→ ローディング表示切替
           │   ├─ error ──→ エラー表示切替
           │   └─ onClearError() ──→ App.setCommentError(null)
           │
           └─ 内部状態:
               └─ value: string (入力テキスト)
```

### 投稿フローのシーケンス

```
ユーザー          PullRequestDetail    CommentInput    App              CodeCommit API
  │                    │                   │            │                    │
  │─── c キー ────────→│                   │            │                    │
  │                    │── isCommenting=true│            │                    │
  │                    │── render ─────────→│            │                    │
  │                    │                   │            │                    │
  │─── テキスト入力 ──→│                   │            │                    │
  │                    │                   │← value更新 │                    │
  │                    │                   │            │                    │
  │─── Enter ─────────→│                   │            │                    │
  │                    │← onSubmit(text) ──│            │                    │
  │                    │── onPostComment(text) ────────→│                    │
  │                    │                   │            │── isPostingComment │
  │                    │                   │            │   = true           │
  │                    │                   │← isPosting │                    │
  │                    │                   │  =true     │                    │
  │                    │                   │「Posting.. │── postComment() ──→│
  │                    │                   │ .」表示    │                    │
  │                    │                   │            │←── comment ────────│
  │                    │                   │            │── reloadComments() │
  │                    │                   │            │── isPostingComment │
  │                    │                   │            │   = false          │
  │                    │── useEffect発火 ──│            │                    │
  │                    │   isCommenting    │            │                    │
  │                    │   = false         │            │                    │
  │                    │← 新コメント表示 ──│            │                    │
```

## コンポーネント設計

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/services/codecommit.ts` | `postComment` 関数を追加、import追加 |
| `src/services/codecommit.test.ts` | `postComment` のテスト追加 |
| `src/components/CommentInput.tsx` | **新規**: テキスト入力コンポーネント |
| `src/components/CommentInput.test.tsx` | **新規**: テスト |
| `src/components/PullRequestDetail.tsx` | コメント入力モードの統合、Props追加 |
| `src/components/PullRequestDetail.test.tsx` | コメント入力関連テスト追加 |
| `src/app.tsx` | `postComment` のコールバック・状態管理追加 |
| `src/app.test.tsx` | コメント投稿フローのテスト追加 |
| `src/components/Help.tsx` | `c` キーバインドの追加 |
| `src/components/Help.test.tsx` | ヘルプ表示テスト更新 |
| `package.json` | `ink-text-input` 依存追加 |

### 1. サービス層: `postComment`

```typescript
// src/services/codecommit.ts に追加

import {
  // 既存のimportに追加
  PostCommentForPullRequestCommand,
} from "@aws-sdk/client-codecommit";

export async function postComment(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    repositoryName: string;
    beforeCommitId: string;
    afterCommitId: string;
    content: string;
  },
): Promise<Comment> {
  const command = new PostCommentForPullRequestCommand({
    pullRequestId: params.pullRequestId,
    repositoryName: params.repositoryName,
    beforeCommitId: params.beforeCommitId,
    afterCommitId: params.afterCommitId,
    content: params.content,
  });
  const response = await client.send(command);
  return response.comment!;
}
```

### 2. CommentInput コンポーネント（新規）

```typescript
// src/components/CommentInput.tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

interface Props {
  onSubmit: (content: string) => void;
  onCancel: () => void;
  isPosting: boolean;
  error: string | null;
  onClearError: () => void;
}

export function CommentInput({ onSubmit, onCancel, isPosting, error, onClearError }: Props) {
  const [value, setValue] = useState("");

  useInput((_input, key) => {
    if (error) {
      // エラー表示中は任意のキーで入力モードに戻る
      onClearError();
      return;
    }
    if (key.escape) {
      onCancel();
    }
  });

  function handleSubmit(text: string) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
  }

  if (isPosting) {
    return (
      <Box flexDirection="column">
        <Text color="cyan">Posting comment...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Failed to post comment: {error}</Text>
        <Text dimColor>Press any key to return</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>New Comment:</Text>
      <Box>
        <Text>&gt; </Text>
        <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
      </Box>
      <Text dimColor>Enter submit  Esc cancel</Text>
    </Box>
  );
}
```

**動作仕様**:

| 状態 | 表示 | キー操作 |
|------|------|---------|
| 入力中 (`isPosting=false, error=null`) | テキスト入力欄 + ヒント | Enter: 送信、Esc: キャンセル |
| 投稿中 (`isPosting=true`) | 「Posting comment...」 | 入力無効 |
| エラー (`error` が非null) | エラーメッセージ | 任意のキー: 入力モードに復帰 |

**入力中のキーバインド無効化**:
- `ink-text-input` がフォーカスを持つため、`j`, `k` 等は通常の文字として入力される
- `PullRequestDetail` 側で `isCommenting` 状態を見て `useInput` のスクロール/ナビゲーション処理をスキップする

### 3. PullRequestDetail の変更

```typescript
// 既存の Props に追加
interface Props {
  pullRequest: PullRequest;
  differences: Difference[];
  comments: Comment[];
  diffTexts: Map<string, { before: string; after: string }>;
  onBack: () => void;
  onHelp: () => void;
  onPostComment: (content: string) => void;  // 追加
  isPostingComment: boolean;                  // 追加
  commentError: string | null;                // 追加
  onClearCommentError: () => void;            // 追加
}
```

**状態管理の追加**:

```typescript
const [isCommenting, setIsCommenting] = useState(false);
```

**useInput の変更**:

```typescript
useInput((input, key) => {
  // コメント入力中は通常キーバインドを無効化
  if (isCommenting) return;

  if (input === "q" || key.escape) {
    onBack();
    return;
  }
  if (input === "?") {
    onHelp();
    return;
  }
  if (input === "j" || key.downArrow) {
    setScrollOffset((prev) => Math.min(prev + 1, Math.max(0, lines.length - 10)));
    return;
  }
  if (input === "k" || key.upArrow) {
    setScrollOffset((prev) => Math.max(prev - 1, 0));
    return;
  }
  if (input === "c") {
    setIsCommenting(true);
    return;
  }
});
```

**レンダリングの変更**:

**投稿成功時の自動クローズ**:

`isCommenting` は投稿成功後に自動で `false` に戻す。`useEffect` で `isPostingComment` の変化を監視し、投稿完了（`isPostingComment` が `true` → `false`）かつエラーなし（`commentError === null`）のとき `setIsCommenting(false)` を実行する。

```typescript
const [wasPosting, setWasPosting] = useState(false);

useEffect(() => {
  if (isPostingComment) {
    setWasPosting(true);
  } else if (wasPosting && !commentError) {
    // 投稿成功: コメントモードを閉じる
    setIsCommenting(false);
    setWasPosting(false);
  } else {
    setWasPosting(false);
  }
}, [isPostingComment, commentError]);
```

**レンダリングの変更**:

```tsx
// 表示可能行数をコメント入力時は削減
const visibleLineCount = isCommenting ? 20 : 30;
const visibleLines = lines.slice(scrollOffset, scrollOffset + visibleLineCount);

return (
  <Box flexDirection="column" padding={1}>
    {/* 既存のヘッダー・diff表示 */}
    {/* ... */}

    {isCommenting && (
      <CommentInput
        onSubmit={onPostComment}
        onCancel={() => setIsCommenting(false)}
        isPosting={isPostingComment}
        error={commentError}
        onClearError={onClearCommentError}
      />
    )}

    <Box marginTop={1}>
      <Text dimColor>
        {isCommenting ? "" : "↑↓ scroll  c comment  q back  ? help"}
      </Text>
    </Box>
  </Box>
);
```

これにより、投稿フローは以下の順序で動作する:
1. ユーザーが Enter → `onPostComment(content)` が呼ばれる
2. App が `isPostingComment=true` に設定 → CommentInput が「Posting comment...」を表示
3. API成功 → App が `isPostingComment=false`, `commentError=null` に設定
4. `useEffect` が発火 → `setIsCommenting(false)` → CommentInput がアンマウント
5. API失敗 → App が `isPostingComment=false`, `commentError="..."` に設定
6. CommentInput がエラーメッセージを表示 → ユーザーが任意キーで入力モードに復帰

### 4. App の変更

```typescript
// 新規import追加
import { postComment } from "./services/codecommit.js";

// 新規state追加
const [isPostingComment, setIsPostingComment] = useState(false);
const [commentError, setCommentError] = useState<string | null>(null);

// コメント投稿ハンドラ
async function handlePostComment(content: string) {
  if (!prDetail) return;
  const target = prDetail.pullRequestTargets?.[0];
  if (!target?.destinationCommit || !target?.sourceCommit) return;

  setIsPostingComment(true);
  setCommentError(null);
  try {
    await postComment(client, {
      pullRequestId: prDetail.pullRequestId!,
      repositoryName: selectedRepo,
      beforeCommitId: target.destinationCommit,
      afterCommitId: target.sourceCommit,
      content,
    });
    // 成功時: コメントをリロード
    await reloadComments(prDetail.pullRequestId!);
  } catch (err) {
    setCommentError(formatCommentError(err));
  } finally {
    setIsPostingComment(false);
  }
}

// コメントのみの軽量リロード
async function reloadComments(pullRequestId: string) {
  const detail = await getPullRequestDetail(client, pullRequestId, selectedRepo);
  setPrComments(detail.comments);
}

// コメント投稿エラーのフォーマット
function formatCommentError(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name;
    if (name === "CommentContentRequiredException") {
      return "Comment cannot be empty.";
    }
    if (name === "CommentContentSizeLimitExceededException") {
      return "Comment exceeds the 10,240 character limit.";
    }
    if (name === "AccessDeniedException" || name === "UnauthorizedException") {
      return "Access denied. Check your IAM policy allows CodeCommit write access.";
    }
    if (name === "PullRequestDoesNotExistException") {
      return "Pull request not found.";
    }
    return err.message;
  }
  return String(err);
}
```

**PullRequestDetail へのProps追加**:

```tsx
case "detail":
  if (!prDetail) return null;
  return (
    <PullRequestDetail
      pullRequest={prDetail}
      differences={prDifferences}
      comments={prComments}
      diffTexts={diffTexts}
      onBack={handleBack}
      onHelp={() => setShowHelp(true)}
      onPostComment={handlePostComment}
      isPostingComment={isPostingComment}
      commentError={commentError}
      onClearCommentError={() => setCommentError(null)}
    />
  );
```

### 5. Help の変更

```typescript
<Text>  c          Post comment (PR Detail)</Text>
```

## キーバインド一覧（更新後）

| キー | 動作 | 画面 |
|------|------|------|
| `j` / `↓` | カーソル下移動 | 全画面（コメント入力中は無効） |
| `k` / `↑` | カーソル上移動 | 全画面（コメント入力中は無効） |
| `Enter` | 選択・決定 / コメント送信 | リスト画面 / コメント入力 |
| `q` / `Esc` | 前の画面に戻る / コメント入力キャンセル | 全画面 / コメント入力 |
| `Ctrl+C` | 即座に終了 | 全画面 |
| `?` | ヘルプ表示 | 全画面（コメント入力中は無効） |
| `c` | コメント入力モード開始 | PR詳細画面 |

## エラーハンドリング

### コメント投稿エラー

| エラー | 表示メッセージ |
|--------|---------------|
| `CommentContentRequiredException` | "Comment cannot be empty." |
| `CommentContentSizeLimitExceededException` | "Comment exceeds the 10,240 character limit." |
| `AccessDeniedException` / `UnauthorizedException` | "Access denied. Check your IAM policy allows CodeCommit write access." |
| `PullRequestDoesNotExistException` | "Pull request not found." |
| その他 | エラーメッセージをそのまま表示 |

### エッジケースと対処方針

| ケース | 対処 |
|--------|------|
| 空文字で送信しようとした | `handleSubmit` で `trim()` 後に空文字チェック。送信しない |
| `pullRequestTargets` が空、または commit ID が欠損 | `handlePostComment` 先頭のガード節で早期 return。UI上は何も起きない（この状態ではdiff自体も表示されていないため、ユーザーが `c` を押す可能性は低い） |
| 投稿中に `Ctrl+C` が押された | Ink のデフォルト動作でプロセスが終了する。AWS SDK のリクエストは中断される。投稿が到達済みの場合、コメントはサーバーに残る |
| ネットワークエラー | エラーメッセージをそのまま表示。ユーザーは任意キーで入力モードに戻り再送信可能 |

## セキュリティ考慮

### IAM 権限

コメント投稿には、v0.1 の読み取り権限に加えて以下の書き込み権限が必要:

```json
{
  "Effect": "Allow",
  "Action": [
    "codecommit:PostCommentForPullRequest"
  ],
  "Resource": "arn:aws:codecommit:<region>:<account-id>:<repository-name>"
}
```

権限不足の場合は `AccessDeniedException` がスローされ、エラーハンドリングテーブルに従いユーザーに案内する。

### 入力バリデーション

- **サーバーサイド**: AWS SDK が `content` の空文字チェック・文字数制限（10,240文字）を検証する。クライアントサイドでの重複バリデーションは行わない（空文字のみ `trim()` 後にクライアント側でブロック）
- **インジェクション**: コメント内容はCodeCommit APIにそのまま渡すプレーンテキスト。HTML/SQLインジェクションのリスクはない（CodeCommitがテキストとして保存・返却する）

### 認証

既存の AWS SDK 標準認証チェーン（環境変数、`~/.aws/credentials`、`--profile` オプション）をそのまま使用する。コメント投稿のために追加の認証フローは不要。

## 技術選定

### `ink-text-input` の採用

| 選択肢 | 評価 |
|--------|------|
| **`ink-text-input`（採用）** | Ink 公式メンテナンスのテキスト入力コンポーネント。カーソル移動、文字削除、Enter/Escのハンドリングを内包。Ink 6.x 対応済み。依存が少なく軽量 |
| 自前実装 | `useInput` と `useState` で実装可能だが、カーソル位置管理、日本語入力対応などの複雑さがある。既に解決済みの問題を再実装するメリットがない |

**バージョン**: `ink-text-input@^6.0.0` を使用。Ink 6.x（React 18+）対応版。プロジェクトは Ink 6.7 + React 19.2 なので互換性あり。

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `postComment` | `vi.fn()` で `client.send` をモック。正常系・異常系をテスト |
| `CommentInput` | `ink-testing-library` でレンダリング。入力・送信・キャンセル・エラー表示をテスト |
| `PullRequestDetail` | `c` キーでコメントモード遷移、`Esc` でキャンセルのテスト追加 |
| `App` | コメント投稿フロー（成功 → リロード、失敗 → エラー表示）の統合テスト |

カバレッジ95%以上を維持する。

### 具体的なテストケース

#### `postComment`（サービス層）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 正常にコメント投稿 | `PostCommentForPullRequestCommand` が正しいパラメータで呼ばれ、`Comment` が返る |
| 2 | API がエラーをスロー | エラーがそのまま上位に伝播する |

#### `CommentInput`（コンポーネント）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 初期レンダリング | 「New Comment:」ラベルとテキスト入力欄、ヒントが表示される |
| 2 | テキスト入力後に Enter | `onSubmit` が入力テキストで呼ばれる |
| 3 | 空文字で Enter | `onSubmit` は呼ばれない |
| 4 | Esc キー | `onCancel` が呼ばれる |
| 5 | `isPosting=true` | 「Posting comment...」が表示される |
| 6 | `error` が非null | エラーメッセージと「Press any key to return」が表示される |
| 7 | エラー表示中に任意キー | `onClearError` が呼ばれる |

#### `PullRequestDetail`（コンポーネント）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `c` キー押下 | CommentInput が表示される |
| 2 | コメントモード中に `j` キー | スクロールしない（通常キーバインド無効） |
| 3 | フッターに `c comment` 表示 | ナビゲーションヒントが更新されている |
| 4 | `isPostingComment` が true→false（エラーなし） | コメントモードが自動的に閉じる |
| 5 | `isPostingComment` が true→false（エラーあり） | コメントモードは閉じない（エラー表示） |

#### `App`（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | PR詳細でコメント投稿成功 | `postComment` が呼ばれ、コメント一覧がリロードされる |
| 2 | コメント投稿失敗 | エラーメッセージが表示される |
| 3 | `pullRequestTargets` なしで投稿試行 | ガード節で早期return、APIは呼ばれない |

#### `Help`

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | ヘルプ画面表示 | 「c」キーバインドが表示される |

## 実装順序

### Step 1: 依存パッケージ追加

`ink-text-input` を dependencies に追加。

```bash
bun add ink-text-input
```

### Step 2: サービス層

`src/services/codecommit.ts` に `postComment` 関数と `PostCommentForPullRequestCommand` の import を追加。テストを追加して通過を確認。

### Step 3: CommentInput コンポーネント

`src/components/CommentInput.tsx` を新規作成。`ink-text-input` を使用したテキスト入力UI。テストを追加して通過を確認。

### Step 4: PullRequestDetail の変更

Props の追加（`onPostComment`, `isPostingComment`, `commentError`, `onClearCommentError`）。`isCommenting` ローカル状態の追加。`useInput` のガード条件追加。`CommentInput` の条件付きレンダリング。テストを追加して通過を確認。

### Step 5: App の変更

`handlePostComment`, `reloadComments`, `formatCommentError` の追加。state の追加（`isPostingComment`, `commentError`）。`PullRequestDetail` への Props 受け渡し。テストを追加して通過を確認。

### Step 6: Help の変更

`c` キーバインドの行を追加。テストを更新して通過を確認。

### Step 7: 全体テスト・カバレッジ確認

```bash
bun run test
bun run lint
bun run check
```

カバレッジ95%以上を確認。

### Step 8: ドキュメント更新

要件定義書（`docs/requirements.md`）と README（`README.md`）を更新。
