# Approve / Revoke 機能 設計書

## 概要

PR 詳細画面から承認（Approve）および承認取り消し（Revoke）操作を行う機能を追加する。v0.2 のコメント投稿に続き、レビューワークフローの核となる「意思決定」をターミナルから完結させる。

## スコープ

### 今回やること

- PR の承認（`a` キー）
- 承認の取り消し（`r` キー）
- 操作前の確認プロンプト（誤操作防止）
- PR 詳細画面に承認者一覧と承認状態の表示
- 承認ルールの評価結果表示（satisfied / not satisfied）

### 今回やらないこと

- 承認ルールの作成・編集・削除
- 承認ルールテンプレートの管理
- 承認ルールのオーバーライド
- 承認状態による PR 一覧のフィルタリング

## AWS SDK API

### UpdatePullRequestApprovalStateCommand

承認状態を更新する。Approve と Revoke の両方でこの API を使用。

```typescript
// Input
{
  pullRequestId: string;        // 必須: PR ID
  revisionId: string;           // 必須: PR のリビジョン ID
  approvalState: ApprovalState; // 必須: "APPROVE" | "REVOKE"
}

// Output
{} // 空レスポンス（HTTP 200 で成功を判定）
```

**制約**:
- `revisionId` は `PullRequest.revisionId` から取得可能
- 自分自身が作成した PR も承認可能（CodeCommit の仕様）
- 同一ユーザーが再度 Approve しても冪等（エラーにならない）

### GetPullRequestApprovalStatesCommand

現在の承認状態を取得する。

```typescript
// Input
{
  pullRequestId: string; // 必須: PR ID
  revisionId: string;    // 必須: PR のリビジョン ID
}

// Output
{
  approvals?: Approval[];
}

// Approval 型
interface Approval {
  userArn?: string;              // 承認者の ARN
  approvalState?: ApprovalState; // "APPROVE" | "REVOKE"
}
```

### EvaluatePullRequestApprovalRulesCommand

承認ルールの評価結果を取得する。

```typescript
// Input
{
  pullRequestId: string; // 必須: PR ID
  revisionId: string;    // 必須: PR のリビジョン ID
}

// Output
{
  evaluation?: Evaluation;
}

// Evaluation 型
interface Evaluation {
  approved?: boolean;                    // PR が承認済み状態か
  overridden?: boolean;                  // 承認ルールがオーバーライドされているか
  approvalRulesSatisfied?: string[];     // 満たされた承認ルール名
  approvalRulesNotSatisfied?: string[];  // 満たされていない承認ルール名
}
```

### revisionId の取得

`revisionId` は `PullRequest` オブジェクトの一部として取得済み。既存の `getPullRequestDetail` で `GetPullRequestCommand` を呼び出しており、そのレスポンスの `pullRequest.revisionId` から取得できる。

```typescript
// 既存コード（getPullRequestDetail 内）
const getCommand = new GetPullRequestCommand({ pullRequestId });
const getResponse = await client.send(getCommand);
const pullRequest = getResponse.pullRequest!;
// pullRequest.revisionId が利用可能
```

追加の API コールは不要。

## 画面設計

### PR 詳細画面（通常モード — 承認状態表示追加）

ヘッダー部に承認者一覧と承認ルール評価を表示。

```
┌─ PR #42: fix: login timeout ────────────────┐
│  Author: watany  Status: OPEN   2h ago       │
│  main ← feature/fix-login                    │
│  Approvals: taro ✓                           │
│  Rules: ✓ Approved (1/1 rules satisfied)     │
│──────────────────────────────────────────────│
│  (diff/コメント)                              │
│                                              │
│  ↑↓ scroll  c comment  a approve  r revoke   │
│  q back  ? help                              │
└──────────────────────────────────────────────┘
```

承認者がいない場合:

```
│  Approvals: (none)                           │
│  Rules: ✗ Not approved (0/1 rules satisfied) │
```

承認ルールが未設定の場合:

```
│  Approvals: taro ✓                           │
```

（Rules 行を非表示にする）

### 確認プロンプト（Approve）

`a` キー押下で確認プロンプトを表示。

```
┌─ PR #42: fix: login timeout ────────────────┐
│  Author: watany  Status: OPEN   2h ago       │
│  main ← feature/fix-login                    │
│  Approvals: (none)                           │
│──────────────────────────────────────────────│
│  (diff/コメント)                              │
│                                              │
│──────────────────────────────────────────────│
│  Approve this pull request? (y/n)            │
└──────────────────────────────────────────────┘
```

