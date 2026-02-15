# ページスクロールキーバインドの追加

> **ステータス**: 設計中（2026-02-15）
>
> キーバインドレビュー [design-review-keybindings.md](design-review-keybindings.md) の **P1: 長い diff の移動手段が j/k のみ** に対する改善。

## 背景と課題

PR 詳細画面（`PullRequestDetail`）では、diff の閲覧に `j`/`k`（1 行ずつ移動）しか手段がない。数百行〜数千行の diff を 1 行ずつ送るのは実用上つらく、Vim 系 TUI で定番のページスクロールが求められている。

現在の表示行数は通常 30 行（モーダル表示中は 20 行）であり、`visibleLineCount` をベースにスクロール量を決定できる。

## 追加キーバインド

| キー | アクション | スクロール量 |
|------|-----------|------------|
| `Ctrl+d` | 半ページ下スクロール | `Math.floor(visibleLineCount / 2)` 行 |
| `Ctrl+u` | 半ページ上スクロール | `Math.floor(visibleLineCount / 2)` 行 |
| `G` | 最終行へジャンプ | `lines.length - 1` |

### 選定理由

- `Ctrl+d` / `Ctrl+u`: Vim の半ページスクロールと同じ操作。`less`、`man` 等のターミナルツールでも広く使われており、ターミナルユーザーにとって最も自然。
- `G`: Vim の末尾ジャンプ。長い diff の末尾にあるコメントセクションへ素早く到達する手段として有用。
- `gg`（先頭ジャンプ）は 2 ストローク操作であり、タイムアウトベースのキーシーケンス管理が必要なため今回はスコープ外とする。`g` はリアクション操作で使用中。

### キー検出方法

Ink の `useInput` は `key.ctrl` プロパティ（boolean）をサポートしている:

```typescript
useInput((input, key) => {
  if (key.ctrl && input === "d") { /* Ctrl+d */ }
  if (key.ctrl && input === "u") { /* Ctrl+u */ }
  if (input === "G") { /* G（大文字） */ }
});
```

## AWS SDK 連携

本機能は純粋な UI キーバインド追加であり、AWS SDK の呼び出し・認証フロー・IAM 権限に変更はない。新たな API コマンドの追加も不要。

## セキュリティ考慮

本機能はキーボード入力に対するカーソル位置の変更のみであり、セキュリティ上の考慮事項はない。

- ユーザー入力の外部送信: なし（カーソル位置の内部 state 更新のみ）
- AWS 認証情報の取り扱い: 変更なし
- 入力値の検証: `Math.min` / `Math.max` による境界チェックのみ（既存パターンと同一）

## 設計

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/components/PullRequestDetail.tsx` | `useInput` にキーバインド追加 |
| `src/components/PullRequestDetail.test.tsx` | テスト追加 |
| `src/components/Help.tsx` | ヘルプ画面にキー表示追加 |
| `src/components/Help.test.tsx` | スナップショット/表示テスト更新 |

### 実装詳細: PullRequestDetail.tsx

#### 1. `useInput` ハンドラへの追加

既存の `j`/`k` ハンドラの直後に追加する。モーダル表示中の早期リターン（L403-415）はそのまま適用されるため、モーダル中はページスクロールも無効化される。

```typescript
// 既存: j/k による 1 行移動
if (input === "j" || key.downArrow) {
  setCursorIndex((prev) => Math.min(prev + 1, lines.length - 1));
  return;
}
if (input === "k" || key.upArrow) {
  setCursorIndex((prev) => Math.max(prev - 1, 0));
  return;
}

