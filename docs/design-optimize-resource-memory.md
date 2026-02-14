# リソース・メモリ最適化 設計書

## 概要

PR 詳細画面と PR 一覧画面のロード性能を改善する 3 つの最適化を行う。CloudShell 環境（1GB RAM, 1vCPU）で体感速度を大幅に向上させる。

1. **コミット取得と Blob 取得の並列化**: `loadPullRequestDetail` 内の逐次処理を並列化
2. **Blob キャッシュ導入**: blobId ベースの重複排除キャッシュで API コール削減
3. **N+1 PR クエリの並行数制御**: PR 一覧のスロットリングリスク低減

## 背景

### 現状の性能ボトルネック

#### 1. コミット逐次取得（最大 5 秒の遅延）

`src/services/codecommit.ts:471-476` の `getCommitsForPR` は while ループで親コミットを 1 件ずつ逐次取得する:

```typescript
while (currentId !== mergeBase && commits.length < MAX_COMMITS) {
  const commit = await getCommit(client, repositoryName, currentId);
  commits.push(commit);
  if (commit.parentIds.length === 0) break;
  currentId = commit.parentIds[0]!;
}
```

さらに `src/app.tsx:222-230` では、この処理が **Blob 取得完了後** に逐次実行される:

```
getPullRequestDetail → 承認状態取得 → Blob全件取得 → コミット逐次取得
                        (100ms)       (500ms)        (2500ms)
                                                     ↑ Blob完了を待ってから開始
```

50 コミットの PR では `50 × 50ms = 2.5 秒`の純粋な API 待ち時間が **Blob 取得後に加算** される。

#### 2. Blob 一括フェッチ（メモリ + 重複取得）

`src/app.tsx:202-220` で PR 全体の diff に含まれる **全ファイル** の before/after blob を一括取得する。`src/app.tsx:486-504` のコミット diff でも同じパターンで blob を取得するが、`diffTexts` と `commitDiffTexts` は **独立した Map** であり、同一 blobId の重複取得が発生する:

```
PR diff:     fileA(before=blob1, after=blob2), fileB(before=blob3, after=blob4)
Commit 1:    fileA(before=blob1, after=blob5)  ← blob1 を再取得
Commit 2:    fileA(before=blob5, after=blob2)  ← blob2 を再取得
```

#### 3. N+1 PR クエリ（スロットリングリスク）

`src/services/codecommit.ts:91-113` で `ListPullRequestsCommand`（ID のみ返却）の結果に対し、25 件の `GetPullRequestCommand` を `Promise.all` で **一斉発行** している:

```typescript
await Promise.all(
  pullRequestIds.map(async (id) => {
    const getCommand = new GetPullRequestCommand({ pullRequestId: id });
    // ...
  }),
)
```

25 件同時の API コールは AWS CodeCommit の TPS 制限（API あたり 15-25 TPS）に近く、スロットリングエラーのリスクがある。

## スコープ

### 今回やること

- `loadPullRequestDetail` 内の承認状態取得・Blob 取得・コミット取得の並列化
- blobId ベースの重複排除キャッシュ（`useRef`）導入
- PR 一覧取得の並行数制御（チャンク分割）

### 今回やらないこと

- `buildDisplayLines` の遅延構築（UI 層の変更は別設計）
- Blob の遅延読み込み（表示ファイルのみ取得）— 遅延読み込みは `buildDisplayLines` が全 `diffTexts` を前提としているため、UI 層の再設計が必要
- `getCommitsForPR` の逐次走査アルゴリズム自体の変更 — 親コミット ID を事前に知る手段がないため、逐次走査は本質的に不可避
- UI コンポーネントの `React.memo` / `useCallback` 化（別設計）
- ページネーション改善

## 技術選定

### 1. 並列化: `Promise.all` による同時実行

| 選択肢 | 評価 |
|--------|------|
| **`Promise.all` で Blob 取得とコミット取得を並列化（採用）** | 既存パターンとの一貫性あり。依存関係のない処理を `Promise.all` でまとめるだけ。リスクなし |
| Web Worker / Worker Thread で並列化 | Ink（React for CLI）環境では Worker との状態同期が複雑。過剰な設計 |
| `getCommitsForPR` 自体の並列化（先読みフェッチ） | 親コミット ID が前のコミットの結果に依存するため、真の並列化は不可能。`BatchGetCommitsCommand` は ID を事前に知る必要があり、初回走査の最適化には使えない |

