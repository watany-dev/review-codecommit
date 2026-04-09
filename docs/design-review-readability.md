# レビュー画面の可読性改善設計書

> **ステータス**: 設計完了（2026-04-09）
>
> PR詳細画面のdiff表示に行番号ガターと変更行ジャンプ（`]c`/`[c`）を追加し、コードレビュー体験を改善する。

## 概要

PR詳細画面（`PullRequestDetail`）のdiff表示に2つの機能を追加し、コードレビュー体験を改善する：
1. 行番号ガターの表示
2. 変更行への高速ジャンプナビゲーション（`]c`/`[c`）

## Context

ユーザーがレビュー画面を使用中に「見づらい」と感じている。具体的には：
1. **diffに行番号がない** — コードの位置が分からず、レビューコメントで行を参照できない
2. **変更行にすぐ飛べない** — `j`/`k`で1行ずつ移動するか、`n`/`N`でファイル間ジャンプしかできず、変更箇所（add/delete行）に素早く移動する手段がない

本設計は v0.3.0（UX強化: diff可読性・ナビゲーション向上）ロードマップに合致する。

## ファイル構成

| ファイル | 変更種別 | Iteration |
|---------|---------|-----------|
| `src/components/DiffLine.tsx` | 変更: 行番号ガター追加 | 1 |
| `src/components/PullRequestDetail.tsx` | 変更: `]c`/`[c` キーバインド、`pendingBracket` state追加 | 2 |
| `src/components/Help.tsx` | 変更: Navigation セクションに `]c`/`[c` 追加 | 2 |
| `src/components/PullRequestDetail.test.tsx` | 変更: テストケース追加 | 1, 2 |

## コンポーネント設計

### Iteration 1: diff行番号の表示

**Tidy First?**: 不要。`DiffLine.tsx` はシンプルな switch-case で読みやすく、構造変更なしに機能を追加できる。

**対象ファイル:**
- `src/components/DiffLine.tsx` — 行番号ガターのレンダリング追加
- `src/components/PullRequestDetail.test.tsx` — テスト追加

**設計:**

`renderDiffLine` に行番号ガターを追加する。`DisplayLine` には既に `beforeLineNumber` と `afterLineNumber` が計算済み（`formatDiff.ts:55-56,77,94`）なので、表示するだけ。

表示形式（ガター幅: 12文字 = 4 + 1 + 4 + 3）:
```
   3    4 │  context line text
   5      │ -deleted line text
        6 │ +added line text
```

- before/after それぞれ4文字幅（`padStart(4)`）で右寄せ、スペース1文字区切り、`│ ` セパレータ付き
- `<Text dimColor>` で表示し、diff本文の色（green/red/white）と競合しないようにする
- `add`, `delete`, `context` 行のみガター表示
- `header`, `separator`, `truncation`, `truncate-context`, `comment-header`, `comment`, `inline-comment`, `inline-reply`, `comment-reply`, `fold-indicator` はガター不要（行番号プロパティが存在しないため）
- ターミナル幅80カラムの場合: カーソル2文字 + ガター12文字 = 14文字消費、残り66文字がdiff本文（十分）
- 行番号が9999を超える場合: `padStart(4)` では左にはみ出すが、レイアウトが壊れるわけではなく数字が左に1文字伸びるだけ。10,000行超のファイルは稀であり、対応不要

**実装詳細:**

`DiffLine.tsx` に `formatGutter(line: DisplayLine): string` ヘルパーを追加:
```typescript
function formatGutter(line: DisplayLine): string {
  const before = line.beforeLineNumber !== undefined ? String(line.beforeLineNumber).padStart(4) : "    ";
  const after = line.afterLineNumber !== undefined ? String(line.afterLineNumber).padStart(4) : "    ";
  return `${before} ${after} │ `;
}
// Note: computeSimpleDiff() は bi+1/ai+1 で行番号を生成するため 0 は来ないが、
// DisplayLine の型定義（number | undefined）に対して防御的に !== undefined を使用する。
```

`add`, `delete`, `context` の各caseでガター部分を `<Text dimColor>` で先頭に追加:
```tsx
case "context":
  return (
    <Text bold={bold}>
      <Text dimColor>{formatGutter(line)}</Text>
      {line.text}
    </Text>
  );
case "add":
  return (
    <Text color="green" bold={bold}>
      <Text dimColor>{formatGutter(line)}</Text>
      {line.text}
    </Text>
  );
case "delete":
  return (
    <Text color="red" bold={bold}>
      <Text dimColor>{formatGutter(line)}</Text>
      {line.text}
    </Text>
  );
```

