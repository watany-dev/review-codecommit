# TUI 性能改善 設計書

## 概要

PR一覧取得の N+1 問題と、PR詳細画面のキー入力ごとの不要な再計算を解消する。
ユーザー体感に直結する2つのボトルネックを修正し、起動速度とスクロール応答性を改善する。

## 対象ボトルネック

### 1. PR一覧取得の N+1 問題

**現状**: `listPullRequests` が `ListPullRequestsCommand` で取得した ID リストに対して、`for` ループで `GetPullRequestCommand` を**逐次実行**している。

```typescript
// src/services/codecommit.ts:79-91 (現状)
for (const id of pullRequestIds) {
  const getCommand = new GetPullRequestCommand({ pullRequestId: id });
  const getResponse = await client.send(getCommand);
  // ...
}
```

**問題**: 25件の PR があれば 25回の逐次 API コール。レイテンシ 100-500ms/回として **2.5〜12.5秒** のブロッキングが発生する。

### 2. `buildDisplayLines` の毎レンダー再計算

**現状**: `PullRequestDetail` コンポーネント内で `buildDisplayLines()` が関数本体で直接呼ばれ、**毎レンダーで全差分テキストを再処理**している。

```typescript
// src/components/PullRequestDetail.tsx:119 (現状)
const lines = buildDisplayLines(differences, diffTexts, commentThreads);
```

**問題**: `j`/`k` キーで `setCursorIndex` → 再レンダー → `buildDisplayLines` が再実行。内部で以下が毎回走る:

- `texts.before.split("\n")` / `texts.after.split("\n")` — 文字列分割
- `computeSimpleDiff()` — O(n) 以上の diff 計算
- `extractAuthorName()` — ARN パース
- `inlineThreadsByKey` Map の再構築

大きな PR（数百行の diff × 複数ファイル）ではキー入力ごとに数十ms の遅延が発生する。

## スコープ

### 今回やること

- `listPullRequests` の `GetPullRequest` コールを `Promise.all` で並列化
- `buildDisplayLines` の結果を `useMemo` でキャッシュ

### 今回やらないこと

- diff アルゴリズム自体の改善（O(n²) `indexOf` → Myers diff 等）
- ページネーション対応（`nextToken` を使った追加読み込み UI）
- `App` コンポーネントの state 統合（`useReducer` 化）
- blob 取得の重複排除

## 設計

### 改善1: PR一覧取得の並列化

#### 変更対象

| ファイル | 変更内容 |
|---------|---------|
| `src/services/codecommit.ts` | `listPullRequests` 内のループを `Promise.all` に置換 |
| `src/services/codecommit.test.ts` | 並列化後の振る舞いを検証するテスト追加 |

#### 変更前

```typescript
// src/services/codecommit.ts:78-91
const pullRequests: PullRequestSummary[] = [];
for (const id of pullRequestIds) {
  const getCommand = new GetPullRequestCommand({ pullRequestId: id });
  const getResponse = await client.send(getCommand);
  const pr = getResponse.pullRequest;
  if (pr) {
    pullRequests.push({
      pullRequestId: pr.pullRequestId ?? id,
      title: pr.title ?? "(no title)",
      authorArn: pr.authorArn ?? "unknown",
      creationDate: pr.creationDate ?? new Date(),
    });
  }
}
```

#### 変更後

```typescript
// src/services/codecommit.ts
const pullRequests: PullRequestSummary[] = [];
const results = await Promise.all(
  pullRequestIds.map(async (id) => {
    const getCommand = new GetPullRequestCommand({ pullRequestId: id });
    const getResponse = await client.send(getCommand);
    return { id, pr: getResponse.pullRequest };
  }),
);
for (const { id, pr } of results) {
  if (pr) {
    pullRequests.push({
      pullRequestId: pr.pullRequestId ?? id,
      title: pr.title ?? "(no title)",
      authorArn: pr.authorArn ?? "unknown",
      creationDate: pr.creationDate ?? new Date(),
    });
  }
}
```

#### 設計判断

**順序保証**: `Promise.all` は入力配列の順序を保持するため、`pullRequestIds` の順序（API が返した順序）がそのまま `results` に反映される。既存テストの期待値を変更する必要はない。

