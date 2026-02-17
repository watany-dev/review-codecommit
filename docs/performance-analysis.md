# Performance Bottleneck Analysis

性能ボトルネック調査結果。細かいものも含め、遅延要因を網羅的に洗い出した。

## A. API層のボトルネック (ネットワーク起因 — 影響大)

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

### 2. `getCommitsForPR` の完全直列処理

**場所**: `src/services/codecommit.ts:478-495`

コミット履歴を1件ずつ直列に `GetCommitCommand` で辿っている。10コミットのPRなら10回の直列APIコール。コミットグラフが線形であるため並列化は難しいが、`GetBatchGetCommits` 相当のAPIがあれば改善可能。現実的にはUI側で最初の数件だけ表示し、残りを遅延ロードするアプローチが有効。

### 3. `getReactionsForComments` — コメント数に比例したAPIコール

**場所**: `src/services/codecommit.ts:576-595`

全コメントの reaction を1件ずつ個別に取得。50コメントあるPRなら50回のAPIコール（concurrency=5で直列10バッチ分）。

### 4. `reloadReactions` による全件再取得

**場所**: `src/app.tsx:133-143`

リアクション1件追加するだけで、全コメントの reaction を再取得する。差分更新（変更した commentId のみ再取得して Map をマージ）に変えれば、APIコールを 1 回に削減できる。

### 5. `reloadComments` による全件再取得

**場所**: `src/app.tsx:415-429`

コメント投稿・返信・編集・削除のいずれの操作でも、全コメント + 全リアクションを再取得する。API レスポンスには新規コメントが含まれるため、楽観的更新でローカル state に追加すれば再取得を省略できる。

---

## B. Diff 計算のボトルネック (CPU起因 — 中規模ファイルで影響)

### 6. `computeSimpleDiff` 内の `indexOf` による O(n×m)

**場所**: `src/components/PullRequestDetail.tsx:1414,1432`

diff 計算のループ内で `afterLines.indexOf(bl, ai)` / `beforeLines.indexOf(al, bi)` を呼んでいる。`indexOf` は O(n) なので、ループ全体で O(n×m)。大きなファイル（数千行）で顕著に遅延する。

```typescript
// 各行に対して indexOf = O(n) → ループ全体で O(n*m)
const nextMatch = afterLines.indexOf(bl, ai);
```

行を `Set` や `Map` で索引すれば O(1) のルックアップに改善可能。

### 7. `findNextHeaderIndex` / `findPrevHeaderIndex` でヘッダー位置を毎回再計算

**場所**: `src/components/PullRequestDetail.tsx:1567-1585`

`n` / `N` キーを押すたびに `lines` 全件を走査して `headerIndices` を再構築する。`useMemo` で既に計算済みの `headerIndices`（417行目）が存在するのに使っていない。

### 8. `buildDisplayLines` 内でキャッシュされた diff 行を変異（mutation）

**場所**: `src/components/PullRequestDetail.tsx:1220-1222`

```typescript
for (const dl of diffLines) {
  dl.filePath = filePath;   // ← キャッシュ済みオブジェクトを直接変更
  dl.diffKey = blobKey;     // ← 同上
  lines.push(dl);
```

`diffCacheRef` に保存されたオブジェクトを直接変更しているため、キャッシュが汚染される。

---

## C. React/状態管理のボトルネック (レンダリング回数 — UI ジャンク)

### 9. `new Map(prev)` による高頻度コピー

**場所**: `src/app.tsx:282-315`

blob が1件ロードされるたびに `setDiffTexts` と `setDiffTextStatus` の両方で `new Map(prev)` を実行する。50ファイルのPRなら100回の Map コピー（各コピーが O(n)）。バッチ化するか `useRef` + 単一 `setState` で更新回数を減らすことで改善可能。

### 10. `diffTextStatus` のデフォルト値が毎レンダー新オブジェクト

**場所**: `src/components/PullRequestDetail.tsx:129`

```typescript
diffTextStatus = new Map(),  // レンダーごとに新 Map 生成
```

prop が渡されない場合、毎レンダーで新しい `Map` が生成され、`useMemo` の依存配列で常に変更扱いになる。モジュールレベルの定数を使うべき。

### 11. `buildDisplayLines` の依存配列が広すぎる

**場所**: `src/components/PullRequestDetail.tsx:402-413`

`diffTexts` が更新されるたびに（blob 1件ロードごと）全ファイル分の display lines を再構築する。`diffCacheRef` で個別ファイルの diff はキャッシュしているが、まとめる処理自体のコストが残る。

### 12. `visibleLines` の key に配列インデックス使用

**場所**: `src/components/PullRequestDetail.tsx:787`

スクロールにより `globalIndex` がずれると、React は全 `visibleLines` を再マウントする。行のコンテンツをベースにした安定 key を使えば再マウントを抑制できる。

---

## D. 細かいが累積する非効率

### 13. `TextDecoder` を毎回生成

**場所**: `src/services/codecommit.ts:347`

`TextDecoder` インスタンスは使い回し可能。50ファイルのPRで100回生成される。

### 14. blob コンテンツのキャッシュなし

**場所**: `src/services/codecommit.ts:336-350`

同じ `blobId` が複数の diff に現れうるが、キャッシュがないため同一 blob を複数回取得する可能性がある。

### 15. `loadDiffTextsInBackground` が `mapWithLimit` を再実装

**場所**: `src/app.tsx:261-335`

`mapWithLimit` ユーティリティが存在するのに独自ワーカープールを実装（concurrency 6 vs 他は 5）。

### 16. `extractAuthorName` の繰り返し呼び出し

ARN 文字列の `split("/")` が毎レンダーで複数箇所から呼ばれる。軽い処理だがコメントが多い画面では累積する。

---

## 優先度まとめ

| 優先度 | 項目 | 影響 | 改善難易度 |
|--------|------|------|------------|
| **高** | #1 listPullRequests N+1 | PR一覧表示が遅い | API制約あり。concurrency増加 |
| **高** | #2 getCommitsForPR 直列 | コミットビュー初回が遅い | API制約あり |
| **高** | #4,#5 操作後の全件再取得 | 操作後のフリーズ | 楽観的更新で解消 |
| **中** | #6 computeSimpleDiff O(n×m) | 大ファイルでフリーズ | Set/Map索引化 |
| **中** | #9 Map コピーの高頻度化 | 多ファイルPRでカクつき | バッチ化 |
| **中** | #3 reaction 全件取得 | コメント多数で遅い | 差分更新 |
| **低** | #7,#10,#12,#13,#14,#15,#16 | 軽微 | 個別に対処 |
