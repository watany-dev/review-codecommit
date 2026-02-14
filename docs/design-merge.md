# マージ操作 設計書

> **✅ 実装完了**
>
> PR のマージ実行（`m` キー）、マージ戦略選択、コンフリクト検出、PR クローズ（`x` キー）を実装済み。

## 概要

PR の閲覧→レビュー→承認→**マージ**の全ワークフローをターミナルで完結させる。v0.5 までで閲覧・コメント・承認が揃ったが、最終的なマージ操作のためにブラウザへの切り替えが必要だった。v0.6 でマージ操作を追加し、PR ライフサイクルをターミナル内で完結させる。

## スコープ

### 今回やること

- PR のマージ実行（`m` キー）
- マージ戦略の選択（Fast-forward / Squash / Three-way）
- マージ前のコンフリクト検出・表示
- マージ確認プロンプト（戦略・ブランチ名を含む確認）
- マージせずに PR をクローズ（`x` キー）
- マージ成功後の画面遷移（PR 一覧へ戻る）

### 今回やらないこと

- コンフリクトの手動解決（conflictResolution パラメータの使用）→ 将来検討
- Squash/Three-way マージのコミットメッセージカスタマイズ → 将来検討
- マージ後のブランチ削除 → CodeCommit API にブランチ削除機能はあるが v0.6 スコープ外
- クローズした PR の再オープン → CodeCommit API が CLOSED→OPEN 遷移を許可しない

## AWS SDK API

### MergePullRequestByFastForwardCommand（新規）

ブランチが分岐していない場合に使用。マージコミットを作成せず、destination ブランチポインタを source の先端に移動する。

```typescript
import { MergePullRequestByFastForwardCommand } from "@aws-sdk/client-codecommit";

// Input
{
  pullRequestId: string;      // 必須: PR ID
  repositoryName: string;     // 必須: リポジトリ名
  sourceCommitId?: string;    // 任意: 楽観的並行制御用
}

// Output
{
  pullRequest?: PullRequest;  // マージ後の PR（status: CLOSED）
}
```

**特徴**:
- マージコミットを作成しない（ポインタの移動のみ）
- ブランチが分岐している場合は `ManualMergeRequiredException` がスローされる
- コミットメッセージ・コンフリクト解決パラメータなし（最もシンプル）

### MergePullRequestBySquashCommand（新規）

全コミットを 1 つにまとめてマージ。クリーンなコミットヒストリーを維持する。

```typescript
import { MergePullRequestBySquashCommand } from "@aws-sdk/client-codecommit";

// Input
{
  pullRequestId: string;                    // 必須: PR ID
  repositoryName: string;                   // 必須: リポジトリ名
  sourceCommitId?: string;                  // 任意: 楽観的並行制御用
  commitMessage?: string;                   // 任意: スカッシュコミットメッセージ
  authorName?: string;                      // 任意: コミット作成者名
  email?: string;                           // 任意: コミット作成者メール
  conflictDetailLevel?: "FILE_LEVEL" | "LINE_LEVEL";
  conflictResolutionStrategy?: "NONE" | "ACCEPT_SOURCE" | "ACCEPT_DESTINATION" | "AUTOMERGE";
  conflictResolution?: ConflictResolution;  // 任意: 手動コンフリクト解決（v0.6 未使用）
  keepEmptyFolders?: boolean;               // 任意: 空ディレクトリに .gitkeep を作成
}

// Output
{
  pullRequest?: PullRequest;  // マージ後の PR（status: CLOSED）
}
```

### MergePullRequestByThreeWayCommand（新規）

共通祖先を使用した三方向マージ。マージコミット（2 つの親を持つ）を作成する。

```typescript
import { MergePullRequestByThreeWayCommand } from "@aws-sdk/client-codecommit";

// Input — MergePullRequestBySquashCommand と同一のパラメータセット
{
  pullRequestId: string;
  repositoryName: string;
  sourceCommitId?: string;
  commitMessage?: string;
  authorName?: string;
  email?: string;
  conflictDetailLevel?: "FILE_LEVEL" | "LINE_LEVEL";
  conflictResolutionStrategy?: "NONE" | "ACCEPT_SOURCE" | "ACCEPT_DESTINATION" | "AUTOMERGE";
  conflictResolution?: ConflictResolution;
  keepEmptyFolders?: boolean;
}

// Output
{
  pullRequest?: PullRequest;
}
```

### GetMergeConflictsCommand（新規）

マージ前のコンフリクト検出に使用。読み取り専用操作。

```typescript
import { GetMergeConflictsCommand } from "@aws-sdk/client-codecommit";

// Input
{
  repositoryName: string;                    // 必須: リポジトリ名
  destinationCommitSpecifier: string;        // 必須: destination コミット指定
  sourceCommitSpecifier: string;             // 必須: source コミット指定
  mergeOption: "FAST_FORWARD_MERGE" | "SQUASH_MERGE" | "THREE_WAY_MERGE";  // 必須: マージ戦略
  conflictDetailLevel?: "FILE_LEVEL" | "LINE_LEVEL";
  maxConflictFiles?: number;
  conflictResolutionStrategy?: "NONE" | "ACCEPT_SOURCE" | "ACCEPT_DESTINATION" | "AUTOMERGE";
  nextToken?: string;
}

// Output
{
  mergeable?: boolean;                       // コンフリクトなしでマージ可能か
  destinationCommitId?: string;
  sourceCommitId?: string;
  baseCommitId?: string;
  conflictMetadataList?: ConflictMetadata[];  // コンフリクトファイル一覧
  nextToken?: string;
}

// ConflictMetadata
{
  filePath?: string;                         // コンフリクトファイルパス
  numberOfConflicts?: number;                // ハンク＋メタデータコンフリクト数
  contentConflict?: boolean;                 // ファイル内容のコンフリクト
  fileModeConflict?: boolean;                // ファイルモードのコンフリクト
  objectTypeConflict?: boolean;              // オブジェクト種別のコンフリクト
  mergeOperations?: {
    source?: "A" | "M" | "D";               // Add / Modify / Delete
    destination?: "A" | "M" | "D";
  };
}
```

**特徴**:
- 読み取り専用。マージの可否を事前判定する
- `mergeable` フィールドが `true` ならコンフリクトなしでマージ可能
- ページネーション対応（`nextToken`）
- コミット指定子にはブランチ名・コミット ID のどちらも使用可能

### UpdatePullRequestStatusCommand（新規）

PR をマージせずにクローズする。

```typescript
import { UpdatePullRequestStatusCommand } from "@aws-sdk/client-codecommit";

// Input
{
  pullRequestId: string;                     // 必須: PR ID
  pullRequestStatus: "OPEN" | "CLOSED";      // 必須: 新しいステータス
}

// Output
{
  pullRequest?: PullRequest;                 // 更新後の PR
}
```

**制約**:
- 有効な遷移は `OPEN` → `CLOSED` のみ。`CLOSED` → `OPEN` は `InvalidPullRequestStatusUpdateException`
- マージは行わない。単にステータスを変更する
- マージコマンド成功時は自動的に PR がクローズされるため、マージ後にこのコマンドを呼ぶ必要はない

