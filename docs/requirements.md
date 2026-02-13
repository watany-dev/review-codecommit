# titmouse 要件定義書

## 概要

AWS CodeCommit のプルリクエストをターミナルでレビューするTUIツール。

## 起動方法

```
npx titmouse                        # リポジトリ一覧から選択
npx titmouse <repo-name>            # リポジトリ指定で起動
npx titmouse --profile <name>       # AWSプロファイル指定
npx titmouse --region <region>      # リージョン指定
```

## 技術スタック

| 項目 | 選択 |
|------|------|
| パッケージ名 | `titmouse` |
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

### 将来対応

- Approve / Revoke → v0.3
- インラインコメント → v0.4
- コメント返信 → v0.5
- マージ操作 → v0.6
- コメント編集・削除 → v0.7
- フィルタ・検索 → v0.8

詳細は [docs/roadmap.md](roadmap.md) を参照。

## キーバインド

| キー | 動作 | 画面 |
|------|------|------|
| `j` / `↓` | カーソル下移動 | 全画面（コメント入力中は無効） |
| `k` / `↑` | カーソル上移動 | 全画面（コメント入力中は無効） |
| `Enter` | 選択・決定 / コメント送信 | リスト画面 / コメント入力 |
| `q` / `Esc` | 前の画面に戻る / コメント入力キャンセル | 全画面 / コメント入力 |
| `Ctrl+C` | 即座に終了 | 全画面 |
| `?` | ヘルプ表示 | 全画面（コメント入力中は無効） |
| `c` | コメント入力モード開始 | PR詳細画面 |

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
┌─ titmouse ──────────────────────────────────┐
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
┌─ titmouse ─ my-service ─────────────────────┐
│                                              │
│  Open Pull Requests (3):                     │
│                                              │
│  > #42  fix: login timeout   watany  2h ago  │
│    #41  feat: add search     taro    1d ago  │
│    #38  chore: deps update   bot     3d ago  │
│                                              │
│  ↑↓ navigate  Enter view  q back             │
└──────────────────────────────────────────────┘
```

### 3. PR詳細画面 (diff)

```
┌─ PR #42: fix: login timeout ────────────────┐
│  Author: watany  Status: OPEN   2h ago       │
│  main ← feature/fix-login                    │
│──────────────────────────────────────────────│
│  src/auth.ts                                 │
│                                              │
│  @@ -15,7 +15,7 @@                           │
│   const config = {                           │
│ -   timeout: 3000,                           │
│ +   timeout: 10000,                          │
│   };                                         │
│                                              │
│──────────────────────────────────────────────│
│  Comments (2):                               │
│  watany: タイムアウトを延長しました          │
│  taro: LGTMです                              │
│                                              │
│  ↑↓ scroll  c comment  q back  ? help          │
└──────────────────────────────────────────────┘
```

## diff表示仕様

- **形式**: unified diff (`git diff` 同等)
- **色付け**: 追加行=緑、削除行=赤、コンテキスト行=デフォルト
- **構造**: ファイル単位でセクション分け

## ページネーション

| 画面 | 取得件数 | 表示方式 |
|------|----------|----------|
| リポジトリ一覧 | 最大100件 | スクロール |
| PR一覧 | OPEN のみ、最大25件ずつ | スクロール |
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

## テスト戦略

| レイヤー | 方針 |
|----------|------|
| AWS SDK | `vitest.mock` でモック。実際のAPIは呼ばない |
| ビジネスロジック | diff整形、日付フォーマット等の純粋関数をユニットテスト |
| TUI層 | Ink の `render` によるスナップショットテスト (ink-testing-library) |
