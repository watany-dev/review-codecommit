# review-codecommit 要件定義書

## 概要

AWS CodeCommit のプルリクエストをターミナルでレビューするTUIツール。

## 起動方法

```
npx review-codecommit                        # リポジトリ一覧から選択
npx review-codecommit <repo-name>            # リポジトリ指定で起動
npx review-codecommit --profile <name>       # AWSプロファイル指定
npx review-codecommit --region <region>      # リージョン指定
npx review-codecommit --completions <shell>  # シェル補完スクリプト生成 (bash, zsh, fish)
```

## 技術スタック

| 項目 | 選択 |
|------|------|
| パッケージ名 | `review-codecommit` |
| TUIフレームワーク | Ink (React for CLI) |
| AWS SDK | `@aws-sdk/client-codecommit` (v3) |
| AWS認証 | SDK標準チェーン + `--profile` / `--region` オプション |
| ビルド | bun build (既存構成を活用) |
| テキスト入力 | `ink-text-input` (v0.2 コメント投稿) |
| テスト | vitest |
| リント | oxlint |

## 実装済み機能（v0.4.0 現在）

### コアレビュー機能

| 機能 | 内容 |
|------|------|
| リポジトリ一覧 | CodeCommit のリポジトリをリスト表示・選択 |
| PR 一覧 | Open / Closed / Merged フィルタ、タイトル・著者名検索、ページネーション |
| PR 詳細 | タイトル、説明、色付き unified diff（追加=緑、削除=赤） |
| 行番号ガター | 変更前/変更後の行番号を4桁右寄せで表示 |
| カーソルナビゲーション | `>` マーカーによる diff 行移動、`]c`/`[c` で変更行ジャンプ |
| コミット単位レビュー | Tab/Shift+Tab で「All changes」と各コミット diff を切り替え |

### コメントシステム

| 機能 | 内容 |
|------|------|
| コメント投稿 | PR 全体コメント（`c`）、インラインコメント（`C`） |
| 返信 | 既存コメントへの返信投稿（`R`） |
| 編集・削除 | 自分のコメントを編集（`e`）、削除（`d`、確認付き） |
| スレッド表示 | `└` プレフィックスのインデント表示、4件以上で自動折りたたみ（`o` で切替） |
| リアクション | 8種類の絵文字リアクション（`g`）、バッジ表示、トグル削除 |

### 承認・マージ

| 機能 | 内容 |
|------|------|
| 承認操作 | PR 承認（`a`）、承認取消（`r`）、確認プロンプト付き |
| 承認状態表示 | 承認者一覧、承認ルール評価（satisfied / not satisfied） |
| マージ | 戦略選択（Fast-forward / Squash / Three-way）、コンフリクト検出 |
| PR クローズ | マージせずに閉じる（`x`、確認付き） |

### アクティビティ・シェル統合

| 機能 | 内容 |
|------|------|
| アクティビティタイムライン | PR イベント履歴の時系列表示（`A`、10種別対応） |
| シェル補完 | bash / zsh / fish 補完スクリプト生成（`--completions`） |
| AWS 設定 | `--profile` / `--region` オプション |

### 将来対応

- v0.5.0: ファイルツリー表示、diff 統計、デフォルトリポジトリ自動判定
- v1.0.0: パフォーマンス最適化、設計負債解消、セマンティックバージョニング保証

詳細は [roadmap.md](roadmap.md) を参照。

## キーバインド

