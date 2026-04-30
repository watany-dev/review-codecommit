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

## 機能スコープ (v0.1) ✅

| 機能 | 内容 |
|------|------|
| リポジトリ一覧 | CodeCommitのリポジトリをリスト表示・選択 |
| PR一覧 | Open状態のPR一覧表示・選択 |
| PR詳細 | タイトル、説明、差分(diff)の表示 |
| コメント閲覧 | PR上のコメントを表示 |

## 機能スコープ (v0.2) ✅

| 機能 | 内容 |
|------|------|
| コメント投稿 | PR全体への一般コメント投稿（`c` キー） |
| 自動リロード | 投稿後のコメント一覧自動更新 |
| ローディング | 投稿中の状態表示 |
| エラーハンドリング | 文字数制限超過、権限不足等のエラー対応 |

## 機能スコープ (v0.3) ✅

| 機能 | 内容 |
|------|------|
| Approve | PR を承認する（`a` キー → 確認プロンプト → `y` で実行） |
| Revoke | 承認を取り消す（`r` キー → 確認プロンプト → `y` で実行） |
| 承認状態表示 | PR 詳細画面に承認者一覧と承認状態を表示 |
| 承認ルール評価表示 | 承認ルールの satisfied / not satisfied を表示（ルール未設定時は非表示） |
| 確認プロンプト | 操作前に確認メッセージを表示（誤操作防止） |
| エラーハンドリング | 権限不足、自分のPR承認不可、リビジョン不整合等のエラー対応 |

## 機能スコープ (v0.4) ✅

| 機能 | 内容 |
|------|------|
| インラインコメント投稿 | diff 表示中のカーソル行へコメントを投稿（`C` キー） |
| インラインコメント表示 | diff の該当行の直下にインラインコメントをインライン表示（💬 マーカー） |
| コメントスレッド表示 | 同一行への複数コメントをスレッド形式で表示 |
| カーソルナビゲーション | diff 行へのカーソル移動（`>` マーカー、j/k でカーソル移動、スクロール追従） |
| CommentThread データモデル | コメントをスレッド構造で管理（一般コメントとインラインコメントの統一的取り扱い） |

## 機能スコープ (v0.5) ✅

| 機能 | 内容 |
|------|------|
| コメント返信投稿 | 既存コメントへの返信を投稿（`R` キー） |
| 返信のスレッド表示 | 返信を `└` プレフィックス付きのインデント表示 |
| スレッド折りたたみ | 4件以上のスレッドを自動折りたたみ、`o` キーで展開/折りたたみ切替 |
| 折りたたみインジケータ | `[+N replies]` 表示で未読返信数を表示 |
| 返信エラーハンドリング | 空返信、文字数超過、コメント削除済み、不正ID等のエラー対応 |

## 機能スコープ (v0.6) ✅

| 機能 | 内容 |
|------|------|
| マージ実行 | PR をマージする（`m` キー → 戦略選択 → コンフリクトチェック → 確認 → 実行） |
| マージ戦略選択 | Fast-forward / Squash / Three-way merge から選択（j/k ナビゲーション） |
| コンフリクト検出 | マージ前にコンフリクトを自動検出し、対象ファイルを一覧表示 |
| マージ確認プロンプト | 戦略名・ブランチ名を含む最終確認（y/n） |
| PR クローズ | マージせずに PR を閉じる（`x` キー → 確認プロンプト → 実行） |
| 画面遷移 | マージ/クローズ成功後、PR 一覧へ自動遷移 |
| エラーハンドリング | コンフリクト、承認ルール未充足、並行更新、権限不足等のエラー対応 |

## 機能スコープ (v0.6.1) ✅

| 機能 | 内容 |
|------|------|
| コミット一覧取得 | PR のコミット一覧を親コミット辿りで取得（`GetCommitCommand`） |
| ビュー切り替え | Tab / Shift+Tab で「All changes」と各コミットの diff を切り替え（循環ナビゲーション） |
| コミット diff 表示 | コミット単位の差分を既存の `computeSimpleDiff` で表示 |
| コミットメタデータ表示 | タブヘッダーにコミットハッシュ（短縮）、メッセージ、著者、日時を表示 |
| 遅延ロード | コミット diff は選択時にオンデマンドで取得（ローディング表示付き） |