**エラーハンドリング**: 1件でも `GetPullRequest` が失敗すると `Promise.all` 全体が reject される。これは現行の逐次ループでも同じ振る舞い（最初の失敗で例外がスロー）なので、既存の `withLoadingState` のエラーハンドリングがそのまま機能する。

**スロットリング**: CodeCommit API のスロットリング制限について。
- CodeCommit の API レート制限は明示的に公開されていないが、一般的な AWS API の制限を考慮して `maxResults: 25` を維持する（現行と同じ）。
- 25件の並列リクエストは実用上問題ないレベル。もし将来スロットリングが問題になった場合は、`p-limit` 等で並列度を制御できるが、現時点では YAGNI として対応しない。

#### テスト方針

既存テストは `mockSend` の呼び出し順序に依存しているが、`Promise.all` でも `map` の順序に従って `mockSend` が呼ばれるため、**既存テストは変更不要**。

追加テストケース:

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 複数PR IDで並列取得 | 全PRが正しい順序で返る、`send` が N+1 回呼ばれる |
| 2 | 1件の GetPullRequest が失敗 | Promise.all が reject、エラーが伝播する |
| 3 | 空の pullRequestIds | 空配列で即 resolve。`send` は ListPullRequests の 1回のみ |

テストコード例（追加テスト #1）:

```typescript
it("fetches multiple PRs in parallel and preserves order", async () => {
  mockSend.mockResolvedValueOnce({
    pullRequestIds: ["10", "20", "30"],
    nextToken: undefined,
  });
  mockSend.mockResolvedValueOnce({
    pullRequest: { pullRequestId: "10", title: "first" },
  });
  mockSend.mockResolvedValueOnce({
    pullRequest: { pullRequestId: "20", title: "second" },
  });
  mockSend.mockResolvedValueOnce({
    pullRequest: { pullRequestId: "30", title: "third" },
  });

  const result = await listPullRequests(mockClient, "my-service");
  expect(result.pullRequests).toHaveLength(3);
  expect(result.pullRequests[0].title).toBe("first");
  expect(result.pullRequests[1].title).toBe("second");
  expect(result.pullRequests[2].title).toBe("third");
  expect(mockSend).toHaveBeenCalledTimes(4); // 1 List + 3 Get
});
```

### 改善2: `buildDisplayLines` の `useMemo` 化

#### 変更対象

| ファイル | 変更内容 |
|---------|---------|
| `src/components/PullRequestDetail.tsx` | `buildDisplayLines` 呼び出しを `useMemo` でラップ |
| `src/components/PullRequestDetail.test.tsx` | テスト変更なし（振る舞いは同一） |

#### 変更前

```typescript
// src/components/PullRequestDetail.tsx:119
const lines = buildDisplayLines(differences, diffTexts, commentThreads);
```

#### 変更後

```typescript
// src/components/PullRequestDetail.tsx
const lines = useMemo(
  () => buildDisplayLines(differences, diffTexts, commentThreads),
  [differences, diffTexts, commentThreads],
);
```

#### 依存値の分析

`useMemo` の依存配列 `[differences, diffTexts, commentThreads]` が正しいことを検証する。

`buildDisplayLines` が参照する外部データ:

| データ | ソース | 変更タイミング |
|--------|--------|---------------|
| `differences` | props (`Difference[]`) | PR 詳細ロード時に一度だけ設定 |
| `diffTexts` | props (`Map<string, ...>`) | blob フェッチ完了時に一度だけ設定 |
| `commentThreads` | props (`CommentThread[]`) | PR 詳細ロード時 + コメント投稿後のリロード時 |

いずれも `App` コンポーネントの state であり、**参照が変わるのは API レスポンス受信時のみ**。`cursorIndex` の変化（`j`/`k` キー）では変わらない。

つまり、`useMemo` により:
- `j`/`k` でカーソルを動かす → `cursorIndex` が変わる → 再レンダー → **`buildDisplayLines` はスキップ**（依存値不変）
- コメント投稿後にリロード → `commentThreads` が変わる → **`buildDisplayLines` が再実行**（正しい動作）

#### 設計判断