| キー | 動作 | 画面 |
|------|------|------|
| `j` / `↓` | カーソル下移動 | 全画面（コメント入力中・確認プロンプト中は無効） |
| `k` / `↑` | カーソル上移動 | 全画面（コメント入力中・確認プロンプト中は無効） |
| `Ctrl+d` | 半ページ下スクロール | PR詳細画面（コメント入力中・確認プロンプト中は無効） |
| `Ctrl+u` | 半ページ上スクロール | PR詳細画面（コメント入力中・確認プロンプト中は無効） |
| `G` | 最終行へジャンプ | PR詳細画面（コメント入力中・確認プロンプト中は無効） |
| `n` | 次のファイルへジャンプ | PR詳細画面（コメント入力中・確認プロンプト中は無効） |
| `N` | 前のファイルへジャンプ | PR詳細画面（コメント入力中・確認プロンプト中は無効） |
| `]c` | 次の変更行（add/delete）へジャンプ | PR詳細画面（コメント入力中・確認プロンプト中は無効） |
| `[c` | 前の変更行（add/delete）へジャンプ | PR詳細画面（コメント入力中・確認プロンプト中は無効） |
| `Enter` | 選択・決定 / コメント送信 | リスト画面 / コメント入力 |
| `q` / `Esc` | 前の画面に戻る / コメント入力キャンセル | 全画面 / コメント入力 |
| `Ctrl+C` | 即座に終了 | 全画面 |
| `?` | ヘルプ表示 | 全画面（コメント入力中・確認プロンプト中は無効） |
| `c` | コメント入力モード開始 | PR詳細画面 |
| `C` | インラインコメント投稿（カーソル行） | PR詳細画面（diff行上のみ） |
| `R` | コメント返信（カーソル行のコメントに返信） | PR詳細画面（コメント行上のみ） |
| `o` | スレッド折りたたみ/展開切替 | PR詳細画面（コメント行上のみ） |
| `e` | コメント編集（既存内容プリフィル） | PR詳細画面（コメント行上のみ） |
| `d` | コメント削除（確認プロンプト表示） | PR詳細画面（コメント行上のみ） |
| `g` | リアクション追加/削除（絵文字ピッカー表示） | PR詳細画面（コメント行上のみ） |
| `←` / `h` | リアクション選択を左へ | リアクションピッカー |
| `→` / `l` | リアクション選択を右へ | リアクションピッカー |
| `a` | PR を承認（確認プロンプト表示） | PR詳細画面 |
| `r` | 承認を取り消し（確認プロンプト表示） | PR詳細画面 |
| `m` | マージ操作を開始（戦略選択） | PR詳細画面 |
| `x` | PR をクローズ（確認プロンプト表示） | PR詳細画面 |
| `A` | アクティビティタイムライン表示 | PR詳細画面 |
| `Tab` | 次のビューへ切り替え（All changes → Commit 1 → ... → All changes） | PR詳細画面 |
| `Shift+Tab` | 前のビューへ切り替え | PR詳細画面 |
| `f` | ステータスフィルタ切り替え（OPEN → CLOSED → MERGED → OPEN） | PR一覧画面 |
| `/` | 検索モード開始（タイトル・著者名でフィルタリング） | PR一覧画面 |
| `n` | 次のページへ移動 | PR一覧画面 |
| `p` | 前のページへ移動 | PR一覧画面 |

## 画面フロー・遷移

```
起動
 │
 ├─ 引数あり ──────────────────┐
 │                              ▼
 └─ 引数なし ─→ [1. リポジトリ選択] ─→ [2. PR一覧] ─→ [3. PR詳細]
                     │                    │               │
                     │ q/Esc: 終了        │ q/Esc: 1へ    │ q/Esc: 2へ
                     ▼                    ▼               ▼
                   終了                  1へ戻る         2へ戻る
```

## 画面モック

### 1. リポジトリ選択画面

```
┌─ review-codecommit ─────────────────────────┐
│                                              │
│  Select Repository:                          │
│                                              │
│  > my-service                                │
│    my-frontend                               │
│    shared-lib                                │
│    infra-config                              │
│                                              │
│  ↑↓ navigate  Enter select  q quit           │
└──────────────────────────────────────────────┘
```

### 2. PR一覧画面

```
┌─ review-codecommit ─ my-service ─────────────────┐
│                                                    │
│  [Open]   Closed   Merged                          │
│                                                    │
│  Open Pull Requests (3):                           │
│                                                    │
│  > #42  fix: login timeout   watany  2h ago        │
│    #41  feat: add search     taro    1d ago        │
│    #38  chore: deps update   bot     3d ago        │
│                                                    │
│  Page 1  n next                                    │
│  ↑↓ navigate  Enter view  f filter  / search       │
│  n next  p prev  q back  ? help                    │
└────────────────────────────────────────────────────┘
```

### 3. PR詳細画面 (diff)

```
┌─ PR #42: fix: login timeout ────────────────┐
│  Author: watany  Status: OPEN   2h ago       │
│  main ← feature/fix-login                    │
│  Approvals: taro ✓                           │
│  Rules: ✓ Approved (1/1 rules satisfied)     │
│──────────────────────────────────────────────│
│  src/auth.ts                                 │
│                                              │
│  @@ -15,7 +15,7 @@                           │
│    15   15 │  const config = {               │
│ >  16      │ -   timeout: 3000,              │
│     💬 taro: この値はconfigから取る方が良さそう │
│        └ watany: 次のPRで修正します           │
│        16 │ +   timeout: 10000,              │
│    17   17 │  };                             │
│                                              │
│──────────────────────────────────────────────│
│  Comments (3):                               │
│  watany: タイムアウトを延長しました  👍×2     │
│     └ taro: LGTMです  🎉×1                   │
│     └ hanako: 他も確認してください            │
│                                              │
│  ↑↓ cursor  c comment  C inline  R reply     │
│  o fold  e edit  d delete  g react           │
│  a approve  r revoke  m merge  x close       │
│  Tab/S-Tab commits  q back  ? help           │
└──────────────────────────────────────────────┘
```

