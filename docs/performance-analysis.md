# Performance Bottleneck Analysis

性能ボトルネック調査結果。細かいものも含め、遅延要因を網羅的に洗い出した。

各項目に **改修影響度**（改修時にテストや既存動作が壊れるリスク）を付記する。
本コードベースのテストは `mockSend.mock.calls[N]` のコール順序検証や `lastFrame()` の文字列マッチに強く依存しており、内部実装の変更に対して脆い構造になっている。

---

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

> **改修影響度: 🟢 低** — concurrency 数値の変更だけなら `mapWithLimit` の第2引数を変えるだけ。`codecommit.test.ts` では `mockSend` のコール回数は検証しているがコール**順序**は `mapWithLimit` 内部の並列度に依存しないため壊れにくい。ただし concurrency を大きく上げると CodeCommit API のスロットリング（1秒あたりのリクエスト上限）に引っかかる可能性がある。本番環境で 429 エラーが出た場合のリトライ処理は未実装。

### 2. `getCommitsForPR` の完全直列処理

**場所**: `src/services/codecommit.ts:478-495`

コミット履歴を1件ずつ直列に `GetCommitCommand` で辿っている。10コミットのPRなら10回の直列APIコール。コミットグラフが線形であるため並列化は構造上難しい。

> **改修影響度: 🟡 中** — while ループの構造を変えると `codecommit.test.ts` の `getCommitsForPR` テスト群（`mockSend` の呼び出し回数・順序を検証）が壊れる。また、コミットチェーンの順序（`commits.reverse()` で時系列順にする）に依存する `app.test.tsx` のコミットビューテストにも影響する。現実的な改善は「最初の N 件だけ取得して残りを遅延ロード」だが、UI のロード状態管理と `app.test.tsx` の `handleLoadCommitDiff` テストの書き換えが必要。

### 3. `getReactionsForComments` — コメント数に比例したAPIコール

**場所**: `src/services/codecommit.ts:576-595`

全コメントの reaction を1件ずつ個別に取得。50コメントあるPRなら50回のAPIコール（concurrency=5で直列10バッチ分）。

> **改修影響度: 🟡 中** — CodeCommit API にバッチ取得がないためAPIレベルでの改善は不可。concurrency を上げるか、reaction 取得を遅延（表示時に lazy load）する方法がある。後者の場合、`app.test.tsx` の `reloadReactions` に関するテスト群と `PullRequestDetail.test.tsx` の reaction 表示テストの書き換えが必要。reaction は表示のみに使われるため、表示が一瞬遅れても操作に影響しない点は有利。

### 4. `reloadReactions` による全件再取得

**場所**: `src/app.tsx:133-143`

リアクション1件追加するだけで、全コメントの reaction を再取得する。差分更新（変更した commentId のみ再取得して Map をマージ）に変えれば、APIコールを 1 回に削減できる。

> **改修影響度: 🟠 高** — `handleReact` → `reloadReactions` のフローは `app.test.tsx` の reaction テストでモック検証されている。差分更新に変えると、`getReactionsForComments` の呼び出しが `getReactionsForComment`（単数）に変わるため、モックの差し替えと検証ロジックの書き換えが必要。さらに差分マージで Map の整合性を保つロジック自体にバグが入るリスクがある（既存 reaction の削除反映漏れ等）。**サーバー側で reaction が削除された場合の状態不整合**が起きうる。

### 5. `reloadComments` による全件再取得

**場所**: `src/app.tsx:415-429`

コメント投稿・返信・編集・削除のいずれの操作でも、全コメント + 全リアクションを再取得する。API レスポンスには新規コメントが含まれるため、楽観的更新でローカル state に追加すれば再取得を省略できる。

