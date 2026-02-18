# コード複雑度・描画バグ監査レポート

## 前提条件・調査範囲

| 項目 | 内容 |
|------|------|
| **調査日** | 2026-02-18 |
| **対象コミット** | `d7abee0`（main 最新） |
| **調査対象** | `src/` 配下の全 `.ts` / `.tsx` ファイル（40ファイル以上） |
| **調査方法** | 全ファイル通読 + レンダリングパス（`buildDisplayLines` → `PullRequestDetail` 描画ループ）の特別重点調査 |
| **本書の位置づけ** | `performance-analysis.md`（性能ボトルネック視点）を**補完**する。本書は**コードの壊れやすさと描画バグリスク**に焦点を当てる |
| **除外した観点** | ネットワーク遅延・AWS APIスロットリング（`performance-analysis.md` 参照）、テストコードの品質 |

## 評価軸とランク基準

### 評価軸

| 軸 | 説明 |
|----|------|
| **深刻度** | コード品質・保守性への影響 |
| **描画バグリスク** | 画面崩れ・カーソル飛び・フリッカーを引き起こす可能性 |
| **壊れやすさ** | 将来の変更時に誤って壊してしまうリスク |

### ランク基準

| ランク | 定義 |
|--------|------|
| **S** | 描画バグリスクが 🔴 高 かつ 現バージョンで常態的に発生している可能性がある |
| **A** | 描画バグリスクが 🟠 中 以上 かつ 壊れやすさが 🔴 高（将来の変更で確実にバグを引き起こす）|
| **B** | 描画バグリスクが 🟡 中 かつ 保守性の問題（即時バグではないが放置すると危険） |
| **C** | デッドコード・スタイル問題（描画・動作への影響なし） |

---

## S ランク — 今まさに描画バグの原因になっている可能性

### S-1. background blob load によるカーソル位置ズレ

**場所**: `src/app.tsx:352-426`（`loadDiffTextsInBackground`）、`src/components/PullRequestDetail.tsx:623`

**問題**:
`loadDiffTextsInBackground` が blob を1件ずつ読み込むたびに `setDiffTexts` を呼び、`lines` useMemo が再計算される。ファイル A の blob がロードされると "(Loading...)" の1行が N 行の diff に置き換わり、**ファイル A より下にあるカーソルが N-1 行ずれる**。

```typescript
// PullRequestDetail.tsx:710-714
{visibleLines.map((line, index) => {
  const globalIndex = scrollOffset + index;
  const isCursor = globalIndex === cursorIndex; // ← cursorIndex は blob ロード前の古い値
  return <Box key={globalIndex}>...
```

blob ロード完了のたびに `cursorIndex` が補正されないため、ユーザーが操作していないにもかかわらずカーソルが別の行を指す。

- **描画バグリスク**: 🔴 高（PR を開いた直後の常態的な blob 読み込み中に発生）
- **壊れやすさ**: 🔴 高（並列読み込みの完了順序が非決定的なため症状が変化）
- **修正方針**: blob ロード完了時に、変化した行数を `setCursorIndex((prev) => prev + delta)` で補正する。または blob のロード単位を1件ずつでなく全完了後にまとめて state 更新する（UX トレードオフあり）。
- **テスト影響**: `app.test.tsx` の diff 表示テストは `vi.waitFor` で最終状態のみ検証しているため、補正ロジック追加で既存テストは壊れない。新規テストケース：「複数 blob がロードされる間にカーソルを移動せず、全ロード完了後もカーソルが初期位置（0）にある」。
- **副作用**: `cursorIndex` を補正するには「どのファイルの blob がロードされたか」と「そのファイルが現カーソル位置より前か後か」を `loadDiffTextsInBackground` が把握する必要がある。`lines` 配列の生成は `PullRequestDetail` 側（`useMemo`）に閉じているため、`app.tsx` から直接行数を取得できない点が実装上の課題。

### S-2. `visibleLines` の React key が位置ベース

**場所**: `src/components/PullRequestDetail.tsx:714`（既存 `performance-analysis.md` #12 と重複）

**問題**:
```typescript
<Box key={globalIndex}>  {/* scrollOffset + index = スクロールのたびに全 key が変化 */}
```
j/k を1回押すと `scrollOffset` が変化し、表示中の全30行の key が総入れ替えになる。React はすべての `Box` を破棄・再生成する。Ink はターミナル出力を直接書き換えるため、DOM React より再描画コストが高く、これがフリッカーや描画乱れの直接原因になりうる。

