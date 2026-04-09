# Performance Bottleneck Analysis

性能ボトルネック調査結果。16件を洗い出し、低リスクの5件は v0.1.1 で対応済み。
残りのうち、改善幅とリスクのバランスが良い3件を推奨対応として残す。

---

## 対応済み（v0.1.1）

| # | 項目 | 対応内容 |
|---|------|----------|
| 10 | `diffTextStatus` デフォルト値 | モジュールレベル定数 `EMPTY_STATUS_MAP` に変更 |
| 13 | `TextDecoder` 毎回生成 | モジュールレベルのシングルトンに変更 |
| 16 | `extractAuthorName` 繰返し | `Map<string, string>` キャッシュ追加 |
| 7 | ヘッダー位置再計算 | `useMemo` 済み `headerIndices` を直接参照 |
| 8 | キャッシュオブジェクト mutation | スプレッドコピーで対応 |

---

## 推奨対応（★★☆）

### 1. `listPullRequests` の N+1 問題

**場所**: `src/services/codecommit.ts:84-124`

`ListPullRequestsCommand` は PR ID のリストだけを返す。その後各 ID に対して `GetPullRequestCommand` を個別に発行しており、最大25件 × 個別 API コール（concurrency=5）が発生する。ページを開くたびにこのコストがかかる。

```
ListPullRequests → [id1, id2, ..., id25]
  → GetPullRequest(id1)  ──┐
  → GetPullRequest(id2)    │ 5並列 × 5バッチ = 直列5回分の遅延
  → ...                    │
  → GetPullRequest(id25) ──┘
```

CodeCommit API にはバッチ取得がないため API の制約ではあるが、concurrency を 5→10 程度に上げることで改善可能。

> **改修影響度: 🟢 低** — `mapWithLimit` の第2引数を変えるだけ。ただし CodeCommit API のスロットリング（1秒あたりのリクエスト上限）に引っかかる可能性がある。

### 3. `getReactionsForComments` — コメント数に比例したAPIコール

**場所**: `src/services/codecommit.ts:576-595`

全コメントの reaction を1件ずつ個別に取得。50コメントあるPRなら50回のAPIコール（concurrency=5で直列10バッチ分）。

> **改修影響度: 🟡 中** — reaction 取得を遅延（表示時に lazy load）する方法が有効。reaction は表示のみに使われるため、表示が一瞬遅れても操作に影響しない。

### 14. blob コンテンツのキャッシュなし

**場所**: `src/services/codecommit.ts:336-350`

同じ `blobId` が複数の diff に現れうるが、キャッシュがないため同一 blob を複数回取得する可能性がある。

> **改修影響度: 🟡 中** — `Map<string, string>` のキャッシュ導入自体は簡単だが、PR を切り替えた際のキャッシュクリアが必要。
