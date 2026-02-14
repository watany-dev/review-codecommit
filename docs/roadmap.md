# review-codecommit ロードマップ

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

### v0.6 — マージ操作 ✅

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

### v0.6.1 — コミット単位レビュー ✅

**目的**: 大きな PR でも各コミットの意図を追いやすくし、レビュー品質を向上させる。

#### 機能

| 機能 | 内容 |
|------|------|
| コミット一覧取得 | `GetCommitCommand` で親コミットを辿り、PR のコミット一覧を取得 |
| ビュー切り替え | Tab / Shift+Tab で All changes ↔ 各コミット diff を切り替え |
| コミット diff 表示 | コミット単位の差分を既存の diff 表示で表示 |
| コミットメタデータ | タブヘッダーにハッシュ、メッセージ、著者、日時を表示 |
| 遅延ロード | コミット diff はオンデマンドで取得（ローディング表示付き） |

#### AWS SDK API

- `GetCommitCommand` — コミットメタデータの取得
- `GetDifferencesCommand` — コミット間の差分取得（既存 API の再利用）
- `GetBlobCommand` — Blob コンテンツ取得（既存 API の再利用）

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `Tab` | 次のビューへ切り替え（循環） | PR 詳細 |
| `Shift+Tab` | 前のビューへ切り替え（循環） | PR 詳細 |

---

### v0.7 — コメント編集・削除 ✅

**目的**: 投稿済みコメントの修正・削除を可能にし、レビューコメントの管理を完成させる。

#### 機能

| 機能 | 内容 |
|------|------|
| コメント編集 | 自分のコメントを編集（`e` キー → 既存内容プリフィル → Enter で更新） |
| コメント削除 | コメントを削除（`d` キー → 確認プロンプト → `y` で実行） |
| 編集後のリロード | コメント更新後にコメント一覧を自動リロード |
| 削除後のリロード | コメント削除後にコメント一覧を自動リロード |
| エラーハンドリング | 権限不足、他人のコメント編集不可、削除済みコメント等のエラー対応 |

#### AWS SDK API

- `UpdateCommentCommand` — コメント内容の更新（作成者のみ実行可能）
- `DeleteCommentContentCommand` — コメント内容の削除（ソフトデリート、IAM 権限のみで制御）

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `e` | 選択中のコメントを編集 | PR 詳細（コメント行上にカーソル時） |
| `d` | 選択中のコメントを削除 | PR 詳細（コメント行上にカーソル時） |

#### IAM 権限追加

```json
{
  "Action": [
    "codecommit:UpdateComment",
    "codecommit:DeleteCommentContent"
  ]
}
```

詳細は [docs/design-comment-edit-delete.md](design-comment-edit-delete.md) を参照。

---

### v0.8 — PR ステータス管理・フィルタリング ✅

**目的**: Open 以外の PR も扱えるようにし、PR の検索性を向上させる。

#### 機能

| 機能 | 内容 |
|------|------|
| ステータスフィルタ | Open / Closed / Merged でフィルタリング（`f` キーでサイクル） |
| PR 検索 | タイトル・著者名でのクライアントサイド絞り込み（`/` キー） |
| ページネーション | 次ページ/前ページのトークンベース読み込み（`n`/`p` キー） |
| PR ステータスバッジ | Closed / Merged の PR にバッジ表示 |
| トークン期限切れ対応 | InvalidContinuationTokenException 時に自動的にページ1へリセット |

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `f` | ステータスフィルタ切り替え（OPEN→CLOSED→MERGED→OPEN） | PR 一覧 |
| `/` | 検索モード（Esc でクリア） | PR 一覧 |
| `n` | 次のページ | PR 一覧 |
| `p` | 前のページ | PR 一覧 |

#### AWS SDK API

- `ListPullRequestsCommand` — `pullRequestStatus: "OPEN" | "CLOSED"` パラメータ追加
- `GetPullRequestCommand` — `mergeMetadata.isMerged` で MERGED/CLOSED を判別

詳細は [docs/design-status-filter.md](design-status-filter.md) を参照。

---

## v0.2.0 以降のロードマップ

v0.1〜v0.8 で PR レビューの基本ワークフロー（閲覧→コメント→承認→マージ）が完成する。v0.2.0 以降はレビュー体験の強化・開発者体験の向上を優先し、その後に PR 作成・編集を独立オプションとして追加する。

