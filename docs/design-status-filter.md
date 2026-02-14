# PR ステータス管理・フィルタリング 設計書

## 実装ステータス

> **未実装**

## 概要

Open 以外の PR（Closed・Merged）も閲覧可能にし、PR 一覧のフィルタリング・検索・ページネーションを強化する。v0.7 までで PR のライフサイクル操作（コメント→承認→マージ→コメント編集削除）が完成したが、PR 一覧は Open 状態のみの表示に限られていた。v0.8 では PR 一覧画面の利便性を向上させ、大量の PR を扱うチームでも効率的にレビュー対象を見つけられるようにする。

## スコープ

### 今回やること

- ステータスフィルタ: Open / Closed / Merged の切り替え（`f` キー）
- PR 検索: タイトル・著者でのインクリメンタル絞り込み（`/` キー）
- ページネーション: 次ページ / 前ページの読み込み（`n` / `p` キー）
- PR ステータス表示: 各 PR にステータスバッジ（Open / Closed / Merged）を表示
- PR 件数のリアルタイム反映: フィルタ・検索結果の件数表示

### 今回やらないこと

- PR 作成日時でのソート切り替え → API がソート順パラメータを持たないため、費用対効果が低い。将来検討
- 著者の ARN 指定による API レベルのフィルタリング → ユーザーは ARN を知らないため、クライアントサイドのテキスト検索で代替
- 複数リポジトリ横断の PR 一覧 → アーキテクチャの大幅変更が必要。将来検討
- PR の再オープン（Closed → Open） → `UpdatePullRequestStatus` API がサポートしないため不可
- 高度なフィルタ（日付範囲、ラベル等） → CodeCommit API にラベル概念がなく、日付範囲フィルタもないため対応不可

## AWS SDK API

### ListPullRequestsCommand（既存・パラメータ拡張）

現在は `pullRequestStatus: "OPEN"` 固定で呼び出しているが、v0.8 で `"CLOSED"` もサポートする。

```typescript
import { ListPullRequestsCommand } from "@aws-sdk/client-codecommit";

// Input
{
  repositoryName: string;       // 必須: リポジトリ名
  pullRequestStatus?: string;   // "OPEN" | "CLOSED"（省略時は全件）
  authorArn?: string;           // 著者 ARN でフィルタ（v0.8 では不使用）
  maxResults?: number;          // 最大取得件数（デフォルト 100）
  nextToken?: string;           // ページネーショントークン
}

// Output
{
  pullRequestIds?: string[];    // PR ID の配列
  nextToken?: string;           // 次ページトークン（存在しない場合は最終ページ）
}
```

**重要な制約**:
- `pullRequestStatus` は `"OPEN"` または `"CLOSED"` のみ。`"MERGED"` は存在しない
- マージ済みかどうかは PR 詳細の `mergeMetadata.isMerged` で判定する
- 結果は作成日時の降順（新しい順）で返される（ソート順の変更は不可）

### GetPullRequestCommand（既存・変更なし）

PR 詳細を取得する。v0.8 ではマージメタデータの確認に使用。

```typescript
// PullRequest 型の関連フィールド
{
  pullRequestId?: string;
  title?: string;
  authorArn?: string;
  pullRequestStatus?: "OPEN" | "CLOSED";
  creationDate?: Date;
  pullRequestTargets?: PullRequestTarget[];
}

// PullRequestTarget 型の関連フィールド
{
  mergeMetadata?: {
    isMerged?: boolean;         // マージ済みかどうか
    mergedBy?: string;          // マージした人の ARN
    mergeCommitId?: string;     // マージコミット ID
    mergeOption?: string;       // マージ戦略
  };
}
```

### API エラー一覧

#### ListPullRequests

| 例外 | HTTP | 説明 |
|------|------|------|
| `RepositoryNameRequiredException` | 400 | `repositoryName` が未指定 |
| `RepositoryDoesNotExistException` | 400 | リポジトリが存在しない |
| `InvalidRepositoryNameException` | 400 | リポジトリ名が不正 |
| `InvalidPullRequestStatusException` | 400 | `pullRequestStatus` の値が不正 |
| `InvalidContinuationTokenException` | 400 | `nextToken` が不正 |
| `InvalidMaxResultsException` | 400 | `maxResults` の値が不正 |
| `EncryptionKeyAccessDeniedException` | 400 | 暗号化キーアクセス拒否 |

### API レベル vs クライアントサイドのフィルタリング

| フィルタ | レベル | 理由 |
|---------|--------|------|
| ステータス（OPEN/CLOSED） | API レベル | `ListPullRequestsCommand` の `pullRequestStatus` パラメータ |
| Merged vs Closed の区別 | クライアントサイド | API に `MERGED` ステータスがない。`mergeMetadata.isMerged` で判定 |
| タイトル検索 | クライアントサイド | API にテキスト検索パラメータがない |
| 著者検索 | クライアントサイド | API の `authorArn` は完全一致のみ。ユーザーは ARN を知らない |
| ページネーション | API レベル | `nextToken` / `maxResults` パラメータ |

## データモデル

### PullRequestSummary の拡張

```typescript
// 既存（v0.1〜v0.7）
export interface PullRequestSummary {
  pullRequestId: string;
  title: string;
  authorArn: string;
  creationDate: Date;
}

// v0.8 拡張
export interface PullRequestSummary {
  pullRequestId: string;
  title: string;
  authorArn: string;
  creationDate: Date;
  status: PullRequestDisplayStatus;   // v0.8 追加: 表示用ステータス
}
```

### PullRequestDisplayStatus（新規）

```typescript
export type PullRequestDisplayStatus = "OPEN" | "CLOSED" | "MERGED";
```

API の `pullRequestStatus` は `"OPEN" | "CLOSED"` だが、表示上は `"MERGED"` を区別する。

### StatusFilter（新規）

```typescript
export type StatusFilter = "OPEN" | "CLOSED" | "MERGED";
```

### PaginationState（新規）

```typescript
export interface PaginationState {
  currentPage: number;                      // 現在のページ番号（1始まり）
  currentToken?: string;                    // 現在ページの取得に使用したトークン（1ページ目は undefined）
  nextToken?: string;                       // 次ページトークン（API レスポンス）
  previousTokens: (string | undefined)[];   // 過去のページトークン（戻るため）
  hasNextPage: boolean;                     // 次ページがあるか
  hasPreviousPage: boolean;                 // 前ページがあるか
}
```

**設計判断**: `previousTokens` を配列で保持する理由は、AWS SDK の `ListPullRequests` API が `previousToken` を返さないため。ページを戻る場合は、保存済みの過去のトークンで再取得する必要がある。

**トークン管理の例**:

