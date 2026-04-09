# キーバインド設計レビュー

> **ステータス**: レビュー結果（2026-02-15）
>
> v0.1〜v0.3.0 で段階的に追加されてきたキーバインドを、ユーザー目線で横断的にレビューした結果をまとめる。

## 現状の全体マップ

### 画面別キーバインド

#### リポジトリ選択画面

| キー | アクション | 実装 |
|------|-----------|------|
| `j` / `↓` | カーソル下移動 | `useListNavigation` |
| `k` / `↑` | カーソル上移動 | `useListNavigation` |
| `Enter` | リポジトリ選択 | `useListNavigation` |
| `q` / `Esc` | 終了 | `useListNavigation` |
| `?` | ヘルプ表示 | `useListNavigation` |

フッターヒント: `↑↓ navigate Enter select q quit ? help`

#### PR 一覧画面

| キー | アクション | モード | 実装 |
|------|-----------|-------|------|
| `j` / `↓` | カーソル下移動 | 通常 | `PullRequestList` |
| `k` / `↑` | カーソル上移動 | 通常 | `PullRequestList` |
| `Enter` | PR 選択 | 通常 | `PullRequestList` |
| `q` / `Esc` | 戻る | 通常 | `PullRequestList` |
| `?` | ヘルプ表示 | 通常 | `PullRequestList` |
| `f` | ステータスフィルタ切替 | 通常 | `PullRequestList` |
| `/` | 検索モード開始 | 通常 | `PullRequestList` |
| `n` | 次のページ | 通常 | `PullRequestList` |
| `p` | 前のページ | 通常 | `PullRequestList` |
| `Esc` | 検索モード終了 + クエリクリア | 検索中 | `PullRequestList` |

フッターヒント:
- 通常: `↑↓ navigate  Enter view  f filter  / search  n next  p prev  q back  ? help`
- 検索中: `Enter select  Esc clear search`

#### PR 詳細画面

| キー | アクション | コミットビュー | 実装 |
|------|-----------|------------|------|
| `j` / `↓` | カーソル下移動 | 両方 | `PullRequestDetail` |
| `k` / `↑` | カーソル上移動 | 両方 | `PullRequestDetail` |
| `Ctrl+d` | 半ページ下スクロール | 両方 | `PullRequestDetail` |
| `Ctrl+u` | 半ページ上スクロール | 両方 | `PullRequestDetail` |
| `G` | 最終行へジャンプ | 両方 | `PullRequestDetail` |
| `q` / `Esc` | 戻る | 両方 | `PullRequestDetail` |
| `?` | ヘルプ表示 | 両方 | `PullRequestDetail` |
| `c` | 一般コメント投稿 | All changes のみ | `PullRequestDetail` |
| `C` | インラインコメント投稿 | All changes のみ | `PullRequestDetail` |
| `R` | コメント返信 | All changes のみ | `PullRequestDetail` |
| `o` | スレッド折りたたみ切替 | All changes のみ | `PullRequestDetail` |
| `e` | コメント編集 | 両方 | `PullRequestDetail` |
| `d` | コメント削除 | 両方 | `PullRequestDetail` |
| `g` | リアクション追加/削除 | All changes のみ | `PullRequestDetail` |
| `a` | PR 承認 | 両方 | `PullRequestDetail` |
| `r` | 承認取消 | 両方 | `PullRequestDetail` |
| `m` | マージ操作開始 | 両方 | `PullRequestDetail` |
| `x` | PR クローズ | 両方 | `PullRequestDetail` |
| `Tab` | 次のビューへ切替 | 両方 | `PullRequestDetail` |
| `Shift+Tab` | 前のビューへ切替 | 両方 | `PullRequestDetail` |

フッターヒント:
- All changes（コミットあり）: `Tab view ↑↓ c comment C inline R reply o fold e edit d del g react a/r approve m merge x close q ? help`
- コミットビュー: `Tab next S-Tab prev ↑↓ e edit d del a/r approve m merge x close q ? help`
- コミットなし: `↑↓ c comment C inline R reply o fold e edit d del g react a/r approve m merge x close q ? help`

#### モーダル/ダイアログ

| コンポーネント | キー | アクション |
|------------|------|-----------|
| `CommentInput` | `Esc` | 入力キャンセル |
| | `Enter` | コメント送信 |
| `ConfirmPrompt` | `y` / `Y` | 確認 |
| | `n` / `N` / `Esc` | キャンセル |
| `MergeStrategySelector` | `j` / `↓` | 下移動 |
| | `k` / `↑` | 上移動 |
| | `Enter` | 戦略選択 |
| | `q` / `Esc` | キャンセル |
| `ReactionPicker` | `←` / `h` | 左移動 |
| | `→` / `l` | 右移動 |
| | `Enter` | リアクション選択 |
| | `q` / `Esc` | キャンセル |

### カテゴリ別キーバインド

#### ナビゲーション（Vim 風）