---

### v0.2.0 — リアクション ✅

**目的**: 絵文字リアクションでレビューの軽量なフィードバックを可能にする。

コメントへの「👍」「👎」「🎉」等のリアクションは、テキストを書かずに意思を示す手段として広く使われている。LGTM の代替としても有効。

#### 機能

| 機能 | 内容 |
|------|------|
| リアクション追加 | コメントにリアクションを付ける（`g` キー → 絵文字選択） |
| リアクション表示 | コメント末尾にリアクションバッジを表示（例: 👍×2 🎉×1） |
| リアクション削除 | 自分のリアクションを取り消し（同じリアクションを再選択でトグル） |

#### AWS SDK API

- `PutCommentReactionCommand` — リアクションの追加（トグル動作）
- `GetCommentReactionsCommand` — リアクション一覧の取得

#### 画面イメージ

```
│  Comments (3):                               │
│  watany: タイムアウトを延長しました  👍×2     │
│    └ taro: LGTM 🎉×1                         │
│  hanako: テスト追加をお願いします             │
│                                              │
│  ↑↓ scroll  g react  c comment  q back       │
```

リアクション選択:

```
│  Select reaction:                            │
│  > 👍  👎  😄  🎉  😕  ❤️  🚀  👀           │
```

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `g` | リアクション追加/削除 | PR 詳細（コメント行上のみ） |

---

### v0.3.0 — シェル補完

**目的**: CLI としての基本的な開発者体験を向上させる。

ターミナルツールとして、タブ補完は最も基本的な利便性。`--profile`、`--region` 等のオプション補完とサブコマンド補完を提供する。

#### 機能

| 機能 | 内容 |
|------|------|
| bash 補完 | bash 用の補完スクリプト生成（`--completions bash`） |
| zsh 補完 | zsh 用の補完スクリプト生成（`--completions zsh`） |
| fish 補完 | fish 用の補完スクリプト生成（`--completions fish`） |
| オプション補完 | `--profile`、`--region` のフラグ補完 |
| AWS プロファイル補完 | `~/.aws/config` からプロファイル名を動的に補完 |

#### 使用イメージ

```bash
# 補完スクリプトの生成
npx review-codecommit --completions bash > ~/.bash_completion.d/review-codecommit
npx review-codecommit --completions zsh > ~/.zsh/completions/_review-codecommit

# 使用例
npx review-codecommit --profile <Tab>
#=> dev  staging  production

npx review-codecommit --region <Tab>
#=> ap-northeast-1  us-east-1  eu-west-1
```

#### 設計上の考慮点

- 外部ライブラリ不要。テンプレート文字列でシェルスクリプトを生成する軽量実装
- AWS プロファイル補完は `~/.aws/config` のパースで実現

---

### v0.4.0 — アクティビティ・自動更新

**目的**: PR の経過をタイムラインで把握し、リアルタイムに近いレビュー体験を提供する。

#### 機能

| 機能 | 内容 |
|------|------|
| アクティビティタイムライン | PR のイベント履歴を時系列で表示（`A` キー） |
| イベント種別表示 | コメント / 承認 / マージ / ステータス変更等のアイコン付き表示 |
| 自動リフレッシュ | PR 詳細画面で定期的にコメント・承認状態を再取得（ポーリング） |
| リフレッシュインジケータ | 新しいコメントがある場合にバッジで通知 |

#### AWS SDK API

- `DescribePullRequestEventsCommand` — PR イベント履歴の取得

#### 画面イメージ

```
┌─ PR #42: Activity ─────────────────────────┐
│                                              │
│  📝 watany created PR              2h ago    │
│  💬 taro commented                 1h ago    │
│  ✅ taro approved                  45m ago   │
│  💬 hanako commented               30m ago   │
│  🔀 watany merged (fast-forward)   10m ago   │
│                                              │
│  ↑↓ scroll  q back                           │
└──────────────────────────────────────────────┘
```

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `A` | アクティビティタイムライン表示 | PR 詳細 |

---

### v0.5.0 — UX 強化

**目的**: diff の可読性とファイル単位のナビゲーションを大幅に向上させる。

#### 機能