### 2. Blob キャッシュ: `useRef` による Map キャッシュ

| 選択肢 | 評価 |
|--------|------|
| **`useRef(new Map<string, string>())` でキャッシュ（採用）** | React のライフサイクルに適合。コンポーネントのマウント中は保持、アンマウントで破棄。追加依存なし |
| `codecommit.ts` にモジュールレベルキャッシュ | サービス層に状態を持たせることになり、テストのモック設計が複雑化。ライフサイクル管理（いつクリアするか）が曖昧 |
| LRU キャッシュ（`lru-cache` パッケージ） | 新規依存の追加。プロジェクトの「最小依存」方針に反する。blobId は一意かつ不変であり、LRU の eviction ポリシーは不要 |
| `useState` でキャッシュ | Map の更新ごとに再レンダーが発生するが、キャッシュ更新は表示に影響しないため無駄な再レンダー。`useRef` が適切 |

### 3. 並行数制御: チャンク分割

| 選択肢 | 評価 |
|--------|------|
| **チャンク分割 `mapWithConcurrency`（採用）** | 追加依存なし。実装が 10 行以内でシンプル。テストしやすい純関数 |
| `p-limit` パッケージ | 新規依存の追加。プロジェクトの「最小依存」方針に反する |
| `Promise.allSettled` + リトライ | スロットリング時のリトライは有用だが、根本原因（同時接続数過多）の解決にならない。チャンク分割と組み合わせる場合は将来検討 |

## 設計

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/app.tsx` | `loadPullRequestDetail` の並列化、`blobCache` の `useRef` 導入、`getCachedBlobContent` ヘルパー追加、`handleLoadCommitDiff` のキャッシュ利用 |
| `src/app.test.tsx` | 並列化・キャッシュの動作検証テスト追加 |
| `src/services/codecommit.ts` | `mapWithConcurrency` ユーティリティ追加、`listPullRequests` の並行数制御適用 |
| `src/services/codecommit.test.ts` | `mapWithConcurrency` のテスト追加、`listPullRequests` の並行数制御テスト追加 |

### 1. コミット取得と Blob 取得の並列化

#### 変更対象

`src/app.tsx` の `loadPullRequestDetail` 関数（現在: 行 183-234）

#### Before（現状の実行フロー）

```
Step 1: getPullRequestDetail()        ← 300ms
Step 2: getApprovalStates() ‖ evaluateApprovalRules()  ← 100ms
Step 3: Promise.all(blobFetches)      ← 500ms
Step 4: getCommitsForPR()             ← 2500ms (50 commits)
────────────────────────────────────────────
合計: ~3400ms
```

Step 2 → Step 3 → Step 4 が逐次実行されている。

#### After（並列化後の実行フロー）

```
Step 1: getPullRequestDetail()        ← 300ms
Step 2-4: Promise.all([
  承認状態取得,     ← 100ms  ┐
  Blob全件取得,     ← 500ms  ├── 並列実行
  コミット一覧取得,  ← 2500ms ┘
])
────────────────────────────────────────────
合計: ~2800ms (= 300ms + max(100ms, 500ms, 2500ms))
```

#### 変更内容

```typescript
async function loadPullRequestDetail(pullRequestId: string) {
  await withLoadingState(async () => {
    blobCache.current.clear(); // PR切り替え時にキャッシュクリア

    const detail = await getPullRequestDetail(client, pullRequestId, selectedRepo);
    setPrDetail(detail.pullRequest);
    setPrDifferences(detail.differences);
    setCommentThreads(detail.commentThreads);

    // Blob フェッチの準備（map の時点で各 Promise の実行が開始される）
    const blobFetches = detail.differences.map(async (diff) => {
      const beforeBlobId = diff.beforeBlob?.blobId;
      const afterBlobId = diff.afterBlob?.blobId;
      const key = `${beforeBlobId ?? ""}:${afterBlobId ?? ""}`;

      const [before, after] = await Promise.all([
        beforeBlobId
          ? getCachedBlobContent(selectedRepo, beforeBlobId)
          : Promise.resolve(""),
        afterBlobId
          ? getCachedBlobContent(selectedRepo, afterBlobId)
          : Promise.resolve(""),
      ]);

      return { key, before, after };
    });

    // コミット取得の準備
    const sourceCommit = detail.pullRequest.pullRequestTargets?.[0]?.sourceCommit;
    const mergeBase = detail.pullRequest.pullRequestTargets?.[0]?.mergeBase;

    // 承認状態・Blob・コミットを並列実行
    const revisionId = detail.pullRequest.revisionId;
    const [approvalResult, blobResults, commitList] = await Promise.all([
      revisionId
        ? Promise.all([
            getApprovalStates(client, { pullRequestId, revisionId }),
            evaluateApprovalRules(client, { pullRequestId, revisionId }).catch(
              () => null,
            ),
          ])
        : Promise.resolve(null),
      Promise.all(blobFetches),
      sourceCommit && mergeBase
        ? getCommitsForPR(client, selectedRepo, sourceCommit, mergeBase)
        : Promise.resolve([] as CommitInfo[]),
    ]);

    // 結果の反映
    if (approvalResult) {
      setApprovals(approvalResult[0]);
      setApprovalEvaluation(approvalResult[1]);
    }

    const texts = new Map<string, { before: string; after: string }>();
    for (const result of blobResults) {
      texts.set(result.key, { before: result.before, after: result.after });
    }
    setDiffTexts(texts);

    setCommits(commitList);
    setCommitDifferences([]);
    setCommitDiffTexts(new Map());
  });
}
```

#### 設計判断

- **承認状態取得も並列化に含める**: 承認状態取得は 100ms 程度と軽量だが、Blob 取得やコミット取得との依存関係がないため、並列化に含めてもリスクなし。コード構造が `Promise.all` 1 箇所にまとまりシンプルになる
- **`blobFetches` の即時実行**: `detail.differences.map(async ...)` は `map` の時点で各 Promise を生成・実行開始する。外側の `Promise.all` はそれらの完了を待つ役割。Blob フェッチの Promise は `Promise.all([approvalResult, Promise.all(blobFetches), commitList])` の評価前に既に実行開始されており、承認取得・コミット取得と真に並列動作する。現状と同じ挙動であり問題なし
- **エラーハンドリング**: `withLoadingState` の try-catch で一括捕捉される。いずれかの並列タスクがエラーになると `Promise.all` 全体が reject され、エラー画面が表示される。現状と同じ挙動

### 2. Blob キャッシュ導入

#### 変更対象

`src/app.tsx` の `App` コンポーネント

#### キャッシュの定義

```typescript
import React, { useEffect, useRef, useState } from "react";

