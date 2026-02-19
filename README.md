# review-codecommit

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

AWS CodeCommit のプルリクエストをターミナルで快適にレビューできる TUI ツール。[Ink](https://github.com/vadimdemedes/ink)（React for CLI）製。

## Overview

リポジトリ選択 → PR 一覧 → PR 詳細の 3 画面構成で、diff・コメント・承認・マージをターミナルから操作できます。

```
Start
 │
 ├─ 引数あり ──────────────────────┐
 │                                  ▼
 └─ 引数なし ──→ [1. Repo List] ──→ [2. PR List] ──→ [3. PR Detail] ──→ [4. Activity Timeline]
                    │                   │                  │                       │
                    │ q/Esc: 終了       │ q/Esc: 1         │ q/Esc: 2              │ q/Esc: 3
```

## Quick Start

```bash
# 1. インストール
bun install -g review-codecommit

# 2. 起動
review-codecommit
```

npx でも実行可能：

```bash
npx review-codecommit
```

## Prerequisites

### Runtime

[Bun](https://bun.sh/) が必要です。

### AWS 認証

`aws configure` または環境変数（`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION`）で設定してください。

### IAM 権限

| 操作 | 必要な権限 |
|------|-----------|
| 基本閲覧（リポジトリ・PR・diff） | `codecommit:ListRepositories`, `codecommit:GetRepository`, `codecommit:ListPullRequests`, `codecommit:GetPullRequest`, `codecommit:GetCommit`, `codecommit:GetDifferences` |
| コメント閲覧・投稿 | `codecommit:GetCommentsForPullRequest`, `codecommit:PostCommentForPullRequest`, `codecommit:PostCommentReply` |
| コメント編集・削除 | `codecommit:UpdateComment`, `codecommit:DeleteCommentContent` |
| リアクション | `codecommit:PutCommentReaction`, `codecommit:GetCommentReactions` |
| 承認操作 | `codecommit:UpdatePullRequestApprovalState`, `codecommit:GetPullRequestApprovalStates`, `codecommit:EvaluatePullRequestApprovalRules` |
| マージ・クローズ | `codecommit:MergePullRequestByFastForward`, `codecommit:MergePullRequestBySquash`, `codecommit:MergePullRequestByThreeWay`, `codecommit:GetMergeConflicts`, `codecommit:UpdatePullRequestStatus` |
| アクティビティ閲覧 | `codecommit:DescribePullRequestEvents` |

## Usage

```bash
# リポジトリ選択画面から起動
review-codecommit

# 指定リポジトリの PR 一覧へ直接ジャンプ
review-codecommit <repo-name>

# AWS プロファイルを指定
review-codecommit --profile <profile-name>

# AWS リージョンを指定
review-codecommit --region <region>

# シェル補完スクリプトを生成
review-codecommit --completions bash|zsh|fish
```

## Features

### PR 閲覧・ナビゲーション

- リポジトリ一覧から選択して PR 一覧へ移動
- ステータスフィルタ切替（Open / Closed / Merged、`f` キー）
- タイトル・著者での絞り込み検索（`/` キー）
- PR 一覧のページネーション（`n`/`p` キー）
- カラーコード付き unified diff 表示（追加: 緑、削除: 赤）
- コミット単位でのレビュー（Tab/Shift+Tab でコミット切替）
- カーソル付き diff ナビゲーション（`>` マーカー）
- PR アクティビティタイムライン（作成・承認・マージ等、`A` キー）

### コメント操作

- PR 全体へのコメント投稿（`c` キー）
- diff の特定行へのインラインコメント投稿（`C` キー）
- コメントへの返信・スレッド表示（`R` キー）
- コメント編集（`e` キー、内容を事前入力した状態で開く）
- コメント削除（`d` キー、確認プロンプトあり）
- 長いスレッドの折りたたみ/展開（`o` キー、4 件以上は自動折りたたみ）

### リアクション

- コメントへの絵文字リアクション（`g` キー）
- 8 種類対応: 👍 👎 😄 🎉 😕 ❤️ 🚀 👀
- リアクション数バッジ表示（例: `👍×2 🎉×1`）

### Approve・Merge・Close

- PR の Approve / 取消し（`a`/`r` キー、確認プロンプトあり）
- 承認状況・承認ルール評価の表示
- マージ戦略選択（Fast-forward / Squash / Three-way、`m` キー）
- マージ前のコンフリクト検出・表示
- マージなしでの PR クローズ（`x` キー）

## Keybindings

### 共通

| キー | 操作 |
|------|------|
| `j` / `↓` | カーソルを下へ |
| `k` / `↑` | カーソルを上へ |
| `q` / `Esc` | 前の画面へ戻る / キャンセル |
| `?` | ヘルプの表示・非表示 |
| `Ctrl+C` | 即時終了 |

### PR 一覧

| キー | 操作 |
|------|------|
| `f` | ステータスフィルタ切替（Open → Closed → Merged） |
| `/` | タイトル・著者で検索（Esc でクリア） |
| `n` / `p` | 次ページ / 前ページ |
| `Enter` | PR 詳細を開く |

### PR 詳細

| キー | 操作 |
|------|------|
| `Ctrl+d` / `Ctrl+u` | 半ページ下 / 上 |
| `G` | 最下部へジャンプ |
| `Tab` / `Shift+Tab` | 次のビュー / 前のビュー（全変更 ↔ コミット単位） |
| `c` | PR へコメント投稿 |
| `C` | カーソル行へインラインコメント投稿 |
| `R` | コメントへ返信 |
| `o` | スレッドの折りたたみ切替 |
| `e` | コメントを編集 |
| `d` | コメントを削除 |
| `g` | リアクション絵文字ピッカーを開く |
| `a` | PR を Approve |
| `r` | Approve を取消し |
| `m` | PR をマージ |
| `x` | PR をクローズ |
| `A` | アクティビティタイムラインを表示 |
| `Enter` | コメントを送信 |

### リアクションピッカー

| キー | 操作 |
|------|------|
| `h` / `←` | 前のリアクションへ |
| `l` / `→` | 次のリアクションへ |
| `Enter` | リアクションを選択 |

## Shell Completion

CLI オプション・AWS プロファイル・リージョンのタブ補完に対応しています。

```bash
# Bash
review-codecommit --completions bash > ~/.bash_completion.d/review-codecommit
# または .bashrc に追記:
echo 'eval "$(review-codecommit --completions bash)"' >> ~/.bashrc

# Zsh
review-codecommit --completions zsh > ~/.zsh/completions/_review-codecommit
# または .zshrc に追記:
echo 'eval "$(review-codecommit --completions zsh)"' >> ~/.zshrc

# Fish
review-codecommit --completions fish > ~/.config/fish/completions/review-codecommit.fish
```

補完対象: CLI オプション / AWS プロファイル名（`~/.aws/config` から動的読み込み）/ AWS CodeCommit 対応リージョン（25+）

## Development

### Tech Stack

| カテゴリ | 選定 |
|---------|------|
| ランタイム | Bun |
| 言語 | TypeScript |
| TUI フレームワーク | Ink（React for CLI） |
| AWS SDK | @aws-sdk/client-codecommit v3 |
| テスト | Vitest |
| リンター | oxlint |

### コマンド

```bash
bun install           # 依存関係のインストール
bun run test          # テスト実行
bun run test:watch    # テストをウォッチモードで実行
bun run lint          # リント
bun run check         # TypeScript 型チェック
bun run build         # プロダクションビルド
bun run ci            # CI と同等のすべてのチェックをローカルで実行
```

コミット前は必ず `bun run ci` を実行してください。

## Roadmap

| バージョン | 内容 | 状態 |
|-----------|------|------|
| v0.1.0 | 完全なレビューワークフロー初回安定版 | ✅ リリース済み（2026-02-15） |

詳細は [docs/roadmap.md](docs/roadmap.md) を参照。

## Release Process

npm への公開は GitHub Actions（Trusted Publishers / OIDC）で自動化されています。

### リリース手順

1. `package.json` の `version` を更新（[semver](https://semver.org/) に従う）
2. ロックファイルを更新: `bun install`
3. CI チェックをローカルで実行: `bun run ci`
4. 変更をコミット: `git commit -m "chore: bump version to X.Y.Z"`
5. git タグを作成: `git tag vX.Y.Z`
6. タグをプッシュ: `git push origin main vX.Y.Z`

GitHub Actions が自動的にビルド・テストを再実行し、npm へプロビナンス付きでパブリッシュします。

### 公開後の確認

```bash
npx review-codecommit@X.Y.Z --version
```

npmjs.com で "Provenance" バッジが表示されていることを確認してください。

## License

[MIT](LICENSE)