```
Page 1: currentToken=undefined, nextToken="token-A", previousTokens=[]
  ↓ n キー
Page 2: currentToken="token-A", nextToken="token-B", previousTokens=[undefined]
  ↓ n キー
Page 3: currentToken="token-B", nextToken="token-C", previousTokens=[undefined, "token-A"]
  ↓ p キー
Page 2: currentToken="token-A", nextToken=※再取得, previousTokens=[undefined]
  ↓ p キー
Page 1: currentToken=undefined, nextToken=※再取得, previousTokens=[]
```

`previousTokens` には `currentToken`（現在ページの取得トークン）を保存する。`nextToken`（次ページのトークン）ではないことに注意。この設計により、前ページに戻る際に正しいトークンで再取得できる。

### App の状態変更

```typescript
// v0.8 追加の state
const [statusFilter, setStatusFilter] = useState<StatusFilter>("OPEN");
const [searchQuery, setSearchQuery] = useState("");
const [pagination, setPagination] = useState<PaginationState>({
  currentPage: 1,
  currentToken: undefined,
  previousTokens: [],
  hasNextPage: false,
  hasPreviousPage: false,
});
```

## 画面設計

### PR 一覧画面（ステータスフィルタ付き）

```
┌─ review-codecommit ─ my-service ────────────┐
│                                              │
│  [Open] Closed  Merged                       │  ← 現在のフィルタを強調
│                                              │
│  Open Pull Requests (3):                     │
│                                              │
│  > #42  fix: login timeout   watany  2h ago  │
│    #41  feat: add search     taro    1d ago  │
│    #38  chore: deps update   bot     3d ago  │
│                                              │
│  Page 1                                      │
│  ↑↓ navigate  Enter view  f filter           │
│  / search  n next  p prev  q back  ? help    │
└──────────────────────────────────────────────┘
```

### Closed フィルタ適用時

```
┌─ review-codecommit ─ my-service ────────────┐
│                                              │
│  Open  [Closed] Merged                       │
│                                              │
│  Closed Pull Requests (2):                   │
│                                              │
│  > #35  CLOSED  fix: typos    hanako  5d ago │
│    #30  CLOSED  refactor: api taro   10d ago │
│                                              │
│  Page 1                                      │
│  ↑↓ navigate  Enter view  f filter           │
│  / search  n next  p prev  q back  ? help    │
└──────────────────────────────────────────────┘
```

### Merged フィルタ適用時

```
┌─ review-codecommit ─ my-service ────────────┐
│                                              │
│  Open  Closed  [Merged]                      │
│                                              │
│  Merged Pull Requests (4):                   │
│                                              │
│  > #40  MERGED  feat: auth    watany  3d ago │
│    #37  MERGED  fix: timeout  taro    7d ago │
│    #33  MERGED  chore: deps   bot    14d ago │
│    #28  MERGED  feat: cache   hanako 21d ago │
│                                              │
│  Page 1  n next                              │
│  ↑↓ navigate  Enter view  f filter           │
│  / search  n next  p prev  q back  ? help    │
└──────────────────────────────────────────────┘
```

### 検索モード（`/` キー押下後）

```
┌─ review-codecommit ─ my-service ────────────┐
│                                              │
│  [Open] Closed  Merged                       │
│                                              │
│  Search: login_                              │  ← ink-text-input
│                                              │
│  Open Pull Requests matching "login" (1):    │
│                                              │
│  > #42  fix: login timeout   watany  2h ago  │
│                                              │
│  Enter select  Esc clear search              │
└──────────────────────────────────────────────┘
```

### 検索でヒットなし

```
│  Search: nonexistent_                        │
│                                              │
│  Open Pull Requests matching "nonexistent" (0): │
│                                              │
│  No matching pull requests.                  │
│                                              │
│  Esc clear search                            │
```

### ページネーション表示

```
│  Page 2  p prev  n next                      │  ← 中間ページ
│  Page 1  n next                              │  ← 最初のページ（次ページあり）
│  Page 3  p prev                              │  ← 最終ページ
│  Page 1                                      │  ← 1ページのみ
```

## データフロー

```
App (状態管理)
 │
 ├─ 既存の state すべて（変更なし）
 │
 ├─ 新規 state (v0.8):
 │   ├─ statusFilter: StatusFilter             // "OPEN" | "CLOSED" | "MERGED"
 │   ├─ searchQuery: string                    // 検索文字列
 │   └─ pagination: PaginationState            // ページネーション状態
 │
 └─→ PullRequestList (表示 + フィルタ操作)
      │
      ├─ 既存の Props:
      │   ├─ repositoryName
      │   ├─ pullRequests: PullRequestSummary[]
      │   ├─ onSelect
      │   ├─ onBack
      │   └─ onHelp
      │
      ├─ 新規 Props (v0.8):
      │   ├─ statusFilter: StatusFilter
      │   ├─ onChangeStatusFilter(filter: StatusFilter) ──→ App
      │   ├─ searchQuery: string
      │   ├─ onChangeSearchQuery(query: string) ──→ App
      │   ├─ pagination: PaginationViewState
      │   ├─ onNextPage() ──→ App
      │   └─ onPreviousPage() ──→ App
      │
      └─→ クライアントサイドフィルタリング
           │
           └─ 検索文字列で pullRequests をフィルタ
```

### ステータスフィルタ変更シーケンス

```
ユーザー          PullRequestList     App              CodeCommit API
  │                    │               │                    │
  │─── f キー ────────→│               │                    │
  │                    │── 次のフィルタ │                    │
  │                    │   を計算      │                    │
  │                    │── onChangeStatusFilter ──→│        │
  │                    │               │── statusFilter     │
  │                    │               │   更新             │
  │                    │               │── loadPullRequests │
  │                    │               │   (status)        │
  │                    │               │── ListPullRequests →│
  │                    │               │   (status=CLOSED)  │
  │                    │               │←── PR IDs ─────────│
  │                    │               │── GetPullRequest   │
  │                    │               │   (each ID)       │
  │                    │               │←── PR details ─────│
  │                    │               │── isMerged で分離  │
  │                    │               │── setPullRequests  │
  │                    │               │── setPagination    │
  │                    │←── re-render ─│                    │
```

### 検索シーケンス

```
ユーザー          PullRequestList     App
  │                    │               │
  │─── / キー ────────→│               │
  │                    │── isSearching │
  │                    │   = true      │
  │                    │── render      │
  │                    │   TextInput   │
  │                    │               │
  │─── "login" 入力 ──→│               │
  │                    │── onChangeSearchQuery("login") ──→│
  │                    │               │── searchQuery 更新 │
  │                    │               │                    │
  │                    │── PullRequests│                    │
  │                    │   をクライアント                    │
  │                    │   サイドで      │                    │
  │                    │   フィルタ     │                    │
  │                    │               │                    │
  │─── Esc ───────────→│               │                    │
  │                    │── isSearching │                    │
  │                    │   = false     │                    │
  │                    │── onChangeSearchQuery("") ────────→│
  │                    │               │── searchQuery = "" │
```