| 機能 | 内容 |
|------|------|
| シンタックスハイライト | diff 内のコードをファイル拡張子に応じて色付け表示 |
| ファイルツリー | PR 内の変更ファイルをツリー表示し、ファイル間をジャンプ（`t` キー） |
| diff 統計 | ファイル別・合計の追加行/削除行数を表示 |
| ファイルジャンプ | ファイルツリーで選択したファイルの diff 位置へ直接移動 |

#### 画面イメージ

ファイルツリー:

```
┌─ PR #42: Files (5) ────────────────────────┐
│  +12 -3   src/auth.ts                       │
│  +45 -0   src/auth.test.ts                  │
│  +2  -2   src/config.ts                     │
│  +8  -1   src/types.ts                      │
│  +1  -1   package.json                      │
│                                              │
│  Total: +68 -7                               │
│                                              │
│  ↑↓ navigate  Enter jump  q back             │
└──────────────────────────────────────────────┘
```

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `t` | ファイルツリー表示 | PR 詳細 |

#### 設計上の考慮点

- シンタックスハイライトは最小依存の方針と要相談。軽量なトークンベースの着色か、外部ライブラリの導入を検討
- ファイルツリーは既存の `formatDiff` のファイル情報から構築可能

---

### v0.6.0 — PR 作成・編集（独立オプション）

**目的**: PR の作成・編集をレビュー機能とは独立したオプションとして提供する。

レビュー機能とは完全に分離された CLI オプション（`--create` / `--edit`）として実装する。既存のレビューフローに影響を与えず、必要な人だけが使える設計。

#### 機能

| 機能 | 内容 |
|------|------|
| PR 新規作成 | `--create` オプション、または PR 一覧画面から `N` キー |
| ブランチ一覧 | ソース・デスティネーションブランチをリストから選択 |
| PR タイトル編集 | 既存 PR のタイトルを編集（`E` キー → `t` 選択） |
| PR 説明編集 | 既存 PR の説明を編集（`E` キー → `d` 選択） |

#### CLI オプション

```bash
# 独立オプションとして直接 PR 作成
npx review-codecommit --create
npx review-codecommit --create --repo my-service

# 既存のレビューフロー内からも N キーでアクセス可能
```

#### AWS SDK API

- `CreatePullRequestCommand` — PR の新規作成
- `UpdatePullRequestTitleCommand` — PR タイトルの更新
- `UpdatePullRequestDescriptionCommand` — PR 説明の更新
- `ListBranchesCommand` — ブランチ一覧の取得

#### 画面イメージ

PR 作成画面:

```
┌─ Create Pull Request ──────────────────────┐
│                                              │
│  Source branch:                              │
│  > feature/add-auth                          │
│    feature/fix-login                         │
│    bugfix/timeout                            │
│                                              │
│  ↑↓ navigate  Enter select  Esc cancel       │
└──────────────────────────────────────────────┘
```

タイトル・説明入力:

```
┌─ Create Pull Request ──────────────────────┐
│                                              │
│  feature/add-auth → main                     │
│                                              │
│  Title: Add authentication module            │
│  Description: (Enter to open editor)         │
│                                              │
│  Enter submit  Esc cancel                    │
└──────────────────────────────────────────────┘
```

#### キーバインド追加

| キー | 動作 | 画面 |
|------|------|------|
| `N` | PR 新規作成 | PR 一覧 |
| `E` | PR タイトル/説明を編集 | PR 詳細 |

#### IAM 権限追加

```json
{
  "Action": [
    "codecommit:CreatePullRequest",
    "codecommit:UpdatePullRequestTitle",
    "codecommit:UpdatePullRequestDescription",
    "codecommit:ListBranches"
  ]
}
```

#### 設計上の考慮点

- レビュー機能とは完全に独立。`--create` は単独で動作し、レビュー画面を経由しなくても PR を作成できる
- 既存のレビューフロー（PR 一覧画面）からも `N` キーでアクセス可能にし、両方の導線を用意

---

### v1.0.0 — 安定版リリース

**目的**: 設定基盤と安定性を確立し、正式な v1.0 をリリースする。

#### 機能

| 機能 | 内容 |
|------|------|
| 設定ファイル | `.reviewcommitrc` (JSON/YAML) による設定永続化 |
| デフォルトリポジトリ | カレントディレクトリの git remote から自動判定 |
| キーバインドカスタマイズ | 設定ファイルでキーバインドを変更可能 |
| テーマ | カラースキームの切り替え（ダーク/ライト/カスタム） |
| パフォーマンス最適化 | API レスポンスキャッシュ、遅延ロードの全面適用 |