- **描画バグリスク**: 🔴 高（スクロールのたびに発生、Ink 特有の問題）
- **壊れやすさ**: 🟡 中（意図的に見えるが誤り）
- **修正方針**: `line.type + (line.diffKey ?? "") + (line.beforeLineNumber ?? line.afterLineNumber ?? "") + (line.threadIndex ?? "")` を組み合わせた安定 key を生成する。完全に一意にならない場合は末尾に `index` を付加してフォールバック。
- **テスト影響**: `PullRequestDetail.test.tsx` の `lastFrame()` 検証は key に依存しないため、既存テストは壊れない。Ink のレンダリング挙動の変化はスナップショットテストで検出可能。
- **副作用**: key が安定すると React がコンポーネントを再利用するため、行の状態（存在する場合）が想定外に保持されるリスクがある。`DiffLine` コンポーネントに内部 state はないため問題ない。

---

## A ランク — 描画バグを誘発しやすい構造的問題

### A-1. `collapsedThreads` がコメントリロード後に古いインデックスを参照

**場所**: `src/components/PullRequestDetail.tsx:232-240`

**問題**:
```typescript
const [collapsedThreads, setCollapsedThreads] = useState<Set<number>>(() => {
  // マウント時1回だけ初期化。commentThreads prop が変わっても更新されない
  for (let i = 0; i < commentThreads.length; i++) {
    if ((commentThreads[i]?.comments.length ?? 0) >= FOLD_THRESHOLD) {
      collapsed.add(i);
    }
  }
  return collapsed;
});
```
コメント投稿・削除後に `reloadComments` → `commentThreads` prop が更新されても `collapsedThreads` は古いインデックスのまま。新スレッドが追加されても自動折りたたみされない。将来スレッド順序がサーバー側で変わると、別スレッドを折りたたんでしまう誤動作が起きる。

- **描画バグリスク**: 🟠 中（コメント投稿後にスレッド折りたたみ状態がずれる）
- **壊れやすさ**: 🔴 高（`commentThreads` の更新頻度が上がるほどズレが拡大）
- **修正方針**: `useEffect(() => { /* 新スレッドだけ自動折りたたみ */ }, [commentThreads])` で差分更新する。インデックスではなく commentId をキーにするのが根本的解決（`DisplayLine.threadIndex` の設計変更が必要）。
- **テスト影響**: `PullRequestDetail.test.tsx` の折りたたみ関連テスト（`o` キー）は既存動作の変更なしなら壊れない。新規テストケース：「コメント投稿後の commentThreads 更新で新スレッドが FOLD_THRESHOLD 以上のコメントを持つ場合、自動折りたたみされること」。
- **副作用**: `useEffect` で `commentThreads` を監視すると、コメントリロードのたびに `collapsedThreads` が再評価される。ユーザーが手動で展開したスレッドが、再リロード後に折りたたまれ直すリスクがある。「手動展開したスレッドは維持する」ロジックが追加で必要。

### A-2. `getReplyTargetFromLine` のテキスト逆パース＋ `u` フラグなし正規表現

**場所**: `src/components/PullRequestDetail.tsx:956-977`

**問題（2点）**:

① **データの往復（設計的問題）**: データ → レンダリングテキスト → 逆パース という経路でリプライ対象の author/content を取得している。
```typescript
// appendThreadLines でテキスト生成
text: `💬 ${rootAuthor}: ${rootContent}`
// ↓ 後で逆パース
const colonIdx = text.indexOf(": ");
author = prefix.replace(/^[💬└\s]+/, "").trim();
```
コンテンツに `": "` が含まれると `colonIdx` が誤った位置を返す。

② **`u` フラグなし文字クラスでの絵文字処理**:
`💬` (U+1F4AC) は UTF-16 サロゲートペア (0xD83D + 0xDCAC)。`/^[💬└\s]+/` は `u` フラグなしでは2つの独立コードユニットとして扱う。現在は偶然動作しているが、実装依存の振る舞い。

- **描画バグリスク**: 🟠 中（R キーでリプライを開く際に著者名・内容が化ける）
- **壊れやすさ**: 🔴 高（文字クラスの誤りが隠れており、将来変更時に踏む）
- **セキュリティ**: `/^[💬└\s]+/` の `\s` 部分は ReDoS（正規表現 DoS）の直接リスクはない（量指定子の入れ子がないため）。ただし `u` フラグなしの絵文字処理はサロゲートペアの誤解釈を生む（詳細は問題①②）。
- **修正方針（段階）**:
  - **即時（1行変更）**: `/^[💬└\s]+/` → `/^[💬└\s]+/u`
  - **根本解決**: `DisplayLine` に `authorArn?: string` と `rawContent?: string` フィールドを追加し、`appendThreadLines` で設定。`getReplyTargetFromLine` で逆パースを廃止。
