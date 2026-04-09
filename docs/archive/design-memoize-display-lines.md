# buildDisplayLines の useMemo 化 設計書

## 概要

PR 詳細画面で `j`/`k` キーによるカーソル移動のたびに `buildDisplayLines()` がフルで再計算されている問題を解消する。`useMemo` で計算結果をキャッシュし、依存データが変化したときだけ再実行することで、カーソル操作時の描画を軽量化する。

## 背景

### 現状の問題

`PullRequestDetail` コンポーネントの `buildDisplayLines()` 呼び出し（`src/components/PullRequestDetail.tsx:155`）は、レンダーごとに毎回実行される:

```typescript
const lines = buildDisplayLines(differences, diffTexts, commentThreads, collapsedThreads);
```

`j`/`k` でカーソルを1行動かすと `setCursorIndex` により再レンダーが走り、**カーソル位置とは無関係な** `buildDisplayLines()` が再計算される。

### buildDisplayLines の計算コスト

1. `inlineThreadsByKey` Map の構築: O(commentThreads.length)
2. 各 difference に対する `computeSimpleDiff()` 実行: O(beforeLines × afterLines) × ファイル数
3. 全差分行に対する `findMatchingThreadEntries()` の照合
4. スレッドごとの `appendThreadLines()` 呼び出し

ファイル数やコメント数が多い PR では、1回の `j` キーで数千行分の diff 再計算 + Map 再構築が走る。

### カーソル操作の再レンダー頻度

ユーザーは `j`/`k` を連打してスクロールする。1秒間に 10〜20 回の再レンダーが発生するケースもあり、上記の計算が毎回走ることで操作がもたつく。

## スコープ

### 今回やること

- `buildDisplayLines()` の戻り値を `useMemo` でキャッシュする

### 今回やらないこと

- `computeSimpleDiff` アルゴリズム自体の改善
- `App` 側のコールバック `useCallback` 化
- `React.memo` によるコンポーネントレベルのメモ化
- Blob 取得の重複排除キャッシュ

## 技術選定

### useMemo の採用

| 選択肢 | 評価 |
|--------|------|
| **`useMemo`（採用）** | React 標準の計算キャッシュ API。依存配列による自動的な再計算制御。追加依存パッケージなし。`buildDisplayLines` が純関数であるため、`useMemo` のセマンティクスと完全に合致する |
| コンポーネント分割 + `React.memo` | `buildDisplayLines` の結果を子コンポーネントに渡す設計。Props 分割が必要になりコンポーネント構造が複雑化する。`DisplayLine[]` を生成する計算と、それを消費するレンダリングが同一コンポーネント内で密結合しているため、分割のメリットが少ない |
| `useRef` による手動キャッシュ | 依存値の変更検出を自前で実装する必要がある（`Map` や `Set` の浅い比較を手動で行う）。`useMemo` が提供する機能を再発明することになり、バグのリスクが増える |
| 外部メモ化ライブラリ（reselect 等） | 新規依存の追加が必要。プロジェクトの「最小依存」方針に反する。React 標準の `useMemo` で十分な要件 |

### buildDisplayLines を useMemo で包む前提条件

`useMemo` はファクトリ関数が**純関数**（同じ入力に対して同じ出力を返す）であることを前提とする。`buildDisplayLines` は以下の条件を満たす:

- 引数のみに依存し、外部のミュータブルな状態を参照しない
- 副作用がない（API コール、DOM 操作、ログ出力等をしない）
- 同じ `differences`, `diffTexts`, `commentThreads`, `collapsedThreads` に対して常に同じ `DisplayLine[]` を返す