// 新規: Ctrl+d 半ページ下スクロール
if (key.ctrl && input === "d") {
  if (lines.length === 0) return;
  const halfPage = Math.floor(visibleLineCount / 2);
  setCursorIndex((prev) => Math.min(prev + halfPage, lines.length - 1));
  return;
}
// 新規: Ctrl+u 半ページ上スクロール
if (key.ctrl && input === "u") {
  if (lines.length === 0) return;
  const halfPage = Math.floor(visibleLineCount / 2);
  setCursorIndex((prev) => Math.max(prev - halfPage, 0));
  return;
}
// 新規: G 最終行へジャンプ
if (input === "G") {
  if (lines.length === 0) return;
  setCursorIndex(lines.length - 1);
  return;
}
```

#### 2. visibleLineCount の参照

`visibleLineCount` は現在 `useInput` の外で宣言されている（L536-547）。`Ctrl+d`/`Ctrl+u` のスクロール量計算に使うため、`visibleLineCount` の宣言を `useInput` より前に移動する必要がある。

**現在の順序:**
```
useInput(...)        // L403-534
visibleLineCount     // L536-547 ← useInput の後
scrollOffset         // L548-553
```

**変更後の順序:**
```
visibleLineCount     // useInput の前に移動
useInput(...)        // visibleLineCount を参照可能に
scrollOffset         // 変更なし
```

`visibleLineCount` は単純な三項演算子による計算で、副作用や依存関係の問題はない。`useInput` 内で参照するクロージャとして自然に動作する。

#### 3. スクロール追従

既存の `scrollOffset` 計算（`useMemo`）はすでに `cursorIndex` に基づいてカーソルをビューポート中央に保つ設計になっている。`setCursorIndex` を変更するだけで、スクロール位置は自動的に追従する。追加のスクロールロジックは不要。

```typescript
const scrollOffset = useMemo(() => {
  const halfVisible = Math.floor(visibleLineCount / 2);
  const maxOffset = Math.max(0, lines.length - visibleLineCount);
  const idealOffset = cursorIndex - halfVisible;
  return Math.max(0, Math.min(idealOffset, maxOffset));
}, [cursorIndex, lines.length, visibleLineCount]);
```

### 実装詳細: Help.tsx

Navigation セクションの `k / ↑` と `Enter` の間に 3 行追加:

```tsx
<KeyRow keyName="k / ↑" description="Cursor up" />
{/* 新規追加 */}
<KeyRow keyName="Ctrl+d" description="Half page down" />
<KeyRow keyName="Ctrl+u" description="Half page up" />
<KeyRow keyName="G" description="Jump to end" />
{/* 既存 */}
<KeyRow keyName="Enter" description="Select / confirm" />
```

### 実装詳細: フッターヒント

PR 詳細画面のフッターヒントに `C-d/C-u` を追加するかは、P2（フッターヒント整理）の対応と合わせて検討する。今回のスコープではヘルプ画面（`?`）での案内のみとし、フッターは変更しない。

理由: 現状のフッターはすでに情報過多であり、項目を追加するとさらに読みにくくなる。

## テスト計画

### キー入力のシミュレーション

Ctrl キーの入力は ASCII 制御文字として送信する:

| キー | ASCII 制御文字 | stdin.write |
|------|-------------|-------------|
| `Ctrl+d` | `0x04` (EOT) | `stdin.write("\x04")` |
| `Ctrl+u` | `0x15` (NAK) | `stdin.write("\x15")` |
| `G` | `G` | `stdin.write("G")` |

### テストデータ

Ctrl+d/Ctrl+u のスクロール量を検証するために、`visibleLineCount`（30 行）を超える diff が必要。50 行の before/after を生成し、1 行だけ変更を加える。

```typescript
// 50 行の diff を生成（header + separator + 49 context + 1 modified = 52 display lines）
const manyLines = Array.from({ length: 50 }, (_, i) => `line${i + 1}`).join("\n");
const manyLinesDiffTexts = new Map([
  ["b1:b2", { before: manyLines, after: manyLines.replace("line25", "modified25") }],
]);
```

display lines の内訳:
- 1 行: file header (`src/auth.ts`)
- 1 行: separator (`---`)
- 49 行: context lines（変更なし）
- 1 行: delete (`- line25`)
- 1 行: add (`+ modified25`)
- 合計: 53 行程度

### 検証方法

カーソル位置の検証には `lastFrame()` の出力行を解析する。`> ` プレフィックスがカーソル行を示す。既存テストでは `expect(lastFrame()).toContain("> ")` で存在確認しているが、ページスクロールの検証では「特定の行にカーソルがあること」を確認する必要がある。

`> ` の直後に表示される行テキスト（例: `> + modified25`）を `toMatch` で検証する。

### PullRequestDetail.test.tsx

TDD サイクルに従い、テストを先に書く。以下のテストでは `manyLinesDiffTexts` を使用し、既存のテストと同じ `defaultXxxProps` パターンで props を構成する。

#### テストケース 1: Ctrl+d で半ページ下にスクロール

```typescript
it("moves cursor half page down with Ctrl+d", () => {
  const { stdin, lastFrame } = render(
    <PullRequestDetail
      pullRequest={pullRequest as any}
      differences={differences as any}
      commentThreads={[]}
      diffTexts={manyLinesDiffTexts}
      onBack={vi.fn()}
      onHelp={vi.fn()}
      comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
      inlineComment={defaultInlineCommentProps}
      reply={defaultReplyProps}
      approval={defaultApprovalProps}
      merge={defaultMergeProps}
      close={defaultCloseProps}
      commitView={defaultCommitProps}
      editComment={defaultEditCommentProps}
      deleteComment={defaultDeleteCommentProps}
      reaction={defaultReactionProps}
    />,
  );
  // 初期カーソルは行 0（file header）
  // Ctrl+d で halfPage（15）行下へ移動
  stdin.write("\x04");
  // カーソルが 15 行目付近にあることを確認
  // visibleLineCount=30 の半分 = 15 行分移動
  const frame = lastFrame() ?? "";
  expect(frame).toContain("> ");
  // カーソルが先頭（file header）から離れていることを確認
  const lines = frame.split("\n");
  const cursorLine = lines.find((l) => l.includes("> "));
  expect(cursorLine).toBeDefined();
  // header 行にカーソルがないことを確認（移動した証拠）
  expect(cursorLine).not.toContain("src/auth.ts");
});
```

#### テストケース 2: Ctrl+u で半ページ上にスクロール

```typescript
it("moves cursor half page up with Ctrl+u", () => {
  const { stdin, lastFrame } = render(
    <PullRequestDetail
      pullRequest={pullRequest as any}
      differences={differences as any}
      commentThreads={[]}
      diffTexts={manyLinesDiffTexts}
      onBack={vi.fn()}
      onHelp={vi.fn()}
      comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
      inlineComment={defaultInlineCommentProps}
      reply={defaultReplyProps}
      approval={defaultApprovalProps}
      merge={defaultMergeProps}
      close={defaultCloseProps}
      commitView={defaultCommitProps}
      editComment={defaultEditCommentProps}
      deleteComment={defaultDeleteCommentProps}
      reaction={defaultReactionProps}
    />,
  );
  // まず Ctrl+d で下へ移動
  stdin.write("\x04");
  // 次に Ctrl+u で上へ戻る
  stdin.write("\x15");
  // カーソルが先頭（行 0）に戻っていることを確認
  const frame = lastFrame() ?? "";
  const lines = frame.split("\n");
  const cursorLine = lines.find((l) => l.includes("> "));
  expect(cursorLine).toBeDefined();
  // file header にカーソルが戻っている
  expect(cursorLine).toContain("src/auth.ts");
});
```

#### テストケース 3: Ctrl+d で末尾を超えない

```typescript
it("does not scroll past last line with Ctrl+d", () => {
  const { stdin, lastFrame } = render(
    <PullRequestDetail
      pullRequest={pullRequest as any}
      differences={differences as any}
      commentThreads={[]}
      diffTexts={diffTexts}  // 少数行（約 7 行）の diff データ
      onBack={vi.fn()}
      onHelp={vi.fn()}
      comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
      inlineComment={defaultInlineCommentProps}
      reply={defaultReplyProps}
      approval={defaultApprovalProps}
      merge={defaultMergeProps}
      close={defaultCloseProps}
      commitView={defaultCommitProps}
      editComment={defaultEditCommentProps}
      deleteComment={defaultDeleteCommentProps}
      reaction={defaultReactionProps}
    />,
  );
  // halfPage (15) > total lines (7) の場合、最終行で止まる
  stdin.write("\x04");
  stdin.write("\x04");
  // クラッシュせずカーソルが存在する
  expect(lastFrame()).toContain("> ");
});
```

#### テストケース 4: Ctrl+u で先頭を超えない

```typescript
it("does not scroll past first line with Ctrl+u", () => {
  const { stdin, lastFrame } = render(
    <PullRequestDetail
      pullRequest={pullRequest as any}
      differences={differences as any}
      commentThreads={[]}
      diffTexts={diffTexts}
      onBack={vi.fn()}
      onHelp={vi.fn()}
      comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
      inlineComment={defaultInlineCommentProps}
      reply={defaultReplyProps}
      approval={defaultApprovalProps}
      merge={defaultMergeProps}
      close={defaultCloseProps}
      commitView={defaultCommitProps}
      editComment={defaultEditCommentProps}
      deleteComment={defaultDeleteCommentProps}
      reaction={defaultReactionProps}
    />,
  );
  // 先頭で Ctrl+u を押してもカーソルが 0 で止まる
  stdin.write("\x15");
  stdin.write("\x15");
  const frame = lastFrame() ?? "";
  const lines = frame.split("\n");
  const cursorLine = lines.find((l) => l.includes("> "));
  expect(cursorLine).toBeDefined();
  // file header にカーソルが留まっている
  expect(cursorLine).toContain("src/auth.ts");
});
```

#### テストケース 5: G で最終行へジャンプ

```typescript
it("jumps to last line with G key", () => {
  const { stdin, lastFrame } = render(
    <PullRequestDetail
      pullRequest={pullRequest as any}
      differences={differences as any}
      commentThreads={[]}
      diffTexts={diffTexts}
      onBack={vi.fn()}
      onHelp={vi.fn()}
      comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
      inlineComment={defaultInlineCommentProps}
      reply={defaultReplyProps}
      approval={defaultApprovalProps}
      merge={defaultMergeProps}
      close={defaultCloseProps}
      commitView={defaultCommitProps}
      editComment={defaultEditCommentProps}
      deleteComment={defaultDeleteCommentProps}
      reaction={defaultReactionProps}
    />,
  );
  // G で最終行へジャンプ
  stdin.write("G");
  const frame = lastFrame() ?? "";
  const lines = frame.split("\n");
  const cursorLine = lines.find((l) => l.includes("> "));
  expect(cursorLine).toBeDefined();
  // 最終行（"new line"）にカーソルがある
  expect(cursorLine).toContain("new line");
});
```

#### テストケース 6: モーダル表示中は Ctrl+d が無効

```typescript
it("does not scroll with Ctrl+d when comment modal is open", async () => {
  const { stdin, lastFrame } = render(
    <PullRequestDetail
      pullRequest={pullRequest as any}
      differences={differences as any}
      commentThreads={[]}
      diffTexts={manyLinesDiffTexts}
      onBack={vi.fn()}
      onHelp={vi.fn()}
      comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
      inlineComment={defaultInlineCommentProps}
      reply={defaultReplyProps}
      approval={defaultApprovalProps}
      merge={defaultMergeProps}
      close={defaultCloseProps}
      commitView={defaultCommitProps}
      editComment={defaultEditCommentProps}
      deleteComment={defaultDeleteCommentProps}
      reaction={defaultReactionProps}
    />,
  );
  // コメントモーダルを開く
  stdin.write("c");
  await vi.waitFor(() => {
    expect(lastFrame()).toContain("comment");
  });
  // モーダル中に Ctrl+d を送信
  stdin.write("\x04");
  // モーダルが閉じておらず、カーソルも移動していない
  expect(lastFrame()).toContain("comment");
});
```

#### テストケース 7: モーダル表示中は G が無効

```typescript
it("does not jump with G when comment modal is open", async () => {
  const { stdin, lastFrame } = render(
    <PullRequestDetail
      pullRequest={pullRequest as any}
      differences={differences as any}
      commentThreads={[]}
      diffTexts={diffTexts}
      onBack={vi.fn()}
      onHelp={vi.fn()}
      comment={{ onPost: vi.fn(), isProcessing: false, error: null, onClearError: vi.fn() }}
      inlineComment={defaultInlineCommentProps}
      reply={defaultReplyProps}
      approval={defaultApprovalProps}
      merge={defaultMergeProps}
      close={defaultCloseProps}
      commitView={defaultCommitProps}
      editComment={defaultEditCommentProps}
      deleteComment={defaultDeleteCommentProps}
      reaction={defaultReactionProps}
    />,
  );
  stdin.write("c");
  await vi.waitFor(() => {
    expect(lastFrame()).toContain("comment");
  });
  stdin.write("G");
  // モーダルが閉じていない（G が無視された）
  expect(lastFrame()).toContain("comment");
});
```

### Help.test.tsx

```typescript
it("displays page scroll keybindings", () => {
  const { lastFrame } = render(<Help onClose={vi.fn()} />);
  const output = lastFrame();
  expect(output).toContain("Ctrl+d");
  expect(output).toContain("Half page down");
  expect(output).toContain("Ctrl+u");
  expect(output).toContain("Half page up");
  expect(output).toContain("G");
  expect(output).toContain("Jump to end");
});
```

## 既存キーバインドとの衝突確認

| キー | 既存の用途 | 衝突 |
|------|-----------|------|
| `Ctrl+d` | なし | なし |
| `Ctrl+u` | なし | なし |
| `G` | なし（`g` はリアクション） | なし — 大文字/小文字で区別 |

`Ctrl+C` は Ink がプロセス終了として処理するため、`Ctrl+d`/`Ctrl+u` とは干渉しない。

## エッジケースと境界条件

### 1. diff が空の場合（lines.length === 0）

差分がないファイルや、新規ファイルで before/after が空の場合、`lines` 配列が空になる可能性がある。

- `Ctrl+d`: `Math.min(prev + halfPage, -1)` → `setCursorIndex` が `-1` にならないよう、`lines.length - 1` が `-1` の場合は何もしない
- `Ctrl+u`: `Math.max(prev - halfPage, 0)` → 問題なし（0 以下にならない）
- `G`: `setCursorIndex(lines.length - 1)` → `-1` になるため、ガードが必要

**対策**: 各ハンドラの先頭で `lines.length === 0` の場合は早期リターンする。

```typescript
if (key.ctrl && input === "d") {
  if (lines.length === 0) return;
  const halfPage = Math.floor(visibleLineCount / 2);
  setCursorIndex((prev) => Math.min(prev + halfPage, lines.length - 1));
  return;
}
```

### 2. 残り行数が halfPage 未満の場合

カーソルが末尾付近にある時、`Ctrl+d` で `prev + halfPage > lines.length - 1` となるケース。`Math.min` により最終行で止まるため、特別な処理は不要。`Ctrl+u` も同様に `Math.max` で先頭を超えない。

### 3. visibleLineCount が 20 の場合（モーダル表示中）

モーダル表示中は `useInput` の早期リターン（L403-415）により `Ctrl+d`/`Ctrl+u`/`G` はそもそも到達しない。しかし仮に将来的に早期リターンの条件が変わった場合に備え、`visibleLineCount` の値に依存する `halfPage` 計算は正しく動作する（`Math.floor(20 / 2) = 10`）。

### 4. コミットビュー切替との相互作用

`Tab` キーでコミットビューに切り替えると `setCursorIndex(0)` でカーソルがリセットされる（L427）。ページスクロールは `cursorIndex` のみを操作するため、ビュー切替後のカーソル位置を壊すことはない。逆にビュー切替後の diff 行数が変わるため、`G` で移動する先は新しい `lines.length - 1` になる。

### 5. 連続入力（Ctrl+d を素早く複数回押す）

React の state 更新は `setCursorIndex((prev) => ...)` の関数形式を使用しているため、バッチ更新でも正しく累積する。例: `Ctrl+d` → `Ctrl+d` で `prev + halfPage + halfPage` ではなく、各 setState が順次 `prev` を更新する。

## 実装手順

TDD サイクルに従い、以下の順序で実装する:

### イテレーション 1: Ctrl+d（半ページ下スクロール）

1. **Red**: `PullRequestDetail.test.tsx` にテストケース 1, 3 を追加
2. **Green**: `PullRequestDetail.tsx` に `Ctrl+d` ハンドラを追加
3. **Refactor**: 必要に応じてコード整理

### イテレーション 2: Ctrl+u（半ページ上スクロール）

1. **Red**: テストケース 2, 4 を追加
2. **Green**: `Ctrl+u` ハンドラを追加
3. **Refactor**: Ctrl+d と Ctrl+u の対称性を確認

### イテレーション 3: G（最終行ジャンプ）

1. **Red**: テストケース 5 を追加
2. **Green**: `G` ハンドラを追加
3. **Refactor**: コード整理

### イテレーション 4: モーダル中の無効化確認

1. **Red**: テストケース 6 を追加
2. **Green**: 既存の早期リターンにより自動的にパス（追加実装不要の見込み）
3. **Refactor**: 不要

### イテレーション 5: ヘルプ画面更新

1. **Red**: `Help.test.tsx` にテスト追加
2. **Green**: `Help.tsx` にキーバインド表示を追加
3. **Refactor**: 表示の整合性確認

## Tidy First?

`useInput` 内のキーバインドは `if` の羅列で可読性が高い。現時点でのリファクタリングは不要。

`visibleLineCount` の宣言位置の移動は構造的変更に該当するため、機能追加コミットとは別のコミットで行う。

## コミット戦略

Tidy First の原則に従い、構造的変更と機能的変更を分離する。全 3 コミット構成:

| # | コミット内容 | 種別 | 対象ファイル |
|---|------------|------|------------|
| 1 | `visibleLineCount` の宣言位置を `useInput` の前に移動 | tidy（構造的変更） | `PullRequestDetail.tsx` |
| 2 | `Ctrl+d` / `Ctrl+u` / `G` キーバインドの追加＋テスト | feat（機能的変更） | `PullRequestDetail.tsx`, `PullRequestDetail.test.tsx` |
| 3 | ヘルプ画面にページスクロールキーを追加＋テスト | feat（機能的変更） | `Help.tsx`, `Help.test.tsx` |

コミット 2 ではイテレーション 1〜4 の成果物をまとめる。各イテレーションの TDD サイクルは開発中に回すが、コミットは論理的な単位で 1 つにまとめる。

## スコープ外

以下は今回のスコープに含めない:

- **`gg`（先頭ジャンプ）**: 2 ストローク操作のため、タイムアウトベースのキーシーケンス管理が必要。`g` がリアクションで使用中でもあり、実装コストが高い
- **フッターヒントの変更**: P2 対応と合わせて別タスクで実施
- **`Ctrl+f` / `Ctrl+b`（フルページスクロール）**: 半ページスクロールで十分。Vim でも `Ctrl+d`/`Ctrl+u` の方が使用頻度が高い