- **テスト影響**: `u` フラグ修正は既存テストで検出されないため（モックデータに絵文字が含まれていない場合）、絵文字を含むコンテンツのユニットテストを新規追加する。根本解決では `DisplayLine` 型変更で `displayLines.test.ts` のスナップショットが更新される。
- **副作用**: `DisplayLine` にフィールドを追加すると `buildDisplayLines` の返り値サイズが増加するが、文字列フィールドの追加であり体感できる影響なし。

### A-3. `handleApprovalAction` が `useAsyncAction` パターンを手動再実装

**場所**: `src/app.tsx:498-517`

**問題**:
他の全アクション（`postCommentAction`, `mergeAction`, `closePRAction` 等）は `useAsyncAction` を使うのに、承認だけ手動の try-catch-finally。

```typescript
// 他のアクション
const mergeAction = useAsyncAction(async (strategy) => { ... }, (err) => formatErrorMessage(err, "merge"));

// 承認だけ手動実装
setIsApproving(true);
setApprovalError(null);
try { ... } catch (err) { setApprovalError(...); } finally { setIsApproving(false); }
```

`useAsyncDismiss` が `isApproving` の変化を監視して承認ダイアログを閉じるタイミングは、`useAsyncAction` の `execute()` が返す void タイミングとわずかに異なる可能性がある。

- **描画バグリスク**: 🟡 中（承認 UI のクローズタイミングが他モーダルとずれる可能性）
- **壊れやすさ**: 🔴 高（パターン不統一で `useAsyncAction` の仕様変更時に承認だけ追従漏れが起きる）
- **修正方針**: `handleApprovalAction` を `useAsyncAction` に移行する（`reloadApprovals` の呼び出しを action 内に含める）。
- **テスト影響**: `app.test.tsx` の承認テストは `mockSend` の呼び出し順序で検証しているため、`useAsyncAction` 移行後も `updateApprovalState` → `getApprovalStates` → `evaluateApprovalRules` の順が維持されれば壊れない。`isApproving` state が `useAsyncAction` の `isProcessing` に置き換わるため、`expect(lastFrame()).toContain("Approving...")` 等の状態表示テストは維持される。
- **副作用**: `handleApprovalAction` で第2引数に渡す承認アクション種別（"approve" / "revoke"）を `formatErrorMessage` に渡すロジックが、`useAsyncAction` の `formatError` 関数に移る。クロージャで `approvalState` を参照する設計が必要。

### A-4. `appendThreadLines` の `.find()` が `sortCommentsRootFirst` の保証を無視

**場所**: `src/utils/displayLines.ts:39-40`

**問題**:
```typescript
const rootComment = comments.find((c) => !c.inReplyTo) ?? comments[0]!;
const replies = comments.filter((c) => c !== rootComment);
```
`sortCommentsRootFirst`（`codecommit.ts:186`）が既に「root を先頭、返信を昇順」で並び替えているため `comments[0]` が root であることは保証済み。にもかかわらず `.find()` で再探索している。

さらに、複数 root コメントが存在する場合（API が異常データを返した場合）、`replies = comments.filter(c => c !== rootComment)` が2番目以降の root コメントを返信として誤分類し、**コメントの描画順が崩れる**。

- **描画バグリスク**: 🟡 中（複数 root のスレッドで描画順が崩れる）
- **壊れやすさ**: 🟡 中（`sortCommentsRootFirst` の仕様変更時に整合が取れなくなる）
- **修正方針**: `const [rootComment, ...replies] = comments;` に置き換える。
- **テスト影響**: `displayLines.test.ts` に「root コメントが正しく1番目に表示されること」のテストが既にある場合は変更不要。1行変更で論理は同一のため既存テストは壊れない。
- **副作用**: `comments` が空の場合、`rootComment` が `undefined` になる。ただし直前に `if (comments.length === 0) return;` があるため安全。

---

## B ランク — 保守性の問題（即時描画バグは低リスク）

### B-1. `indexOf` 全スキャンで5行先だけを判定（`performance-analysis.md` #6 と重複）

**場所**: `src/utils/formatDiff.ts:72-73,89-90`

```typescript
const nextMatch = afterLines.indexOf(bl, ai); // O(n) 全スキャン
if (nextMatch !== -1 && nextMatch - ai < 5) break; // でも5行以内だけを使う
```
`afterLines.slice(ai, ai + 5).includes(bl)` で O(5) に改善可能。