### API 比較

| 項目 | FastForward | Squash | ThreeWay | GetMergeConflicts | UpdatePRStatus |
|------|-------------|--------|----------|-------------------|----------------|
| 操作種別 | 書き込み | 書き込み | 書き込み | 読み取り | 書き込み |
| コミット作成 | なし | 1つ（単一親） | 1つ（2親） | なし | なし |
| 必須パラメータ | 2 | 2 | 2 | 4 | 2 |
| コンフリクト解決 | 不可 | 可能 | 可能 | - | - |
| PR 自動クローズ | あり | あり | あり | - | 手動 |

## データモデル

### MergeStrategy 型（新規）

```typescript
type MergeStrategy = "fast-forward" | "squash" | "three-way";
```

表示名とコマンドの対応:

| 表示名 | MergeStrategy | AWS SDK mergeOption | AWS SDK Command |
|--------|--------------|--------------------|----|
| Fast-forward | `"fast-forward"` | `"FAST_FORWARD_MERGE"` | `MergePullRequestByFastForwardCommand` |
| Squash | `"squash"` | `"SQUASH_MERGE"` | `MergePullRequestBySquashCommand` |
| Three-way merge | `"three-way"` | `"THREE_WAY_MERGE"` | `MergePullRequestByThreeWayCommand` |

### ConflictSummary 型（新規）

コンフリクト検出結果の簡易表現。UI に表示するための最小限の情報。

```typescript
interface ConflictSummary {
  mergeable: boolean;
  conflictCount: number;
  conflictFiles: string[];   // コンフリクトファイルパスの一覧
}
```

### MergeState 型（新規）

マージ操作のステート管理用。PullRequestDetail 内の `mergeStep` state で使用する。

```typescript
type MergeStep = "strategy" | "confirm";
```

`mergeStep` の state 型は `MergeStep | null` とし、`null` は通常表示を意味する。マージ実行中の状態は App 側の `isMerging` state で管理するため、`MergeStep` には含めない。

マージフローの状態遷移:

```
(null)             (strategy)          (confirm)          (isMerging=true)
  m キー ──→ 戦略選択画面 ──→ 確認プロンプト ──→ マージ実行中
                  │ Esc              │ n/Esc              │
                  └→ (null)          └→ (null)            └→ 成功: PR一覧へ
                                                          └→ 失敗: エラー表示
```

## 画面設計

### マージ戦略選択（`m` キー押下後）

```
┌─ PR #42: fix: login timeout ────────────────┐
│  Author: watany  Status: OPEN   2h ago       │
│  main ← feature/fix-login                    │
│  Approvals: taro ✓                           │
│──────────────────────────────────────────────│
│  (diff 表示 ... 省略)                         │
│                                              │
│──────────────────────────────────────────────│
│  Merge feature/fix-login into main           │
│                                              │
│  Select merge strategy:                      │
│  > Fast-forward                              │
│    Squash                                    │
│    Three-way merge                           │
│                                              │
│  ↑↓ select  Enter confirm  Esc cancel        │
└──────────────────────────────────────────────┘
```

**戦略選択の表示規則**:

| 戦略 | 表示テキスト | 説明（参考） |
|------|-------------|-------------|
| Fast-forward | `Fast-forward` | ブランチポインタを移動（コミット作成なし） |
| Squash | `Squash` | 全変更を 1 コミットにまとめる |
| Three-way merge | `Three-way merge` | マージコミットを作成 |

### コンフリクト検出中

戦略選択後、マージ確認の前にコンフリクト検出を実行する。

```
│  Checking for conflicts...                   │
```

### コンフリクトあり（マージ不可）

```
│  ✗ Cannot merge: 3 conflicting files         │
│                                              │
│    src/auth.ts                               │
│    src/config.ts                             │
│    tests/auth.test.ts                        │
│                                              │
│  Resolve conflicts before merging.           │
│  Press any key to return                     │
```

コンフリクトが検出された場合、マージは実行せずユーザーに通知する。コンフリクトの手動解決は v0.6 のスコープ外。

### マージ確認プロンプト（コンフリクトなし）

```
│  Merge feature/fix-login into main           │
│  using fast-forward? (y/n)                   │
```

Squash / Three-way の場合:

```
│  Merge feature/fix-login into main           │
│  using squash? (y/n)                         │
```

```
│  Merge feature/fix-login into main           │
│  using three-way merge? (y/n)                │
```

### マージ実行中

```
│  Merging...                                  │
```

### マージ成功

マージ成功後は PR 一覧画面に戻り、PR リストを再取得する。ユーザーに対してトランジション表示は行わない（PR 一覧のリロードで、マージされた PR が一覧から消えることで結果が明確になる）。

### マージ失敗

```
│  Merge failed: Approval rules not satisfied. │
│  Press any key to return                     │
```

### PR クローズ確認（`x` キー押下後）

```
│  Close this pull request without merging?    │
│  (y/n)                                       │
```

### PR クローズ成功

クローズ成功後は PR 一覧画面に戻り、PR リストを再取得する。

### PR クローズ失敗

```
│  Close failed: Pull request is already       │
│  closed.                                     │
│  Press any key to return                     │
```

## データフロー

```
App (状態管理)
 │
 ├─ 既存の state すべて（変更なし）
 │
 ├─ 新規 state (v0.6):
 │   ├─ isMerging: boolean           // マージ実行中
 │   ├─ mergeError: string | null    // マージエラー
 │   ├─ isClosingPR: boolean         // PR クローズ実行中
 │   └─ closePRError: string | null  // クローズエラー
 │
 └─→ PullRequestDetail (表示 + 操作管理)
      │
      ├─ 既存の state すべて（変更なし）
      │
      ├─ 新規 local state (v0.6):
      │   ├─ mergeStep: MergeStep | null   // "strategy" | "confirm" | null
      │   ├─ selectedStrategy: MergeStrategy  // 選択中の戦略
      │   ├─ strategyIndex: number         // 戦略選択カーソル位置
      │   ├─ conflictSummary: ConflictSummary | null  // コンフリクト検出結果
      │   ├─ isCheckingConflicts: boolean  // コンフリクト検出中
      │   └─ isClosing: boolean            // PR クローズ確認中
      │
      ├─ Props から受け取る (v0.6 追加):
      │   ├─ onMerge(strategy) ──→ App.handleMerge()
      │   ├─ isMerging ──→ マージ中表示
      │   ├─ mergeError ──→ エラー表示
      │   ├─ onClearMergeError
      │   ├─ onCheckConflicts(strategy) ──→ App.handleCheckConflicts()
      │   ├─ onClosePR() ──→ App.handleClosePR()
      │   ├─ isClosingPR ──→ クローズ中表示
      │   ├─ closePRError ──→ エラー表示
      │   └─ onClearClosePRError
      │
      ├─→ MergeStrategySelector（新規コンポーネント）
      │    │
      │    └─ 戦略の一覧表示 + j/k 選択 + Enter 確定 + Esc キャンセル
      │
      └─→ ConfirmPrompt（既存コンポーネント再利用）
           │
           └─ マージ確認 / クローズ確認
```

