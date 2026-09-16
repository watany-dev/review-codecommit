# ボトルネック解消（#102–#105）設計書

**バージョン**: 未リリース（現行 0.1.3 上）
**ステータス**: 実装完了 ✅
**最終更新**: 2026-09-16

---

## 実装ステータス

> **✅ 実装完了 — 2026-09-16**
>
> GitHub issues #102 / #103 / #104 / #105（ベンチマークで検出したレンダリング・I/O ボトルネック）を一括対応。
>
> **実装済みファイル**:
> - `src/services/codecommit.ts` — `listPullRequests` 同時実行 10、`getReactionsForComments` 同時実行 15
> - `src/app.tsx` — blob 到着のバッチ更新、`getCommitsForPR` のバックグラウンド先行取得
> - `src/utils/batchUpdates.ts` — `createBatcher`（時間窓で更新をまとめる）
> - `src/components/ActivityTimeline.tsx` — 可視 30 行へのスライス、`ActivityEventRow` の `memo` 化、安定 key

---

## 概要

`bench/` のボトルネック検出ベンチで定量化された 4 件を、レイテンシ（API ラウンドトリップ）と CPU（再描画）の両面から解消する。いずれも表示内容やキーバインドは変えない。

| Issue | 現象 | 方針 |
|-------|------|------|
| #105 | N+1 ファンアウトが concurrency=5 固定 | 呼び出し箇所ごとに定数化し、10 / 15 に引き上げる |
| #104 | `getCommitsForPR` が最大 100 回直列 | 並列化はできないため、PR 詳細ロード時に先行取得し in-flight Promise を共有する |
| #103 | blob 1 件ごとに全 display line を再構築（O(N²)） | 16ms 窓で setState をバッチ化し、ストリーム完了時に flush する |
| #102 | ActivityTimeline が全件描画（300 件で 91ms/キー） | `PullRequestDetail` と同じカーソル追従ウィンドウ + 行の `memo` |

## スコープ

### 今回やること

- `listPullRequests` / `getReactionsForComments` の同時実行数を定数として切り出し、値を上げる
- PR 詳細表示時にコミット履歴をバックグラウンド取得し、Tab では同じ Promise を待つ
- blob テキストの到着を `createBatcher` でまとめてから `diffTexts` / `diffTextStatus` を更新する
- ActivityTimeline を 30 行ウィンドウで描画し、行コンポーネントを `React.memo` する

### 今回やらないこと

- CodeCommit に存在しないバッチ API の導入
- `getCommitsForPR` の親チェーン走査そのものの並列化（次 ID がレスポンス依存のため不可能）
- 部分コミット列のインクリメンタル `setCommits`（oldest-first の `viewIndex` が途中でずれる）
- リアクションの逐次 UI 反映（concurrency 引き上げだけでラウンドトリップ深度は半分以下になる）
- `PullRequestList` のウィンドウ処理（1 ページ 25 件で実測 7ms、到達可能な問題ではない）
- `computeSimpleDiff` のアルゴリズム変更
- 429 スロットリング時のリトライ（未実装のまま。concurrency 15 は CodeCommit の一般的な読み取り上限に対して保守的）

## 設計

### #105: ファンアウト同時実行数

#### 変更

| 呼び出し | 変更前 | 変更後 | 25件 / 100件でのウェーブ数 |
|---------|--------|--------|---------------------------|
| `listPullRequests`（フォアグラウンド） | 5 | **10** | 25 PR: 5 → **3** |
| `getReactionsForComments`（バックグラウンド） | 5 | **15** | 100 コメント: 20 → **7** |

定数は `src/services/codecommit.ts` のモジュールスコープに置き、エクスポートしない（knip の未使用 export を避ける）。

```typescript
const LIST_PULL_REQUEST_CONCURRENCY = 10;
const REACTION_FETCH_CONCURRENCY = 15;
```

#### 設計判断

| 選択肢 | 評価 |
|--------|------|
| **箇所ごとに異なる定数（採用）** | フォアグラウンドは体感待ち、バックグラウンドは完了遅れ。適切な値が異なる |
| 全体を 15 に統一 | PR 一覧はユーザー操作のたびに走る。上げすぎるとスロットリングリスクが操作に直撃する |
| 逐次 UI 反映（issue の案 3） | `reloadReactions` の Map マージとテスト書き換えが必要。concurrency だけで 100 コメント時の深度は 23→7 |

`fetchBlobTexts` / `streamBlobTexts` の 5〜6 は本 issue の対象外。blob は後段のバッチ化（#103）で吸収する。

---

### #104: コミット履歴の先行取得

親を辿る `GetCommit` は構造上並列化できない。待ち時間を隠す。