- **描画バグリスク**: 🟡 中（大ファイル操作中の応答遅延による UI 固まり）
- **壊れやすさ**: 🟡 中（diff 出力が変わると inline comment の行番号もずれる）
- **テスト影響**: `afterLines.indexOf` を `afterLines.slice(ai, ai + 5).includes(bl)` に変えるだけなら diff 出力は変わらないため既存テストは壊れない（`indexOf` は全スキャンだが、5行以内の一致を探す結果は同じ）。
- **副作用**: なし。ロジック上の等価変換。

### B-2. `loadActivity` の silent retry が `loadPullRequests` と非対称

**場所**: `src/app.tsx:585-589`

```typescript
// loadPullRequests: エラー表示してリセット
setError("Page token expired. Returning to first page.");

// loadActivity: サイレントに最初から再実行（ユーザーに通知なし）
setActivityEvents([]);
void loadActivity(pullRequestId); // ← 無限ループの可能性
```
- **描画バグリスク**: 🟡 中（アクティビティ画面が無限ロード状態になりうる）
- **壊れやすさ**: 🟡 中
- **テスト影響**: `app.test.tsx` の `loadActivity` テストに「`InvalidContinuationTokenException` 発生時に silent retry されること」のテストを追加する。修正方針（`setActivityError` でエラー表示）に変えると、このテストが壊れる。
- **副作用**: silent retry を廃止してエラー表示に変えると、ページングの途中でトークンが失効した場合に「最初からやり直す」UX が明示的になる。これは `loadPullRequests` との挙動統一として望ましい。

### B-3. `loadDiffTextsInBackground` が `mapWithLimit` を手動再実装（`performance-analysis.md` #15 と重複）

**場所**: `src/app.tsx:360-421`

ステイルロードガード（`diffLoadRef`）が必要なため単純置き換え不可。ただし、内部の worker 実装が `mapWithLimit` と2重管理になっており、バグ修正時に片方だけ直すリスクがある。

- **描画バグリスク**: 🟡 中（ステイルガードを誤って削除するとレースコンディション）
- **壊れやすさ**: 🔴 高
- **テスト影響**: `app.test.tsx` は `loadDiffTextsInBackground` の内部ロジックを直接テストしていない（`vi.waitFor` で diff 表示の最終状態を検証）。ステイルガードのテストは `diffLoadRef` をモックなしに検証できないため未テストのまま（`/* v8 ignore */` で除外済み）。現状維持の場合は変更不要。
- **副作用**: `mapWithLimit` の concurrency 設定と `loadDiffTextsInBackground` の concurrency 設定（6）が乖離している（他は 5）。コードを読む際に混乱の原因となる。

---

## C ランク — デッドコード・軽微な非効率

| # | 問題 | 場所 | 描画バグリスク | 壊れやすさ |
|---|------|------|--------------|-----------|
| C-1 | `handleBack` の dead `else` ブランチ | `app.tsx:624` | 🟢 低 | 🟢 低 |
| C-2 | `getSliceLimits` の到達不能防御ガード3か所 | `displayLines.ts:101-117` | 🟢 低 | 🟡 中（読みにくさによる修正ミス誘発） |
| C-3 | `getCommitDifferences` の無意味なラッパー関数 | `codecommit.ts:505-512` | 🟢 低 | 🟢 低 |
| C-4 | `getCommentIdFromLine` の無意味な object ラッピング | `PullRequestDetail.tsx:937-941` | 🟢 低 | 🟡 中 |
| C-5 | `formatStrategyName` の冗長 switch（2ケースは入力をそのまま返す） | `PullRequestDetail.tsx:1018-1027` | 🟢 低 | 🟢 低 |
| C-6 | `split()` 後の `?? fallback`（JavaScript 保証により到達不能） | `formatDate.ts:31`, `codecommit.ts:477` | 🟢 低 | 🟢 低 |
| C-7 | `...(cond ? {k:v} : {})` スプレッドの多用 | `app.tsx`, `codecommit.ts`, `cli.tsx` | 🟢 低 | 🟢 低 |

---

## 優先度サマリー