### ページネーションシーケンス

```
ユーザー          PullRequestList     App              CodeCommit API
  │                    │               │                    │
  │─── n キー ────────→│               │                    │
  │                    │── onNextPage ─→│                    │
  │                    │               │── previousTokens   │
  │                    │               │   に現在token追加  │
  │                    │               │── ListPullRequests │
  │                    │               │   (nextToken)      │
  │                    │               │──────────────────→│
  │                    │               │←── PR IDs + token ─│
  │                    │               │── GetPullRequest   │
  │                    │               │   (each ID)       │
  │                    │               │←── PR details ─────│
  │                    │               │── setPullRequests  │
  │                    │               │── setPagination    │
  │                    │               │   (page +1)       │
  │                    │←── re-render ─│                    │
```

## コンポーネント設計

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/services/codecommit.ts` | `listPullRequests` 関数のパラメータ拡張。`PullRequestSummary` 型に `status` フィールド追加 |
| `src/services/codecommit.test.ts` | 上記変更のテスト追加 |
| `src/components/PullRequestList.tsx` | ステータスフィルタ UI、検索 UI、ページネーション UI の追加。Props 追加 |
| `src/components/PullRequestList.test.tsx` | フィルタ・検索・ページネーションのテスト追加 |
| `src/app.tsx` | `statusFilter`、`searchQuery`、`pagination` の state 追加。`loadPullRequests` のパラメータ拡張。ハンドラ追加 |
| `src/app.test.tsx` | フィルタ・検索・ページネーションの統合テスト追加 |
| `src/components/Help.tsx` | `f` / `/` / `n` / `p` キーバインドの追加 |
| `src/components/Help.test.tsx` | スナップショットテスト更新 |

### 1. サービス層の変更

#### PullRequestSummary 型の拡張

```typescript
// src/services/codecommit.ts

export type PullRequestDisplayStatus = "OPEN" | "CLOSED" | "MERGED";

export interface PullRequestSummary {
  pullRequestId: string;
  title: string;
  authorArn: string;
  creationDate: Date;
  status: PullRequestDisplayStatus;   // v0.8 追加
}
```

#### listPullRequests 関数の変更

```typescript
export async function listPullRequests(
  client: CodeCommitClient,
  repositoryName: string,
  nextToken?: string,
  pullRequestStatus?: "OPEN" | "CLOSED",  // v0.8 追加
): Promise<{ pullRequests: PullRequestSummary[]; nextToken?: string }> {
  const listCommand = new ListPullRequestsCommand({
    repositoryName,
    pullRequestStatus: pullRequestStatus ?? "OPEN",
    maxResults: 25,
    nextToken,
  });
  const listResponse = await client.send(listCommand);
  const pullRequestIds = listResponse.pullRequestIds ?? [];

  const pullRequests: PullRequestSummary[] = (
    await Promise.all(
      pullRequestIds.map(async (id) => {
        const getCommand = new GetPullRequestCommand({ pullRequestId: id });
        const getResponse = await client.send(getCommand);
        const pr = getResponse.pullRequest;
        if (!pr) return null;

        // v0.8: mergeMetadata から表示用ステータスを決定
        const apiStatus = pr.pullRequestStatus ?? "OPEN";
        const isMerged = pr.pullRequestTargets?.[0]?.mergeMetadata?.isMerged === true;
        const displayStatus: PullRequestDisplayStatus =
          apiStatus === "CLOSED" && isMerged ? "MERGED" : (apiStatus as PullRequestDisplayStatus);

        return {
          pullRequestId: pr.pullRequestId ?? id,
          title: pr.title ?? "(no title)",
          authorArn: pr.authorArn ?? "unknown",
          creationDate: pr.creationDate ?? new Date(),
          status: displayStatus,
        };
      }),
    )
  ).filter((pr): pr is PullRequestSummary => pr !== null);

  const result: { pullRequests: PullRequestSummary[]; nextToken?: string } = { pullRequests };
  if (listResponse.nextToken != null) result.nextToken = listResponse.nextToken;
  return result;
}
```

**設計判断**:
- `pullRequestStatus` パラメータにデフォルト値 `"OPEN"` を設定し、既存の呼び出し箇所への影響を最小化
- `PullRequestDisplayStatus` の判定は `mergeMetadata.isMerged` で行う。`mergeMetadata.mergeCommitId` の有無でも判定可能だが、`isMerged` がより明示的
- Closed と Merged の分離は API 呼び出し後にクライアントサイドで行う

#### StatusFilter → API パラメータの変換

```typescript
// App 側で使用するヘルパー
function statusFilterToApiStatus(filter: StatusFilter): "OPEN" | "CLOSED" {
  switch (filter) {
    case "OPEN":
      return "OPEN";
    case "CLOSED":
    case "MERGED":
      return "CLOSED";
  }
}
```

`CLOSED` と `MERGED` はどちらも API レベルでは `"CLOSED"` で取得し、取得後にクライアントサイドで分離する。

### 2. PullRequestList コンポーネントの変更

#### Props の変更

```typescript
interface Props {
  repositoryName: string;
  pullRequests: PullRequestSummary[];
  onSelect: (pullRequestId: string) => void;
  onBack: () => void;
  onHelp: () => void;
  // v0.8 追加
  statusFilter: StatusFilter;
  onChangeStatusFilter: (filter: StatusFilter) => void;
  searchQuery: string;
  onChangeSearchQuery: (query: string) => void;
  pagination: PaginationViewState;
  onNextPage: () => void;
  onPreviousPage: () => void;
}
```

#### StatusFilter 型の定義

```typescript
export type StatusFilter = "OPEN" | "CLOSED" | "MERGED";
```

#### PaginationViewState 型の定義

PullRequestList コンポーネントが受け取るのは、App 内部の `PaginationState` の **ビュー用サブセット**。トークン管理（`currentToken` / `nextToken` / `previousTokens`）は App 内部に隠蔽する。

```typescript
export interface PaginationViewState {
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
```

**注意**: App が持つ `PaginationState`（データモデルセクション参照）とは異なる型。コンポーネントはページ番号とナビゲーション可否のみを知ればよい。

#### ステータスフィルタの循環ロジック

```typescript
const STATUS_CYCLE: StatusFilter[] = ["OPEN", "CLOSED", "MERGED"];

function nextStatusFilter(current: StatusFilter): StatusFilter {
  const index = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length]!;
}
```

`f` キーで OPEN → CLOSED → MERGED → OPEN と循環する。

#### クライアントサイドフィルタリング

```typescript
// 検索クエリによるフィルタリング（PullRequestList 内）
const filteredPullRequests = useMemo(() => {
  if (!searchQuery) return pullRequests;
  const query = searchQuery.toLowerCase();
  return pullRequests.filter(
    (pr) =>
      pr.title.toLowerCase().includes(query) ||
      extractAuthorName(pr.authorArn).toLowerCase().includes(query),
  );
}, [pullRequests, searchQuery]);
```

**設計判断**: 検索は `PullRequestList` コンポーネント内でクライアントサイドフィルタリングとして実装する。理由:
- API にテキスト検索パラメータがない
- 1ページ分（最大25件）のデータに対するフィルタリングは十分高速
- `useMemo` で不要な再計算を防止

#### useInput の変更

```typescript
useInput((input, key) => {
  if (isSearching) {
    // 検索モード中は Esc のみ受け付け
    if (key.escape) {
      setIsSearching(false);
      onChangeSearchQuery("");
    }
    return;
  }

  if (input === "q" || key.escape) {
    onBack();
    return;
  }
  if (input === "?") {
    onHelp();
    return;
  }
  if (input === "f") {                              // v0.8 追加
    onChangeStatusFilter(nextStatusFilter(statusFilter));
    return;
  }
  if (input === "/") {                              // v0.8 追加
    setIsSearching(true);
    return;
  }
  if (input === "n" && pagination.hasNextPage) {    // v0.8 追加
    onNextPage();
    return;
  }
  if (input === "p" && pagination.hasPreviousPage) {// v0.8 追加
    onPreviousPage();
    return;
  }
  if (input === "j" || key.downArrow) {
    setCursor((prev) => Math.min(prev + 1, filteredPullRequests.length - 1));
    return;
  }
  if (input === "k" || key.upArrow) {
    setCursor((prev) => Math.max(prev - 1, 0));
    return;
  }
  if (key.return) {
    const item = filteredPullRequests[cursor];
    if (item) {
      onSelect(item.pullRequestId);
    }
  }
});
```

#### 検索モードの状態管理

```typescript
const [isSearching, setIsSearching] = useState(false);