## 設計

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/components/PullRequestDetail.tsx` | `buildDisplayLines()` の呼び出しを `useMemo` で包む |
| `src/components/PullRequestDetail.test.tsx` | メモ化の動作を検証するテストを追加 |

### 変更内容

#### Before（現状）

```typescript
// src/components/PullRequestDetail.tsx:155
const lines = buildDisplayLines(differences, diffTexts, commentThreads, collapsedThreads);
```

#### After（変更後）

```typescript
const lines = useMemo(
  () => buildDisplayLines(differences, diffTexts, commentThreads, collapsedThreads),
  [differences, diffTexts, commentThreads, collapsedThreads],
);
```

### 依存配列の設計

| 依存値 | 型 | 変更タイミング | 参照安定性 |
|--------|-----|---------------|-----------|
| `differences` | `Difference[]` | PR 詳細ロード時 | App が `setPrDifferences` で新配列をセットするため、ロードごとに新しい参照 |
| `diffTexts` | `Map<string, ...>` | Blob 取得完了時 | App が `setDiffTexts` で新しい Map をセットするため、取得完了ごとに新しい参照 |
| `commentThreads` | `CommentThread[]` | PR 詳細ロード時、コメント投稿後のリロード時 | App が `setCommentThreads` で新配列をセットするため、リロードごとに新しい参照 |
| `collapsedThreads` | `Set<number>` | ユーザーが `o` キーでスレッドを折り畳み/展開したとき | `setCollapsedThreads` 内で `new Set(prev)` を生成するため、操作ごとに新しい参照 |

いずれも React の state または props であり、変更時に新しい参照が生成される。**浅い比較（===）で変更検出が正しく機能する。**

### 再計算が走るケース（正しい動作）

| ユーザー操作 | 依存値の変化 | 再計算 |
|-------------|-------------|--------|
| PR 詳細画面を開く | `differences`, `diffTexts`, `commentThreads` すべて変化 | する |
| コメント投稿後のリロード | `commentThreads` が変化 | する |
| `o` キーでスレッド折り畳み/展開 | `collapsedThreads` が変化 | する |
| Blob 取得完了 | `diffTexts` が変化 | する |

### 再計算がスキップされるケース（最適化効果）

| ユーザー操作 | 依存値の変化 | 再計算 |
|-------------|-------------|--------|
| `j`/`k` カーソル移動 | なし（`cursorIndex` のみ変化） | **しない** |
| `c` コメント入力モード開始/終了 | なし（`isCommenting` のみ変化） | **しない** |
| `C` インラインコメントモード開始/終了 | なし | **しない** |
| `R` 返信モード開始/終了 | なし | **しない** |
| `a`/`r` 承認確認プロンプト開始/終了 | なし | **しない** |

**最も頻繁な操作（カーソル移動）で再計算がスキップされる** ため、体感の改善効果が大きい。

## データフロー

```
App (状態管理)
 │
 ├─ differences ──────────┐
 ├─ diffTexts ────────────┤
 ├─ commentThreads ───────┤
 │                        ▼
 └─→ PullRequestDetail
      │
      ├─ collapsedThreads (ローカル state) ─┐
      │                                      ▼
      │                          useMemo(buildDisplayLines, deps)
      │                                      │
      │                                      ▼
      │                                    lines: DisplayLine[]
      │                                      │
      ├─ cursorIndex (ローカル state) ───────┤ ← lines を変更しない
      │                                      │
      ▼                                      ▼
   scrollOffset = useMemo(...)          visibleLines = lines.slice(...)
                      │                      │
                      ▼                      ▼
                   レンダリング（visibleLines.map）