### 確認プロンプト（Revoke）

`r` キー押下で確認プロンプトを表示。

```
│  Revoke your approval? (y/n)                 │
```

### 操作中（ローディング）

```
│  Approving...                                │
```

または

```
│  Revoking approval...                        │
```

### 操作成功

操作成功後は確認プロンプトを閉じ、承認状態を再取得して通常モードに戻る。
承認者一覧が更新され、ユーザーの操作結果が反映される。

### 操作エラー

```
│  Failed to approve: Access denied. Check     │
│  your IAM policy.                            │
│  Press any key to return                     │
```

エラー表示中に任意のキーを押すと確認プロンプトを閉じ、通常モードに戻る。
v0.2 のコメント投稿ではエラー後に入力モードに復帰する（テキストを修正して再送信可能）が、承認操作には修正可能な入力がないため、通常モードに戻す方が自然。ユーザーは再度 `a` / `r` キーで再試行できる。

## データフロー

```
App (状態管理)
 │
 ├─ approvals: Approval[]
 ├─ approvalEvaluation: Evaluation | null
 ├─ isApproving: boolean
 ├─ approvalError: string | null
 │
 └─→ PullRequestDetail (表示 + 確認プロンプト管理)
      │
      ├─ approvalAction: "approve" | "revoke" | null (ローカル状態)
      │
      ├─ Props から受け取る:
      │   ├─ approvals ──→ 承認者一覧表示
      │   ├─ approvalEvaluation ──→ 承認ルール評価表示
      │   ├─ onApprove() ──→ App.handleApprove()
      │   ├─ onRevoke() ──→ App.handleRevoke()
      │   ├─ isApproving ──→ ローディング表示
      │   ├─ approvalError ──→ エラー表示
      │   └─ onClearApprovalError() ──→ App.setApprovalError(null)
      │
      └─→ ConfirmPrompt (確認表示 + y/n 入力)
           │
           ├─ Props:
           │   ├─ message ──→ 確認メッセージ
           │   ├─ onConfirm() ──→ PullRequestDetail → App
           │   ├─ onCancel() ──→ PullRequestDetail.setApprovalAction(null) + App.setApprovalError(null)
           │   ├─ isProcessing ──→ ローディング表示切替
           │   ├─ error ──→ エラー表示切替
           │   └─ onClearError() ──→ App.setApprovalError(null) + PullRequestDetail.setApprovalAction(null)
           │
           └─ 内部状態: なし（ステートレス）
```

### 承認フローのシーケンス

```
ユーザー          PullRequestDetail   ConfirmPrompt    App              CodeCommit API
  │                    │                   │            │                    │
  │─── a キー ────────→│                   │            │                    │
  │                    │── approvalAction  │            │                    │
  │                    │   ="approve"      │            │                    │
  │                    │── render ─────────→│            │                    │
  │                    │                   │「Approve   │                    │
  │                    │                   │ this PR?   │                    │
  │                    │                   │ (y/n)」    │                    │
  │                    │                   │            │                    │
  │─── y キー ────────→│                   │            │                    │
  │                    │← onConfirm() ────│            │                    │
  │                    │── onApprove() ───────────────→│                    │
  │                    │                   │            │── isApproving      │
  │                    │                   │            │   = true           │
  │                    │                   │← isProc.  │                    │
  │                    │                   │  =true     │                    │
  │                    │                   │「Approving │── updateApproval() │
  │                    │                   │ ...」表示  │───────────────────→│
  │                    │                   │            │←── success ────────│
  │                    │                   │            │── reloadApprovals()│
  │                    │                   │            │── isApproving      │
  │                    │                   │            │   = false          │
  │                    │── useEffect発火 ──│            │                    │
  │                    │   approvalAction  │            │                    │
  │                    │   = null          │            │                    │
  │                    │← 承認状態更新表示 │            │                    │
```

キャンセルフロー:

```
ユーザー          PullRequestDetail   ConfirmPrompt
  │                    │                   │
  │─── a キー ────────→│                   │
  │                    │── render ─────────→│
  │                    │                   │
  │─── n / Esc ───────→│                   │
  │                    │← onCancel() ─────│
  │                    │── approvalAction  │
  │                    │   = null          │
  │                    │← 通常モードに復帰│
```

