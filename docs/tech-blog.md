# ターミナルを離れずに AWS CodeCommit をレビューできる TUI ツールを作った

## はじめに

AWS CodeCommit のプルリクエストをレビューするとき、ブラウザを開いてマネジメントコンソールに移動するのが地味に面倒だと感じていました。コードを書いているときはターミナルに集中しているのに、レビューのたびにコンテキストスイッチが発生する。

そこで作ったのが **review-codecommit**です。ターミナル上で完結する AWS CodeCommit PR レビュー TUI ツールです。

```
$ review-codecommit my-repo
```

これだけで、リポジトリの PR 一覧が表示され、diff の閲覧からコメント投稿・Approve・マージまで、ターミナルを一切離れずに完結します。

## 技術スタック

| カテゴリ | 選択 |
|---|---|
| ランタイム | Bun |
| 言語 | TypeScript |
| TUI フレームワーク | Ink (React for CLI) |
| AWS SDK | @aws-sdk/client-codecommit v3 |
| テスト | Vitest |
| リンター | oxlint |
| フォーマッター | Biome |

特筆すべきは **Ink** の採用です。Ink は React のコンポーネントモデルをターミナル UI に持ち込んだフレームワークで、`useState` や `useEffect` などの React フックがそのまま使えます。複雑な TUI をイベントループとエスケープシーケンスで手書きする必要がなく、宣言的に UI を組み立てられます。

## 主な機能

### PR ブラウジング

```
[1. Repo List] → [2. PR List] → [3. PR Detail] → [4. Activity Timeline]
```

4 画面構成のシンプルなフロー。Vim ライクな `j`/`k` ナビゲーション、ステータスフィルタ（Open / Closed / Merged）、タイトルや作者でのインクリメンタルサーチ、トークンベースのページネーションをサポートしています。

### カラー付き diff 表示

追加行は緑、削除行は赤で表示。`>` マーカーでカーソル行を示し、`Ctrl+d`/`Ctrl+u` でハーフページスクロール、`G` で末尾へジャンプできます。

「All changes」ビューと個別コミットビューを `Tab`/`Shift+Tab` で切り替えられるため、コミット単位でのレビューも可能です。

### コメントシステム

インライン・スレッド・返信の3層構造です。

- `c` — PR 全体へのコメント投稿
- `C` — カーソル行へのインラインコメント投稿
- `R` — スレッドへの返信
- `e` — コメント編集（既存内容をプリフィル）
- `d` — 削除（確認プロンプト付き）
- `o` — スレッドの折りたたみ/展開（4件以上で自動折りたたみ）

### リアクション

`g` キーでリアクションピッカーを開き、8種類の絵文字（👍👎😄🎉😕❤️🚀👀）をコメントに付与できます。コメント行には `👍×2 🎉×1` のようなバッジが表示されます。

### Approve・マージ・クローズ

```
a → Approve（確認プロンプト）
r → Revoke approval
m → Merge（Fast-forward / Squash / Three-way を選択）
x → Close without merge
```

マージ前に競合を検出し、競合があれば画面に表示してからマージをブロックします。Approval Rule の評価結果もリアルタイムで確認できます。

### Activity Timeline（v0.4 新機能）

`A` キーで PR のイベント履歴を時系列で表示します。

対応イベントは10種類:

- PR 作成・ステータス変更（open/close）
- ソースブランチ更新
- マージ状態変更
- Approval Rule 作成・削除・更新・オーバーライド
- Approval リセット・Approve/Revoke

各イベントにはアイコン、アクター名、説明文、相対時刻が表示されます。`n` キーで追加ページをロード（既存イベントを保持したまま末尾追記）。

## 実装のポイント

### useAsyncAction フック

非同期操作の `isProcessing`/`error` 管理を共通化しました。コメント投稿、Approve、マージなど至る所で同じパターンが繰り返されていたので、フックとして抽出しています。