export function App({ client, initialRepo }: AppProps) {
  // ... 既存の state ...

  // blobId → content のキャッシュ（再レンダーを発生させない）
  const blobCache = useRef(new Map<string, string>());

  // ...
}
```

#### キャッシュ付き Blob 取得関数

```typescript
async function getCachedBlobContent(
  repositoryName: string,
  blobId: string,
): Promise<string> {
  const cached = blobCache.current.get(blobId);
  if (cached !== undefined) return cached;

  const content = await getBlobContent(client, repositoryName, blobId);
  blobCache.current.set(blobId, content);
  return content;
}
```

#### キャッシュの利用箇所

| 箇所 | 現状 | 変更後 |
|------|------|--------|
| `loadPullRequestDetail` 内の Blob 取得（行 207-209） | `getBlobContent(client, selectedRepo, blobId)` | `getCachedBlobContent(selectedRepo, blobId)` |
| `handleLoadCommitDiff` 内の Blob 取得（行 491-493） | `getBlobContent(client, selectedRepo, blobId)` | `getCachedBlobContent(selectedRepo, blobId)` |

#### キャッシュライフサイクル

```
PR一覧画面 → PR詳細画面を開く → blobCache.clear() → Blob取得（キャッシュ蓄積開始）
                                                    → Tab切り替え → キャッシュヒット ✅
                                                    → Tab切り替え → キャッシュヒット ✅
             PR一覧に戻る ←────────────────────────── blobCache は useRef なので保持
             同じ/別のPRを開く → blobCache.clear() → 新たにBlob取得