### マージシーケンス

```
ユーザー          PullRequestDetail   MergeStrategySelector    App              CodeCommit API
  │                    │                   │                   │                    │
  │─── m キー ────────→│                   │                   │                    │
  │                    │── mergeStep       │                   │                    │
  │                    │   = "strategy"    │                   │                    │
  │                    │── render ─────────→│                   │                    │
  │                    │                   │  戦略一覧表示     │                    │
  │                    │                   │  > Fast-forward   │                    │
  │                    │                   │    Squash         │                    │
  │                    │                   │    Three-way      │                    │
  │                    │                   │                   │                    │
  │─── j/k キー ──────→│                   │                   │                    │
  │                    │─ strategyIndex ──→│                   │                    │
  │                    │                   │  カーソル移動     │                    │
  │                    │                   │                   │                    │
  │─── Enter ─────────→│                   │                   │                    │
  │                    │← onSelect ────────│                   │                    │
  │                    │── selectedStrategy│                   │                    │
  │                    │   設定            │                   │                    │
  │                    │── isCheckingConflicts = true          │                    │
  │                    │── onCheckConflicts(strategy) ─────────→│                   │
  │                    │                   │                   │── GetMergeConflicts│
  │                    │                   │                   │───────────────────→│
  │                    │                   │                   │←── response ───────│
  │                    │← conflictSummary ←│                   │                    │
  │                    │   設定            │                   │                    │
  │                    │                   │                   │                    │
  │  [コンフリクトなしの場合]               │                   │                    │
  │                    │── mergeStep       │                   │                    │
  │                    │   = "confirm"     │                   │                    │
  │                    │── ConfirmPrompt   │                   │                    │
  │                    │   表示            │                   │                    │
  │                    │                   │                   │                    │
  │─── y キー ────────→│                   │                   │                    │
  │                    │── onMerge(strategy)────────────────────→│                    │
  │                    │                   │                   │── isMerging = true │
  │                    │                   │                   │── MergePR(strategy)│
  │                    │                   │                   │───────────────────→│
  │                    │                   │                   │←── success ────────│
  │                    │                   │                   │── PR一覧へ遷移     │
  │                    │                   │                   │── loadPullRequests │
  │                    │                   │                   │                    │
  │  [コンフリクトありの場合]               │                   │                    │
  │                    │── コンフリクト    │                   │                    │
  │                    │   ファイル一覧表示│                   │                    │
  │─── 任意キー ──────→│                   │                   │                    │
  │                    │── mergeStep = null│                   │                    │
```

### PR クローズシーケンス

```
ユーザー          PullRequestDetail   ConfirmPrompt        App              CodeCommit API
  │                    │                   │               │                    │
  │─── x キー ────────→│                   │               │                    │
  │                    │── isClosing       │               │                    │
  │                    │   = true          │               │                    │
  │                    │── render ─────────→│               │                    │
  │                    │                   │ "Close this   │                    │
  │                    │                   │  PR?" (y/n)   │                    │
  │                    │                   │               │                    │
  │─── y キー ────────→│                   │               │                    │
  │                    │← onConfirm ───────│               │                    │
  │                    │── onClosePR() ─────────────────────→│                    │
  │                    │                   │               │── isClosingPR=true │
  │                    │                   │               │── UpdatePRStatus   │
  │                    │                   │               │   (CLOSED)         │
  │                    │                   │               │───────────────────→│
  │                    │                   │               │←── success ────────│
  │                    │                   │               │── PR一覧へ遷移     │
  │                    │                   │               │── loadPullRequests │
```

## コンポーネント設計

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/services/codecommit.ts` | `mergePullRequest`, `getMergeConflicts`, `closePullRequest` 関数を追加。新規 Command の import 追加 |
| `src/services/codecommit.test.ts` | 上記関数のテスト追加 |
| `src/components/MergeStrategySelector.tsx` | **新規**: マージ戦略選択コンポーネント |
| `src/components/MergeStrategySelector.test.tsx` | **新規**: テスト |
| `src/components/PullRequestDetail.tsx` | `m` / `x` キーハンドラ、マージ UI 統合、Props 追加 |
| `src/components/PullRequestDetail.test.tsx` | マージ・クローズのテスト追加 |
| `src/app.tsx` | `handleMerge`, `handleCheckConflicts`, `handleClosePR` ハンドラ追加。state 追加。マージ成功後の画面遷移 |
| `src/app.test.tsx` | マージ・クローズの統合テスト追加 |
| `src/components/Help.tsx` | `m` / `x` キーバインドの追加 |
| `src/components/Help.test.tsx` | テスト更新 |

### 1. サービス層の変更

#### mergePullRequest（新規）

マージ戦略に応じて適切な Command を使い分ける関数。

```typescript
// src/services/codecommit.ts に追加
import {
  // 既存の import に追加
  GetMergeConflictsCommand,
  MergePullRequestByFastForwardCommand,
  MergePullRequestBySquashCommand,
  MergePullRequestByThreeWayCommand,
  UpdatePullRequestStatusCommand,
} from "@aws-sdk/client-codecommit";

export type MergeStrategy = "fast-forward" | "squash" | "three-way";

export async function mergePullRequest(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    repositoryName: string;
    sourceCommitId?: string;
    strategy: MergeStrategy;
  },
): Promise<PullRequest> {
  let command;
  switch (params.strategy) {
    case "fast-forward":
      command = new MergePullRequestByFastForwardCommand({
        pullRequestId: params.pullRequestId,
        repositoryName: params.repositoryName,
        sourceCommitId: params.sourceCommitId,
      });
      break;
    case "squash":
      command = new MergePullRequestBySquashCommand({
        pullRequestId: params.pullRequestId,
        repositoryName: params.repositoryName,
        sourceCommitId: params.sourceCommitId,
      });
      break;
    case "three-way":
      command = new MergePullRequestByThreeWayCommand({
        pullRequestId: params.pullRequestId,
        repositoryName: params.repositoryName,
        sourceCommitId: params.sourceCommitId,
      });
      break;
  }
  const response = await client.send(command);
  return response.pullRequest!;
}
```

**設計判断**: 3 つの Command を 1 つの関数にまとめる。呼び出し側は `MergeStrategy` 型のみを意識すれば良く、Command の違いは隠蔽される。v0.6 では Squash/Three-way の追加パラメータ（`commitMessage`, `authorName` 等）は使用しない。将来拡張する場合は `params` にオプショナルフィールドを追加する。

#### getMergeConflicts（新規）

```typescript
export interface ConflictSummary {
  mergeable: boolean;
  conflictCount: number;
  conflictFiles: string[];
}