| キー | アクション | 備考 |
|------|-----------|------|
| `j` / `↓` | 下移動 | 全画面共通 |
| `k` / `↑` | 上移動 | 全画面共通 |
| `Ctrl+d` | 半ページ下スクロール | PR詳細画面 |
| `Ctrl+u` | 半ページ上スクロール | PR詳細画面 |
| `G` | 最終行へジャンプ | PR詳細画面 |
| `h` / `←` | 左移動 | ReactionPicker のみ |
| `l` / `→` | 右移動 | ReactionPicker のみ |
| `Enter` | 選択/確定 | 全画面共通 |
| `q` / `Esc` | 戻る/閉じる | 全画面共通 |
| `?` | ヘルプ表示 | モーダル以外 |

#### コメント操作

| キー | アクション | ケース |
|------|-----------|-------|
| `c` | 一般コメント投稿 | 小文字 |
| `C` | インラインコメント投稿 | 大文字 |
| `R` | コメント返信 | 大文字 |
| `e` | コメント編集 | 小文字 |
| `d` | コメント削除 | 小文字 |
| `o` | スレッド折りたたみ切替 | 小文字 |
| `g` | リアクション追加/削除 | 小文字 |

#### PR アクション

| キー | アクション | 確認プロンプト |
|------|-----------|------------|
| `a` | 承認 | あり (y/n) |
| `r` | 承認取消 | あり (y/n) |
| `m` | マージ | あり（戦略選択 → 確認） |
| `x` | クローズ | あり (y/n) |

#### リスト操作（PR 一覧のみ）

| キー | アクション |
|------|-----------|
| `f` | ステータスフィルタ切替 |
| `/` | 検索モード |
| `n` | 次のページ |
| `p` | 前のページ |

---

## 設計上の良い点

### 1. Vim 風ナビゲーションの一貫性

`j`/`k` + 矢印キーの両対応が全画面で統一されている。ターミナルユーザーの習慣に沿っている。

### 2. モーダル中のキー無効化

`isCommenting`、`isDeleting` 等のフラグにより、モーダル表示中は親画面のキーバインドが発火しない。`useInput` 内の早期リターンで実現しており、安全に動作する。

### 3. 破壊的操作の確認プロンプト

`a`（承認）、`r`（取消）、`m`（マージ）、`x`（クローズ）、`d`（削除）はすべて確認プロンプト（y/n）を経由する。

### 4. useListNavigation による共通化

リポジトリ選択画面は `useListNavigation` フックを使い、ナビゲーションロジックを共通化している。

---

## 問題点

### P1: 長い diff の移動手段が j/k のみ ✅ 解決済み

**影響度: 高** — 日常的なレビュー体験に直接影響

~~Vim 系 TUI で定番のページスクロールが未実装。数百行の diff を `j`/`k` の 1 行移動のみで読むのは実用上つらい。~~

**→ [design-page-scroll.md](design-page-scroll.md) にて `Ctrl+d`/`Ctrl+u`/`G` を実装完了（2026-02-15）。**

不足しているキー:

| キー | Vim での意味 | 提案するアクション |
|------|------------|--------------|
| `Ctrl+d` | 半ページ下 | 表示行数の半分だけ下へスクロール |
| `Ctrl+u` | 半ページ上 | 表示行数の半分だけ上へスクロール |
| `G` | 末尾へジャンプ | 最終行へ移動 |

`gg`（先頭ジャンプ）は 2 ストローク操作のため、TUI での実装コストが高い。代替として `0` や `Home` キーを検討できるが、優先度は低い。

### P2: PR 詳細画面のフッターヒントが長すぎて読めない

**影響度: 高** — 表示しているのに情報が伝わらない

All changes ビュー（コミットあり）のフッターは 15 個以上の操作を 1 行に詰め込んでいる:

```
Tab view ↑↓ c comment C inline R reply o fold e edit d del g react a/r approve m merge x close q ? help
```

- 端末幅 80 カラムでは折り返しが発生する
- 省略の不統一: `del` vs `comment`、`a/r approve` が何を指すか不明

### P3: 大文字/小文字の一貫性がない

**影響度: 中** — ユーザーの認知負荷

コメント操作で大文字・小文字が混在:

| キー | アクション | なぜこのケースか |
|------|-----------|-------------|
| `c` → `C` | コメント → インラインコメント | `C` は `c` の上位操作。Shift に意味あり |
| `r` → `R` | 承認取消 → リプライ | `r` が revoke で使用済みのため `R` に回避 |

`c`/`C` の関係は「通常操作 → Shift で派生操作」という設計意図が見えるが、`R` は `r`（revoke）との衝突回避でしかなく、ユーザーから見ると「なぜリプライだけ Shift が要る？」という疑問が生じる。

### P4: ヘルプ画面のグルーピングがない

**影響度: 中** — 発見性・一覧性の低下

`Help.tsx` は全 23 キーバインドをフラットに列挙している。画面やカテゴリによるグルーピングがなく、目的のキーを探しにくい。

### P5: `S-Tab` の表記が分かりにくい

**影響度: 低** — Vim ユーザーには自然だが一般ユーザーには不親切

ヘルプとフッターで `S-Tab` と表記しているが、`Shift+Tab` の方が直感的。

### P6: ReactionPicker の h/l がドキュメント化されていない

