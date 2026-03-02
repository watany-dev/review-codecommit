# 設計負債B: ページネーション状態を `usePagination` フックに抽出

## 概要

`app.tsx` に散在するページネーション関連の状態（`PaginationState`）とハンドラ（`handleNextPage` / `handlePreviousPage`）をカスタムフック `usePagination` に抽出する。

### スコープ

| 対象 | 内容 |
|------|------|
| **やること** | ページネーション状態・ハンドラを `usePagination` フックに移動する |
| **やらないこと** | ページネーションのロジック変更、APIインターフェースの変更、UIの変更 |

## 現状分析

### 問題

`app.tsx` は現在30+個の `useState` を持ち、その中にページネーション固有の状態が埋もれている。

**該当コード** (`src/app.tsx`):

```typescript
// 型定義（L51-58）
interface PaginationState {
  currentPage: number;
  currentToken: string | undefined;
  nextToken: string | undefined;
  previousTokens: (string | undefined)[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// 初期値（L60-67）
const initialPagination: PaginationState = { ... };

// 状態（L232）
const [pagination, setPagination] = useState<PaginationState>(initialPagination);

// ハンドラ（L391-422）
function handleNextPage() { ... }     // 16行
function handlePreviousPage() { ... } // 13行

// リセット（L373-376, L543-545 の3箇所）
setPagination(initialPagination);
```

### 問題の具体的影響

1. **認知的負荷**: `app.tsx` の 30+ useState の中にページネーションが紛れ、全体の見通しが悪い
2. **再利用不可**: 将来リポジトリ一覧にもページネーションが必要になった場合、同じロジックをコピーするしかない
3. **テスト粒度**: ページネーションロジック単体をテストするために App 全体を render する必要がある（`app.test.tsx` L4210-4391）

## 技術選定の根拠

### なぜ `useState` + カスタムフックか（`useReducer` との比較）

| 観点 | `useState` + カスタムフック | `useReducer` |
|------|---------------------------|-------------|
| 現行コードとの差分 | 最小（既存の `useState` をそのまま移動） | `PaginationState` を action/reducer に書き直す必要あり |
| プロジェクトの慣習 | `useAsyncAction` / `useListNavigation` が同パターン | プロジェクト内に `useReducer` の使用例なし |
| 複雑さ | 状態遷移が4種（setNextToken, goNext, goPrevious, reset）のみ | action type の定義が冗長 |
| テスタビリティ | 同等（どちらもTestComponent経由） | reducer関数を単体テスト可能だが、この規模では過剰 |

**結論**: 状態遷移が少なく、プロジェクトの既存パターンに合致する `useState` + カスタムフックを採用する。

### なぜ汎用ページネーション抽象化にしないか

将来の再利用（リポジトリ一覧のページネーション）を考慮すると、汎用化の誘惑がある。しかし:

- **YAGNI**: 現時点で再利用箇所はPR一覧のみ
- **トークンベースページネーション特化**: CodeCommit APIのトークンスタック方式に特化した設計の方が、呼び出し側のコードが簡潔
- **Tidy First?**: 小さな整理を積み重ねる方針に合致。汎用化は再利用箇所が確定してから行う

## 設計

### フックインターフェース

```typescript
// src/hooks/usePagination.ts

interface UsePaginationReturn {
  /** 現在のページ番号（1始まり） */
  currentPage: number;
  /** 現在のページトークン（API呼び出し用） */
  currentToken: string | undefined;
  /** 次のページが存在するか */
  hasNextPage: boolean;
  /** 前のページが存在するか */
  hasPreviousPage: boolean;
  /** APIレスポンスの nextToken を受け取り、次ページ情報を更新する */
  setNextToken: (nextToken: string | undefined) => void;
  /** 次のページに進む。遷移先トークンを返す。操作不可なら null を返す */
  goNext: () => string | undefined | null;
  /** 前のページに戻る。遷移先トークンを返す。操作不可なら null を返す */
  goPrevious: () => string | undefined | null;
  /** ページネーション状態を初期状態にリセットする */
  reset: () => void;
}

export function usePagination(): UsePaginationReturn;
```