**データフロー:**
```
formatDiff.ts: computeSimpleDiff()
  → DisplayLine { beforeLineNumber: 3, afterLineNumber: 4, type: "context", text: " line1" }
    → displayLines.ts: buildDisplayLines() でそのまま伝搬
      → PullRequestDetail.tsx: renderDiffLine(line, isCursor) を呼び出し
        → DiffLine.tsx: formatGutter(line) で "   3    4 │ " を生成、<Text dimColor> で表示
```

---

### Iteration 2: 変更行ジャンプ機能の追加 (`]c`/`[c`)

**Tidy First?**: 不要。`useInput` ハンドラは既存のパターン（キー検出 → 状態更新 → return）で一貫しており、新キーバインドを同パターンで追加可能。

**対象ファイル:**
- `src/components/PullRequestDetail.tsx` — `]c`/`[c` キーバインド追加
- `src/components/PullRequestDetail.test.tsx` — テスト追加
- `src/components/Help.tsx` — ヘルプ画面にキー説明追加

**設計:**

Vim diff風の `]c` (次の変更行) / `[c` (前の変更行) キーバインドを追加する。

変更行 = `line.type === "add" || line.type === "delete"` の行

**2キーシーケンスの設計判断:**

`design-review-keybindings.md:349` で「2ストローク操作はタイムアウトベースのキーシーケンス管理が必要」と記載されている。しかしこれは `gg` のように**1キー目が既存キーバインドと衝突する場合**（`g` はリアクション操作に使用中）の話。`[`/`]` は現在どのキーバインドにも使用されていないため、押下時点で即座に `pendingBracket` state を設定する state ベースアプローチが使える。タイムアウト管理は不要。

**タイムアウトなしのUX影響**: `]` を押した後に長時間放置してから `c` を押すと、コメント投稿ではなく変更行ジャンプが発火する。ただし、間に別のキー（`j`/`k` 等）を1つでも押せば `pendingBracket` はリセットされるため、誤発火は「`]`→（何もしない）→`c`」のパターンに限定される。実用上問題にならないと判断し、タイムアウトは導入しない。

**state遷移図:**
```
[null] ──("]"キー)──→ ["]"] ──("c"キー)──→ [null] + 次の変更行へジャンプ
  ↑                     │
  └──(他のキー)─────────┘ (リセット + そのキーを通常処理)

[null] ──("["キー)──→ ["["] ──("c"キー)──→ [null] + 前の変更行へジャンプ
  ↑                     │
  └──(他のキー)─────────┘ (リセット + そのキーを通常処理)
```

**実装詳細:**

1. `pendingBracket` state を追加（`PullRequestDetail.tsx`、既存state群の近くに配置）:
```typescript
const [pendingBracket, setPendingBracket] = useState<"[" | "]" | null>(null);
```

2. `useInput` コールバック内で、**モーダルガード（line 405-416）の直後、既存キーハンドラの前**に配置:

```typescript
// === 2-key sequence: ]c / [c for change navigation ===
if (pendingBracket && input === "c") {
  const isNext = pendingBracket === "]";
  setPendingBracket(null);
  if (isNext) {
    const idx = lines.findIndex(
      (l, i) => i > cursorIndex && (l.type === "add" || l.type === "delete"),
    );
    if (idx !== -1) setCursorIndex(idx);
  } else {
    for (let i = cursorIndex - 1; i >= 0; i--) {
      if (lines[i]!.type === "add" || lines[i]!.type === "delete") {
        setCursorIndex(i);
        break;
      }
    }
  }
  return;
}
if (pendingBracket) {
  setPendingBracket(null); // 無効な2キー目: リセットしてフォールスルー
}
```

3. 既存キーハンドラの末尾付近（`G` ハンドラ等の後）に `[`/`]` キャプチャを追加:
```typescript
if (input === "]") {
  setPendingBracket("]");
  return;
}
if (input === "[") {
  setPendingBracket("[");
  return;
}
```

## エッジケース・異常系

