# review-codecommit 要件定義書

## 概要

AWS CodeCommit のプルリクエストをターミナルでレビューするTUIツール。

## 起動方法

```
npx review-codecommit                        # リポジトリ一覧から選択
npx review-codecommit <repo-name>            # リポジトリ指定で起動
npx review-codecommit --profile <name>       # AWSプロファイル指定
npx review-codecommit --region <region>      # リージョン指定
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

### 将来対応

- マージ操作 → v0.6
- コメント編集・削除 → v0.7
- フィルタ・検索 → v0.8

詳細は [docs/roadmap.md](roadmap.md) を参照。

## キーバインド

| キー | 動作 | 画面 |
|------|------|------|
| `j` / `↓` | カーソル下移動 | 全画面（コメント入力中・確認プロンプト中は無効） |
| `k` / `↑` | カーソル上移動 | 全画面（コメント入力中・確認プロンプト中は無効） |
| `Enter` | 選択・決定 / コメント送信 | リスト画面 / コメント入力 |
| `q` / `Esc` | 前の画面に戻る / コメント入力キャンセル | 全画面 / コメント入力 |
| `Ctrl+C` | 即座に終了 | 全画面 |
| `?` | ヘルプ表示 | 全画面（コメント入力中・確認プロンプト中は無効） |
| `c` | コメント入力モード開始 | PR詳細画面 |
| `C` | インラインコメント投稿（カーソル行） | PR詳細画面（diff行上のみ） |
| `R` | コメント返信（カーソル行のコメントに返信） | PR詳細画面（コメント行上のみ） |
| `o` | スレッド折りたたみ/展開切替 | PR詳細画面（コメント行上のみ） |
| `a` | PR を承認（確認プロンプト表示） | PR詳細画面 |
| `r` | 承認を取り消し（確認プロンプト表示） | PR詳細画面 |

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
┌─ review-codecommit ─ my-service ────────────┐
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
│  Approvals: taro ✓                           │
│  Rules: ✓ Approved (1/1 rules satisfied)     │
│──────────────────────────────────────────────│
│  src/auth.ts                                 │
│                                              │
│  @@ -15,7 +15,7 @@                           │
│   const config = {                           │
│ > -   timeout: 3000,                         │
│     💬 taro: この値はconfigから取る方が良さそう │
│        └ watany: 次のPRで修正します           │
│   +   timeout: 10000,                        │
│   };                                         │
│                                              │
│──────────────────────────────────────────────│
│  Comments (3):                               │
│  watany: タイムアウトを延長しました          │
│     └ taro: LGTMです                         │
│     └ hanako: 他も確認してください            │
│                                              │
│  ↑↓ cursor  c comment  C inline  R reply     │
│  o fold  a approve  r revoke  q back  ? help │
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

## テスト戦略

| レイヤー | 方針 |
|----------|------|
| AWS SDK | `vitest.mock` でモック。実際のAPIは呼ばない |
| ビジネスロジック | diff整形、日付フォーマット等の純粋関数をユニットテスト |
| TUI層 | Ink の `render` によるスナップショットテスト (ink-testing-library) |