**戻り値の3値について**:

| 戻り値 | 意味 | 例 |
|--------|------|-----|
| `string` | 遷移先のAPIトークン | `"token-A"` |
| `undefined` | 1ページ目のトークン（トークンなし） | `goPrevious()` で1ページ目に戻る場合 |
| `null` | 操作不可（次/前ページが存在しない） | `goNext()` で最終ページにいる場合 |

### 設計判断

#### 1. `setNextToken` を分離する理由

現在 `loadPullRequests` の中で `setPagination` を使い `nextToken` と `hasNextPage` を更新している（L304-308）:

```typescript
setPagination((prev) => ({
  ...prev,
  nextToken: result.nextToken,
  hasNextPage: !!result.nextToken,
}));
```

これは API レスポンス受信時の操作であり、`goNext` / `goPrevious`（ユーザー操作時）とは別のタイミングで発生する。分離することで責務が明確になる。

```
[APIレスポンス受信] → setNextToken(result.nextToken)  ← データ層からの通知
[ユーザーがnキー]   → goNext()                         ← ユーザー操作
[ユーザーがpキー]   → goPrevious()                     ← ユーザー操作
[フィルタ変更]      → reset()                          ← 画面遷移
```

#### 2. `goNext` / `goPrevious` が `null` を返す設計

現在の `handleNextPage` は内部で `loadPullRequests(selectedRepo, statusFilter, nextToken)` を呼んでいる。フックはデータ取得の責務を持たないため、呼び出し側が戻り値のトークンを使って API を呼ぶ設計にする。

**検討過程**:

1. `goNext: () => string | undefined` — `undefined` が「操作不可」と「1ページ目のトークン」の両方を意味し曖昧
2. `goNext: () => string | undefined | null` — `null` = 操作不可、`undefined` = 1ページ目トークン。3値だが意味が明確

**結論**: 3値の戻り値を採用。呼び出し側は `null` チェックのみで済む:

```typescript
// After (app.tsx)
function handleNextPage() {
  const token = pagination.goNext();
  if (token === null) return; // 操作不可
  loadPullRequests(selectedRepo, statusFilter, token);
}

function handlePreviousPage() {
  const token = pagination.goPrevious();
  if (token === null) return; // 操作不可
  loadPullRequests(selectedRepo, statusFilter, token);
}
```

### 内部アーキテクチャ

#### データフロー

```
┌──────────────────────────────────────────────┐
│ App.tsx                                       │
│                                               │
│  usePagination()                              │
│    ├── currentPage / hasNextPage / ...  ──────┼──→ PullRequestList (Props)
│    ├── setNextToken() ←── loadPullRequests()  │
│    ├── goNext()       ←── handleNextPage()    │
│    ├── goPrevious()   ←── handlePreviousPage()│
│    └── reset()        ←── handleBack() /      │
│                           handleSelectRepo() /│
│                           handleChangeFilter()│
└──────────────────────────────────────────────┘
```

#### ファイル構成

```
src/hooks/
├── useAsyncAction.ts        # 既存
├── useAsyncAction.test.tsx   # 既存
├── useAsyncDismiss.ts        # 既存
├── useAsyncDismiss.test.tsx   # 既存
├── useListNavigation.ts      # 既存
├── useListNavigation.test.tsx # 既存
├── usePagination.ts          # 新規
└── usePagination.test.tsx    # 新規
```

### 実装詳細

#### `usePagination.ts`