| ケース | 挙動 | 根拠 |
|--------|------|------|
| カーソルが既に変更行上 | 次の/前の**別の**変更行にジャンプ | `i > cursorIndex` / `i < cursorIndex` で現在行を除外 |
| 前方/後方に変更行がない | カーソル位置変更なし | `findIndex` が `-1` を返す / for ループが `break` せず終了。ラップアラウンドしない（Vimの `]c` と同じ） |
| diffが空（ファイルロード中） | カーソル位置変更なし | `lines` にadd/delete行が存在しない |
| モーダル表示中に `[` を押下 | `pendingBracket` は設定されない | モーダルガード（line 405-416）で早期リターンするため |
| `[` 押下直後に `j` を押す | pendingBracket リセット、`j` は通常のカーソル移動 | `pendingBracket` チェックで null 化後、return せずフォールスルー |
| `[` 押下直後に `q` を押す | pendingBracket リセット、`q` で画面遷移 | 同上 |
| All changes / コミットビュー | 両方で動作する | diff行のtype判定は共通。`viewIndex` によるガードなし |
| 連続して `]c`/`[c` を押す | 変更行を順にたどれる | 毎回 `cursorIndex` から検索するため |
| `n`/`N` とのラップアラウンド差異 | `]c`/`[c` はラップアラウンドしない | `n`/`N`（ファイルジャンプ）はラップアラウンドするが、`]c`/`[c` はVimの `]c` に準拠しラップしない。意図的な設計差異 |
| コミットビューでの行番号ガター | 表示される | `DiffLine.tsx` はビューモード非依存の共通コンポーネントであり、コミットビューでも行番号ガターが表示される |

**キーバインドの整合性:**

`c` は既にコメント投稿に使用中（line 519-522）。衝突しない理由：
- `[` 押下 → `pendingBracket` が `"["` にセット、即 return
- 次の入力 `c` → `pendingBracket` チェック（モーダルガード直後に配置）が先に発火し、変更行ジャンプ実行
- `c` 単体押下（`pendingBracket` が null）→ pendingBracket チェック条件 `if (pendingBracket && input === "c")` が false → 従来通り line 519 のコメント投稿ハンドラに到達

**フッター更新** (`PullRequestDetail.tsx` line 905付近):
`n/N file` の直後に `]c/[c change` を追加。

**`pendingBracket` の視覚的フィードバック**: `]` または `[` 押下時、フッターに pending 状態を表示する。`pendingBracket` が非 null の場合、通常のフッターヒントの代わりに以下を表示:
```
]_ Press c for next change, other key to cancel
```
これにより、ユーザーが2キー目の入力を待っている状態であることを明示する。Vimのpending operator表示に倣った設計。

**Help.tsx更新:**
Navigation セクション内（line 50-51 の `n`/`N` の直後）に追加:
```tsx
<KeyRow keyName="]c" description="Next change (add/delete line)" />
<KeyRow keyName="[c" description="Previous change (add/delete line)" />
```

## テスト戦略

### Iteration 1: 行番号テスト

TDDサイクル:
1. **Red**: `PullRequestDetail.test.tsx` にテスト追加 — diff行に `│` セパレータが含まれることを検証
2. **Green**: `DiffLine.tsx` に `formatGutter` + 各caseの変更を実装
3. **Refactor**: 必要に応じて整理

**既存テストへの影響:**
- `toContain("line1")` （line 251）: ガターが前置されても `line1` は含まれるためパス
- `toMatch(/> .*new line 1/)` （line 1938）: `.*` がガター文字にマッチするためパス
- `toContain("src/auth.ts")` （line 225）: header行にはガターが付かないためパス

### Iteration 2: 変更行ジャンプテスト

TDDサイクル:
1. **Red**: テストを追加
   - `]c` で次のadd/delete行にジャンプすることを確認
   - `[c` で前のadd/delete行にジャンプすることを確認
   - 変更行がない場合はカーソル位置が変わらないことを確認
   - `[` + `j` でpendingBracketがリセットされ、`j` が通常処理されることを確認
2. **Green**: `PullRequestDetail.tsx` に pendingBracket state + useInput ハンドラ実装、`Help.tsx` にキー説明追加
3. **Refactor**: 必要に応じて整理

## 実装計画

各イテレーション完了時に `bun run ci` を実行して全チェックをパス:
1. `lint` — oxlint
2. `format:check` — Biome formatting
3. `check` — TypeScript type check
4. `dead-code` — knip unused export detection
5. `audit` — dependency vulnerability check
6. `test:coverage` — Vitest with 95% coverage threshold
7. `build` — production build