```

カーソル移動は `cursorIndex` → `scrollOffset` → `visibleLines` のパスのみ通り、`lines` の再計算をバイパスする。

## 影響範囲の分析

### 機能的影響: なし

`useMemo` は純粋なパフォーマンス最適化であり、計算結果は同一。依存配列が正しく設定されていれば、表示内容に変化はない。

### 既存テストへの影響: なし

既存のテストは `buildDisplayLines` の**出力結果**（表示内容）を検証しているため、`useMemo` でキャッシュしても全テストがそのまま通過する。

### 既存の scrollOffset useMemo との関係

`PullRequestDetail.tsx:225-230` に既存の `useMemo` がある:

```typescript
const scrollOffset = useMemo(() => {
  const halfVisible = Math.floor(visibleLineCount / 2);
  const maxOffset = Math.max(0, lines.length - visibleLineCount);
  const idealOffset = cursorIndex - halfVisible;
  return Math.max(0, Math.min(idealOffset, maxOffset));
}, [cursorIndex, lines.length, visibleLineCount]);
```

この `useMemo` は `lines.length` に依存している。`buildDisplayLines` のメモ化により `lines` の参照が安定するが、`lines.length` はプリミティブ値（number）であるため、`lines` の参照が変わらなくても `lines.length` が変わらない限り `scrollOffset` は再計算されない。**既存の動作と完全に互換性がある。**

### エッジケース

| ケース | 動作 |
|--------|------|
| 初回レンダー | `useMemo` は初回レンダーで必ずファクトリ関数を実行する。初回表示に影響なし |
| `differences` が空配列（diff のない PR） | `buildDisplayLines` は空の `DisplayLine[]` を返す。`useMemo` は空配列をキャッシュする。正常動作 |
| `diffTexts` が空 Map（Blob 未取得） | ロード中は `diffTexts` が空 Map。`buildDisplayLines` はファイルヘッダーのみの `DisplayLine[]` を返す。Blob 取得完了で `diffTexts` が新しい Map に更新され、`useMemo` が再計算する |
| コンポーネントのアンマウント/リマウント | `useMemo` のキャッシュはアンマウント時に破棄される。PR 一覧に戻って別の PR を開くと、新しいコンポーネントインスタンスが作られ、`useMemo` は初回実行する |

### リスク

| リスク | 対策 |
|--------|------|
| 依存配列の漏れにより stale なデータが表示される | 依存配列の各値が新しい参照を生成することを上記で確認済み。テストでもコメント投稿後のリロードで lines が更新されることを検証する |
| `collapsedThreads` の Set が同一参照で変更される | 既存コードで `new Set(prev)` により新しい参照が生成されることを確認済み（`PullRequestDetail.tsx:194`） |

## AWS SDK 連携

この変更は UI レイヤーのメモ化最適化であり、AWS SDK の呼び出し・認証フロー・エラーハンドリングに変更はない。

## セキュリティ考慮

この変更はコンポーネント内部の計算キャッシュであり、セキュリティ上の影響はない。

- **入力**: 変更なし。`buildDisplayLines` の引数は従来通り App から渡される props と内部 state
- **出力**: 変更なし。`DisplayLine[]` の内容は同一
- **認証**: 変更なし
- **データの永続化**: なし。`useMemo` のキャッシュはコンポーネントのライフサイクルに従い、アンマウント時に破棄される

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `PullRequestDetail` | メモ化後も表示内容が正しいことの確認。依存値変更時に再計算されることの確認 |

カバレッジ 95% 以上を維持する。

### 既存テストとの関係

`PullRequestDetail.test.tsx` には現在以下のカテゴリのテストが存在する:

- diff 表示（追加行・削除行・コンテキスト行の色分け）
- コメント表示（一般コメント・インラインコメント）
- スレッド折り畳み（`o` キーでの展開/折り畳み）
- カーソルナビゲーション（`j`/`k` によるカーソル移動）
- 各種モーダル（コメント入力、インラインコメント、返信、承認）

これらのテストは `buildDisplayLines` の**出力結果**を検証しており、`useMemo` でキャッシュしても全テストが変更なしで通過する。

### 追加テストケース

`useMemo` の依存配列が正しいことを保証する回帰テストを追加する。`render` → `rerender` パターンで props を変更し、表示が更新されることを確認する。

#### `PullRequestDetail`（コンポーネント）

| # | テストケース | 検証対象の依存値 | 期待結果 |
|---|-------------|-----------------|---------|
| 1 | `commentThreads` が更新された場合（rerender で新しい配列を渡す） | `commentThreads` | 新しいコメントが表示に反映される |
| 2 | `diffTexts` が更新された場合（rerender で新しい Map を渡す） | `diffTexts` | 新しい diff 内容が表示に反映される |
| 3 | `collapsedThreads` の変更（`o` キーで折り畳み/展開） | `collapsedThreads` | 折り畳み状態が表示に反映される（既存テストで担保済み） |
| 4 | `differences` が更新された場合（rerender で新しい配列を渡す） | `differences` | 新しいファイル一覧が表示に反映される |

テスト #1, #2, #4 は `useMemo` の依存配列漏れを検出する回帰テスト。各依存値を個別に変更して表示が更新されることを確認する。テスト #3 は既存テストで担保済みのため、新規追加は不要。

## 実装順序

### Step 1: `PullRequestDetail.tsx` の変更

`buildDisplayLines()` の呼び出しを `useMemo` で包む。1行の変更。

### Step 2: テスト追加

`PullRequestDetail.test.tsx` にメモ化の回帰テスト（`commentThreads` 更新時に表示が反映されるケース）を追加。

### Step 3: CI 確認

```bash
bun run ci
```

全チェック通過を確認。

### Step 4: ドキュメント更新

この変更はパフォーマンス最適化であり、ユーザー向け機能や API に変更はない。要件定義書（`docs/requirements.md`）および README の更新は不要。