```typescript
import { useState } from "react";

interface PaginationState {
  currentPage: number;
  currentToken: string | undefined;
  nextToken: string | undefined;
  previousTokens: (string | undefined)[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const initialState: PaginationState = {
  currentPage: 1,
  currentToken: undefined,
  nextToken: undefined,
  previousTokens: [],
  hasNextPage: false,
  hasPreviousPage: false,
};

export function usePagination() {
  const [state, setState] = useState<PaginationState>(initialState);

  function setNextToken(nextToken: string | undefined): void {
    setState((prev) => ({
      ...prev,
      nextToken,
      hasNextPage: !!nextToken,
    }));
  }

  function goNext(): string | undefined | null {
    if (!state.nextToken) return null;

    const nextToken = state.nextToken;
    setState((prev) => ({
      ...prev,
      previousTokens: [...prev.previousTokens, prev.currentToken],
      currentToken: nextToken,
      currentPage: prev.currentPage + 1,
      hasPreviousPage: true,
    }));
    return nextToken;
  }

  function goPrevious(): string | undefined | null {
    if (state.previousTokens.length === 0) return null;

    // immutable 操作で取得（React Strict Mode 安全）
    const prevToken = state.previousTokens.at(-1);
    setState((prev) => {
      const newPreviousTokens = prev.previousTokens.slice(0, -1);
      return {
        ...prev,
        previousTokens: newPreviousTokens,
        currentToken: prevToken,
        currentPage: prev.currentPage - 1,
        hasPreviousPage: newPreviousTokens.length > 0,
      };
    });
    return prevToken;
  }

  function reset(): void {
    setState(initialState);
  }

  return {
    currentPage: state.currentPage,
    currentToken: state.currentToken,
    hasNextPage: state.hasNextPage,
    hasPreviousPage: state.hasPreviousPage,
    setNextToken,
    goNext,
    goPrevious,
    reset,
  };
}
```

### `app.tsx` の変更箇所

#### 削除するコード

| 行範囲 | 内容 |
|---------|------|
| L51-67 | `PaginationState` interface + `initialPagination` 定数 |
| L232 | `const [pagination, setPagination] = useState<PaginationState>(initialPagination)` |
| L304-308 | `setPagination` による nextToken 更新 |
| L313 | `setPagination(initialPagination)` （エラー時リセット） |
| L375-376 | `setPagination(initialPagination)` （リポジトリ選択時リセット） |
| L388 | `setPagination(initialPagination)` （フィルタ変更時リセット） |
| L391-422 | `handleNextPage` / `handlePreviousPage` 関数全体 |
| L544 | `setPagination(initialPagination)` （戻る操作時リセット） |

#### 追加するコード

```typescript
import { usePagination } from "./hooks/usePagination.js";

// useState を置換
const pagination = usePagination();

// loadPullRequests 内の nextToken 更新
pagination.setNextToken(result.nextToken);

// エラー時リセット
pagination.reset();

// リポジトリ選択時リセット
pagination.reset();

// フィルタ変更時リセット
pagination.reset();

// ページ遷移ハンドラ
function handleNextPage() {
  const token = pagination.goNext();
  if (token === null) return;
  loadPullRequests(selectedRepo, statusFilter, token);
}

function handlePreviousPage() {
  const token = pagination.goPrevious();
  if (token === null) return;
  loadPullRequests(selectedRepo, statusFilter, token);
}

// 戻る操作時リセット
pagination.reset();
```

#### PullRequestList への Props（変更なし）

```typescript
pagination={{
  currentPage: pagination.currentPage,
  hasNextPage: pagination.hasNextPage,
  hasPreviousPage: pagination.hasPreviousPage,
}}
```

`PullRequestList` の `PaginationViewState` interface と受け取り側は一切変更不要。

## エッジケース・異常系

### 1. React Strict Mode での setState 二重実行

`goPrevious` 内で `setState` コールバック中に `pop()` を使うと、Strict Mode で2回実行された場合にスタックが壊れる。

**対策**: `setState` 外で immutable な `at(-1)` でトークンを取得し、`setState` 内では `slice(0, -1)` を使う。上記実装コードはこの対策済み。

### 2. `goNext` の stale state 問題

`goNext` は `state.nextToken` を参照してガードチェックを行うが、React の batched updates により `state` が最新でない可能性がある。

**分析**: 現行のApp.tsxも同じパターン（`if (!pagination.nextToken) return;` で `state` 直参照）を使っており、問題は発生していない。理由:

- `goNext` はユーザーのキー入力（`n`キー）で同期的に呼ばれる
- `setNextToken` は非同期APIレスポンス後に呼ばれる
- 両者が同一レンダリングサイクル内で競合するケースは実質的にない

**結論**: 現行と同じパターンを維持。問題が顕在化した場合は `useRef` でトークンを保持する方式に変更する。

### 3. `goNext` 連続呼び出し

ユーザーが `n` キーを素早く2回押した場合:

- 1回目: `goNext()` → `state.nextToken` を消費し、`setState` をキュー
- 2回目: `goNext()` → 1回目の `setState` が未反映のため、同じ `nextToken` で2回遷移

**分析**: 現行の `handleNextPage` も同じ問題を持つが、`loadPullRequests` 内の `withLoadingState` が `setLoading(true)` を呼ぶことで、2回目の呼び出し時にはローディング画面が表示されキー入力が無視される。

**結論**: 現行と同じ振る舞いを維持。フック側での追加防御は不要。

### 4. `InvalidContinuationTokenException` 処理

App.tsx の `loadPullRequests` エラーハンドラ内で `pagination.reset()` が呼ばれるため、既存の動作を維持。フック側では特別な対応不要。

## AWS SDK 連携

### 影響: なし

本リファクタリングは UI 状態管理の内部変更であり、AWS SDK への影響はない。

- CodeCommit API の呼び出しシグネチャは変更なし
- `listPullRequests` への引数（`pageToken`）は `goNext` / `goPrevious` の戻り値をそのまま渡すため、API 層との境界は維持
- `setNextToken` は `listPullRequests` のレスポンスに含まれる `nextToken` を受け取るだけで、API 層のコードは変更なし
- モック方針にも影響なし

## セキュリティ考慮

### 影響: なし

本リファクタリングは Ink コンポーネント内部の状態管理ロジック移動のみであり、セキュリティへの影響はない。

- AWS 認証情報の取り扱いに変更なし
- ユーザー入力の処理に変更なし（ページネーショントークンはAPIレスポンスから受け取るのみ）
- 権限管理に変更なし

## テスト戦略

### 1. フック単体テスト (`src/hooks/usePagination.test.tsx`)

既存フックテストのパターン（`useAsyncAction.test.tsx`）に倣い、TestComponent 経由でテストする。

#### テストコード例

```typescript
import { Text } from "ink";
import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it } from "vitest";
import { usePagination } from "./usePagination.js";

function TestComponent({
  onResult,
}: {
  onResult?: (result: ReturnType<typeof usePagination>) => void;
}) {
  const result = usePagination();
  onResult?.(result);
  return (
    <Text>
      {`page: ${result.currentPage}, next: ${result.hasNextPage}, prev: ${result.hasPreviousPage}`}
    </Text>
  );
}

describe("usePagination", () => {
  it("starts with page 1, no next/previous", () => {
    let captured: ReturnType<typeof usePagination> | undefined;
    render(<TestComponent onResult={(r) => { captured = r; }} />);
    expect(captured!.currentPage).toBe(1);
    expect(captured!.hasNextPage).toBe(false);
    expect(captured!.hasPreviousPage).toBe(false);
    expect(captured!.currentToken).toBeUndefined();
  });

  it("goNext returns null when no next page", () => {
    let captured: ReturnType<typeof usePagination> | undefined;
    render(<TestComponent onResult={(r) => { captured = r; }} />);
    expect(captured!.goNext()).toBeNull();
  });

  // ... 以下、テストケース表に従って実装
});
```

#### テストケース一覧