| ランク | 問題 | 推奨優先度 | 備考 |
|--------|------|-----------|------|
| **S-1** | background blob load でカーソルが飛ぶ | ⛔ 即対応 | 描画バグの主因候補 |
| **S-2** | `visibleLines` の key が位置ベース | ⛔ 即対応 | フリッカーの主因候補。`performance-analysis.md` #12 参照 |
| **A-1** | `collapsedThreads` がコメントリロード後に古い | 🔴 高 | |
| **A-2** | `getReplyTargetFromLine` 逆パース＋ `u` フラグなし正規表現 | 🔴 高（`u` フラグ修正は即時可） | |
| **A-3** | `handleApprovalAction` の手動 try-catch | 🟠 中 | |
| **A-4** | `appendThreadLines` の `.find()` で root 再探索 | 🟠 中 | |
| **B-1** | `indexOf` 全スキャン O(n²) | 🟡 低-中 | `performance-analysis.md` #6 参照 |
| **B-2** | `loadActivity` の silent retry | 🟡 低-中 | |
| **B-3** | `loadDiffTextsInBackground` の手動 worker pool | 🟡 低-中 | `performance-analysis.md` #15 参照 |
| **C-1〜7** | デッドコード各種 | 🟢 低 | |

## 修正間の依存関係と推奨実装順序

### 依存関係マップ

```
A-4（appendThreadLines の .find() 除去）
  └─ 独立。他の修正に依存しない。1行変更。

B-1（indexOf → slice.includes）
  └─ 独立。他の修正に依存しない。2行変更。

A-2-即時（正規表現に u フラグ追加）
  └─ 独立。他の修正に依存しない。1行変更。

A-3（handleApprovalAction → useAsyncAction 移行）
  └─ 独立。ただし app.tsx の承認 state（isApproving, approvalError）が
     useAsyncAction の isProcessing/error に置き換わるため
     PullRequestDetail.tsx の approval prop 型も更新が必要。

S-2（visibleLines の key 安定化）
  └─ S-1 より先に対応推奨。S-1 の修正（cursorIndex 補正）が入ると
     key 変更との組み合わせで挙動確認が複雑になるため。

A-1（collapsedThreads の useEffect 追加）
  └─ A-2-根本解決（DisplayLine にフィールド追加）の前後どちらでも可。
     ただし threadIndex → commentId への設計変更は A-2-根本解決後に行う。

A-2-根本解決（DisplayLine にフィールド追加）
  └─ 他の修正が完了してから行う。型変更の影響範囲が広い
     （formatDiff.ts、displayLines.ts、PullRequestDetail.tsx）。

S-1（cursorIndex 補正）
  └─ S-2 完了後に対応推奨。最も実装難易度が高い（app.tsx と
     PullRequestDetail.tsx をまたぐ設計変更が必要）。
```

### 推奨実装順序

| ステップ | 修正 | 変更ファイル | 工数目安 |
|---------|------|-------------|---------|
| 1 | **A-4** `appendThreadLines` の `.find()` 除去 | `src/utils/displayLines.ts` | 5分 |
| 2 | **B-1** `indexOf` → `slice.includes` | `src/utils/formatDiff.ts` | 10分 |
| 3 | **A-2-即時** 正規表現に `u` フラグ追加 | `src/components/PullRequestDetail.tsx` | 5分 |
| 4 | **B-2** `loadActivity` silent retry を明示エラーに変更 | `src/app.tsx` | 15分 |
| 5 | **S-2** `visibleLines` の key 安定化 | `src/components/PullRequestDetail.tsx` | 30分 |
| 6 | **A-3** `handleApprovalAction` → `useAsyncAction` 移行 | `src/app.tsx`, `src/components/PullRequestDetail.tsx` | 1時間 |
| 7 | **A-1** `collapsedThreads` の `useEffect` 差分更新 | `src/components/PullRequestDetail.tsx` | 1時間 |
| 8 | **S-1** `cursorIndex` の補正ロジック追加 | `src/app.tsx`, `src/components/PullRequestDetail.tsx` | 2〜4時間 |
| 9 | **A-2-根本解決** `DisplayLine` にフィールド追加 | `src/utils/formatDiff.ts`, `src/utils/displayLines.ts`, `src/components/PullRequestDetail.tsx` | 2時間 |

ステップ 1〜4 はリスクが低く（既存テスト無破壊・1〜2ファイル変更）、`bun run ci` をパスしやすい。
ステップ 5〜9 は変更ファイルが多いため、各ステップで独立した PR を切ることを推奨する。

## `performance-analysis.md` との関係

本書は `performance-analysis.md` を**補完**する位置づけ。重複する項目は以下の通り。

| 本書 | `performance-analysis.md` |
|------|--------------------------|
| S-2（key フリッカー） | #12（visibleLines key） |
| B-1（indexOf O(n²)） | #6（computeSimpleDiff O(n×m)） |
| B-3（worker pool 再実装） | #15（loadDiffTexts 再実装） |

`performance-analysis.md` に記載のない**新規知見**は S-1、A-1、A-2、A-3、A-4、B-2 の6件。