## 対象外（今回のスコープ外）

- ファイル間の余白改善（セパレータ幅の動的化など）
- コメントの視覚的階層改善
- フッター情報量の削減（`design-review-keybindings.md` P2 として別途対応）
- 表示行数のターミナル高さ連動
- 要件定義書（`docs/requirements.md`）のキーバインド表への `]c`/`[c` 追記は実装完了後に `/update-docs` で対応
- ロードマップ（`docs/roadmap.md`）の v0.3.0 セクションへの行番号ガター・`]c`/`[c` 追記は実装完了後に `/update-docs` で対応

---

## update-plan 検証結果

### 設計書品質評価（レビュー反映後）

| # | カテゴリ | 点数 | コメント |
|---|---------|------|---------|
| 1 | 基本構造 | 9/10 | 概要・コンポーネント設計・実装詳細・テスト・検証方法・ファイル構成が揃っている |
| 2 | 目的・スコープの明確性 | 9/10 | 何を実装し何を実装しないかが明確。対象外も列挙済み |
| 3 | コンポーネント設計の完全性 | 9/10 | DiffLine.tsx の全case、pendingBracket の型定義・state遷移図・視覚的フィードバック・データフローを記載 |
| 4 | AWS SDK連携設計 | N/A | 本変更にAWS SDK連携なし |
| 5 | 内部アーキテクチャ | 9/10 | ファイル構成表、データフロー図、state遷移図、`useInput` 内の配置順序を記載 |
| 6 | エッジケース・異常系 | 9/10 | 10ケースの網羅的な表（`n`/`N` とのラップアラウンド差異、コミットビューのガター表示を追記）、行番号オーバーフロー、モーダル中の挙動を記載 |
| 7 | テスト戦略 | 9/10 | TDDサイクル（Red→Green→Refactor）で構成。具体的なテストケース、既存テスト影響分析を記載 |
| 8 | セキュリティ考慮 | N/A | 本変更にセキュリティ影響なし |
| 9 | 技術選定の根拠 | 9/10 | stateベース vs タイムアウトの比較、タイムアウトなしのUX影響分析、`design-review-keybindings.md` との整合性説明を記載 |
| 10 | 実装計画 | 9/10 | 2イテレーション、Tidy First判定、TDDサイクル、対象ファイル/行番号が明確 |
| | **合計** | **72/80 (90%)** | N/A 2項目を除外した8項目での評価 |

**総合判定**: 🟢 実装着手可能（90%）

### 整合性チェック

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| 設計書 ↔ ソースコード | ✅ | `DisplayLine` に `beforeLineNumber`/`afterLineNumber` が既存（`formatDiff.ts:1-24`）。`DiffLine.tsx` の switch-case 構造と一致。`formatGutter` は `!== undefined` で型安全にチェック |
| ロードマップ ↔ 設計書 ↔ 要件定義 | ✅ | v0.3.0 UX強化（diff可読性・ナビゲーション向上）に合致。`roadmap.md`・`requirements.md` の更新は対象外セクションで言及済み |
| CLAUDE.md との整合性 | ✅ | TDDサイクル、Tidy First判定、カバレッジ95%を担保 |
| ソースコード規約 | ✅ | 既存のキーハンドラパターン、`Help.tsx` の `SectionHeader`+`KeyRow` パターンに従う |
| design-review-keybindings.md | ✅ | 2ストローク操作にタイムアウト不要の根拠・UX影響を記載 |

### レビュー反映事項

以下の指摘をレビューに基づき設計書に反映済み:

- **P1-1**: `pendingBracket` の視覚的フィードバック → フッターに pending 状態表示を追加する設計を追記
- **P1-2**: `formatGutter` の truthiness チェック → `!== undefined` に変更し、`computeSimpleDiff` が1始まりである根拠をコメントで明記
- **P2-3**: `n`/`N` とのラップアラウンド差異 → エッジケース表に追記
- **P2-4**: タイムアウトなしのUX影響 → 2キーシーケンスの設計判断セクションに追記
- **P2-5**: コミットビューの行番号ガター → エッジケース表に追記
- **P2-6**: `roadmap.md` 更新 → 対象外セクションに追記

### 修正事項

- **P0**: なし
- **P1**: なし（反映済み）
- **P2**: フッターがさらに長くなる（`]c/[c change` + pending状態表示）が、`design-review-keybindings.md` P2（フッター整理）で別途対応