> **改修影響度: 🔴 非常に高** — これは最も壊れやすい改修。楽観的更新を入れるには以下すべてを正しく扱う必要がある:
> - `CommentThread` の構造（`location` の有無で inline / general を分離）
> - `sortCommentsRootFirst` の並び順再現
> - 返信の `inReplyTo` チェーンの正しい配置
> - 投稿失敗時のロールバック
> - 編集・削除時のローカル state 反映
>
> `app.test.tsx` では `handlePostComment` / `handlePostReply` / `handleUpdateComment` / `handleDeleteComment` のすべてが `reloadComments` → `getComments` モックの呼び出しを検証している。楽観的更新に変えると、これらのテストの大半を書き直すことになる。**投稿後にサーバー側で順序やスレッド構造が異なる場合、UIに不整合が出る**リスクもある。

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

> **改修影響度: 🟠 高** — `computeSimpleDiff` は diff 表示の根幹。アルゴリズムを変えると出力される行の順序やタイプ（add/delete/context）が変わりうる。`PullRequestDetail.test.tsx` には diff の表示内容を `lastFrame()` で検証するテストが多数あり、diff 出力が1行でも変わると大量のテストが壊れる。**さらに、inline comment の位置が `beforeLineNumber` / `afterLineNumber` に依存している**ため、行番号の割り当てが変わると inline comment が誤った位置に表示される深刻なバグにつながる。改修時はスナップショットテストの追加を強く推奨する。

### 7. `findNextHeaderIndex` / `findPrevHeaderIndex` でヘッダー位置を毎回再計算

**場所**: `src/components/PullRequestDetail.tsx:1567-1585`

`n` / `N` キーを押すたびに `lines` 全件を走査して `headerIndices` を再構築する。`useMemo` で既に計算済みの `headerIndices`（417行目）が存在するのに使っていない。

> **改修影響度: 🟢 低** — コンポーネント内の `useMemo` 済み `headerIndices` を `useInput` ハンドラ内で直接参照するようにし、`findNextHeaderIndex` / `findPrevHeaderIndex` を削除するだけ。ただしこれらの関数はコンポーネント外に定義されているため、引数に `headerIndices` を渡す形にするか、クロージャに変える必要がある。テストへの影響は `n`/`N` キーのナビゲーションテストのみで、出力結果は同一なので壊れない。

### 8. `buildDisplayLines` 内でキャッシュされた diff 行を変異（mutation）

**場所**: `src/components/PullRequestDetail.tsx:1220-1222`

```typescript
for (const dl of diffLines) {
  dl.filePath = filePath;   // ← キャッシュ済みオブジェクトを直接変更
  dl.diffKey = blobKey;     // ← 同上
  lines.push(dl);
```

`diffCacheRef` に保存されたオブジェクトを直接変更しているため、キャッシュが汚染される。

> **改修影響度: 🟢 低** — `{ ...dl, filePath, diffKey }` でスプレッドコピーするだけ。テストは DisplayLine の内容（`text`, `type`）を検証するため、`filePath`/`diffKey` の付与方法が変わっても壊れない。ただし、コピーのオーバーヘッドが微増する（大量行の場合）。現状の mutation が即座にバグを生んでいない理由は、キャッシュキーに `displayLimit` が含まれており、同一キーでは同じ `filePath`/`diffKey` が設定されるため。

---

## C. React/状態管理のボトルネック (レンダリング回数 — UI ジャンク)

### 9. `new Map(prev)` による高頻度コピー

**場所**: `src/app.tsx:282-315`

blob が1件ロードされるたびに `setDiffTexts` と `setDiffTextStatus` の両方で `new Map(prev)` を実行する。50ファイルのPRなら100回の Map コピー（各コピーが O(n)）。バッチ化するか `useRef` + 単一 `setState` で更新回数を減らすことで改善可能。

> **改修影響度: 🟠 高** — `diffTexts` と `diffTextStatus` は `App` コンポーネントの state として管理され、`PullRequestDetail` に props として渡されている。`useRef` ベースに変えると、**React のリレンダリングが自動でトリガーされなくなる**ため、別途 `forceUpdate` 相当の仕組みが必要。`app.test.tsx` は `vi.waitFor(() => expect(lastFrame()).toContain(...))` で diff テキストの描画完了を検証しており、更新タイミングが変わるとテストのタイミング前提が壊れる。バッチ化（例：5件ごとにまとめて state 更新）の方が安全だが、プログレッシブローディングの UX が変わる。