export async function getMergeConflicts(
  client: CodeCommitClient,
  params: {
    repositoryName: string;
    sourceCommitId: string;
    destinationCommitId: string;
    strategy: MergeStrategy;
  },
): Promise<ConflictSummary> {
  const mergeOptionMap: Record<MergeStrategy, "FAST_FORWARD_MERGE" | "SQUASH_MERGE" | "THREE_WAY_MERGE"> = {
    "fast-forward": "FAST_FORWARD_MERGE",
    squash: "SQUASH_MERGE",
    "three-way": "THREE_WAY_MERGE",
  };

  const command = new GetMergeConflictsCommand({
    repositoryName: params.repositoryName,
    sourceCommitSpecifier: params.sourceCommitId,
    destinationCommitSpecifier: params.destinationCommitId,
    mergeOption: mergeOptionMap[params.strategy],
  });
  const response = await client.send(command);

  return {
    mergeable: response.mergeable ?? false,
    conflictCount: response.conflictMetadataList?.length ?? 0,
    conflictFiles: (response.conflictMetadataList ?? [])
      .map((c) => c.filePath ?? "(unknown)")
      .filter(Boolean),
  };
}
```

**設計判断**: API レスポンスの `conflictMetadataList` から必要最小限の情報のみ抽出する。コンフリクトの詳細（hunk レベル、ファイルモード等）は v0.6 では不要。ページネーションも初回は未対応（通常のPRでコンフリクトファイルが大量になることは稀）。

#### closePullRequest（新規）

```typescript
export async function closePullRequest(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
  },
): Promise<PullRequest> {
  const command = new UpdatePullRequestStatusCommand({
    pullRequestId: params.pullRequestId,
    pullRequestStatus: "CLOSED",
  });
  const response = await client.send(command);
  return response.pullRequest!;
}
```

### 2. MergeStrategySelector コンポーネント（新規）

マージ戦略を j/k で選択し、Enter で確定、Esc でキャンセルするコンポーネント。

```typescript
// src/components/MergeStrategySelector.tsx

import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import type { MergeStrategy } from "../services/codecommit.js";

interface Props {
  sourceRef: string;
  destRef: string;
  onSelect: (strategy: MergeStrategy) => void;
  onCancel: () => void;
}

const STRATEGIES: { key: MergeStrategy; label: string }[] = [
  { key: "fast-forward", label: "Fast-forward" },
  { key: "squash", label: "Squash" },
  { key: "three-way", label: "Three-way merge" },
];

export function MergeStrategySelector({ sourceRef, destRef, onSelect, onCancel }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (input === "j" || key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, STRATEGIES.length - 1));
      return;
    }
    if (input === "k" || key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.return) {
      onSelect(STRATEGIES[selectedIndex]!.key);
      return;
    }
    if (input === "q" || key.escape) {
      onCancel();
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <Text>
        Merge {sourceRef} into {destRef}
      </Text>
      <Text />
      <Text>Select merge strategy:</Text>
      {STRATEGIES.map((s, i) => (
        <Text key={s.key}>
          {i === selectedIndex ? "> " : "  "}
          {s.label}
        </Text>
      ))}
      <Text />
      <Text dimColor>↑↓ select  Enter confirm  Esc cancel</Text>
    </Box>
  );
}
```

**設計判断**:
- 独立したコンポーネントとして切り出す。マージ戦略選択は固有の UI パターン（リスト選択）であり、ConfirmPrompt（y/n）とは異なるため再利用が適切でない
- j/k ナビゲーションは既存の UI パターンと一貫
- `useListNavigation` hook の再利用は検討したが、MergeStrategySelector は固定 3 項目のシンプルなリストであり、hook の依存を追加するほどの複雑さがない

### 3. PullRequestDetail の変更

#### Props の変更

v0.6 で 9 つの Props を追加する。既存の Props はすべて維持。

```typescript
interface Props {
  // ... 既存の Props すべて ...
  // v0.6 追加
  onMerge: (strategy: MergeStrategy) => void;
  isMerging: boolean;
  mergeError: string | null;
  onClearMergeError: () => void;
  onCheckConflicts: (strategy: MergeStrategy) => Promise<ConflictSummary>;
  onClosePR: () => void;
  isClosingPR: boolean;
  closePRError: string | null;
  onClearClosePRError: () => void;
}
```

**`onCheckConflicts` の設計判断**:

`onCheckConflicts` は `Promise<ConflictSummary>` を返す。通常の Props コールバック（`onPostComment` 等）は `void` を返すが、コンフリクト検出は **結果を即座に UI に反映する必要がある**ため例外的に戻り値を使用する。

代替案として App 側で state を管理する方法も検討したが:
- コンフリクト情報は PullRequestDetail 内でのみ使用する一時的な状態
- App に state を追加すると Props が 2 つ増える（`conflictSummary`, `isCheckingConflicts`）
- PullRequestDetail 内で完結する方がデータフローがシンプル

#### 状態管理の追加

```typescript
const [mergeStep, setMergeStep] = useState<"strategy" | "confirm" | null>(null);
const [selectedStrategy, setSelectedStrategy] = useState<MergeStrategy>("fast-forward");
const [conflictSummary, setConflictSummary] = useState<ConflictSummary | null>(null);
const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
const [isClosing, setIsClosing] = useState(false);
const [wasMerging, setWasMerging] = useState(false);
const [wasClosingPR, setWasClosingPR] = useState(false);
```

#### useEffect（マージ完了検知）

```typescript
// v0.6: マージ完了で PR 一覧に戻る（App 側で画面遷移を実行）
useEffect(() => {
  if (isMerging) {
    setWasMerging(true);
  } else if (wasMerging && !mergeError) {
    setMergeStep(null);
    setWasMerging(false);
    // App 側の handleMerge 成功時に画面遷移が実行されるため、ここでは何もしない
  } else {
    setWasMerging(false);
  }
}, [isMerging, mergeError]);

// v0.6: PR クローズ完了検知
useEffect(() => {
  if (isClosingPR) {
    setWasClosingPR(true);
  } else if (wasClosingPR && !closePRError) {
    setIsClosing(false);
    setWasClosingPR(false);
  } else {
    setWasClosingPR(false);
  }
}, [isClosingPR, closePRError]);
```

#### useInput の変更

```typescript
useInput((input, key) => {
  if (isCommenting || isInlineCommenting || isReplying || approvalAction || mergeStep || isClosing) return;

  // ... 既存のキーバインド ...

  if (input === "m") {                                   // v0.6 追加
    setMergeStep("strategy");
    return;
  }
  if (input === "x") {                                   // v0.6 追加
    setIsClosing(true);
    return;
  }
});
```

**ガード条件**: `mergeStep` と `isClosing` を既存の入力ガードに追加。マージ戦略選択中・クローズ確認中は他のキーバインドを無効化する。

#### マージ戦略選択ハンドラ

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
    // コンフリクトありの場合は conflictSummary を表示（mergeStep は "strategy" のまま変更しない）
  } catch {
    setIsCheckingConflicts(false);
    setMergeStep(null);
  }
}
```

#### レンダリングの変更