#### 画面イメージ

設定ファイル例:

```json
{
  "defaultRegion": "ap-northeast-1",
  "defaultProfile": "dev",
  "theme": "dark",
  "keybindings": {
    "approve": "a",
    "comment": "c"
  },
  "autoRefresh": {
    "enabled": true,
    "intervalSeconds": 30
  }
}
```

#### 設計上の考慮点

- 設定ファイルの探索順序: `./.reviewcommitrc` → `~/.config/review-codecommit/config.json` → `~/.reviewcommitrc`
- v1.0 はセマンティックバージョニングにおける「安定 API」を意味するため、キーバインドや CLI オプションの後方互換性を保証する

---

## v0.2.0 以降の優先順位

```
v0.2.0 リアクション        ← 軽量フィードバック。実装コストが低く、UX 向上効果が高い
 │
v0.3.0 シェル補完          ← CLI としての基本的な開発者体験。早期に入れたい
 │
v0.4.0 アクティビティ      ← PR の経過把握と自動更新。チームでのリアルタイムレビュー
 │
v0.5.0 UX 強化            ← diff の可読性とナビゲーション。レビュー品質の底上げ
 │
v0.6.0 PR 作成・編集      ← レビューとは独立したオプション。PR ライフサイクル全体をカバー
 │
v1.0.0 安定版              ← 設定基盤・パフォーマンス・後方互換保証
```

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
| `Tab` | 次のビューへ切り替え | PR 詳細 | v0.6.1 |
| `Shift+Tab` | 前のビューへ切り替え | PR 詳細 | v0.6.1 |
| `e` | コメント編集 | PR 詳細 | v0.7 |
| `d` | コメント削除 | PR 詳細 | v0.7 |
| `f` | ステータスフィルタ | PR 一覧 | v0.8 |
| `/` | 検索 | PR 一覧 | v0.8 |
| `n` | 次ページ | PR 一覧 | v0.8 |
| `p` | 前ページ | PR 一覧 | v0.8 |
| `g` | リアクション | PR 詳細 | v0.2.0 |
| `A` | アクティビティ表示 | PR 詳細 | v0.4.0 |
| `t` | ファイルツリー | PR 詳細 | v0.5.0 |
| `N` | PR 新規作成 | PR 一覧 | v0.6.0 |
| `E` | PR タイトル/説明編集 | PR 詳細 | v0.6.0 |

## 優先順位の考え方

### v0.1.0 まで（レビューワークフローの完成）

```
v0.1 閲覧機能         ← PR を読む基盤
 │
v0.2 コメント投稿      ← レビューに「参加」する
 │
v0.3 Approve/Revoke   ← レビューワークフローの核
 │
v0.4 インラインコメント ← コードレビューの精度を大幅に向上
 │
v0.5 コメント返信      ← レビューでの会話を完結させる
 │
v0.6 マージ操作        ← ワークフロー全体をターミナルで完結
 │
v0.6.1 コミット単位レビュー ← 大きなPRのレビュー品質を向上
 │
v0.7 コメント編集・削除 ← コメント管理の仕上げ
 │
v0.8 フィルタ・検索    ← 大量のPRを扱うチーム向けの利便性
```

### v0.2.0 以降（レビュー体験の強化と PR ライフサイクルの拡張）

```
v0.2.0 リアクション     ← 軽量フィードバック。実装コストが低く効果が高い
 │
v0.3.0 シェル補完       ← CLI の開発者体験。早期に入れたい基本機能
 │
v0.4.0 アクティビティ   ← PR の経過把握とリアルタイム更新
 │
v0.5.0 UX 強化         ← diff の可読性とナビゲーション向上
 │
v0.6.0 PR 作成・編集    ← レビューとは独立したオプション
 │
v1.0.0 安定版           ← 設定基盤・パフォーマンス・後方互換保証
```

各バージョンは独立してリリース可能。v0.1.0 まででレビューワークフローが完結する。v0.2.0〜v0.5.0 はレビュー体験の強化と開発者体験の向上、v0.6.0 で PR 作成・編集を独立オプションとして追加、v1.0.0 で安定版をリリースする。