### 10. `diffTextStatus` のデフォルト値が毎レンダー新オブジェクト

**場所**: `src/components/PullRequestDetail.tsx:129`

```typescript
diffTextStatus = new Map(),  // レンダーごとに新 Map 生成
```

prop が渡されない場合、毎レンダーで新しい `Map` が生成され、`useMemo` の依存配列で常に変更扱いになる。モジュールレベルの定数を使うべき。

> **改修影響度: 🟢 非常に低** — `const EMPTY_STATUS_MAP = new Map()` をモジュールレベルで定義し、デフォルト値を差し替えるだけ。テストへの影響なし。**最も安全に改善できる項目。**

### 11. `buildDisplayLines` の依存配列が広すぎる

**場所**: `src/components/PullRequestDetail.tsx:402-413`

`diffTexts` が更新されるたびに（blob 1件ロードごと）全ファイル分の display lines を再構築する。`diffCacheRef` で個別ファイルの diff はキャッシュしているが、まとめる処理自体のコストが残る。

> **改修影響度: 🟡 中** — 依存配列を減らすには `diffTexts` を `useRef` にする等の構造変更が必要で、#9 と連動する。`useMemo` 内のロジック自体は `diffCacheRef` でキャッシュ済みの diff 行を再利用するため、再構築コストは主にループとpush操作。差分描画のファイル単位分割（各ファイルを独立コンポーネントにする）で根本解決できるが、`PullRequestDetail` の大規模リファクタリングになる。

### 12. `visibleLines` の key に配列インデックス使用 ⚠️ 描画バグ確認済み

**場所**: `src/components/PullRequestDetail.tsx:714`（行番号は実装変更で移動している場合あり）

スクロールにより `globalIndex` がずれると、React は全 `visibleLines` を再マウントする。行のコンテンツをベースにした安定 key を使えば再マウントを抑制できる。

> **改修影響度: 🔴 高（描画バグ）** — 「要プロファイリング」から格上げ。`audit-complexity-rendering.md`（S-2）で確認：j/k を1回押すたびに表示中全30行の `Box` コンポーネントが破棄・再生成される。Ink はターミナルへの直接書き込みを行うため、DOM React より再マウントのコストが高く、フリッカー・描画乱れの直接原因になっている可能性が高い。
>
> **修正方針**: `line.type + (line.diffKey ?? "") + String(line.beforeLineNumber ?? line.afterLineNumber ?? "") + String(line.threadIndex ?? "") + String(index)` で安定 key を生成する。`index` は重複を防ぐ最終フォールバック。

---

## D. 細かいが累積する非効率

### 13. `TextDecoder` を毎回生成

**場所**: `src/services/codecommit.ts:347`

`TextDecoder` インスタンスは使い回し可能。50ファイルのPRで100回生成される。

> **改修影響度: 🟢 非常に低** — モジュールレベルで `const decoder = new TextDecoder()` を定義するだけ。テスト影響なし。

### 14. blob コンテンツのキャッシュなし

**場所**: `src/services/codecommit.ts:336-350`

同じ `blobId` が複数の diff に現れうるが、キャッシュがないため同一 blob を複数回取得する可能性がある。

> **改修影響度: 🟡 中** — `Map<string, string>` のキャッシュ導入自体は簡単だが、キャッシュの寿命管理が必要。PR を切り替えた際にキャッシュをクリアしないとメモリリークする。また `codecommit.test.ts` で `getBlobContent` のモック呼び出し回数を検証しているテストがある場合（キャッシュヒットで呼ばれなくなる）壊れる。キャッシュを service 層に入れるか app 層に入れるかで設計判断が分かれる。

### 15. `loadDiffTextsInBackground` が `mapWithLimit` を再実装

**場所**: `src/app.tsx:261-335`

`mapWithLimit` ユーティリティが存在するのに独自ワーカープールを実装（concurrency 6 vs 他は 5）。