```tsx
{/* マージ戦略選択 */}
{mergeStep === "strategy" && !isCheckingConflicts && !conflictSummary && (
  <MergeStrategySelector
    sourceRef={sourceRef}
    destRef={destRef}
    onSelect={handleStrategySelect}
    onCancel={() => {
      setMergeStep(null);
      setConflictSummary(null);
    }}
  />
)}

{/* コンフリクト検出中 */}
{isCheckingConflicts && (
  <Box flexDirection="column">
    <Text color="cyan">Checking for conflicts...</Text>
  </Box>
)}

{/* コンフリクトあり */}
{conflictSummary && !conflictSummary.mergeable && (
  <ConflictDisplay
    conflictSummary={conflictSummary}
    onDismiss={() => {
      setConflictSummary(null);
      setMergeStep(null);
    }}
  />
)}

{/* マージ確認 */}
{mergeStep === "confirm" && (
  <ConfirmPrompt
    message={`Merge ${sourceRef} into ${destRef} using ${formatStrategyName(selectedStrategy)}?`}
    onConfirm={() => onMerge(selectedStrategy)}
    onCancel={() => {
      setMergeStep(null);
      setConflictSummary(null);
      onClearMergeError();
    }}
    isProcessing={isMerging}
    processingMessage="Merging..."
    error={mergeError}
    onClearError={() => {
      onClearMergeError();
      setMergeStep(null);
    }}
  />
)}

{/* PR クローズ確認 */}
{isClosing && (
  <ConfirmPrompt
    message="Close this pull request without merging?"
    onConfirm={onClosePR}
    onCancel={() => {
      setIsClosing(false);
      onClearClosePRError();
    }}
    isProcessing={isClosingPR}
    processingMessage="Closing..."
    error={closePRError}
    onClearError={() => {
      onClearClosePRError();
      setIsClosing(false);
    }}
  />
)}
```

#### ConflictDisplay（PullRequestDetail 内のローカルコンポーネント）

コンフリクト情報の表示は `PullRequestDetail.tsx` 内に定義する。独立コンポーネントとして切り出すほどの再利用性はない。

```tsx
function ConflictDisplay({
  conflictSummary,
  onDismiss,
}: {
  conflictSummary: ConflictSummary;
  onDismiss: () => void;
}) {
  useInput(() => {
    onDismiss();
  });

  return (
    <Box flexDirection="column">
      <Text color="red">
        ✗ Cannot merge: {conflictSummary.conflictCount} conflicting file
        {conflictSummary.conflictCount !== 1 ? "s" : ""}
      </Text>
      <Text />
      {conflictSummary.conflictFiles.map((file) => (
        <Text key={file}>  {file}</Text>
      ))}
      <Text />
      <Text>Resolve conflicts before merging.</Text>
      <Text dimColor>Press any key to return</Text>
    </Box>
  );
}
```

#### formatStrategyName ヘルパー

```typescript
function formatStrategyName(strategy: MergeStrategy): string {
  switch (strategy) {
    case "fast-forward":
      return "fast-forward";
    case "squash":
      return "squash";
    case "three-way":
      return "three-way merge";
  }
}
```

#### visibleLineCount の調整

```typescript
const visibleLineCount =
  isCommenting || isInlineCommenting || isReplying || approvalAction || mergeStep || isClosing ? 20 : 30;
```

#### フッターの変更

```tsx
<Box marginTop={1}>
  <Text dimColor>
    {isCommenting || isInlineCommenting || isReplying || approvalAction || mergeStep || isClosing
      ? ""
      : "↑↓ cursor  c comment  C inline  R reply  o fold  a approve  r revoke  m merge  x close  q back  ? help"}
  </Text>
</Box>
```

### 4. App の変更

#### import の変更

```typescript
import {
  // 既存の import に追加
  type ConflictSummary,
  closePullRequest,
  getMergeConflicts,
  mergePullRequest,
  type MergeStrategy,
} from "./services/codecommit.js";
```

#### state の追加

```typescript
// v0.6: マージ状態
const [isMerging, setIsMerging] = useState(false);
const [mergeError, setMergeError] = useState<string | null>(null);

// v0.6: クローズ状態
const [isClosingPR, setIsClosingPR] = useState(false);
const [closePRError, setClosePRError] = useState<string | null>(null);
```

#### handleMerge（新規）

```typescript
async function handleMerge(strategy: MergeStrategy) {
  if (!prDetail?.pullRequestId) return;
  const target = prDetail.pullRequestTargets?.[0];

  setIsMerging(true);
  setMergeError(null);
  try {
    await mergePullRequest(client, {
      pullRequestId: prDetail.pullRequestId,
      repositoryName: selectedRepo,
      sourceCommitId: target?.sourceCommit,
      strategy,
    });
    // マージ成功: PR 一覧に戻る
    setScreen("prs");
    setPrDetail(null);
    setIsMerging(false);
    await loadPullRequests(selectedRepo);
  } catch (err) {
    setMergeError(formatMergeError(err));
    setIsMerging(false);
  }
}
```

**マージ成功後の画面遷移**:
- `setScreen("prs")` で PR 一覧画面に遷移
- `setPrDetail(null)` で PR 詳細をクリア
- `loadPullRequests(selectedRepo)` で PR 一覧を再取得（マージされた PR が消える）
- `setIsMerging(false)` を `try` ブロック内で先に呼ぶ（画面遷移後は PullRequestDetail がアンマウントされるため、useEffect での検知は不要）

#### handleCheckConflicts（新規）

```typescript
async function handleCheckConflicts(strategy: MergeStrategy): Promise<ConflictSummary> {
  if (!prDetail?.pullRequestId) {
    return { mergeable: false, conflictCount: 0, conflictFiles: [] };
  }
  const target = prDetail.pullRequestTargets?.[0];
  if (!target?.sourceCommit || !target?.destinationCommit) {
    return { mergeable: false, conflictCount: 0, conflictFiles: [] };
  }

  return getMergeConflicts(client, {
    repositoryName: selectedRepo,
    sourceCommitId: target.sourceCommit,
    destinationCommitId: target.destinationCommit,
    strategy,
  });
}
```

#### handleClosePR（新規）

```typescript
async function handleClosePR() {
  if (!prDetail?.pullRequestId) return;

  setIsClosingPR(true);
  setClosePRError(null);
  try {
    await closePullRequest(client, {
      pullRequestId: prDetail.pullRequestId,
    });
    // クローズ成功: PR 一覧に戻る
    setScreen("prs");
    setPrDetail(null);
    setIsClosingPR(false);
    await loadPullRequests(selectedRepo);
  } catch (err) {
    setClosePRError(formatClosePRError(err));
    setIsClosingPR(false);
  }
}
```

#### formatMergeError（新規）

```typescript
function formatMergeError(err: unknown): string {
  return formatErrorMessage(err, "merge");
}

function formatClosePRError(err: unknown): string {
  return formatErrorMessage(err, "close");
}
```

#### formatErrorMessage の拡張