**`useMemo` の粒度**: `buildDisplayLines` 全体を1つの `useMemo` でラップする。内部の `computeSimpleDiff` や `split("\n")` を個別にメモ化する案もあるが、`differences`/`diffTexts`/`commentThreads` が同時に変わる（PR ロード時）ため、個別メモ化のメリットは小さい。シンプルさを優先する。

**Map の参照等価性**: `diffTexts` は `Map` オブジェクト。`App` 側で `setDiffTexts(texts)` するたびに新しい `Map` インスタンスが作られるため、`useMemo` の依存値比較（`Object.is`）が正しく機能する。同じ内容でも新しいオブジェクトなら再計算され、同一参照なら再計算されない。

#### テスト方針

`useMemo` は内部最適化であり、外部から見た振る舞い（レンダリング結果）は変わらない。**既存テストは変更不要**。`useMemo` が正しく機能していることは、依存値の分析（上記）で論理的に検証済みとする。

## データフロー（改善後）

### 改善1: PR一覧取得

```
ユーザー           App              codecommit.ts        CodeCommit API
  │                │                    │                     │
  │── リポ選択 ───→│                    │                     │
  │                │── loadPullRequests()                     │
  │                │                    │── ListPullRequests ─→│
  │                │                    │←── [id1,id2,id3] ───│
  │                │                    │                     │
  │                │                    │── Promise.all([     │
  │                │                    │     GetPR(id1), ────→│ ← 並列
  │                │                    │     GetPR(id2), ────→│ ← 並列
  │                │                    │     GetPR(id3), ────→│ ← 並列
  │                │                    │   ])                │
  │                │                    │←── [pr1,pr2,pr3] ───│
  │                │← setPullRequests ──│                     │
  │←── 一覧表示 ───│                    │                     │
```

**改善前**: GetPR(id1) 完了 → GetPR(id2) 完了 → GetPR(id3) 完了 （直列）
**改善後**: GetPR(id1,id2,id3) が同時に実行 （並列）

### 改善2: キー入力時の再レンダー

```
ユーザー         PullRequestDetail           buildDisplayLines
  │                  │                            │
  │── j キー ───────→│                            │
  │                  │── setCursorIndex(+1)       │
  │                  │── 再レンダー               │
  │                  │                            │
  │                  │── useMemo チェック          │
  │                  │   deps 変化なし → スキップ  │ ← 再計算されない
  │                  │                            │
  │                  │── scrollOffset 計算        │
  │                  │── visibleLines.slice()     │
  │←── 描画更新 ─────│                            │
```

**改善前**: j キー → `buildDisplayLines()` 再実行 → 全 diff 再処理
**改善後**: j キー → `useMemo` キャッシュヒット → `slice()` のみ

## 性能改善の見積もり

### 改善1: PR一覧取得

| 条件 | 改善前 | 改善後 | 改善率 |
|------|--------|--------|--------|
| 10件のPR、100ms/リクエスト | 1,100ms | 200ms | **5.5x** |
| 25件のPR、100ms/リクエスト | 2,600ms | 200ms | **13x** |
| 25件のPR、300ms/リクエスト | 7,800ms | 400ms | **19.5x** |

※改善後の時間 = ListPullRequests (100ms) + max(GetPR × N) (100-300ms)。並列実行ではネットワークラウンドトリップが重複するため、最も遅い1件の時間が支配的になる。

### 改善2: `buildDisplayLines` のメモ化

| 条件 | 改善前 | 改善後 |
|------|--------|--------|
| j/k キー入力ごとの `buildDisplayLines` 実行 | 毎回（5-50ms） | 0ms（キャッシュヒット） |
| コメント投稿後 | 毎回（5-50ms） | 1回のみ再計算 |

※ diff 行数が 500 行、ファイル数 10 のケースで 5-50ms の推定。`split()`、`computeSimpleDiff()`、`extractAuthorName()` の合計。

## エッジケースと対処方針

### 改善1: PR一覧並列化