**影響度: 低** — 発見性がゼロ

`ReactionPicker` は `h`/`l` での左右移動をサポートしているが:
- `Help.tsx` に記載なし
- フッターヒントにも記載なし（`←→ select Enter send Esc cancel`）

Vim ユーザーが自然に試す可能性はあるが、ドキュメント化されていない隠し機能になっている。

### P7: コミットビューでの機能制限が暗黙的

**影響度: 低** — フッターヒントは変わるが、キーを押しても無反応で理由が表示されない

コミットビュー（`Tab` 切替後）では `c`、`C`、`g` が無効化される。フッターヒントからは除外されるため気付けるが、キーを押した場合は何も起きず理由も表示されない。

---

## 改善提案

### 提案 1: ページスクロールの追加（P1 対応）

**対象**: `PullRequestDetail.tsx`

```
Ctrl+d → カーソルを表示行数の半分だけ下へ移動
Ctrl+u → カーソルを表示行数の半分だけ上へ移動
G      → 最終行へ移動
```

`Ctrl+d`/`Ctrl+u` は Ink の `useInput` で `key.ctrl` + `input === "d"` で検出可能。`G` は `input === "G"`（大文字）で検出可能。`g` がリアクションで使用中のため、`gg`（先頭ジャンプ）は 2 ストローク操作となり実装コストが高い。先頭ジャンプが必要な場合は `0` キーを検討する。

### 提案 2: フッターヒントの整理（P2 対応）

**対象**: `PullRequestDetail.tsx` のフッター表示

現状の 1 行 15 項目を、カテゴリで区切ったコンパクトな形式に変更する:

```
↑↓/C-d/C-u scroll  c/C comment  R reply  o fold  e/d edit/del  g react  a/r/m/x actions  ? help
```

あるいは最低限のヒントのみ表示し、詳細は `?` に委ねる:

```
↑↓ scroll  ? for all keybindings
```

### 提案 3: ヘルプ画面のグルーピング（P4 対応）

**対象**: `Help.tsx`

フラットなリストから画面・カテゴリ別のグルーピングに変更:

```
=== Navigation ===
 j / ↓        Cursor down
 k / ↑        Cursor up
 Ctrl+d       Half page down
 Ctrl+u       Half page up
 G            Jump to end
 Enter        Select / confirm
 q / Esc      Back / quit
 Ctrl+C       Exit immediately
 ?            Toggle help

=== Comments (PR Detail) ===
 c            Post comment
 C            Post inline comment
 R            Reply to comment
 o            Toggle thread fold
 e            Edit comment
 d            Delete comment
 g            React to comment

=== PR Actions (PR Detail) ===
 a            Approve PR
 r            Revoke approval
 m            Merge PR
 x            Close PR without merge
 Tab          Next commit view
 Shift+Tab    Previous commit view

=== PR List ===
 f            Filter by status
 /            Search pull requests
 n            Next page
 p            Previous page
```

### 提案 4: `S-Tab` → `Shift+Tab` 表記統一（P5 対応）

**対象**: `Help.tsx`、`PullRequestDetail.tsx` のフッター

`S-Tab` を `Shift+Tab` に変更する。

### 提案 5: ReactionPicker の h/l をヘルプに追加（P6 対応）

**対象**: `Help.tsx`、`ReactionPicker.tsx` のフッター

ヘルプ画面のリアクション項目に `h/l` を追記:

```
 ← / h        Previous reaction
 → / l        Next reaction
```

ReactionPicker のフッターも更新:

```
←→/h/l select  Enter send  Esc cancel
```

---

## 対応優先度

| 優先度 | 提案 | 理由 | 影響範囲 |
|-------|------|------|---------|
| ~~**高**~~ | ~~提案 1: ページスクロール~~ | ✅ 実装完了（[design-page-scroll.md](design-page-scroll.md)） | `PullRequestDetail.tsx`、`Help.tsx` |
| **高** | 提案 2: フッターヒント整理 | 現状読めないので表示する意味が薄い | `PullRequestDetail.tsx` |
| **中** | 提案 3: ヘルプ画面グルーピング | 発見性・一覧性の改善 | `Help.tsx` |
| **低** | 提案 4: `S-Tab` 表記統一 | 小さいが確実に改善 | `Help.tsx`、`PullRequestDetail.tsx` |
| **低** | 提案 5: h/l ドキュメント化 | 隠し機能の解消 | `Help.tsx`、`ReactionPicker.tsx` |

---

## 将来的な検討事項（スコープ外）

以下は本レビューで認識したが、スコープが大きいため将来検討とする:

- **`R` キーの再設計**: `r`（revoke）との衝突を根本的に解消するにはキーバインド全体の再設計が必要。v1.0.0 のキーバインドカスタマイズ機能で対応可能
- **diff 内検索（`/`）**: PR 一覧では `/` で検索できるが、PR 詳細画面（diff 内）では未対応。レビューツールとして重要だが機能追加になる
- **2 ストローク操作（`gg` 等）**: Vim の `gg`（先頭ジャンプ）は実装コストが高い。タイムアウトベースのキーシーケンス管理が必要