## 機能スコープ (v0.7) ✅

| 機能 | 内容 |
|------|------|
| コメント編集 | 自分のコメントを編集（`e` キー → 既存内容プリフィル → Enter で更新） |
| コメント削除 | コメントを削除（`d` キー → 確認プロンプト → `y` で実行） |
| 編集後のリロード | コメント更新後にコメント一覧を自動リロード |
| 削除後のリロード | コメント削除後にコメント一覧を自動リロード |
| エラーハンドリング | 権限不足、他人のコメント編集不可、削除済みコメント等のエラー対応 |

## 機能スコープ (v0.8) ✅

| 機能 | 内容 |
|------|------|
| ステータスフィルタ | Open / Closed / Merged でフィルタリング（`f` キーでサイクル） |
| PR 検索 | タイトル・著者名でクライアントサイド検索（`/` キーで検索モード） |
| ページネーション | 次ページ/前ページのトークンベース読み込み（`n`/`p` キー） |
| PR ステータスバッジ | Closed / Merged の PR にバッジ表示（Open はバッジなし） |
| トークン期限切れ対応 | InvalidContinuationTokenException 時に自動的にページ1へリセット |

## 機能スコープ (v0.2.0) ✅

| 機能 | 内容 |
|------|------|
| リアクション追加 | コメントにリアクションを追加（`g` キー → 絵文字選択 → Enter で送信） |
| リアクション表示 | コメント末尾にリアクションバッジを表示（例: 👍×2 🎉×1） |
| リアクション削除 | 同じリアクションを再選択でトグル削除 |
| リアクション一括取得 | PR 詳細読み込み時にリアクション情報を一括取得 |
| リアクション自動リロード | リアクション追加/削除後に自動リロード |
| エラーハンドリング | コメント削除済み、存在しないコメント、不正リアクション値等のエラー対応 |

## 機能スコープ (v0.3.0) ✅

| 機能 | 内容 |
|------|------|
| bash 補完スクリプト生成 | `--completions bash` で bash 用の補完スクリプトを標準出力に出力 |
| zsh 補完スクリプト生成 | `--completions zsh` で zsh 用の補完スクリプトを標準出力に出力 |
| fish 補完スクリプト生成 | `--completions fish` で fish 用の補完スクリプトを標準出力に出力 |
| CLI オプション補完 | `--profile`、`--region`、`--help`、`--version`、`--completions` のフラグ補完 |
| AWS プロファイル動的補完 | `--profile` 引数として `~/.aws/config` のプロファイル名を動的に補完 |
| AWS リージョン補完 | `--region` 引数として CodeCommit がサポートするリージョンを補完 |
| 不正シェル種別エラー | bash/zsh/fish 以外の値が指定された場合、エラーメッセージを stderr に出力して終了 |

## 機能スコープ (v0.4.0) ✅

| 機能 | 内容 |
|------|------|
| アクティビティタイムライン表示 | PR 詳細画面から `A` キーでアクティビティタイムライン画面を表示 |
| PR イベント取得 | `DescribePullRequestEventsCommand` でイベント一覧を取得 |
| イベント種別サポート | PR 作成・ステータス変更・ソースブランチ更新・マージ・承認ルール操作・承認状態変更など 10 種別 |
| j/k ナビゲーション | タイムライン画面でのカーソル移動 |
| ページネーション | `n` キーで次ページ（nextToken ベースの追記方式） |
| 画面遷移 | `q`/`Esc` でアクティビティ画面から PR 詳細画面に戻る |
| エラーハンドリング | アクティビティ取得失敗時のエラー表示と `q` で戻る操作 |

### 将来対応（v0.5.0 以降）

- UX 強化（シンタックスハイライト、ファイルツリー） → v0.5.0
- PR 作成・編集（独立オプション） → v0.6.0
- 安定版リリース（設定ファイル、テーマ） → v1.0.0

詳細は [docs/roadmap.md](roadmap.md) を参照。

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