```typescript
const { isProcessing, error, run } = useAsyncAction();

// 使用側は run() を呼ぶだけ
await run(() => postComment(prId, content));
```

### buildDisplayLines のメモ化

PR Detail 画面では、diff 行・コメント行・リアクション行を合成した `DisplayLine[]` を構築します。カーソル移動のたびに再計算すると重いので、`useMemo` でメモ化。カーソル位置の変化は `DisplayLine` のフラグ更新のみで対応し、配列の再構築を避けています。

### mapWithLimit による並列制御

PR の diff 取得では複数ファイルのブロブを並列取得しますが、Lambda の同時実行制限のような問題を避けるため、同時実行数を制限するユーティリティ `mapWithLimit` を実装しています。

```typescript
// 同時実行数 5 で並列処理
const results = await mapWithLimit(files, 5, async (file) => {
  return getBlobContent(file.blobId);
});
```

このユーティリティには fast-check でプロパティベーステストを書いており、任意の入力に対して「結果の順序が入力と一致する」「並列数が制限を超えない」を検証しています。

### エラーメッセージのサニタイズ

AWS SDK のエラーには ARN、アカウント ID、アクセスキーなどの機密情報が含まれることがあります。`formatErrorMessage` は文脈（comment / approval / merge / activity など）ごとに適切なメッセージを返しつつ、正規表現でこれらの機密情報を除去します。

## テスト戦略

カバレッジ 95% 以上を CI の必須要件としています。

**ユニットテスト**: Vitest + ink-testing-library でコンポーネントのレンダリングと操作をテスト。AWS SDK は vi.mock でモック。

**スナップショットテスト**: TUI コンポーネントの出力をスナップショットで固定。リグレッションを即検出。

**プロパティベーステスト**: `mapWithLimit` や `formatErrorMessage` のサニタイズ処理に fast-check を採用。「任意の入力でも機密情報が出力に含まれない」をランダムデータで検証。

## 開発プロセス

**TDD サイクル**（Red → Green → Refactor）でイテレーションを刻み、各機能を 1 コミットで完結させています。

機能変更の前に「Tidy First?」を自問するのも習慣にしています。Kent Beck の考え方で、構造的な整理（tidying）と機能変更を別コミットに分けることで、diff がシンプルになりレビューしやすくなります。

CI は `bun run ci` 1 コマンドで全チェックをローカル再現できます:

```bash
bun run ci
# lint → format:check → check → dead-code → audit → test:coverage → build
```

プッシュ前に必ずこれを回す習慣で、GitHub Actions で CI が落ちることをほぼゼロにできています。

## インストール

```bash
bun install -g review-codecommit
# または
npx review-codecommit
```

AWS の認証情報（`aws configure` または環境変数）と、必要な IAM 権限を設定すれば動きます。特定のプロファイルやリージョンを指定することも可能:

```bash
review-codecommit --profile staging --region ap-northeast-1
```

シェル補完（bash / zsh / fish）も生成できます:

```bash
eval "$(review-codecommit --completions zsh)"
```

## 今後の展望

v0.1.0 でコアのレビューワークフローが一通り揃いました。今後は使い勝手の改善や、CodeCommit 以外の Git ホスティングへの対応も視野に入れています。

## まとめ

- ターミナル完結の AWS CodeCommit PR レビュー TUI
- Ink（React for CLI）で宣言的に TUI を構築
- コメント・リアクション・Approve・マージ・Activity Timeline をフルサポート
- Vim ライクなキーバインドで快適なナビゲーション
- TDD + カバレッジ 95% で品質を担保

「ブラウザを開かずにコードレビューしたい」というシンプルな動機から始まったプロジェクトですが、気づけばかなり実用的なツールになりました。AWS CodeCommit ユーザーの方はぜひ試してみてください。

---

*[review-codecommit on npm](https://www.npmjs.com/package/review-codecommit)*