```
loadPullRequestDetail
  ├─ getPullRequestDetail（フォアグラウンド、画面遷移をブロック）
  ├─ streamBlobTexts（既存・バックグラウンド）
  ├─ getCommitsForPR  ← 新規: 同じタイミングで開始
  ├─ getApprovalStates / evaluateApprovalRules（既存）
  └─ getReactionsForComments（既存）

Tab → handleLoadCommitDiff
  └─ await commitsPromiseRef.current（解決済みなら即時）
     └─ getCommitDifferences + fetchBlobTexts
```

- `commitsPromiseRef` に in-flight（または解決済み）Promise を保持する
- 詳細ロードのたびに `null` へ戻してから張り直す（PR 切り替えのステイル防止は既存の `detailLoadRef`）
- Tab は **必ずフルの Promise を await** する。部分リストを `setCommits` しない

部分リストを出さない理由: `getCommitsForPR` は newest-first で辿り、最後に `reverse()` して oldest-first にする。10 件ごとの途中結果を reverse すると `viewIndex === 0` の指すコミットが後から変わる。

#### テストへの影響

`app.test.tsx` の「Tab まで `getCommitsForPR` は呼ばれない」前提を、「詳細表示の時点で先行取得され、Tab では再取得しない」に更新。in-flight 中の Tab が同一 Promise を共有することも検証する。

---

### #103: blob 到着のバッチ化

#### 問題

`onLoaded` がファイルごとに `setDiffTexts` / `setDiffTextStatus` を呼び、どちらも `PullRequestDetail` の `lines` useMemo 依存に入っている。N ファイルで N 回の全再構築 = O(N²)。

#### 変更

`createBatcher`（`src/utils/batchUpdates.ts`）:

- 最初の `enqueue` で 16ms タイマーを開始
- 窓の間の到着は同じ配列に積む
- `streamBlobTexts` 完了時に `flush` し、末尾の待ちをなくす
- `apply` 内で `isDetailLoadStale` を見てから 1 回ずつ setState

16ms は concurrency 6 の 1 ウェーブ（同一 RTT で揃う到着）をまとめる長さで、最初のファイル表示をほとんど遅らせない。

#### 設計判断

| 選択肢 | 評価 |
|--------|------|
| **時間窓バッチ（採用）** | app.tsx のみ。`buildDisplayLines` の分割より変更が小さい。ベンチの「一括」列に近づく |
| マイクロタスクのみ | ワーカー完了は別ターンになり、逐次到着をまとめられない |
| ファイル単位セグメント差し替え | `PullRequestDetail` の大規模リファクタ。効果は最大だが今回の範囲外 |
| `diffTextStatus` を `diffTexts` から導出 | 更新回数は半減するが O(N²) の次数は変わらない |

---

### #102: ActivityTimeline のウィンドウ処理

`PullRequestDetail` と同じ計算:

```
halfVisible = floor(30 / 2) = 15
scrollOffset = clamp(cursorIndex - 15, 0, max(0, length - 30))
visible = events.slice(scrollOffset, scrollOffset + 30)
```

加えて:

- `ActivityEventRow` を `memo` — カーソル移動で `isCursor` が変わった 1〜2 行だけ再計算
- `key={globalIndex}` — `eventDate.toISOString()` を毎レンダー呼ばない。イベントは末尾追記のみなのでインデックスは安定
- 空リストで `j` を押しても `cursorIndex` が -1 にならないよう `Math.max(length - 1, 0)` でクランプ

`n` で 50 件ずつ増えても、描画は常に 30 行。キーストロークコストは件数非依存になる。

## データフロー

```
PR 選択
  → loadPullRequestDetail
       → 画面: ヘッダ + loading 行
       → blob ウェーブ ──16ms batch──→ setDiffTexts / setDiffTextStatus → buildDisplayLines 1 回
       → getCommitsForPR（直列）──完了──→ setCommits
Tab
  → await 同じ Promise → コミット diff のみ取得
A（activity）
  → events 全件は state に保持
  → 描画は cursor 周辺 30 行のみ
```

## 影響範囲

| コンポーネント | 表示の変化 | 操作の変化 |
|--------------|-----------|-----------|
| `PullRequestList` | なし（取得が速いだけ） | なし |
| `PullRequestDetail` | blob の初回反映が最大 16ms 遅れる可能性 | Tab 時の "Loading commits..." が短くなる |
| `ActivityTimeline` | 同時に見えるのが 30 行（スクロールで残り） | j/k は従来どおり全件を辿る |

## エッジケース

| ケース | 対処 |
|--------|------|
| PR をすぐ切り替える | `detailLoadRef` でバッチ apply / setCommits を破棄。`commitsPromiseRef` は新しい Promise に張り替え |
| 先行取得中に Tab | 同じ Promise を await。二重の `GetCommit` チェーンは走らない |
| 先行取得が reject | prefetch 側は握りつぶし、Tab 側の await が同じ rejection を見る |
| blob 0 件 | `streamBlobTexts` は即座に resolve、`flush` は空なら no-op |
| イベント 30 件以下 | ウィンドウ = 全件。既存テストの見た目は変わらない |
| イベント 50 件で末尾へ j | scrollOffset が追従し、先頭行は画面外 |