```typescript
function formatErrorMessage(
  err: unknown,
  context?: "comment" | "reply" | "approval" | "merge" | "close",
  approvalAction?: "approve" | "revoke",
): string {
  if (!(err instanceof Error)) {
    return context ? String(err) : "An unexpected error occurred.";
  }

  const name = err.name;

  // Merge-specific errors (v0.6)
  if (context === "merge") {
    if (name === "ManualMergeRequiredException") {
      return "Conflicts detected. Cannot auto-merge. Use a different strategy or resolve conflicts manually.";
    }
    if (name === "PullRequestAlreadyClosedException") {
      return "Pull request is already closed.";
    }
    if (name === "PullRequestApprovalRulesNotSatisfiedException") {
      return "Approval rules not satisfied. Ensure required approvals are met before merging.";
    }
    if (name === "TipOfSourceReferenceIsDifferentException") {
      return "Source branch has been updated. Go back and reopen the PR to get the latest changes.";
    }
    if (name === "ConcurrentReferenceUpdateException") {
      return "Branch was updated concurrently. Please try again.";
    }
    if (name === "TipsDivergenceExceededException") {
      return "Branches have diverged too much to compare. Consider rebasing.";
    }
    if (name === "PullRequestDoesNotExistException") {
      return "Pull request not found.";
    }
    if (name === "EncryptionKeyAccessDeniedException") {
      return "Encryption key access denied.";
    }
  }

  // Close-specific errors (v0.6)
  if (context === "close") {
    if (name === "InvalidPullRequestStatusUpdateException") {
      return "Cannot update pull request status. It may already be closed.";
    }
    if (name === "PullRequestAlreadyClosedException" || name === "InvalidPullRequestStatusException") {
      return "Pull request is already closed.";
    }
    if (name === "PullRequestDoesNotExistException") {
      return "Pull request not found.";
    }
    if (name === "EncryptionKeyAccessDeniedException") {
      return "Encryption key access denied.";
    }
  }

  // ... 既存の reply / comment / approval エラーハンドリング ...

  // General AWS errors (変更なし)
  // ...

  // Default: sanitize and return original message
  // v0.6 変更: context の有無に関わらず常にサニタイズする
  const sanitized = err.message
    .replace(/arn:[^\s"')]+/gi, "[ARN]")
    .replace(/\b\d{12}\b/g, "[ACCOUNT_ID]");
  return sanitized;
}
```

#### PullRequestDetail への Props 渡し

```tsx
case "detail":
  if (!prDetail) return null;
  return (
    <PullRequestDetail
      // ... 既存の Props すべて ...
      onMerge={handleMerge}                              // v0.6 追加
      isMerging={isMerging}                              // v0.6 追加
      mergeError={mergeError}                            // v0.6 追加
      onClearMergeError={() => setMergeError(null)}      // v0.6 追加
      onCheckConflicts={handleCheckConflicts}             // v0.6 追加
      onClosePR={handleClosePR}                          // v0.6 追加
      isClosingPR={isClosingPR}                          // v0.6 追加
      closePRError={closePRError}                        // v0.6 追加
      onClearClosePRError={() => setClosePRError(null)}  // v0.6 追加
    />
  );
```

### 5. Help の変更

```typescript
<Text> c          Post comment (PR Detail)</Text>
<Text> C          Post inline comment (PR Detail)</Text>
<Text> R          Reply to comment (PR Detail)</Text>
<Text> o          Toggle thread fold (PR Detail)</Text>
<Text> a          Approve PR (PR Detail)</Text>
<Text> r          Revoke approval (PR Detail)</Text>
<Text> m          Merge PR (PR Detail)</Text>           // v0.6 追加
<Text> x          Close PR (PR Detail)</Text>           // v0.6 追加
```

## キーバインド一覧（更新後）

| キー | 動作 | 画面 |
|------|------|------|
| `j` / `↓` | カーソル下移動 | 全画面（入力中・確認中は無効） |
| `k` / `↑` | カーソル上移動 | 全画面（入力中・確認中は無効） |
| `Enter` | 選択・決定 / コメント送信 | リスト画面 / コメント入力 / 戦略選択 |
| `q` / `Esc` | 前の画面に戻る / キャンセル | 全画面 / コメント入力 / 確認プロンプト / 戦略選択 |
| `Ctrl+C` | 即座に終了 | 全画面 |
| `?` | ヘルプ表示 | 全画面（入力中・確認中は無効） |
| `c` | 一般コメント投稿 | PR 詳細画面 |
| `C` | インラインコメント投稿（カーソル行） | PR 詳細画面（diff 行上のみ） |
| `R` | コメント返信 | PR 詳細画面（コメント行上のみ） |
| `o` | スレッド折りたたみ/展開 | PR 詳細画面（コメント行上のみ） |
| `a` | PR を承認（確認プロンプト表示） | PR 詳細画面 |
| `r` | 承認を取り消し（確認プロンプト表示） | PR 詳細画面 |
| `m` | PR をマージ（戦略選択 → 確認） | PR 詳細画面 |
| `x` | PR をクローズ（確認プロンプト表示） | PR 詳細画面 |

## エラーハンドリング

### マージエラー

| エラー | 表示メッセージ |
|--------|---------------|
| `ManualMergeRequiredException` | "Conflicts detected. Cannot auto-merge. Use a different strategy or resolve conflicts manually." |
| `PullRequestAlreadyClosedException` | "Pull request is already closed." |
| `PullRequestApprovalRulesNotSatisfiedException` | "Approval rules not satisfied. Ensure required approvals are met before merging." |
| `TipOfSourceReferenceIsDifferentException` | "Source branch has been updated. Go back and reopen the PR to get the latest changes." |
| `ConcurrentReferenceUpdateException` | "Branch was updated concurrently. Please try again." |
| `TipsDivergenceExceededException` | "Branches have diverged too much to compare. Consider rebasing." |
| `PullRequestDoesNotExistException` | "Pull request not found." |
| `AccessDeniedException` / `UnauthorizedException` | "Access denied. Check your IAM policy." |
| `EncryptionKeyAccessDeniedException` | "Encryption key access denied." |
| その他 | エラーメッセージをサニタイズして表示（ARN・アカウントID除去） |

### PR クローズエラー

| エラー | 表示メッセージ |
|--------|---------------|
| `InvalidPullRequestStatusUpdateException` | "Cannot update pull request status. It may already be closed." |
| `PullRequestAlreadyClosedException` / `InvalidPullRequestStatusException` | "Pull request is already closed." |
| `PullRequestDoesNotExistException` | "Pull request not found." |
| `AccessDeniedException` / `UnauthorizedException` | "Access denied. Check your IAM policy." |
| `EncryptionKeyAccessDeniedException` | "Encryption key access denied." |
| その他 | エラーメッセージをサニタイズして表示 |

### エッジケースと対処方針