> **改修影響度: 🟠 高** — 現在の手動実装には `mapWithLimit` にない重要な機能がある: **`diffLoadRef.current === loadId` によるステイルロードガード**。PR を素早く切り替えた場合、前の PR のバックグラウンドロードが新しい PR の state を汚染しないようにしている。`mapWithLimit` に書き換える場合、このガードを維持する仕組みが必要（例: AbortController / キャンセルトークン）。見た目の簡素化とは裏腹に、**ステイルガードの喪失によるレースコンディション**のリスクがある。

### 16. `extractAuthorName` の繰り返し呼び出し

ARN 文字列の `split("/")` が毎レンダーで複数箇所から呼ばれる。軽い処理だがコメントが多い画面では累積する。

> **改修影響度: 🟢 非常に低** — 関数内に `Map<string, string>` キャッシュを追加するだけ。テスト影響なし。メモリ懸念も ARN 文字列はせいぜい数十件なので無視できる。

---

## 改修優先度マトリクス

| 優先度 | # | 項目 | 性能改善 | 改修影響度 | 推奨アクション |
|--------|---|------|----------|------------|----------------|
| ✅ 完了 | 10 | diffTextStatus デフォルト値 | 小 | 🟢 非常に低 | 対応済み（v0.1.1） |
| ✅ 完了 | 13 | TextDecoder 毎回生成 | 小 | 🟢 非常に低 | 対応済み（v0.1.1） |
| ✅ 完了 | 16 | extractAuthorName 繰返し | 小 | 🟢 非常に低 | 対応済み（v0.1.1） |
| ✅ 完了 | 7 | header index 再計算 | 小 | 🟢 低 | 対応済み（v0.1.1） |
| ✅ 完了 | 8 | キャッシュ mutation | — | 🟢 低 | 対応済み（v0.1.1） |
| ⛔ 即対応 | 12 | visibleLines key（**描画バグ確認**） | — | 🔴 高 | 安定 key 生成に変更。`audit-complexity-rendering.md` S-2 参照 |
| ⛔ 即対応 | — | blob load 時カーソル飛び（**描画バグ確認**） | — | 🔴 高 | cursorIndex の補正。`audit-complexity-rendering.md` S-1 参照 |
| ★★☆ | 1 | listPullRequests N+1 | 大 | 🟢 低 | concurrency 増加のみ。スロットリング監視を追加 |
| ★★☆ | 3 | reaction 全件取得 | 中 | 🟡 中 | 遅延ロード化。テスト書き換え中程度 |
| ★★☆ | 14 | blob キャッシュなし | 中 | 🟡 中 | app 層でキャッシュ。寿命管理に注意 |
| ★☆☆ | 6 | computeSimpleDiff O(n×m) | 中 | 🟠 高 | diff 出力が変わりうるため要スナップショットテスト |
| ★☆☆ | 9 | Map 高頻度コピー | 中 | 🟠 高 | バッチ化推奨。UX 変化に注意 |
| ★☆☆ | 2 | getCommitsForPR 直列 | 大 | 🟡 中 | 遅延ロードUI。テスト書き換え必要 |
| ★☆☆ | 15 | loadDiffTexts 再実装 | — | 🟠 高 | ステイルガード喪失リスク。現状維持推奨 |
| ☆☆☆ | 4 | reloadReactions 全件 | 中 | 🟠 高 | 差分マージの整合性リスク |
| ☆☆☆ | 5 | reloadComments 全件 | 中 | 🔴 非常に高 | 楽観的更新は複雑。現状維持推奨 |
| ☆☆☆ | 11 | buildDisplayLines 依存 | 中 | 🟡 中 | #9 と連動。単独改修は非推奨 |

### 推奨アプローチ

0. **⛔ 即対応: 描画バグ2件**（`audit-complexity-rendering.md` S-1, S-2）— blob load 時カーソル飛び、key フリッカー
1. ~~**#10, #13, #16, #7, #8 を対応**（リスクなし、即効性あり）~~ → v0.1.1 で対応済み
2. **次に #1 の concurrency 増加**（低リスクで最大の体感改善）
3. **#6, #9 は十分なテスト追加後に着手**（スナップショットテスト必須）
4. **#5, #15 は現状維持**（壊れるリスクが改善幅に見合わない）