## コンポーネント設計

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/services/codecommit.ts` | `updateApprovalState`, `getApprovalStates`, `evaluateApprovalRules` 関数を追加 |
| `src/services/codecommit.test.ts` | 上記3関数のテスト追加 |
| `src/components/ConfirmPrompt.tsx` | **新規**: 確認プロンプトコンポーネント |
| `src/components/ConfirmPrompt.test.tsx` | **新規**: テスト |
| `src/components/PullRequestDetail.tsx` | 承認状態表示、確認プロンプト統合、Props 追加 |
| `src/components/PullRequestDetail.test.tsx` | 承認関連テスト追加 |
| `src/app.tsx` | 承認状態管理・ハンドラ追加、承認状態の取得処理追加 |
| `src/app.test.tsx` | 承認フローの統合テスト追加 |
| `src/components/Help.tsx` | `a` / `r` キーバインドの追加 |
| `src/components/Help.test.tsx` | ヘルプ表示テスト更新 |

### 1. サービス層

```typescript
// src/services/codecommit.ts に追加

import {
  // 既存の import に追加
  UpdatePullRequestApprovalStateCommand,
  GetPullRequestApprovalStatesCommand,
  EvaluatePullRequestApprovalRulesCommand,
  type Approval,
  type Evaluation,
} from "@aws-sdk/client-codecommit";

export async function updateApprovalState(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    revisionId: string;
    approvalState: "APPROVE" | "REVOKE";
  },
): Promise<void> {
  const command = new UpdatePullRequestApprovalStateCommand({
    pullRequestId: params.pullRequestId,
    revisionId: params.revisionId,
    approvalState: params.approvalState,
  });
  await client.send(command);
}

export async function getApprovalStates(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    revisionId: string;
  },
): Promise<Approval[]> {
  const command = new GetPullRequestApprovalStatesCommand({
    pullRequestId: params.pullRequestId,
    revisionId: params.revisionId,
  });
  const response = await client.send(command);
  return response.approvals ?? [];
}

export async function evaluateApprovalRules(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    revisionId: string;
  },
): Promise<Evaluation | null> {
  const command = new EvaluatePullRequestApprovalRulesCommand({
    pullRequestId: params.pullRequestId,
    revisionId: params.revisionId,
  });
  const response = await client.send(command);
  return response.evaluation ?? null;
}
```

### 2. ConfirmPrompt コンポーネント（新規）

確認プロンプトは v0.3 だけでなく、v0.6（マージ確認）や v0.7（削除確認）でも再利用できる汎用コンポーネントとして設計する。

```typescript
// src/components/ConfirmPrompt.tsx
import React from "react";
import { Box, Text, useInput } from "ink";

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
  processingMessage: string;
  error: string | null;
  onClearError: () => void;
}