| ケース | 対処 |
|--------|------|
| マージ戦略選択中に `c` / `C` / `R` / `a` / `r` / `o` | `mergeStep` チェックにより無効化 |
| マージ戦略選択中に `j` / `k` | MergeStrategySelector 内の `useInput` が処理（戦略リストのカーソル移動） |
| マージ確認中に `Esc` / `n` | mergeStep を null に戻し通常表示に復帰 |
| クローズ確認中に `Esc` / `n` | isClosing を false に戻し通常表示に復帰 |
| Fast-forward でコンフリクト | `GetMergeConflicts` が `mergeable: false` を返し、コンフリクトファイルを表示 |
| Fast-forward 不可（分岐あり）+ Squash/Three-way に切り替え | コンフリクト表示の dismissal 後に `m` キーで再度戦略選択可能 |
| マージ成功後の画面遷移 | `setScreen("prs")` + `loadPullRequests()` で PR 一覧を再取得 |
| クローズ成功後の画面遷移 | 同上 |
| マージ中に Ctrl+C | プロセス終了。CodeCommit 側ではマージは完了している可能性あり（API 呼び出し後）|
| 承認ルール未充足でのマージ試行 | `PullRequestApprovalRulesNotSatisfiedException` エラーを表示 |
| 既にクローズ済みの PR でマージ | `PullRequestAlreadyClosedException` エラーを表示 |
| ソースブランチが更新された | `TipOfSourceReferenceIsDifferentException` エラーを表示 |
| 並行更新（他ユーザーが同時にマージ） | `ConcurrentReferenceUpdateException` エラーを表示 |
| コンフリクト 0 件だが mergeable: false | API レスポンスの `mergeable` を信頼し、マージ不可として扱う |
| コンフリクト検出 API 自体のエラー | `handleStrategySelect` の catch 節で mergeStep を null に戻す |

## セキュリティ考慮

### IAM 権限

v0.6 で追加の IAM 権限が必要:

```json
{
  "Effect": "Allow",
  "Action": [
    "codecommit:MergePullRequestByFastForward",
    "codecommit:MergePullRequestBySquash",
    "codecommit:MergePullRequestByThreeWay",
    "codecommit:GetMergeConflicts",
    "codecommit:UpdatePullRequestStatus"
  ],
  "Resource": "arn:aws:codecommit:<region>:<account-id>:<repository-name>"
}
```

マージは破壊的操作（destination ブランチの変更）であり、権限管理が重要。権限不足の場合は `AccessDeniedException` がスローされ、エラーハンドリングテーブルに従いユーザーに案内する。

### 認証

既存の AWS SDK 標準認証チェーン（環境変数、`~/.aws/credentials`、`--profile` オプション）をそのまま使用する。マージ操作のために追加の認証フローは不要。

### 操作の安全性

マージは**不可逆操作**（ブランチへのコミット追加）であるため、以下の安全策を設ける:

1. **2段階確認**: 戦略選択 → 確認プロンプト（y/n）。誤操作防止
2. **コンフリクト事前検出**: マージ実行前に `GetMergeConflicts` で検出。コンフリクトありの場合はマージを実行しない
3. **楽観的並行制御**: `sourceCommitId` を渡してソースブランチの変更を検出。他のユーザーがプッシュした場合は `TipOfSourceReferenceIsDifferentException` で安全にフェイル

## 技術選定

### 新規依存パッケージ: なし

v0.6 では新規依存パッケージの追加は不要。すべての merge コマンドは既存の `@aws-sdk/client-codecommit` パッケージに含まれている。

### マージ関数の構造: 統一関数 vs 個別関数

| 選択肢 | 評価 |
|--------|------|
| **`mergePullRequest(client, { strategy, ... })`（採用）** | 呼び出し側は `MergeStrategy` 型のみを意識。Command の違いを隠蔽。将来の Squash/Three-way パラメータ拡張にも対応可能 |
| `mergePRByFastForward` / `mergePRBySquash` / `mergePRByThreeWay` を個別定義 | 呼び出し側が if/switch で分岐する必要あり。ボイラープレートが増える |

### コンフリクト検出のタイミング: 戦略選択後・確認前

| 選択肢 | 評価 |
|--------|------|
| **戦略選択後に自動検出（採用）** | ユーザーが戦略を選んだ直後にコンフリクトを確認。問題がなければそのまま確認に進める。ステップが自然 |
| `m` キー押下時に全戦略で検出 | 3 つの API 呼び出しが発生。レイテンシが増加。ユーザーが選ばない戦略のコンフリクト情報は不要 |
| マージ実行時に検出（事前検出なし） | マージ失敗時のエラーメッセージは分かりにくい。事前に情報を提示する方が UX が良い |

### MergeStrategySelector の配置: 独立コンポーネント vs PullRequestDetail 内

| 選択肢 | 評価 |
|--------|------|
| **独立コンポーネント（採用）** | テスト可能性が高い。j/k + Enter + Esc の入力処理を独立してテストできる。ConfirmPrompt と同じ粒度 |
| PullRequestDetail 内のインライン実装 | PullRequestDetail がさらに肥大化する（現在 728 LOC）。テストが複雑化 |

### ConflictDisplay の配置: PullRequestDetail 内

| 選択肢 | 評価 |
|--------|------|
| **PullRequestDetail 内のローカルコンポーネント（採用）** | コンフリクト表示はマージフローでのみ使用する一時的な表示。外部への再利用性がない。ファイル数の増加を抑制 |
| 独立ファイルのコンポーネント | 単一の利用箇所に対して過度な分離。テストファイルも別途必要 |

### マージ成功後の遷移: PR 一覧へ自動遷移

| 選択肢 | 評価 |
|--------|------|
| **PR 一覧へ自動遷移（採用）** | マージ後の PR はクローズされ、OPEN のみ表示する現在の PR 一覧からは消える。自然な遷移先 |
| PR 詳細に留まる | マージ後にクローズ済み PR を表示し続けるのは不自然。追加操作の余地もない |
| 成功メッセージを表示後に遷移 | 追加のステップが増える。PR 一覧のリロードで結果は明確 |

### クローズ確認: ConfirmPrompt 再利用

| 選択肢 | 評価 |
|--------|------|
| **ConfirmPrompt 再利用（採用）** | v0.3 で導入した汎用確認コンポーネント。y/n の操作パターンが同一。追加実装不要 |
| 専用のクローズ確認コンポーネント | ConfirmPrompt と同じ UI パターン。再実装の意味がない |

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `mergePullRequest` | `vi.fn()` で `client.send` をモック。3 つの戦略それぞれでテスト |
| `getMergeConflicts` | コンフリクトあり/なしの API レスポンスをモック |
| `closePullRequest` | `UpdatePullRequestStatusCommand` のモック |
| `MergeStrategySelector` | j/k ナビゲーション、Enter 選択、Esc キャンセル |
| `PullRequestDetail`（`m` キー） | 戦略選択 → コンフリクト検出 → 確認 → マージ実行の流れ |
| `PullRequestDetail`（`x` キー） | 確認 → クローズ実行の流れ |
| `App`（統合テスト） | マージ成功→画面遷移、クローズ成功→画面遷移 |

カバレッジ 95% 以上を維持する。

### 具体的なテストケース