| ケース | 対処 |
|--------|------|
| `pullRequestIds` が空配列 | `Promise.all([])` は即座に空配列で resolve される。既存の動作と同じ |
| PR が 1件のみ | `Promise.all` に要素1つの配列を渡す。逐次ループと同じ結果。オーバーヘッドは無視できる |
| 1件の `GetPullRequest` が `ThrottlingException` で失敗 | `Promise.all` が reject。`withLoadingState` がエラーを捕捉し UI に表示。逐次ループでも同じ振る舞い |
| 複数件が同時に失敗 | `Promise.all` は最初に reject された Promise のエラーのみを伝播。逐次ループでは最初の失敗で停止するため、見えるエラーは1件という点で同じ |
| `pullRequest` が `undefined` のレスポンス | `results` の後処理で `if (pr)` ガードにより安全にスキップ。既存の動作と同じ |

### 改善2: `useMemo` 化

| ケース | 対処 |
|--------|------|
| `differences` が空配列 | `buildDisplayLines` が空の `lines` を返す。`useMemo` は正しくキャッシュする |
| `diffTexts` が空 Map | diff テキストなしの状態をキャッシュ。blob フェッチ完了時に `diffTexts` の参照が変わり再計算される |
| `commentThreads` が投稿後に変更 | `commentThreads` は `App` 側で新配列が生成されるため、参照が変わり `useMemo` が正しく再計算する |
| 高速なキー連打（j を押し続ける） | `useMemo` のキャッシュヒットにより `buildDisplayLines` は実行されない。`scrollOffset` の `useMemo` と `slice()` のみが動作するため高速 |
| PR 切り替え時 | `differences`、`diffTexts`、`commentThreads` 全ての参照が変わるため、`useMemo` が1回だけ再計算する |

## セキュリティ考慮

今回の変更は内部的な性能最適化であり、セキュリティ上の影響はない。

| 観点 | 評価 |
|------|------|
| 認証モデル | 変更なし。既存の AWS SDK 認証チェーン（`--profile` / `--region`）をそのまま使用 |
| API 呼び出しパターン | 呼び出す API（`GetPullRequestCommand`）は同じ。逐次→並列に変えるだけで、新たな API は追加しない |
| データの取り扱い | `useMemo` はメモリ内キャッシュ。ディスクやネットワークへの新たなデータ永続化は発生しない |
| 権限要件 | IAM ポリシーの変更不要。必要な権限は `codecommit:GetPullRequest`（既存と同じ） |

## 技術選定の補足

### `Promise.all` vs `Promise.allSettled`

| 選択肢 | 評価 |
|--------|------|
| **`Promise.all`（採用）** | 1件でも失敗すると全体が reject。現行の逐次ループと同じ振る舞い（最初の失敗で停止）を維持でき、`withLoadingState` のエラーハンドリングをそのまま活用できる |
| `Promise.allSettled` | 全リクエストの完了を待ち、成功/失敗を個別に取得可能。部分的な結果を表示できるが、「一覧の一部だけ表示」は UX として不自然。失敗時のリトライ UI も必要になり、スコープが膨らむ |

**判断**: `Promise.all` を採用。エラー時の振る舞いを変えない（既存と一貫）ことを優先する。部分表示が必要になった場合は `Promise.allSettled` への切り替えを検討する。

## 実装順序

構造的変更と機能的変更を分離し、各ステップでコミットする（Tidy First? の原則に従う）。

### Step 1: `listPullRequests` の並列化（コミット1）

1. `src/services/codecommit.ts` の `for` ループを `Promise.all` + `map` に変更
2. 並列取得のテストを `src/services/codecommit.test.ts` に追加
3. `bun run test` で既存テスト含め全パスを確認
4. コミット: `perf: parallelize GetPullRequest calls in listPullRequests`

### Step 2: `buildDisplayLines` の `useMemo` 化（コミット2）

1. `src/components/PullRequestDetail.tsx` の `buildDisplayLines` 呼び出しを `useMemo` でラップ
2. `useMemo` は既に import 済み（3行目）なので import 変更不要
3. `bun run test` で既存テスト全パスを確認
4. コミット: `perf: memoize buildDisplayLines to avoid recalc on cursor move`

### Step 3: CI チェック

```bash
bun run ci
```

全チェック（lint, format, type check, dead-code, audit, test:coverage, build）をパスすることを確認。