export function ConfirmPrompt({
  message,
  onConfirm,
  onCancel,
  isProcessing,
  processingMessage,
  error,
  onClearError,
}: Props) {
  useInput((input, key) => {
    if (error) {
      onClearError();
      return;
    }
    if (isProcessing) return;

    if (input === "y" || input === "Y") {
      onConfirm();
      return;
    }
    if (input === "n" || input === "N" || key.escape) {
      onCancel();
      return;
    }
  });

  if (isProcessing) {
    return (
      <Box flexDirection="column">
        <Text color="cyan">{processingMessage}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">{error}</Text>
        <Text dimColor>Press any key to return</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>{message} (y/n)</Text>
    </Box>
  );
}
```

**動作仕様**:

| 状態 | 表示 | キー操作 |
|------|------|---------|
| 確認待ち (`isProcessing=false, error=null`) | 確認メッセージ + (y/n) | y: 確定、n/Esc: キャンセル |
| 処理中 (`isProcessing=true`) | processingMessage | 入力無効 |
| エラー (`error` が非null) | エラーメッセージ + 「Press any key to return」 | 任意のキー: 確認プロンプトを閉じ、通常モードに復帰 |

**再利用性**:
- `message`, `processingMessage` を外部から注入するため、Approve/Revoke/Merge/Delete 等に汎用的に使える
- 状態管理は親コンポーネントに委任（ConfirmPrompt 自体はステートレス）

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
  onPostComment: (content: string) => void;
  isPostingComment: boolean;
  commentError: string | null;
  onClearCommentError: () => void;
  // v0.3 追加
  approvals: Approval[];                     // 追加
  approvalEvaluation: Evaluation | null;     // 追加
  onApprove: () => void;                     // 追加
  onRevoke: () => void;                      // 追加
  isApproving: boolean;                      // 追加
  approvalError: string | null;              // 追加
  onClearApprovalError: () => void;          // 追加
}
```

**状態管理の追加**:

```typescript
const [approvalAction, setApprovalAction] = useState<"approve" | "revoke" | null>(null);
const [wasApproving, setWasApproving] = useState(false);
```

**useEffect の追加（操作成功時の自動クローズ）**:

```typescript
useEffect(() => {
  if (isApproving) {
    setWasApproving(true);
  } else if (wasApproving && !approvalError) {
    setApprovalAction(null);
    setWasApproving(false);
  } else {
    setWasApproving(false);
  }
}, [isApproving, approvalError]);
```

このパターンは v0.2 コメント投稿の `wasPosting` パターンと同一。操作成功（`isApproving` が `true` → `false` かつエラーなし）で確認プロンプトを自動的に閉じる。

**useInput の変更**:

```typescript
useInput((input, key) => {
  if (isCommenting || approvalAction) return;

  // ... 既存のキーバインド ...

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

`approvalAction` が非 null の場合、通常のキーバインドを無効化する。`ConfirmPrompt` が `useInput` で y/n を処理するため、二重にハンドリングされることはない。

**承認状態の表示**:

ヘッダー部分（ブランチ情報の下）に承認者一覧と承認ルール評価を追加。

```tsx
<Box marginBottom={1}>
  <Text dimColor>
    {destRef} ← {sourceRef}
  </Text>
</Box>

{/* v0.3: 承認状態表示 */}
<Box>
  <Text>
    Approvals: {approvals.length > 0
      ? approvals
          .filter((a) => a.approvalState === "APPROVE")
          .map((a) => extractAuthorName(a.userArn ?? ""))
          .join(", ") + " ✓"
      : "(none)"}
  </Text>
</Box>
{approvalEvaluation && (
  <Box marginBottom={1}>
    <Text>
      Rules: {approvalEvaluation.approved ? "✓" : "✗"}{" "}
      {approvalEvaluation.approved ? "Approved" : "Not approved"}
      {(approvalEvaluation.approvalRulesSatisfied?.length ?? 0) +
        (approvalEvaluation.approvalRulesNotSatisfied?.length ?? 0) > 0 &&
        ` (${approvalEvaluation.approvalRulesSatisfied?.length ?? 0}/${
          (approvalEvaluation.approvalRulesSatisfied?.length ?? 0) +
          (approvalEvaluation.approvalRulesNotSatisfied?.length ?? 0)
        } rules satisfied)`}
    </Text>
  </Box>
)}
```

**表示ロジックの詳細**:

| 条件 | 表示 |
|------|------|
| 承認者あり | `Approvals: taro, hanako ✓` |
| 承認者なし | `Approvals: (none)` |
| 承認ルールあり & 全て satisfied | `Rules: ✓ Approved (2/2 rules satisfied)` |
| 承認ルールあり & 一部 not satisfied | `Rules: ✗ Not approved (1/2 rules satisfied)` |
| 承認ルールなし（evaluation が null、またはルール数が 0） | Rules 行を非表示 |

**ConfirmPrompt の条件付きレンダリング**:

```tsx
{approvalAction && (
  <ConfirmPrompt
    message={
      approvalAction === "approve"
        ? "Approve this pull request?"
        : "Revoke your approval?"
    }
    onConfirm={approvalAction === "approve" ? onApprove : onRevoke}
    onCancel={() => {
      setApprovalAction(null);
      onClearApprovalError();
    }}
    isProcessing={isApproving}
    processingMessage={
      approvalAction === "approve" ? "Approving..." : "Revoking approval..."
    }
    error={approvalError}
    onClearError={() => {
      onClearApprovalError();
      setApprovalAction(null);
    }}
  />
)}
```

**フッターの変更**:

```tsx
<Box marginTop={1}>
  <Text dimColor>
    {isCommenting || approvalAction
      ? ""
      : "↑↓ scroll  c comment  a approve  r revoke  q back  ? help"}
  </Text>
</Box>
```

**visibleLineCount の調整**:

```typescript
const visibleLineCount = isCommenting || approvalAction ? 20 : 30;
```

### 4. App の変更

```typescript
// 新規 import 追加
import {
  updateApprovalState,
  getApprovalStates,
  evaluateApprovalRules,
} from "./services/codecommit.js";
import type { Approval, Evaluation } from "@aws-sdk/client-codecommit";

// 新規 state 追加
const [approvals, setApprovals] = useState<Approval[]>([]);
const [approvalEvaluation, setApprovalEvaluation] = useState<Evaluation | null>(null);
const [isApproving, setIsApproving] = useState(false);
const [approvalError, setApprovalError] = useState<string | null>(null);
```

**承認状態の取得（loadPullRequestDetail 内に追加）**:

```typescript
async function loadPullRequestDetail(pullRequestId: string) {
  setLoading(true);
  setError(null);
  try {
    const detail = await getPullRequestDetail(client, pullRequestId, selectedRepo);
    setPrDetail(detail.pullRequest);
    setPrDifferences(detail.differences);
    setPrComments(detail.comments);

    // v0.3: 承認状態を取得
    const revisionId = detail.pullRequest.revisionId;
    if (revisionId) {
      const [approvalStates, evaluation] = await Promise.all([
        getApprovalStates(client, { pullRequestId, revisionId }),
        evaluateApprovalRules(client, { pullRequestId, revisionId }).catch(() => null),
      ]);
      setApprovals(approvalStates);
      setApprovalEvaluation(evaluation);
    }

    // ... 既存の diff テキスト取得 ...
  } catch (err) {
    setError(formatError(err));
  } finally {
    setLoading(false);
  }
}
```

**`evaluateApprovalRules` の `.catch(() => null)` について**: 承認ルールが設定されていないリポジトリでは、この API がエラーを返す場合がある。承認ルール評価はオプショナルな情報のため、失敗時は `null` として扱い、表示をスキップする。

**承認ハンドラ**:

```typescript
async function handleApprove() {
  if (!prDetail?.pullRequestId || !prDetail?.revisionId) return;

  setIsApproving(true);
  setApprovalError(null);
  try {
    await updateApprovalState(client, {
      pullRequestId: prDetail.pullRequestId,
      revisionId: prDetail.revisionId,
      approvalState: "APPROVE",
    });
    await reloadApprovals(prDetail.pullRequestId, prDetail.revisionId);
  } catch (err) {
    setApprovalError(formatApprovalError(err));
  } finally {
    setIsApproving(false);
  }
}

async function handleRevoke() {
  if (!prDetail?.pullRequestId || !prDetail?.revisionId) return;

  setIsApproving(true);
  setApprovalError(null);
  try {
    await updateApprovalState(client, {
      pullRequestId: prDetail.pullRequestId,
      revisionId: prDetail.revisionId,
      approvalState: "REVOKE",
    });
    await reloadApprovals(prDetail.pullRequestId, prDetail.revisionId);
  } catch (err) {
    setApprovalError(formatApprovalError(err));
  } finally {
    setIsApproving(false);
  }
}
```

**承認状態のリロード**:

```typescript
async function reloadApprovals(pullRequestId: string, revisionId: string) {
  const [approvalStates, evaluation] = await Promise.all([
    getApprovalStates(client, { pullRequestId, revisionId }),
    evaluateApprovalRules(client, { pullRequestId, revisionId }).catch(() => null),
  ]);
  setApprovals(approvalStates);
  setApprovalEvaluation(evaluation);
}
```

**エラーフォーマット**:

```typescript
function formatApprovalError(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name;
    if (name === "PullRequestDoesNotExistException") {
      return "Pull request not found.";
    }
    if (name === "RevisionIdRequiredException" || name === "InvalidRevisionIdException") {
      return "Invalid revision. The PR may have been updated. Go back and reopen.";
    }
    if (name === "PullRequestCannotBeApprovedByAuthorException") {
      return "Cannot approve your own pull request.";
    }
    if (name === "AccessDeniedException" || name === "UnauthorizedException") {
      return "Access denied. Check your IAM policy.";
    }
    if (name === "PullRequestAlreadyClosedException") {
      return "Pull request is already closed.";
    }
    if (name === "EncryptionKeyAccessDeniedException") {
      return "Encryption key access denied.";
    }
    return err.message;
  }
  return String(err);
}
```

**PullRequestDetail への Props 追加**:

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
      // v0.3 追加
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

### 5. Help の変更

```typescript
<Text> c          Post comment (PR Detail)</Text>
<Text> a          Approve PR (PR Detail)</Text>
<Text> r          Revoke approval (PR Detail)</Text>
```

## キーバインド一覧（更新後）

| キー | 動作 | 画面 |
|------|------|------|
| `j` / `↓` | カーソル下移動 | 全画面（コメント入力中・確認プロンプト中は無効） |
| `k` / `↑` | カーソル上移動 | 全画面（コメント入力中・確認プロンプト中は無効） |
| `Enter` | 選択・決定 / コメント送信 | リスト画面 / コメント入力 |
| `q` / `Esc` | 前の画面に戻る / キャンセル | 全画面 / コメント入力 / 確認プロンプト |
| `Ctrl+C` | 即座に終了 | 全画面 |
| `?` | ヘルプ表示 | 全画面（コメント入力中・確認プロンプト中は無効） |
| `c` | コメント入力モード開始 | PR 詳細画面 |
| `a` | PR を承認（確認プロンプト表示） | PR 詳細画面 |
| `r` | 承認を取り消し（確認プロンプト表示） | PR 詳細画面 |

## エラーハンドリング

### 承認操作エラー

| エラー | 表示メッセージ |
|--------|---------------|
| `PullRequestDoesNotExistException` | "Pull request not found." |
| `RevisionIdRequiredException` / `InvalidRevisionIdException` | "Invalid revision. The PR may have been updated. Go back and reopen." |
| `PullRequestCannotBeApprovedByAuthorException` | "Cannot approve your own pull request." |
| `AccessDeniedException` / `UnauthorizedException` | "Access denied. Check your IAM policy." |
| `PullRequestAlreadyClosedException` | "Pull request is already closed." |
| `EncryptionKeyAccessDeniedException` | "Encryption key access denied." |
| その他 | エラーメッセージをそのまま表示 |

### エッジケースと対処方針

| ケース | 対処 |
|--------|------|
| `revisionId` が欠損 | `handleApprove` / `handleRevoke` の先頭ガード節で早期 return。UI 上は何も起きない |
| 自分が作成した PR を承認 | CodeCommit の設定次第。`PullRequestCannotBeApprovedByAuthorException` の場合は専用メッセージを表示 |
| 既に承認済みの PR を再度承認 | API は冪等なのでエラーにならない。承認者一覧は変わらない |
| Revoke 時に自分が承認していない | API はエラーを返さない。承認者一覧は変わらない |
| 操作中に `Ctrl+C` | Ink のデフォルト動作でプロセス終了。API リクエストが到達済みの場合、操作はサーバーに反映される |
| PR が別のユーザーにより更新（revisionId 変更） | `InvalidRevisionIdException` が発生。「Go back and reopen」メッセージでユーザーに再取得を案内 |
| 承認ルール未設定のリポジトリ | `evaluateApprovalRules` を `.catch(() => null)` で処理。Rules 行を非表示にする |
| コメント入力中に `a` / `r` | `isCommenting` チェックにより無効化される |
| 確認プロンプト中に `c` | `approvalAction` チェックにより無効化される |

## セキュリティ考慮

### IAM 権限

承認操作には、v0.2 までの権限に加えて以下の書き込み権限が必要:

```json
{
  "Effect": "Allow",
  "Action": [
    "codecommit:UpdatePullRequestApprovalState",
    "codecommit:GetPullRequestApprovalStates",
    "codecommit:EvaluatePullRequestApprovalRules"
  ],
  "Resource": "arn:aws:codecommit:<region>:<account-id>:<repository-name>"
}
```

権限不足の場合は `AccessDeniedException` がスローされ、エラーハンドリングテーブルに従いユーザーに案内する。

`GetPullRequestApprovalStates` と `EvaluatePullRequestApprovalRules` は読み取り操作だが、最小権限の原則として明示的に記載。

### 入力バリデーション

v0.2 のコメント投稿では `content` が自由テキスト（最大 10,240 文字）であるため、空文字チェックやサイズ制限が必要だった。v0.3 の承認操作では:

- **ユーザー入力は `y` / `n` の1キーのみ**: ConfirmPrompt が `y` / `n` / `Esc` 以外のキーを無視するため、不正入力は到達しない
- **API パラメータは固定値**: `approvalState` は `"APPROVE"` / `"REVOKE"` のリテラル値をコードから渡すため、インジェクションリスクはない
- **`revisionId` は PullRequest オブジェクトから取得**: ユーザー入力ではないため、改竄リスクはない

クライアントサイドでの追加バリデーションは不要。

### 認証

既存の AWS SDK 標準認証チェーン（環境変数、`~/.aws/credentials`、`--profile` オプション）をそのまま使用する。承認操作のために追加の認証フローは不要。

## 技術選定

### 新規依存パッケージ: なし

v0.2 では `ink-text-input` を追加したが、v0.3 では新規依存は不要。承認操作は y/n の1キー入力のみで、テキスト入力コンポーネントは必要ない。

### ConfirmPrompt の汎用コンポーネント化

| 選択肢 | 評価 |
|--------|------|
| **汎用 ConfirmPrompt（採用）** | `message`, `processingMessage` を外部注入するステートレス設計。v0.6（マージ確認）、v0.7（削除確認）でも再利用可能。テストも容易 |
| Approve/Revoke 専用コンポーネント | 再利用性が低い。v0.6 で類似コンポーネントを重複作成する必要がある |
| PullRequestDetail に直接埋め込み | コンポーネントが肥大化する。テストが複雑化する |

### エラー回復の方針: 通常モードに復帰

| 選択肢 | 評価 |
|--------|------|
| **通常モードに復帰（採用）** | 承認操作に修正可能な入力がないため、プロンプトを閉じて通常モードに戻す。再試行は `a` / `r` キーで可能 |
| 確認プロンプトに復帰 | v0.2 コメント投稿のパターン。テキスト修正→再送信が可能だが、承認操作では不要 |

### 承認状態の取得タイミング: PR 詳細ロード時

| 選択肢 | 評価 |
|--------|------|
| **PR 詳細ロード時に同時取得（採用）** | `loadPullRequestDetail` 内で `Promise.all` により並列取得。追加の画面遷移やボタン操作が不要。初回表示時に承認状態が即座に見える |
| 承認タブ/セクション表示時に遅延取得 | UX が遅れる。承認状態は常に確認したい情報のため、遅延取得の利点が少ない |

### evaluateApprovalRules の失敗許容

承認ルールが設定されていないリポジトリでは `EvaluatePullRequestApprovalRules` がエラーを返す場合がある。この API はオプショナルな補助情報のため、`.catch(() => null)` で失敗を許容し、UI では Rules 行を非表示にする。承認ルール評価の失敗が Approve/Revoke 操作自体をブロックしてはならない。

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `updateApprovalState` | `vi.fn()` で `client.send` をモック。正常系・異常系をテスト |
| `getApprovalStates` | `vi.fn()` で `client.send` をモック。承認者リスト取得をテスト |
| `evaluateApprovalRules` | `vi.fn()` で `client.send` をモック。評価結果取得をテスト |
| `ConfirmPrompt` | `ink-testing-library` でレンダリング。y/n 入力、ローディング、エラー表示をテスト |
| `PullRequestDetail` | 承認状態表示、`a`/`r` キーで確認プロンプト遷移、キーバインド無効化をテスト |
| `App` | 承認フロー（成功 → リロード、失敗 → エラー表示）の統合テスト |

カバレッジ 95% 以上を維持する。

### 具体的なテストケース

#### `updateApprovalState`（サービス層）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 正常に Approve 実行 | `UpdatePullRequestApprovalStateCommand` が正しいパラメータで呼ばれる |
| 2 | 正常に Revoke 実行 | `UpdatePullRequestApprovalStateCommand` が `REVOKE` で呼ばれる |
| 3 | API がエラーをスロー | エラーがそのまま上位に伝播する |

#### `getApprovalStates`（サービス層）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 承認者がいる場合 | `Approval[]` が返る |
| 2 | 承認者がいない場合 | 空配列が返る |
| 3 | API がエラーをスロー | エラーがそのまま上位に伝播する |

#### `evaluateApprovalRules`（サービス層）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 承認ルールが satisfied | `Evaluation` オブジェクトが返る（`approved: true`） |
| 2 | 承認ルールが not satisfied | `Evaluation` オブジェクトが返る（`approved: false`） |
| 3 | evaluation が null | `null` が返る |
| 4 | API がエラーをスロー | エラーがそのまま上位に伝播する |

#### `ConfirmPrompt`（コンポーネント）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 初期レンダリング | 確認メッセージと「(y/n)」が表示される |
| 2 | `y` キー押下 | `onConfirm` が呼ばれる |
| 3 | `n` キー押下 | `onCancel` が呼ばれる |
| 4 | `Esc` キー押下 | `onCancel` が呼ばれる |
| 5 | `isProcessing=true` | processingMessage が表示される |
| 6 | `error` が非null | エラーメッセージと「Press any key to return」が表示される |
| 7 | エラー表示中に任意キー | `onClearError` が呼ばれ、確認プロンプトが閉じる |
| 8 | 処理中に `y` キー | `onConfirm` は呼ばれない（入力無効） |

#### `PullRequestDetail`（コンポーネント）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 承認者ありの表示 | 「Approvals: taro ✓」が表示される |
| 2 | 承認者なしの表示 | 「Approvals: (none)」が表示される |
| 3 | 承認ルール satisfied | 「Rules: ✓ Approved」が表示される |
| 4 | 承認ルール not satisfied | 「Rules: ✗ Not approved」が表示される |
| 5 | 承認ルールなし | Rules 行が表示されない |
| 6 | `a` キー押下 | ConfirmPrompt が「Approve this pull request?」で表示される |
| 7 | `r` キー押下 | ConfirmPrompt が「Revoke your approval?」で表示される |
| 8 | 確認プロンプト中に `j` キー | スクロールしない（通常キーバインド無効） |
| 9 | フッターに `a approve  r revoke` | ナビゲーションヒントが更新されている |
| 10 | `isApproving` が true→false（エラーなし） | 確認プロンプトが自動的に閉じる |
| 11 | `isApproving` が true→false（エラーあり） | 確認プロンプトは閉じない（エラー表示） |
| 12 | コメント入力中に `a` キー | 確認プロンプトは表示されない |

#### `App`（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | PR 詳細ロード時に承認状態を取得 | `getApprovalStates` と `evaluateApprovalRules` が呼ばれる |
| 2 | Approve 成功 | `updateApprovalState` が `APPROVE` で呼ばれ、承認状態がリロードされる |
| 3 | Revoke 成功 | `updateApprovalState` が `REVOKE` で呼ばれ、承認状態がリロードされる |
| 4 | Approve 失敗 | エラーメッセージが表示される |
| 5 | `revisionId` なしで操作試行 | ガード節で早期 return、API は呼ばれない |
| 6 | `evaluateApprovalRules` が失敗 | `null` として処理、他の機能に影響しない |

#### `Help`

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | ヘルプ画面表示 | 「a」「r」キーバインドが表示される |

## 実装順序

### Step 1: サービス層

`src/services/codecommit.ts` に `updateApprovalState`, `getApprovalStates`, `evaluateApprovalRules` 関数と必要な import を追加。テストを追加して通過を確認。

### Step 2: ConfirmPrompt コンポーネント

`src/components/ConfirmPrompt.tsx` を新規作成。y/n 入力の確認プロンプト UI。テストを追加して通過を確認。

### Step 3: PullRequestDetail の変更

Props の追加（`approvals`, `approvalEvaluation`, `onApprove`, `onRevoke`, `isApproving`, `approvalError`, `onClearApprovalError`）。`approvalAction` ローカル状態の追加。`useInput` のガード条件追加。承認状態表示のレンダリング。`ConfirmPrompt` の条件付きレンダリング。テストを追加して通過を確認。

### Step 4: App の変更

`handleApprove`, `handleRevoke`, `reloadApprovals`, `formatApprovalError` の追加。state の追加（`approvals`, `approvalEvaluation`, `isApproving`, `approvalError`）。`loadPullRequestDetail` に承認状態取得を追加。`PullRequestDetail` への Props 受け渡し。テストを追加して通過を確認。

### Step 5: Help の変更

`a`, `r` キーバインドの行を追加。テストを更新して通過を確認。

### Step 6: 全体テスト・カバレッジ確認

```bash
bun run lint && bun run check && bun run test:coverage
```

カバレッジ 95% 以上を確認。

### Step 7: ドキュメント更新

要件定義書（`docs/requirements.md`）と README（`README.md`）を更新。