#### サービス層

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `mergePullRequest`: Fast-forward で正常マージ | `MergePullRequestByFastForwardCommand` が正しいパラメータで呼ばれる |
| 2 | `mergePullRequest`: Squash で正常マージ | `MergePullRequestBySquashCommand` が正しいパラメータで呼ばれる |
| 3 | `mergePullRequest`: Three-way で正常マージ | `MergePullRequestByThreeWayCommand` が正しいパラメータで呼ばれる |
| 4 | `mergePullRequest`: `sourceCommitId` を渡す | Command に `sourceCommitId` が含まれる |
| 5 | `mergePullRequest`: API がエラーをスロー | エラーがそのまま上位に伝播する |
| 6 | `getMergeConflicts`: コンフリクトなし | `{ mergeable: true, conflictCount: 0, conflictFiles: [] }` が返る |
| 7 | `getMergeConflicts`: コンフリクトあり | `{ mergeable: false, conflictCount: N, conflictFiles: [...] }` が返る |
| 8 | `getMergeConflicts`: mergeOption が正しくマッピングされる | `"fast-forward"` → `"FAST_FORWARD_MERGE"` 等 |
| 9 | `closePullRequest`: 正常クローズ | `UpdatePullRequestStatusCommand` が `pullRequestStatus: "CLOSED"` で呼ばれる |
| 10 | `closePullRequest`: API がエラーをスロー | エラーがそのまま上位に伝播する |

#### MergeStrategySelector

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 初期表示 | 3 つの戦略が表示。カーソルは最初（Fast-forward）にある |
| 2 | `j` キーでカーソル下移動 | Squash にカーソルが移動 |
| 3 | `k` キーでカーソル上移動 | Fast-forward にカーソルが戻る |
| 4 | `j` キーでリスト末尾を超えない | Three-way merge でカーソルが止まる |
| 5 | `k` キーでリスト先頭を超えない | Fast-forward でカーソルが止まる |
| 6 | `Enter` で戦略選択 | `onSelect` がカーソル位置の戦略で呼ばれる |
| 7 | `Esc` でキャンセル | `onCancel` が呼ばれる |
| 8 | ブランチ名が表示される | "Merge {sourceRef} into {destRef}" が表示される |

#### PullRequestDetail（コンポーネント）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `m` キーで戦略選択画面が表示される | MergeStrategySelector が表示される |
| 2 | 戦略選択で Enter → コンフリクト検出 → コンフリクトなし | 確認プロンプトが表示される |
| 3 | 戦略選択で Enter → コンフリクト検出 → コンフリクトあり | コンフリクトファイル一覧が表示される |
| 4 | コンフリクト表示で任意キー | 通常表示に戻る |
| 5 | 確認プロンプトで `y` | `onMerge` が選択した戦略で呼ばれる |
| 6 | 確認プロンプトで `n` | 通常表示に戻る |
| 7 | `isMerging` が `true` | "Merging..." が表示される |
| 8 | マージエラー | エラーメッセージが表示される |
| 9 | `x` キーでクローズ確認が表示される | "Close this pull request without merging?" が表示される |
| 10 | クローズ確認で `y` | `onClosePR` が呼ばれる |
| 11 | クローズ確認で `n` | 通常表示に戻る |
| 12 | `isClosingPR` が `true` | "Closing..." が表示される |
| 13 | クローズエラー | エラーメッセージが表示される |
| 14 | 戦略選択中に `c` / `a` / `r` 等 | 無視される |
| 15 | クローズ確認中に `m` / `c` 等 | 無視される |
| 16 | フッターに `m merge  x close` が表示 | ナビゲーションヒントが更新されている |
| 17 | コンフリクト検出中に "Checking for conflicts..." 表示 | ローディング表示される |

#### App（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | マージ成功 | `mergePullRequest` が呼ばれ、画面が PR 一覧に遷移し、PR リストが再取得される |
| 2 | マージ失敗（ManualMergeRequired） | "Conflicts detected..." エラーが表示される |
| 3 | マージ失敗（ApprovalRulesNotSatisfied） | "Approval rules not satisfied..." エラーが表示される |
| 4 | マージ失敗（TipOfSourceReferenceIsDifferent） | "Source branch has been updated..." エラーが表示される |
| 5 | マージ失敗（AccessDenied） | "Access denied..." エラーが表示される |
| 6 | コンフリクト検出成功（mergeable: true） | `ConflictSummary` が返される |
| 7 | コンフリクト検出成功（mergeable: false） | コンフリクト情報が返される |
| 8 | PR クローズ成功 | `closePullRequest` が呼ばれ、画面が PR 一覧に遷移する |
| 9 | PR クローズ失敗（already closed） | "Pull request is already closed." エラーが表示される |

#### Help

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | ヘルプ画面表示 | `m` と `x` のキーバインドが表示される |

## 実装順序

### Step 1: サービス層 — mergePullRequest, getMergeConflicts, closePullRequest 追加

`src/services/codecommit.ts` に 3 つの関数と新規 Command の import を追加。`MergeStrategy`, `ConflictSummary` 型を export。テストを追加して通過を確認。

**この Step で変更するファイル**:
- `src/services/codecommit.ts`: 関数追加、import 追加、型定義追加
- `src/services/codecommit.test.ts`: テスト追加

**この Step の完了条件**: 全テストが通過。既存テストに影響なし。

### Step 2: MergeStrategySelector コンポーネント作成

戦略選択 UI を独立コンポーネントとして作成。j/k ナビゲーション、Enter 選択、Esc キャンセル。

**この Step で変更するファイル**:
- `src/components/MergeStrategySelector.tsx`: **新規作成**
- `src/components/MergeStrategySelector.test.tsx`: **新規作成**

**この Step の完了条件**: MergeStrategySelector のテストが通過。

### Step 3: PullRequestDetail にマージ UI を統合

`m` / `x` キーハンドラ追加。マージステップ管理（strategy → confirm）。Props 追加。ConflictDisplay。ConfirmPrompt 再利用。

**この Step で変更するファイル**:
- `src/components/PullRequestDetail.tsx`: state 追加、キーハンドラ追加、レンダリング追加、Props 追加
- `src/components/PullRequestDetail.test.tsx`: マージ・クローズのテスト追加

**この Step の完了条件**: PullRequestDetail のマージ・クローズテストが通過。

### Step 4: App にマージ・クローズハンドラを統合

`handleMerge`, `handleCheckConflicts`, `handleClosePR` 追加。state 追加。`formatErrorMessage` 拡張。画面遷移ロジック。

**この Step で変更するファイル**:
- `src/app.tsx`: ハンドラ追加、state 追加、Props 渡し、`formatErrorMessage` 拡張
- `src/app.test.tsx`: 統合テスト追加

**この Step の完了条件**: マージ成功→画面遷移、クローズ成功→画面遷移の統合テストが通過。

### Step 5: Help 更新

`m` と `x` キーバインドを追加。

**この Step で変更するファイル**:
- `src/components/Help.tsx`: キーバインド行追加
- `src/components/Help.test.tsx`: スナップショットテスト更新

**この Step の完了条件**: Help 画面に `m Merge PR` と `x Close PR` が表示される。既存のスナップショットテストが更新され通過。

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
- `docs/requirements.md`: v0.6 機能スコープセクション追加、キーバインド表に `m` / `x` 追加、エラーハンドリング表にマージ・クローズエラー追加
- `docs/roadmap.md`: v0.6 セクションに ✅ マーク追加
- `README.md`: 機能一覧にマージ操作を追記

**この Step の完了条件**: 要件定義書・ロードマップ・README が設計書の内容と整合している。