| テストケース | 検証内容 |
|-------------|---------|
| 初期状態 | `currentPage=1`, `hasNextPage=false`, `hasPreviousPage=false`, `currentToken=undefined` |
| `setNextToken("token-A")` で次ページ有効化 | `hasNextPage=true` |
| `setNextToken(undefined)` で次ページ無効化 | `hasNextPage=false` |
| `goNext` で次ページ遷移 | `currentPage=2`, `hasPreviousPage=true`, `"token-A"` 返却 |
| `goNext` が次ページなしで `null` 返却 | 状態変更なし |
| `goPrevious` で前ページ遷移 | `currentPage` が1減少、前ページのトークンを返却 |
| `goPrevious` が1ページ目で `null` 返却 | 状態変更なし |
| `reset` で初期状態に戻る | 全フィールドが初期値 |
| 複数ページ遷移（1→2→3→2→1） | previousTokens スタックの正確性 |
| `goNext` + `goPrevious` 交互操作 | 状態の整合性 |

### 2. 既存テストによる回帰確認

`app.test.tsx` の以下のテストがそのまま回帰テストとして機能する:

- L4211: `navigates to next page with n key`
- L4255: `navigates to previous page with p key`
- L4311: `resets pagination on filter change`
- L4365: `handles InvalidContinuationTokenException by resetting to page 1`

これらは App コンポーネント経由でフックを間接的にテストするため、振る舞いの同一性を保証する。

### 3. プロパティベーステスト（検討）

`goNext` / `goPrevious` の対称性（N回 goNext した後 N回 goPrevious すると元に戻る）をプロパティベーステストで検証可能。ただし初回実装では見送り、必要に応じて追加する。

## 影響範囲

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `src/hooks/usePagination.ts` | 新規作成 | フック本体 |
| `src/hooks/usePagination.test.tsx` | 新規作成 | フック単体テスト |
| `src/app.tsx` | 修正 | `PaginationState` / `initialPagination` 削除、フック呼び出しに置換 |

### 変更しないファイル

| ファイル | 理由 |
|----------|------|
| `src/components/PullRequestList.tsx` | `PaginationViewState` Props はそのまま |
| `src/app.test.tsx` | 既存テストは振る舞いテストのため変更不要 |
| `src/services/codecommit.ts` | API呼び出しに変更なし |

## リスク評価

**リスク: 低**

- **Props 変更なし**: `PullRequestList` へ渡す Props の型・値は同一
- **振る舞い変更なし**: ページネーションのロジック自体を変えず、コードの配置を移動するのみ
- **既存テスト**: `app.test.tsx` のページネーション関連テスト（4件）がそのまま回帰テストとして機能
- **型安全**: TypeScript コンパイラが移動時の不整合を検出

## 実装計画

### イテレーション分割

TDDサイクル（Red → Green → Refactor）に従い、2イテレーションで実施する。

#### イテレーション1: フック作成とテスト（Red → Green）

1. `src/hooks/usePagination.test.tsx` を作成（テストケース10件）
2. `src/hooks/usePagination.ts` を作成（テストが通る最小実装）
3. `bun run test` で単体テスト通過を確認
4. コミット: `refactor: add usePagination hook with tests`

#### イテレーション2: App.tsx 置換（Refactor）

1. `src/app.tsx` の `PaginationState` / `initialPagination` を削除
2. `usePagination()` フック呼び出しに置換
3. `handleNextPage` / `handlePreviousPage` を簡素化
4. `setPagination(initialPagination)` → `pagination.reset()` に置換（4箇所）
5. `bun run ci` で全チェック通過を確認
6. コミット: `refactor: replace inline pagination state with usePagination hook`

### 依存関係

```
イテレーション1（フック作成） → イテレーション2（App.tsx置換）
```

イテレーション1完了後にイテレーション2を開始する。各イテレーション完了時にコミットを行う。

## 検証手順

実装完了後に `bun run ci` を実行し、以下を確認:

1. TypeScript 型チェック通過
2. 既存テスト全件パス（特に `app.test.tsx` のページネーション4件）
3. カバレッジ 95% 以上維持
4. oxlint / Biome / knip チェック通過

## 実施順序（設計負債全体での位置づけ）

設計負債Bは設計負債Aと独立しており、並行作業可能。Cの前に実施することが推奨される（App.tsx のコード量が減り、C の変更時に見通しがよくなるため）。

```
A（モーダル状態統合） ─┬─→ C（DisplayLine型安全化）
B（本設計）            ─┘
```