```

**設計判断**: `loadPullRequestDetail` の先頭で**毎回** `clear()` する。同一 PR を再度開いた場合もキャッシュはクリアされるが、PR のブランチが更新されている可能性があるため、stale データを防ぐ観点でこの挙動が正しい。キャッシュの恩恵は **同一 PR 内での Tab 切り替え（All changes ↔ コミット diff）** に限定される。

`loadPullRequestDetail` の先頭でキャッシュをクリアする:

```typescript
async function loadPullRequestDetail(pullRequestId: string) {
  await withLoadingState(async () => {
    blobCache.current.clear(); // PR切り替え時にキャッシュクリア
    // ...
  });
}
```

#### メモリ影響の分析

| シナリオ | キャッシュなし（現状） | キャッシュあり |
|----------|---------------------|--------------|
| PR diff 表示のみ | diffTexts に全 blob 保持 | diffTexts + blobCache に全 blob 保持（参照共有なし、2 倍） |
| PR diff + Commit 1 diff | diffTexts + commitDiffTexts（重複あり） | diffTexts + commitDiffTexts + blobCache（重複排除で API コール削減） |
| PR diff + Commit 1〜5 切り替え | diffTexts + commitDiffTexts（毎回再取得） | diffTexts + commitDiffTexts + blobCache（キャッシュヒットで API コール大幅削減） |

**トレードオフ**: `blobCache` はキャッシュ専用の Map であり、`diffTexts` / `commitDiffTexts` とは別に blob content を保持する。メモリ使用量は増加するが、API コール数の削減と引き換え。CloudShell の 1GB RAM に対し、50 ファイル PR で blobCache のオーバーヘッドは数 MB 程度であり許容範囲内。

#### `getBlobContent` をキャッシュ内に含めない理由

`getBlobContent`（`src/services/codecommit.ts:321-335`）自体にキャッシュを入れず、`App` コンポーネント内の `getCachedBlobContent` でラップする理由:

- `getBlobContent` はサービス層の純粋な API ラッパー。状態を持たせるとテストが複雑化する
- キャッシュのライフサイクルは UI 層（PR 詳細画面の開閉）に依存しており、サービス層が管理する責務ではない
- `useRef` で React のライフサイクルに合わせたキャッシュ管理が可能

### 3. N+1 PR クエリの並行数制御

#### 変更対象

`src/services/codecommit.ts` の `listPullRequests` 関数（現在: 行 76-118）

#### `mapWithConcurrency` ユーティリティ

`src/services/codecommit.ts` にチャンク分割の汎用関数を追加:

```typescript
export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}
```

#### `listPullRequests` の変更

```typescript
const CONCURRENCY_LIMIT = 5;

export async function listPullRequests(
  client: CodeCommitClient,
  repositoryName: string,
  nextToken?: string,
  pullRequestStatus?: "OPEN" | "CLOSED",
): Promise<{ pullRequests: PullRequestSummary[]; nextToken?: string }> {
  const listCommand = new ListPullRequestsCommand({
    repositoryName,
    pullRequestStatus: pullRequestStatus ?? "OPEN",
    maxResults: 25,
    nextToken,
  });
  const listResponse = await client.send(listCommand);
  const pullRequestIds = listResponse.pullRequestIds ?? [];

  const pullRequestsRaw = await mapWithConcurrency(
    pullRequestIds,
    async (id) => {
      const getCommand = new GetPullRequestCommand({ pullRequestId: id });
      const getResponse = await client.send(getCommand);
      const pr = getResponse.pullRequest;
      if (!pr) return null;

      const apiStatus = pr.pullRequestStatus ?? "OPEN";
      const isMerged =
        pr.pullRequestTargets?.[0]?.mergeMetadata?.isMerged === true;
      const displayStatus: PullRequestDisplayStatus =
        apiStatus === "CLOSED" && isMerged
          ? "MERGED"
          : (apiStatus as PullRequestDisplayStatus);

      return {
        pullRequestId: pr.pullRequestId ?? id,
        title: pr.title ?? "(no title)",
        authorArn: pr.authorArn ?? "unknown",
        creationDate: pr.creationDate ?? new Date(),
        status: displayStatus,
      };
    },
    CONCURRENCY_LIMIT,
  );

  const pullRequests = pullRequestsRaw.filter(
    (pr): pr is PullRequestSummary => pr !== null,
  );

  const result: { pullRequests: PullRequestSummary[]; nextToken?: string } = {
    pullRequests,
  };
  if (listResponse.nextToken != null) result.nextToken = listResponse.nextToken;
  return result;
}
```

#### `CONCURRENCY_LIMIT = 5` の選定根拠

| 並行数 | 25 件の取得時間（API レイテンシ 50ms） | チャンク数 | スロットリングリスク |
|--------|--------------------------------------|-----------|-------------------|
| 25（現状） | ~50ms（1 チャンク） | 1 | **高**: 25 TPS を瞬間的に消費 |
| 10 | ~150ms（3 チャンク） | 3 | 中 |
| **5（採用）** | ~250ms（5 チャンク） | 5 | **低**: ピーク 5 TPS |
| 1 | ~1250ms（25 チャンク） | 25 | なし |

CodeCommit API のデフォルト TPS 制限は API 操作あたり 15-25 TPS（[AWS ドキュメント](https://docs.aws.amazon.com/codecommit/latest/userguide/limits.html)）。5 並列ならピーク時でもヘッドルームを十分確保しつつ、ユーザーの体感遅延（+200ms）は最小限。

## データフロー

### Before（現状）

```
loadPullRequestDetail:
  getPullRequestDetail ─── 300ms ───→ setPrDetail, setPrDifferences, setCommentThreads
                                      │
                                      ▼
  getApprovalStates ‖ evaluateRules ─ 100ms ──→ setApprovals, setApprovalEvaluation
                                      │
                                      ▼
  Promise.all(blobFetches) ────────── 500ms ──→ setDiffTexts
                                      │
                                      ▼
  getCommitsForPR ─────────────────── 2500ms ─→ setCommits
                                      │
                                      ▼
                              合計: ~3400ms

