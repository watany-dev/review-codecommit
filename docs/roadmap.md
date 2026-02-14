# titmouse ロードマップ

## リリース履歴

### v0.1 — 閲覧機能 ✅

PR の閲覧に必要な基本機能を提供。

- リポジトリ一覧表示・選択
- Open 状態の PR 一覧表示・選択
- PR 詳細（タイトル、ステータス、ブランチ情報）
- 色付き unified diff 表示
- コメント閲覧
- Vim 風キーバインド（j/k ナビゲーション）
- AWS プロファイル・リージョン指定
- ヘルプ画面（`?` キー）

### v0.2 — コメント投稿 ✅

PR に対して一般コメントを投稿する機能を追加。閲覧のみだったレビューワークフローに「参加」する能力を付与。

- PR 全体への一般コメント投稿（`c` キー）
- コメント投稿後のコメント一覧自動リロード
- 投稿中のローディング表示
- エラーハンドリング（文字数制限超過、権限不足など）

---

## 今後のロードマップ

### v0.3 — Approve / Revoke ✅

**目的**: レビューの意思決定をターミナルから完結させる。

コメント投稿に続き、レビューワークフローの核となる「承認」操作を追加する。これにより、PR の閲覧→コメント→承認までをブラウザなしで完結できる。

#### 機能

| 機能 | 内容 |
|------|------|
| Approve | PR を承認する（`a` キー） |
| Revoke | 承認を取り消す（`r` キー） |
| 承認状態表示 | PR 詳細画面に承認者一覧と承認状態を表示 |
| 確認プロンプト | 操作前に確認メッセージを表示（誤操作防止） |

#### AWS SDK API

- `UpdatePullRequestApprovalState` — 承認状態の更新
- `GetPullRequestApprovalStates` — 承認状態の取得
- `EvaluatePullRequestApprovalRules` — 承認ルールの評価

#### 画面イメージ

```
┌─ PR #42: fix: login timeout ────────────────┐
│  Author: watany  Status: OPEN   2h ago       │
│  main ← feature/fix-login                    │
│  Approvals: taro ✓                           │
│──────────────────────────────────────────────│
│  (diff/コメント)                              │
│                                              │
│  ↑↓ scroll  c comment  a approve  q back     │
└──────────────────────────────────────────────┘
```

確認プロンプト:

```
│  Approve this pull request? (y/n)            │
```

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `a` | PR を承認 | PR 詳細 |
| `r` | 承認を取り消し | PR 詳細 |

#### IAM 権限追加

```json
{
  "Action": [
    "codecommit:UpdatePullRequestApprovalState",
    "codecommit:GetPullRequestApprovalStates",
    "codecommit:EvaluatePullRequestApprovalRules"
  ]
}
```

---

### v0.4 — インラインコメント ✅

**目的**: diff の特定の行にコメントを付け、精密なコードレビューを可能にする。

v0.2 の一般コメントを拡張し、ファイル・行単位のインラインコメントに対応する。コードレビューの品質を大幅に向上させる機能。

#### 機能

| 機能 | 内容 |
|------|------|
| インラインコメント投稿 | diff 表示中にカーソル位置の行へコメントを投稿（`C` キー） |
| インラインコメント表示 | diff の該当行の直下にコメントをインライン表示（💬 マーカー） |
| コメントスレッド表示 | 同一行への複数コメントをスレッド形式で表示 |
| カーソルナビゲーション | diff 行へのカーソル移動（`>` マーカー、スクロール追従） |
| CommentThread モデル | コメントをスレッド構造で管理（location で一般/インラインを区別） |

#### AWS SDK API

`PostCommentForPullRequestCommand` の `location` パラメータを使用:

```typescript
{
  pullRequestId: string;
  repositoryName: string;
  beforeCommitId: string;
  afterCommitId: string;
  content: string;
  location: {
    filePath: string;           // 対象ファイルパス
    filePosition: number;       // 行番号
    relativeFileVersion: "BEFORE" | "AFTER";  // 変更前/後
  };
}
```

#### 画面イメージ

```
│  src/auth.ts                                 │
│                                              │
│  @@ -15,7 +15,7 @@                           │
│   const config = {                           │
│ -   timeout: 3000,                           │
│ +   timeout: 10000,                          │
│   │ 💬 taro: この値はconfigから取る方が良さそう │
│   };                                         │
│                                              │
│  ↑↓ scroll  c comment  C inline  q back      │
```

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `C` (大文字) | カーソル行にインラインコメント | PR 詳細（diff 表示中） |

#### 設計上の考慮点

- diff の行とファイルパス・行番号のマッピングロジックが必要
- `formatDiff` ユーティリティの拡張（行番号トラッキング）
- コメント表示時の diff レイアウト再計算

---

### v0.5 — コメント返信 ✅

**目的**: コメントスレッドでの会話を可能にし、非同期レビューのやり取りを完結させる。

#### 機能

| 機能 | 内容 |
|------|------|
| コメント返信 | 既存コメントに返信を投稿（`inReplyTo` パラメータ） |
| スレッド表示 | 返信をインデント付きのツリー構造で表示 |
| スレッド折りたたみ | 長いスレッドの折りたたみ/展開 |

#### AWS SDK API

`PostCommentReplyCommand` を使用:

```typescript
{
  inReplyTo: string;  // 返信先コメントID
  content: string;    // 返信本文
}
```

#### 画面イメージ

```
│  Comments (4):                               │
│  watany: タイムアウトを延長しました          │
│    └ taro: 設定値は定数にしませんか？        │
│      └ watany: 次のPRで対応します            │
│  hanako: LGTMです                            │
│                                              │
│  ↑↓ scroll  c comment  R reply  q back       │
```

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `R` (大文字) | 選択中のコメントに返信 | PR 詳細（コメント上にカーソル時） |