// 検索モード中は TextInput を表示
// TextInput の onChange で onChangeSearchQuery を呼ぶ
```

**設計判断**: 検索クエリの状態は `App` が保持し、`PullRequestList` は `searchQuery` と `onChangeSearchQuery` を Props で受け取る。理由:
- ステータスフィルタ変更時に検索クエリをリセットするロジックが `App` 側にある
- 画面遷移（PR 詳細→PR 一覧）時に検索クエリを維持するかどうかの判断が `App` 側にある

#### import 文

```typescript
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import React, { useEffect, useMemo, useState } from "react";
import type { PullRequestDisplayStatus, PullRequestSummary } from "../services/codecommit.js";
import { extractAuthorName, formatRelativeDate } from "../utils/formatDate.js";
```

#### レンダリング

```tsx
export function PullRequestList({
  repositoryName,
  pullRequests,
  onSelect,
  onBack,
  onHelp,
  statusFilter,
  onChangeStatusFilter,
  searchQuery,
  onChangeSearchQuery,
  pagination,
  onNextPage,
  onPreviousPage,
}: Props) {
  const [isSearching, setIsSearching] = useState(false);
  const [cursor, setCursor] = useState(0);

  const filteredPullRequests = useMemo(() => {
    if (!searchQuery) return pullRequests;
    const query = searchQuery.toLowerCase();
    return pullRequests.filter(
      (pr) =>
        pr.title.toLowerCase().includes(query) ||
        extractAuthorName(pr.authorArn).toLowerCase().includes(query),
    );
  }, [pullRequests, searchQuery]);

  // カーソルがフィルタ後のリスト範囲外にならないよう調整
  useEffect(() => {
    setCursor((prev) => Math.min(prev, Math.max(filteredPullRequests.length - 1, 0)));
  }, [filteredPullRequests.length]);

  // useInput は上記参照

  const statusLabel = statusFilter === "OPEN" ? "Open" : statusFilter === "CLOSED" ? "Closed" : "Merged";
  const statusBadge = (status: PullRequestDisplayStatus) => {
    switch (status) {
      case "OPEN": return "";  // Open 時はバッジ不要（デフォルト）
      case "CLOSED": return "CLOSED  ";
      case "MERGED": return "MERGED  ";
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">review-codecommit</Text>
        <Text> — </Text>
        <Text bold>{repositoryName}</Text>
      </Box>

      {/* ステータスフィルタ表示 */}
      <Box marginBottom={1}>
        {STATUS_CYCLE.map((s) => (
          <Text key={s}>
            {s === statusFilter ? (
              <Text bold color="green">[{s === "OPEN" ? "Open" : s === "CLOSED" ? "Closed" : "Merged"}]</Text>
            ) : (
              <Text dimColor> {s === "OPEN" ? "Open" : s === "CLOSED" ? "Closed" : "Merged"} </Text>
            )}
            {"  "}
          </Text>
        ))}
      </Box>

      {/* 検索入力 */}
      {isSearching && (
        <Box marginBottom={1}>
          <Text>Search: </Text>
          <TextInput value={searchQuery} onChange={onChangeSearchQuery} />
        </Box>
      )}

      {/* PR 一覧ヘッダー */}
      <Box marginBottom={1}>
        <Text bold>
          {statusLabel} Pull Requests
          {searchQuery ? ` matching "${searchQuery}"` : ""}
          {" "}({filteredPullRequests.length}):
        </Text>
      </Box>

      {/* PR 一覧 */}
      {filteredPullRequests.length === 0 ? (
        <Box>
          <Text dimColor>
            {searchQuery ? "No matching pull requests." : `No ${statusLabel.toLowerCase()} pull requests.`}
          </Text>
        </Box>
      ) : (
        filteredPullRequests.map((pr, index) => (
          <Box key={pr.pullRequestId}>
            <Text {...(index === cursor ? { color: "green" as const } : {})}>
              {index === cursor ? "> " : "  "}#{pr.pullRequestId} {statusBadge(pr.status)}{pr.title}
              {"  "}
              <Text dimColor>
                {extractAuthorName(pr.authorArn)} {formatRelativeDate(pr.creationDate)}
              </Text>
            </Text>
          </Box>
        ))
      )}

      {/* ページネーション情報 */}
      <Box marginTop={1}>
        <Text dimColor>
          Page {pagination.currentPage}
          {pagination.hasPreviousPage ? "  p prev" : ""}
          {pagination.hasNextPage ? "  n next" : ""}
        </Text>
      </Box>

      {/* フッター */}
      <Box marginTop={0}>
        <Text dimColor>
          {isSearching
            ? "Enter select  Esc clear search"
            : "↑↓ navigate  Enter view  f filter  / search  n next  p prev  q back  ? help"
          }
        </Text>
      </Box>
    </Box>
  );
}
```

### 3. useListNavigation フックの変更検討

現在の `useListNavigation` フックは `PullRequestList` で使用されている。v0.8 で `f`、`/`、`n`、`p` の追加キーバインドと検索モードの状態管理が必要になるため、`PullRequestList` では `useListNavigation` を使わず、`useInput` を直接使用する。

**設計判断**: `useListNavigation` を拡張する選択肢もあるが、追加パラメータが多すぎるため、フックの汎用性が低下する。`RepositoryList` は引き続き `useListNavigation` を使用し、`PullRequestList` のみ個別実装とする。

### 4. App の変更

#### import の変更

```typescript
import {
  // 既存の import に追加（型のみ）
  type PullRequestDisplayStatus,
} from "./services/codecommit.js";
```

#### StatusFilter 型

```typescript
type StatusFilter = "OPEN" | "CLOSED" | "MERGED";
```

#### state の追加

```typescript
// v0.8: フィルタ・検索・ページネーション
const [statusFilter, setStatusFilter] = useState<StatusFilter>("OPEN");
const [searchQuery, setSearchQuery] = useState("");
const [pagination, setPagination] = useState<PaginationState>({
  currentPage: 1,
  currentToken: undefined,
  previousTokens: [],
  hasNextPage: false,
  hasPreviousPage: false,
});
```

#### PaginationState インターフェース

```typescript
interface PaginationState {
  currentPage: number;
  currentToken?: string;                    // 現在ページの取得に使用したトークン
  nextToken?: string;                       // 次ページトークン（API レスポンス）
  previousTokens: (string | undefined)[];   // 過去のページトークン
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
```

#### loadPullRequests の変更

`InvalidContinuationTokenException` の特別処理が必要なため、`withLoadingState` を使わず個別にエラーハンドリングする。

```typescript
async function loadPullRequests(
  repoName: string,
  status?: StatusFilter,
  pageToken?: string,
) {
  setLoading(true);
  setError(null);
  try {
    // StatusFilter → API パラメータ変換
    const apiStatus = status === "MERGED" || status === "CLOSED" ? "CLOSED" : "OPEN";

    const result = await listPullRequests(client, repoName, pageToken, apiStatus);

    // Merged/Closed の分離（CLOSED フィルタ時のみ）
    let filtered = result.pullRequests;
    if (status === "CLOSED") {
      filtered = result.pullRequests.filter((pr) => pr.status === "CLOSED");
    } else if (status === "MERGED") {
      filtered = result.pullRequests.filter((pr) => pr.status === "MERGED");
    }

    setPullRequests(filtered);
    setPagination((prev) => ({
      ...prev,
      nextToken: result.nextToken,
      hasNextPage: !!result.nextToken,
    }));
  } catch (err) {
    if (err instanceof Error && err.name === "InvalidContinuationTokenException") {
      setError("Page token expired. Returning to first page.");
      setPagination({
        currentPage: 1,
        currentToken: undefined,
        previousTokens: [],
        hasNextPage: false,
        hasPreviousPage: false,
      });
    } else {
      setError(formatError(err));
    }
  } finally {
    setLoading(false);
  }
}
```

**設計判断**:
- Closed と Merged の分離はクライアントサイドで行う。API は `"CLOSED"` で両方返すため、取得後にフィルタする。このため、フィルタ後の件数が `maxResults` より少なくなる可能性がある。これは許容する（次ページで追加取得可能）
- `withLoadingState` を使わない理由は、`InvalidContinuationTokenException` 発生時にページネーションのリセットが必要で、ジェネリックなエラーハンドラでは対応できないため

#### handleChangeStatusFilter（新規）

```typescript
function handleChangeStatusFilter(filter: StatusFilter) {
  setStatusFilter(filter);
  setSearchQuery("");  // フィルタ変更時に検索をリセット
  setPagination({
    currentPage: 1,
    currentToken: undefined,
    previousTokens: [],
    hasNextPage: false,
    hasPreviousPage: false,
  });
  loadPullRequests(selectedRepo, filter);
}
```

#### handleNextPage（新規）

```typescript
function handleNextPage() {
  if (!pagination.nextToken) return;

  const nextToken = pagination.nextToken;

  setPagination((prev) => ({
    ...prev,
    previousTokens: [...prev.previousTokens, prev.currentToken],  // 現在ページのトークンを保存
    currentToken: nextToken,         // 次ページのトークンが現在のトークンになる
    currentPage: prev.currentPage + 1,
    hasPreviousPage: true,
  }));

  loadPullRequests(selectedRepo, statusFilter, nextToken);
}
```

#### handlePreviousPage（新規）

```typescript
function handlePreviousPage() {
  if (pagination.previousTokens.length === 0) return;

  const newPreviousTokens = [...pagination.previousTokens];
  const prevToken = newPreviousTokens.pop();  // 前ページの取得トークン

  setPagination((prev) => ({
    ...prev,
    previousTokens: newPreviousTokens,
    currentToken: prevToken,         // 前ページのトークンが現在のトークンになる
    currentPage: prev.currentPage - 1,
    hasPreviousPage: newPreviousTokens.length > 0,
  }));

  loadPullRequests(selectedRepo, statusFilter, prevToken);  // undefined の場合は 1ページ目
}
```

**設計判断**: 前ページへの遷移は `previousTokens` 配列から pop して再取得する方式。理由:
- AWS SDK の `ListPullRequests` は `previousToken` を返さない
- ローカルにページのデータをキャッシュする方式はメモリ使用量が増大する
- 再取得方式はシンプルで、データの整合性も保たれる

**トークン管理の正確性**: `previousTokens` には `currentToken`（現在ページの取得に使ったトークン）を保存する。1ページ目の `currentToken` は `undefined` であり、`previousTokens` には `undefined` が入りうる。これにより、任意の深さからの前ページ遷移が正確に動作する。

#### handleSelectRepo の変更

```typescript
function handleSelectRepo(repoName: string) {
  setSelectedRepo(repoName);
  setScreen("prs");
  // v0.8: フィルタ・検索・ページネーションをリセット
  setStatusFilter("OPEN");
  setSearchQuery("");
  setPagination({
    currentPage: 1,
    currentToken: undefined,
    previousTokens: [],
    hasNextPage: false,
    hasPreviousPage: false,
  });
  loadPullRequests(repoName, "OPEN");
}
```

#### handleBack の変更

```typescript
function handleBack() {
  if (screen === "detail") {
    setScreen("prs");
    // フィルタ・検索状態は維持（PR 一覧に戻る）
  } else if (screen === "prs") {
    if (initialRepo) {
      process.exit(0);
    }
    // v0.8: リポジトリ一覧に戻る時にフィルタ・検索をリセット
    setStatusFilter("OPEN");
    setSearchQuery("");
    setPagination({
      currentPage: 1,
      currentToken: undefined,
      previousTokens: [],
      hasNextPage: false,
      hasPreviousPage: false,
    });
    setScreen("repos");
  } else {
    process.exit(0);
  }
}
```

#### PullRequestList への Props 渡し

```tsx
case "prs":
  return (
    <PullRequestList
      repositoryName={selectedRepo}
      pullRequests={pullRequests}
      onSelect={handleSelectPR}
      onBack={handleBack}
      onHelp={() => setShowHelp(true)}
      statusFilter={statusFilter}
      onChangeStatusFilter={handleChangeStatusFilter}
      searchQuery={searchQuery}
      onChangeSearchQuery={setSearchQuery}
      pagination={{
        currentPage: pagination.currentPage,
        hasNextPage: pagination.hasNextPage,
        hasPreviousPage: pagination.hasPreviousPage,
      }}
      onNextPage={handleNextPage}
      onPreviousPage={handlePreviousPage}
    />
  );
```

### 5. Help の変更

```typescript
<Text> f          Filter by status (PR List)</Text>         // v0.8 追加
<Text> /          Search pull requests (PR List)</Text>     // v0.8 追加
<Text> n          Next page (PR List)</Text>                // v0.8 追加
<Text> p          Previous page (PR List)</Text>            // v0.8 追加
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
| `Tab` | 次のビューへ切り替え | PR 詳細画面 |
| `Shift+Tab` | 前のビューへ切り替え | PR 詳細画面 |
| `f` | ステータスフィルタ切り替え（Open → Closed → Merged → Open） | PR 一覧画面 |
| `/` | 検索モード開始 | PR 一覧画面 |
| `n` | 次のページ | PR 一覧画面（次ページがある場合のみ） |
| `p` | 前のページ | PR 一覧画面（前ページがある場合のみ） |

## エラーハンドリング

### フィルタ・ページネーション関連エラー

| エラー | 表示メッセージ |
|--------|---------------|
| `InvalidPullRequestStatusException` | "Invalid filter status." |
| `InvalidContinuationTokenException` | "Page token expired. Returning to first page." |
| `RepositoryDoesNotExistException` | "Repository not found." |
| `EncryptionKeyAccessDeniedException` | "Encryption key access denied." |
| `AccessDeniedException` / `UnauthorizedException` | "Access denied. Check your IAM policy." |
| ネットワークエラー | "Network error. Check your connection." |

### `InvalidContinuationTokenException` の特別処理

ページネーショントークンの有効期限切れやトークンの不整合が発生した場合、最初のページに自動で戻す。

```typescript
// loadPullRequests 内で catch
if (err instanceof Error && err.name === "InvalidContinuationTokenException") {
  setError("Page token expired. Returning to first page.");
  setPagination({
    currentPage: 1,
    currentToken: undefined,
    previousTokens: [],
    hasNextPage: false,
    hasPreviousPage: false,
  });
  return;
}
```

### エッジケースと対処方針

| ケース | 対処 |
|--------|------|
| フィルタ変更中にローディング | `withLoadingState` でローディング表示。キー操作は無効化 |
| 検索モード中に `f` / `n` / `p` | `isSearching` チェックにより無効化。`Esc` で検索モードを抜けてから操作 |
| 検索モード中に `j` / `k` / `Enter` | `isSearching` チェックにより無効化 |
| 検索結果が空 | "No matching pull requests." メッセージを表示 |
| Closed/Merged フィルタでの空結果 | `No closed/merged pull requests.` メッセージを表示 |
| フィルタ後に Merged/Closed が混在 | クライアントサイドフィルタで確実に分離 |
| CLOSED 取得で Merged のみ（Closed が 0 件） | フィルタ後にリストが空になるが正常動作。次ページがあれば取得可能。後述「CLOSED/MERGED フィルタと件数の注意」参照 |
| ページ遷移後にフィルタ変更 | フィルタ変更でページネーションをリセット（1ページ目に戻る） |
| PR 詳細→一覧に戻った時 | フィルタ・検索・ページ状態を維持 |
| リポジトリ変更時 | フィルタ・検索・ページ状態をリセット |
| 検索中に Esc | 検索モードを終了し、検索クエリをクリア |
| 検索文字列の大文字/小文字 | 大文字小文字を区別しない（`toLowerCase` で比較） |
| ローディング中にフィルタ連打 | `withLoadingState` のローディング画面中はキー入力が届かないため安全。連打による race condition は発生しない |

### CLOSED/MERGED フィルタと件数の注意

API の `ListPullRequests` は `pullRequestStatus: "CLOSED"` で取得する場合、マージ済み PR と純粋にクローズされた PR の両方を返す。`maxResults: 25` で取得した結果を `status === "CLOSED"` または `status === "MERGED"` でクライアントサイドフィルタすると、表示件数が 25 件未満になる場合がある。

**例**:
- API が 25 件返却し、そのうち 20 件が Merged、5 件が Closed
- CLOSED フィルタ → 5 件表示
- MERGED フィルタ → 20 件表示

**許容する理由**:
1. 正確な件数を確保するには「25件の Closed PR が集まるまで API を繰り返し呼ぶ」ロジックが必要で、実装が複雑化する
2. API レート制限のリスクが増加する（1ページあたり最大 25 回の `GetPullRequest` に加え、追加の `ListPullRequests` 呼び出し）
3. 次ページ（`n` キー）で追加の結果を取得できるため、ユーザーは必要な PR にたどり着ける
4. 一般的に Merged の方が Closed より多いため、CLOSED フィルタの件数不足が顕著だが、実用上問題にならない

**将来改善**: 件数不足が UX 上の問題になった場合、「n キーで自動追加取得」（無限スクロール的アプローチ）を検討する。

## セキュリティ考慮

### IAM 権限

v0.8 で追加の IAM 権限は不要。既存の `codecommit:ListPullRequests` と `codecommit:GetPullRequest` 権限で動作する。

```json
{
  "Effect": "Allow",
  "Action": [
    "codecommit:ListPullRequests",
    "codecommit:GetPullRequest"
  ],
  "Resource": "arn:aws:codecommit:<region>:<account-id>:<repository-name>"
}
```

### 認証

既存の AWS SDK 標準認証チェーンをそのまま使用する。v0.8 で追加の認証フローは不要。`--profile` / `--region` オプションも既存のまま動作する。

### 入力サニタイズ

検索クエリはクライアントサイドのフィルタリングにのみ使用され、API に送信されない。XSS やインジェクションのリスクはない。`ink-text-input` コンポーネントが入力処理を担当し、TUI 環境のためブラウザベースの攻撃ベクトルは存在しない。

## 技術選定

### 新規依存パッケージ: なし

v0.8 では新規依存パッケージの追加は不要。検索入力には既存の `ink-text-input` を使用する。

### Merged ステータスの判定方法

| 選択肢 | 評価 |
|--------|------|
| **`mergeMetadata.isMerged` で判定（採用）** | AWS SDK の公式フィールド。意図が明確。`boolean` 型で判定が単純 |
| `mergeMetadata.mergeCommitId` の有無で判定 | 間接的な判定。`mergeCommitId` がない Merged PR は理論上ありえないが、保証されていない |
| `DescribePullRequestEvents` API で MERGED イベントを検索 | 追加の API 呼び出しが必要。レイテンシが大幅に増加。25件の PR ごとに追加の API 呼び出しは非現実的 |

### 検索のアーキテクチャ

| 選択肢 | 評価 |
|--------|------|
| **クライアントサイドフィルタリング（採用）** | API にテキスト検索がないため唯一の選択肢。1ページ分（最大25件）なら十分高速。`useMemo` で最適化 |
| API の `authorArn` を使った著者フィルタ | ARN の完全一致のみ。ユーザーは ARN を知らないため UX が悪い |
| 全ページ取得してローカル検索 | API 呼び出しが大量に発生。レイテンシとコストの問題 |

### ページネーションの前ページ遷移

| 選択肢 | 評価 |
|--------|------|
| **`previousTokens` 配列で再取得（採用）** | シンプル。メモリ使用量が少ない（トークン文字列のみ保持）。データの整合性が保たれる |
| ページデータをキャッシュ | メモリ使用量が大きい（全 PR データを保持）。データの更新を反映するために cache invalidation が必要 |
| API の `previousToken` を使用 | `ListPullRequests` API は `previousToken` を返さない。利用不可 |

### useListNavigation フックの拡張 vs 直接 useInput

| 選択肢 | 評価 |
|--------|------|
| **直接 `useInput` を使用（採用）** | `PullRequestList` 固有のキーバインド（`f` / `/` / `n` / `p`）と検索モードの状態管理が必要。フックの汎用性を損なわない |
| `useListNavigation` に追加コールバックを渡す | パラメータが増えすぎてフックの責務が曖昧になる。`RepositoryList` には不要な機能が混入する |

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `listPullRequests`（`pullRequestStatus` パラメータ） | OPEN/CLOSED の呼び出し、Merged/Closed の分離をテスト |
| `PullRequestSummary`（`status` フィールド） | isMerged による表示ステータス判定をテスト |
| `PullRequestList`（ステータスフィルタ） | `f` キーでのフィルタ切り替え、UI 表示を確認 |
| `PullRequestList`（検索） | `/` キーでの検索モード、テキスト入力、フィルタリングを確認 |
| `PullRequestList`（ページネーション） | `n` / `p` キーでのページ遷移、表示を確認 |
| `App`（統合テスト） | フィルタ変更→再取得、ページ遷移→再取得、検索→フィルタの統合フロー |

カバレッジ 95% 以上を維持する。

### テストデータの構造

#### mergeMetadata のモック例

```typescript
// Merged PR のモック
const mergedPR = {
  pullRequest: {
    pullRequestId: "40",
    title: "feat: auth",
    authorArn: "arn:aws:iam::123456789012:user/watany",
    pullRequestStatus: "CLOSED",
    creationDate: new Date("2026-02-11T10:00:00Z"),
    pullRequestTargets: [{
      mergeMetadata: {
        isMerged: true,
        mergedBy: "arn:aws:iam::123456789012:user/taro",
        mergeCommitId: "abc123",
        mergeOption: "SQUASH_MERGE",
      },
    }],
  },
};

// Closed（非マージ）PR のモック
const closedPR = {
  pullRequest: {
    pullRequestId: "35",
    title: "fix: typos",
    authorArn: "arn:aws:iam::123456789012:user/hanako",
    pullRequestStatus: "CLOSED",
    creationDate: new Date("2026-02-09T10:00:00Z"),
    pullRequestTargets: [{
      mergeMetadata: {
        isMerged: false,
      },
    }],
  },
};

// Open PR のモック（既存テストデータ + status フィールド追加）
const openPR = {
  pullRequestId: "42",
  title: "fix: login timeout",
  authorArn: "arn:aws:iam::123456789012:user/watany",
  creationDate: new Date("2026-02-13T10:00:00Z"),
  status: "OPEN" as const,
};
```

### 具体的なテストケース

#### サービス層

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `listPullRequests`: OPEN ステータスで取得 | `ListPullRequestsCommand` が `pullRequestStatus: "OPEN"` で呼ばれる |
| 2 | `listPullRequests`: CLOSED ステータスで取得 | `ListPullRequestsCommand` が `pullRequestStatus: "CLOSED"` で呼ばれる |
| 3 | `listPullRequests`: デフォルト（引数省略） | `pullRequestStatus: "OPEN"` で呼ばれる（後方互換） |
| 4 | `listPullRequests`: Merged PR の status 判定 | `mergeMetadata.isMerged === true` の場合 `status: "MERGED"` |
| 5 | `listPullRequests`: Closed PR の status 判定 | `mergeMetadata.isMerged` が `false`/`undefined` の場合 `status: "CLOSED"` |
| 6 | `listPullRequests`: Open PR の status 判定 | `pullRequestStatus: "OPEN"` の場合 `status: "OPEN"` |
| 7 | `listPullRequests`: nextToken の返却 | API レスポンスに `nextToken` がある場合、結果に含まれる |
| 8 | `listPullRequests`: nextToken なし | 最終ページの場合 `nextToken` が `undefined` |

#### PullRequestList（コンポーネント）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | ステータスフィルタの表示 | 現在のフィルタが強調表示される |
| 2 | `f` キーで Open → Closed | `onChangeStatusFilter("CLOSED")` が呼ばれる |
| 3 | `f` キーで Closed → Merged | `onChangeStatusFilter("MERGED")` が呼ばれる |
| 4 | `f` キーで Merged → Open | `onChangeStatusFilter("OPEN")` が呼ばれる |
| 5 | `/` キーで検索モード開始 | テキスト入力欄が表示される |
| 6 | 検索モード中に文字入力 | `onChangeSearchQuery` が呼ばれる |
| 7 | 検索モード中に Esc | 検索モード終了、`onChangeSearchQuery("")` が呼ばれる |
| 8 | 検索モード中に `f` / `n` / `p` | 無視される（検索入力として扱われる） |
| 9 | 検索でタイトルにマッチ | マッチした PR のみ表示される |
| 10 | 検索で著者にマッチ | マッチした PR のみ表示される |
| 11 | 検索で大文字小文字を区別しない | "Login" で "login" にマッチ |
| 12 | 検索結果が空 | "No matching pull requests." が表示される |
| 13 | `n` キーで次ページ | `onNextPage` が呼ばれる |
| 14 | `p` キーで前ページ | `onPreviousPage` が呼ばれる |
| 15 | 次ページなしで `n` キー | `onNextPage` が呼ばれない |
| 16 | 前ページなしで `p` キー | `onPreviousPage` が呼ばれない |
| 17 | ページ番号の表示 | "Page 1" 等が表示される |
| 18 | Closed PR のステータスバッジ | "CLOSED" がタイトル前に表示される |
| 19 | Merged PR のステータスバッジ | "MERGED" がタイトル前に表示される |
| 20 | Open PR のステータスバッジ | バッジなし（デフォルト表示） |
| 21 | PR 件数の表示 | フィルタ・検索後の件数が括弧内に表示される |
| 22 | 空リスト（Closed フィルタ） | "No closed pull requests." が表示される |
| 23 | フッターのキーバインド表示 | `f filter  / search  n next  p prev` が表示される |

#### App（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | フィルタを CLOSED に変更 | `listPullRequests` が `pullRequestStatus: "CLOSED"` で再呼び出しされる |
| 2 | フィルタを MERGED に変更 | `listPullRequests` が `pullRequestStatus: "CLOSED"` で呼ばれ、結果が `MERGED` のみにフィルタされる |
| 3 | フィルタ変更時に検索クエリリセット | `searchQuery` が空文字列になる |
| 4 | フィルタ変更時にページネーションリセット | 1ページ目に戻る |
| 5 | 次ページ遷移 | `listPullRequests` が `nextToken` 付きで呼ばれる |
| 6 | 前ページ遷移 | `listPullRequests` が `previousTokens` の最後のトークンで呼ばれる |
| 7 | リポジトリ変更時にフィルタリセット | `statusFilter` が "OPEN"、`searchQuery` が空、ページが 1 にリセット |
| 8 | PR 詳細から戻った時にフィルタ維持 | `statusFilter` と `searchQuery` が維持される |
| 9 | `InvalidContinuationTokenException` | エラーメッセージ表示、1ページ目にリセット |

#### Help

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | ヘルプ画面表示 | `f`、`/`、`n`、`p` のキーバインドが表示される |

## 実装順序

各 Step は TDD サイクル（Red → Green → Refactor）で進める。テストを先に書き、最小限の実装で通し、その後リファクタリングする。

### Step 1: Tidy — PullRequestSummary に status フィールドを追加

`PullRequestSummary` 型に `status: PullRequestDisplayStatus` フィールドを追加し、`listPullRequests` 関数で `mergeMetadata.isMerged` を参照して表示用ステータスを設定する。既存のテストを更新し、テストデータに `status: "OPEN"` を追加する。

**この Step で変更するファイル**:
- `src/services/codecommit.ts`: `PullRequestDisplayStatus` 型追加、`PullRequestSummary` に `status` フィールド追加、`listPullRequests` 内で `status` 判定ロジック追加
- `src/services/codecommit.test.ts`: 既存テストに `status` フィールドの assertion 追加、Merged PR のテスト追加
- `src/components/PullRequestList.test.tsx`: テストデータに `status: "OPEN"` 追加
- `src/app.test.tsx`: テストデータに `status: "OPEN"` 追加

**この Step の完了条件**: 全テストが通過。既存テストの `PullRequestSummary` に `status` フィールドが含まれている。

### Step 2: サービス層 — listPullRequests にステータスパラメータ追加

`listPullRequests` 関数に `pullRequestStatus` パラメータを追加する。デフォルト値で後方互換を維持。

**この Step で変更するファイル**:
- `src/services/codecommit.ts`: `listPullRequests` のパラメータ追加
- `src/services/codecommit.test.ts`: OPEN/CLOSED パラメータのテスト追加

**この Step の完了条件**: `listPullRequests` が `pullRequestStatus` パラメータを受け取り、API に渡す。全テストが通過。

### Step 3: PullRequestList にステータスフィルタ UI を追加

`f` キーでのステータスフィルタ切り替え UI を追加する。`useListNavigation` フックの使用をやめ、`useInput` を直接使用する。

**この Step で変更するファイル**:
- `src/components/PullRequestList.tsx`: Props 追加、ステータスフィルタ UI、`useInput` 直接使用
- `src/components/PullRequestList.test.tsx`: フィルタ UI のテスト追加

**この Step の完了条件**: `f` キーでフィルタが切り替わり、`onChangeStatusFilter` が呼ばれる。

### Step 4: App にステータスフィルタのハンドラを統合

`statusFilter` state と `handleChangeStatusFilter` ハンドラを追加。`loadPullRequests` の呼び出しを変更。

**この Step で変更するファイル**:
- `src/app.tsx`: state 追加、ハンドラ追加、Props 渡し
- `src/app.test.tsx`: フィルタ変更→再取得の統合テスト

**この Step の完了条件**: フィルタ変更で API が正しいパラメータで再呼び出しされる。

### Step 5: PullRequestList に検索 UI を追加

`/` キーでの検索モード、テキスト入力、クライアントサイドフィルタリングを追加する。

**この Step で変更するファイル**:
- `src/components/PullRequestList.tsx`: 検索モード state、TextInput、フィルタリングロジック
- `src/components/PullRequestList.test.tsx`: 検索モードのテスト追加

**この Step の完了条件**: `/` キーで検索モード開始、テキスト入力でフィルタリング、Esc で検索終了。

### Step 6: PullRequestList にページネーション UI を追加

`n` / `p` キーでのページ遷移 UI を追加する。

**この Step で変更するファイル**:
- `src/components/PullRequestList.tsx`: ページネーション Props、`n` / `p` キーハンドラ、ページ情報表示
- `src/components/PullRequestList.test.tsx`: ページネーションのテスト追加

**この Step の完了条件**: `n` / `p` キーで `onNextPage` / `onPreviousPage` が呼ばれる。

### Step 7: App にページネーションのハンドラを統合

`pagination` state と `handleNextPage` / `handlePreviousPage` ハンドラを追加。

**この Step で変更するファイル**:
- `src/app.tsx`: `PaginationState` 型、state 追加、ハンドラ追加
- `src/app.test.tsx`: ページ遷移の統合テスト

**この Step の完了条件**: ページ遷移で API が正しい `nextToken` で再呼び出しされる。

### Step 8: Help 更新

`f`、`/`、`n`、`p` キーバインドを追加。

**この Step で変更するファイル**:
- `src/components/Help.tsx`: キーバインド行追加
- `src/components/Help.test.tsx`: スナップショットテスト更新

**この Step の完了条件**: Help 画面に 4 つの新しいキーバインドが表示される。

### Step 9: 全体テスト・カバレッジ確認

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

### Step 10: ドキュメント更新

**この Step で変更するファイル**:
- `docs/requirements.md`: v0.8 機能スコープセクション追加、キーバインド表に `f` / `/` / `n` / `p` 追加
- `docs/roadmap.md`: v0.8 セクションに ✅ マーク追加
- `README.md`: 機能一覧にステータスフィルタ・検索・ページネーションを追記