handleLoadCommitDiff:
  getCommitDifferences ────── 50ms ──→ setCommitDifferences
                                      │
                                      ▼
  Promise.all(blobFetches) ── 300ms ─→ setCommitDiffTexts  ← 重複 blob 再取得
```

### After（最適化後）

```
loadPullRequestDetail:
  getPullRequestDetail ─── 300ms ───→ setPrDetail, setPrDifferences, setCommentThreads
                                      │
                                      ▼
  Promise.all([                       │
    approvalStates ‖ evaluateRules,   ├── 100ms  ┐
    Promise.all(blobFetches),         ├── 500ms  ├── max = 2500ms
    getCommitsForPR,                  └── 2500ms ┘
  ])                                  │
                                      ▼
  setApprovals, setDiffTexts,  ─────→ 合計: ~2800ms（600ms 改善）
  setCommits

handleLoadCommitDiff:
  getCommitDifferences ────── 50ms ──→ setCommitDifferences
                                      │
                                      ▼
  Promise.all(blobFetches) ── 50ms ──→ setCommitDiffTexts  ← blobCache ヒット
                              ↑ キャッシュにより大幅短縮
```

## 影響範囲の分析

### コンポーネント・Props への影響: なし

この設計ではコンポーネントの追加・削除・Props 変更は行わない。変更は `App` 内部の非同期処理フローとサービス層のユーティリティ関数に限定される。

| コンポーネント | Props 変更 | レンダリング変更 |
|--------------|-----------|----------------|
| `App` | なし | なし |
| `PullRequestDetail` | なし | なし |
| `PullRequestList` | なし | なし |
| `RepositoryList` | なし | なし |

### 機能的影響: なし

3 つの変更はすべて非機能要件（性能・リソース効率）の最適化であり、API の呼び出し結果・画面表示・ユーザー操作に変化はない。

### 既存テストへの影響

| 変更 | 既存テストへの影響 |
|------|-----------------|
| `loadPullRequestDetail` の並列化 | App のテストでモック呼び出し順序を検証しているケースがあれば修正が必要。ただし現状のテストは**結果**を検証しており、呼び出し順序には依存していない → **影響なし** |
| `blobCache` 導入 | `getBlobContent` のモックは引き続き動作する。`getCachedBlobContent` は内部で `getBlobContent` を呼ぶため、モックが有効 → **影響なし** |
| `listPullRequests` の並行数制御 | `Promise.all` → `mapWithConcurrency` に変更するが、`client.send` のモックは各呼び出しに対して動作する → **影響なし** |

### エッジケース

| ケース | 対処 |
|--------|------|
| `Promise.all` 内の 1 つがエラー | `Promise.all` が reject → `withLoadingState` の catch でエラー画面表示（現状と同じ） |
| `blobCache` にキャッシュ済みの blob が破損 | blobId は不変（Content-Addressable）であり、同一 blobId の内容が変わることはない。破損リスクなし |
| PR 切り替え時にキャッシュが残る | `loadPullRequestDetail` 先頭で `blobCache.current.clear()` を実行 |
| `mapWithConcurrency` に空配列 | for ループが 0 回実行され、空配列を返す。正常動作 |
| `mapWithConcurrency` で 1 チャンクがエラー | `Promise.all` が reject → 呼び出し元でエラーハンドリング |
| `pullRequestIds` が 5 件未満 | 1 チャンクで完結。現状と同じ `Promise.all` 挙動 |
| 同一 blobId の並行フェッチ（同一 blob が複数 diff に出現） | `getCachedBlobContent` の `get` → `set` 間に別の呼び出しがキャッシュミスする可能性あり（race condition）。ただし結果は同一内容の重複 API コールに留まり、データ破損は発生しない（blobId は Content-Addressable で不変）。2 回目以降は確実にキャッシュヒットする |
| `loadPullRequestDetail` の多重呼び出し（高速な PR 切り替え） | `blobCache.clear()` が毎回実行されるため、前の呼び出しのキャッシュは破棄される。`withLoadingState` のローディングガードにより UI 上は最後の呼び出し結果が反映される（既存挙動と同じ） |

### リスク

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| 並列化によりエラーハンドリングの挙動が変わる | 低 | 中 | `Promise.all` は最初の reject で全体を reject する挙動で、現状の逐次実行と同等。テストで検証 |
| `blobCache` のメモリリーク | 低 | 低 | `loadPullRequestDetail` でクリア + コンポーネントアンマウントで `useRef` が GC 対象になる |
| チャンク分割による一覧表示の遅延増加 | 中 | 低 | 最大 +200ms。ユーザーの体感には影響しにくい |

## AWS SDK 連携

### 使用 API（変更なし）

この変更では新しい AWS API は使用しない。既存の API 呼び出しの**実行タイミングと並行度**のみを変更する。

| API | 変更点 |
|-----|--------|
| `GetBlobCommand` | キャッシュ層を追加。同一 blobId への 2 回目以降の呼び出しをスキップ |
| `GetCommitCommand` | 実行タイミングを Blob 取得と並列に変更 |
| `GetPullRequestCommand` | 同時実行数を 25 → 5 に制限 |
| `GetPullRequestApprovalStatesCommand` | 実行タイミングを Blob・コミット取得と並列に変更 |
| `EvaluatePullRequestApprovalRulesCommand` | 同上 |

### IAM 権限

変更なし。追加の IAM 権限は不要。

## セキュリティ考慮

### blobCache のセキュリティ

- **スコープ**: `useRef` で App コンポーネント内に閉じている。外部からアクセス不可
- **永続化**: なし。メモリ上のみ。プロセス終了で破棄
- **機密情報**: blob content にはソースコードが含まれるが、これは既存の `diffTexts` / `commitDiffTexts` と同レベル。キャッシュ導入により新たなリスクは発生しない

### 並行数制御のセキュリティ

- API コールの同時実行数を**削減**する変更であり、セキュリティリスクは発生しない
- スロットリング回避により、AWS アカウントの API 制限を超えるリスクを**軽減**する

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `mapWithConcurrency` | 純関数のユニットテスト。並行度制御の検証 |
| `listPullRequests`（並行数制御後） | 既存テスト + 並行度の確認 |
| `App`（`loadPullRequestDetail` 並列化） | 既存の統合テストで結果を検証。並列化による結果の変化がないことを確認 |
| `App`（`blobCache`） | 同一 blobId の 2 回目呼び出しで API が呼ばれないことを検証 |

カバレッジ 95% 以上を維持する。

### 具体的なテストケース

#### `mapWithConcurrency`（ユニットテスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 10 件のアイテムを concurrency=3 で処理 | 全 10 件の結果が返る。チャンク: [3, 3, 3, 1] |
| 2 | 空配列 | 空配列が返る |
| 3 | concurrency=1 | 逐次実行される |
| 4 | items.length < concurrency | 1 チャンクで全件並列実行 |
| 5 | チャンク内の 1 件がエラー | Promise が reject される |
| 6 | 実行順序の検証 | チャンク内は並列、チャンク間は逐次であることを確認 |

#### `listPullRequests`（並行数制御）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 25 件の PR ID を 5 件ずつ取得 | 全 25 件の `PullRequestSummary` が返る |
| 2 | 3 件の PR ID（CONCURRENCY_LIMIT 未満） | 1 チャンクで全件取得 |
| 3 | 結果の内容が変更前と同一 | `pullRequestId`, `title`, `status` 等が正しい |

#### `App`（blob キャッシュ）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | PR 詳細ロード → コミット diff ロードで同一 blobId | `getBlobContent` が blobId あたり 1 回のみ呼ばれる |
| 2 | 別の PR を開いた場合 | キャッシュがクリアされ、新しい blob が取得される |
| 3 | 空文字列を返す blob（空ファイル） | 空文字列がキャッシュされ、2 回目は API 呼び出しなし（`"" !== undefined` で正しくヒット） |
| 4 | `"[File too large to display]"` を返す blob | 文字列がキャッシュされ、同一 blobId で同じ結果が返る |

#### `App`（`loadPullRequestDetail` 並列化）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | PR 詳細ロードで承認・blob・コミットが全て設定される | 既存テストの通過で担保 |
| 2 | 承認取得エラー時 | `Promise.all` が reject → エラー画面表示 |
| 3 | blob 取得エラー時 | 同上 |
| 4 | コミット取得エラー時 | 同上 |
| 5 | `revisionId` なし・`mergeBase` なしの場合 | null/空配列が正しく処理される |

## 性能改善の見積もり

### 定量的効果

| 項目 | Before | After | 改善幅 |
|------|--------|-------|--------|
| PR 詳細ロード（50 コミット, 20 ファイル） | ~3,400ms | ~2,800ms | **-600ms** |
| コミット Tab 切り替え（10 ファイル、80% キャッシュヒット） | ~500ms | ~100ms | **-400ms** |
| PR 一覧表示（25 件） | ~50ms（スロットリングなし） | ~250ms | +200ms（安定性とのトレードオフ） |
| PR 一覧表示（25 件、スロットリング発生時） | ~3,000ms+（リトライ含む） | ~250ms | **-2,750ms** |

### 定性的効果

- PR 詳細画面の初回表示が高速化（ローディング時間短縮）
- コミット Tab 切り替えが即座に反応（キャッシュヒット時）
- PR 一覧表示のスロットリングエラーが事実上排除

## 実装順序

### Step 1: `mapWithConcurrency` の追加とテスト

`src/services/codecommit.ts` に `mapWithConcurrency` 関数を追加。ユニットテストを追加して通過を確認。

**変更ファイル**:
- `src/services/codecommit.ts`: `mapWithConcurrency` 追加
- `src/services/codecommit.test.ts`: テスト追加

**完了条件**: `mapWithConcurrency` のテストが全て通過。

### Step 2: `listPullRequests` の並行数制御適用

`listPullRequests` 内の `Promise.all` を `mapWithConcurrency` に置き換え。

**変更ファイル**:
- `src/services/codecommit.ts`: `listPullRequests` 変更
- `src/services/codecommit.test.ts`: 既存テスト通過確認 + 並行数制御テスト追加

**完了条件**: `listPullRequests` の既存テスト + 新規テストが全て通過。

### Step 3: `blobCache` の導入

`App` コンポーネントに `blobCache` と `getCachedBlobContent` を追加。`loadPullRequestDetail` と `handleLoadCommitDiff` でキャッシュを利用。

**変更ファイル**:
- `src/app.tsx`: `blobCache` の `useRef` 追加、`getCachedBlobContent` 追加、利用箇所変更
- `src/app.test.tsx`: blob キャッシュのテスト追加

**完了条件**: blob キャッシュのテスト通過。既存テスト全通過。

### Step 4: `loadPullRequestDetail` の並列化

承認状態取得・Blob 取得・コミット取得を `Promise.all` で並列実行に変更。

**変更ファイル**:
- `src/app.tsx`: `loadPullRequestDetail` の構造変更
- `src/app.test.tsx`: 並列化の結果検証テスト追加

**完了条件**: 既存テスト + 新規テストが全て通過。

### Step 5: CI 確認

```bash
bun run ci
```

**完了条件**:
- oxlint: エラーなし
- Biome: フォーマットチェック通過
- TypeScript: 型チェック通過
- knip: 未使用 export なし
- vitest: カバレッジ 95% 以上
- build: 本番ビルド成功

### Step 6: ドキュメント更新

**変更ファイル**:
- `docs/requirements.md`: 非機能要件セクションに性能最適化の記載追加
- `README.md`: 必要に応じて更新