## diff表示仕様

- **形式**: unified diff (`git diff` 同等)
- **色付け**: 追加行=緑、削除行=赤、コンテキスト行=デフォルト
- **行番号ガター**: 変更前/変更後の行番号を各4桁右寄せで表示（例: `   3    4 │ `）。add/delete/context行のみ。dimColorで本文色と分離
- **構造**: ファイル単位でセクション分け

## ページネーション

| 画面 | 取得件数 | 表示方式 |
|------|----------|----------|
| リポジトリ一覧 | 最大100件 | スクロール |
| PR一覧 | OPEN/CLOSED/MERGED、最大25件ずつ | `n`/`p` キーでページ切替 |
| diff | 全ファイル取得 | 画面内スクロール |

## エラーハンドリング

| エラー | 挙動 |
|--------|------|
| AWS認証失敗 | メッセージ表示して終了。`aws configure` を案内 |
| リポジトリ不在 | 「Repository not found」と表示して終了 |
| ネットワークエラー | 「Network error. Check your connection.」と表示 |
| 権限不足 | 「Access denied」と表示し必要なIAMポリシーを案内 |
| コメント空 | 「Comment cannot be empty.」と表示 |
| コメント文字数超過 | 「Comment exceeds the 10,240 character limit.」と表示 |
| コメント投稿権限不足 | 「Access denied. Check your IAM policy allows CodeCommit write access.」と表示 |
| PR不在（投稿時） | 「Pull request not found.」と表示 |
| 承認権限不足 | 「Access denied. Check your IAM policy.」と表示 |
| 自分のPR承認不可 | 「Cannot approve your own pull request.」と表示 |
| リビジョン不整合 | 「Invalid revision. The PR may have been updated. Go back and reopen.」と表示 |
| PR既にクローズ（承認時） | 「Pull request is already closed.」と表示 |
| 暗号化キーアクセス拒否 | 「Encryption key access denied.」と表示 |
| PR不在（承認時） | 「Pull request not found.」と表示 |
| 返信空 | 「Reply cannot be empty.」と表示 |
| 返信文字数超過 | 「Reply exceeds the 10,240 character limit.」と表示 |
| 返信先コメント削除済み | 「The comment you are replying to no longer exists.」と表示 |
| 不正コメントID | 「Invalid comment ID format.」と表示 |
| マージコンフリクト | 「Conflicts detected. Cannot auto-merge. Resolve conflicts manually.」と表示 |
| 承認ルール未充足（マージ時） | 「Approval rules not satisfied. Get required approvals first.」と表示 |
| ソースブランチ変更（マージ時） | 「Source branch has been updated. Go back and reopen the PR.」と表示 |
| 並行更新エラー（マージ時） | 「Branch was updated concurrently. Try again.」と表示 |
| コミット差分超過（マージ時） | 「Branches have diverged too much. Merge manually.」と表示 |
| PR既にクローズ（マージ時） | 「Pull request is already closed.」と表示 |
| PR不在（マージ時） | 「Pull request not found.」と表示 |
| 暗号化キーアクセス拒否（マージ時） | 「Encryption key access denied.」と表示 |
| PR既にクローズ（クローズ時） | 「Pull request is already closed.」と表示 |
| PR不在（クローズ時） | 「Pull request not found.」と表示 |
| アクセス拒否（クローズ時） | 「Access denied. Check your IAM policy.」と表示 |
| 他人のコメント編集 | 「You can only edit your own comments.」と表示 |
| 削除済みコメント編集 | 「Comment has already been deleted.」と表示 |
| 存在しないコメント編集 | 「Comment not found.」と表示 |
| コメント編集文字数超過 | 「Comment exceeds the 10,240 character limit.」と表示 |
| 削除済みコメント再削除 | 「Comment has already been deleted.」と表示 |
| 存在しないコメント削除 | 「Comment not found.」と表示 |
| ページトークン期限切れ | 「Page token expired. Returning to first page.」と表示し、ページ1にリセット |
| 削除済みコメントへのリアクション | 「Comment has already been deleted.」と表示 |
| 存在しないコメントへのリアクション | 「Comment not found.」と表示 |
| 不正リアクション値 | 「Invalid reaction value.」と表示 |
| 不正コメントID（リアクション時） | 「Invalid comment ID format.」と表示 |

## テスト戦略

| レイヤー | 方針 |
|----------|------|
| AWS SDK | `vitest.mock` でモック。実際のAPIは呼ばない |
| ビジネスロジック | diff整形、日付フォーマット等の純粋関数をユニットテスト |
| TUI層 | Ink の `render` によるスナップショットテスト (ink-testing-library) |