## AWS SDK 連携

新規 API は使わない。既存コマンドの同時実行数と呼び出しタイミングだけを変える。

| コマンド | 変更 |
|---------|------|
| `ListPullRequestsCommand` | なし（1 回のまま） |
| `GetPullRequestCommand` | 同時実行 5 → 10。1 ページ最大 25 ID |
| `GetCommentReactionsCommand` | 同時実行 5 → 15 |
| `GetCommitCommand` | 直列のまま。開始を `loadPullRequestDetail` に前倒し |
| `GetBlobCommand` | `streamBlobTexts` の concurrency 6 は維持。UI への反映だけバッチ |

認証・リージョン・タイムアウト（`createClient` の 10s / 5s）は変更しない。モック方針も既存どおり `client.send` を差し替える。同時実行数のテストは「進行中の `send` 数」を数える。

429（スロットリング）時のリトライは今回も入れない。失敗した 1 件は従来どおりその呼び出しが reject し、PR 一覧は `withLoadingState` がエラー画面にする。リアクションはコメント単位で catch 済みなので、1 件失敗しても他は載る。

## ファイル構成

```
src/
  app.tsx                          # blob バッチ、commitsPromiseRef
  components/ActivityTimeline.tsx  # 30 行ウィンドウ、memo 行
  services/codecommit.ts           # LIST_*=10, REACTION_*=15
  utils/batchUpdates.ts            # createBatcher
  utils/batchUpdates.test.ts
```

コンポーネント階層は変わらない。`ActivityTimeline` の Props 型は従来どおり（`events` 全件を受け取り、スライスは内部）。

## セキュリティ考慮

- API 呼び出しの種類・権限は変わらない。同時実行数が増えるだけ
- バッチとウィンドウはメモリ上の表示最適化であり、認証情報やコメント本文の扱いを変えない
- スロットリングで 429 が出てもリトライはしない（既存どおりエラー表示）。上限 15 は読み取り系としては控えめ
- `createBatcher` はクロージャ内の配列のみを持ち、プロセス終了で破棄される。ディスクへは書かない

## テスト方針

| 対象 | テスト |
|------|--------|
| `createBatcher` | 窓内のまとまり、タイマー後の次窓、`flush` の即時適用とタイマーキャンセル、空 flush |
| `listPullRequests` | 25 ID で最大同時 10 |
| `getReactionsForComments` | 30 ID で最大同時 15 |
| App コミット | 詳細表示で prefetch、Tab で再取得しない、in-flight 中の Tab が同一 Promise |
| ActivityTimeline | 50 件で末尾が初期非表示、j×20 でカーソル行が見え先頭が消える |

既存の blob 表示テストは `waitFor` のため 16ms バッチでも成立する。

## 計測結果（実装後）

同一マシンで `origin/main`（変更前）とこのブランチ（変更後）を `bun run bench` した。mean。service 系は 1 リクエスト 1ms のフェイク RTT。

### #105 ファンアウト

| 呼び出し | 件数 | main | このブランチ | 比 |
|---|---|---|---|---|
| `listPullRequests` | 10 PR | 3.35 ms | 2.34 ms | 1.4x |
| `listPullRequests` | 25 PR | 6.73 ms | 4.53 ms | 1.5x |
| `getReactionsForComments` | 20 | 4.49 ms | 2.28 ms | 2.0x |
| `getReactionsForComments` | 100 | 22.0 ms | 7.96 ms | 2.8x |

25 PR を RTT 100ms に換算すると約 670ms → 約 450ms。ウェーブ数 `ceil(N/limit)+1` と一致する。

### #104 `getCommitsForPR`

| コミット数 | main | このブランチ |
|---|---|---|
| 10 | 11.2 ms | 11.3 ms |
| 50 | 56.3 ms | 55.8 ms |
| 100 | 112 ms | 113 ms |

関数自体は速くなっていない（直列走査のまま）。改善は Tab を押す前に走らせて待ちを隠すこと。

### #103 blob 再構築

60 ファイル × 300 行。progressive = ファイルごと全再構築（変更前）。windowed = 6 件ずつ（concurrency 相当の窓）。

| | mean |
|---|---|
| progressive | 27.7 ms |
| windowed (6) | 7.90 ms |
| batched（下限） | 5.44 ms |

80 ファイル（150 行/ファイル）: progressive 22.6 ms → windowed 6.01 ms。

### #102 ActivityTimeline j/k

| イベント数 | main | このブランチ |
|---|---|---|
| 50 | 6.72 ms | 3.07 ms |
| 150 | 19.4 ms | 2.84 ms |
| 300 | 41.7 ms | 2.91 ms |

件数を増やしてもキーストロークは約 3ms で頭打ち。

---

1. `createBatcher` + テスト
2. concurrency 定数
3. コミット prefetch
4. blob バッチ
5. ActivityTimeline ウィンドウ
6. `bun run ci`