---

### v0.6 — マージ操作

**目的**: PR の閲覧→レビュー→承認→マージの全ワークフローをターミナルで完結させる。

#### 機能

| 機能 | 内容 |
|------|------|
| マージ実行 | PR をマージする（`m` キー） |
| マージ戦略選択 | Fast-forward / Squash / Three-way merge から選択 |
| コンフリクト検出 | マージ不可の場合にコンフリクト情報を表示 |
| マージ確認 | 操作前に戦略と対象ブランチの確認プロンプト |
| PR クローズ | マージせずに PR を閉じる |

#### AWS SDK API

- `MergePullRequestByFastForward` — Fast-forward マージ
- `MergePullRequestBySquash` — Squash マージ
- `MergePullRequestByThreeWay` — Three-way マージ
- `GetMergeConflicts` — コンフリクト情報の取得
- `UpdatePullRequestStatus` — PR ステータスの更新（クローズ）

#### 画面イメージ

マージ戦略選択:

```
┌─ Merge PR #42 ─────────────────────────────┐
│                                              │
│  feature/fix-login → main                    │
│                                              │
│  Select merge strategy:                      │
│  > Fast-forward                              │
│    Squash                                    │
│    Three-way merge                           │
│                                              │
│  Enter select  Esc cancel                    │
└──────────────────────────────────────────────┘
```

最終確認:

```
│  Merge feature/fix-login into main           │
│  using fast-forward? (y/n)                   │
```

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `m` | マージ操作を開始 | PR 詳細 |
| `x` | PR をクローズ | PR 詳細 |

#### IAM 権限追加

```json
{
  "Action": [
    "codecommit:MergePullRequestByFastForward",
    "codecommit:MergePullRequestBySquash",
    "codecommit:MergePullRequestByThreeWay",
    "codecommit:GetMergeConflicts",
    "codecommit:UpdatePullRequestStatus"
  ]
}
```

---

### v0.7 — コメント編集・削除

**目的**: 投稿済みコメントの修正・削除を可能にし、レビューコメントの管理を完成させる。

#### 機能

| 機能 | 内容 |
|------|------|
| コメント編集 | 自分のコメントを編集 |
| コメント削除 | 自分のコメントを削除（確認プロンプト付き） |

#### AWS SDK API

- `UpdateComment` — コメント内容の更新
- `DeleteCommentContent` — コメント内容の削除

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `e` | 選択中のコメントを編集 | PR 詳細（自分のコメント上にカーソル時） |
| `d` | 選択中のコメントを削除 | PR 詳細（自分のコメント上にカーソル時） |

---

### v0.8 — PR ステータス管理・フィルタリング

**目的**: Open 以外の PR も扱えるようにし、PR の検索性を向上させる。

#### 機能

| 機能 | 内容 |
|------|------|
| ステータスフィルタ | Open / Closed / Merged でフィルタリング（`f` キー） |
| PR 検索 | タイトル・著者での絞り込み（`/` キー） |
| ページネーション改善 | 次ページ/前ページの読み込み |
| PR 作成日時ソート | 新しい順/古い順の切り替え |

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `f` | ステータスフィルタ切り替え | PR 一覧 |
| `/` | 検索モード | PR 一覧 |
| `n` | 次のページ | PR 一覧 |
| `p` | 前のページ | PR 一覧 |

---

## バージョン別キーバインド一覧

全バージョンのキーバインド計画をまとめる。

| キー | 動作 | 画面 | バージョン |
|------|------|------|-----------|
| `j` / `↓` | カーソル下移動 | 全画面 | v0.1 |
| `k` / `↑` | カーソル上移動 | 全画面 | v0.1 |
| `Enter` | 選択・決定 | リスト画面 | v0.1 |
| `q` / `Esc` | 戻る / キャンセル | 全画面 | v0.1 |
| `Ctrl+C` | 即座に終了 | 全画面 | v0.1 |
| `?` | ヘルプ表示 | 全画面 | v0.1 |
| `c` | コメント投稿 | PR 詳細 | v0.2 |
| `a` | Approve | PR 詳細 | v0.3 |
| `r` | Revoke | PR 詳細 | v0.3 |
| `C` | インラインコメント | PR 詳細 | v0.4 |
| `R` | コメント返信 | PR 詳細 | v0.5 |
| `m` | マージ | PR 詳細 | v0.6 |
| `x` | PR クローズ | PR 詳細 | v0.6 |
| `e` | コメント編集 | PR 詳細 | v0.7 |
| `d` | コメント削除 | PR 詳細 | v0.7 |
| `f` | ステータスフィルタ | PR 一覧 | v0.8 |
| `/` | 検索 | PR 一覧 | v0.8 |
| `n` | 次ページ | PR 一覧 | v0.8 |
| `p` | 前ページ | PR 一覧 | v0.8 |

## 優先順位の考え方

```
v0.3 Approve/Revoke  ← レビューワークフローの核。コメントの次に最も使われる操作
 │
v0.4 インラインコメント ← コードレビューの精度を大幅に向上
 │
v0.5 コメント返信    ← レビューでの会話を完結させる
 │
v0.6 マージ操作      ← ワークフロー全体をターミナルで完結
 │
v0.7 コメント編集・削除 ← コメント管理の仕上げ
 │
v0.8 フィルタ・検索   ← 大量のPRを扱うチーム向けの利便性
```

各バージョンは独立してリリース可能。v0.3〜v0.6 でレビューワークフローが完結し、v0.7〜v0.8 は利便性の向上にあたる。
