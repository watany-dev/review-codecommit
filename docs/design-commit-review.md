# コミット単位レビュー 設計書（v0.6.1）

> **✅ 実装完了** (2026-02-14)
>
> PR 詳細画面に Tab/Shift+Tab によるビュー切り替え（All changes ↔ 各コミット）を実装。サービス層（getCommit, getCommitsForPR, getCommitDifferences）、PullRequestDetail UI（viewIndex, タブヘッダー、コミット diff 表示）、App 統合（状態管理、diff ロード）、Help 画面更新を含む。

## 概要

PR 詳細画面に「All changes」と「Commits」のタブ切り替え機能を追加し、コミット単位で差分を確認できるようにする。大きな PR でも各コミットの意図を追いやすくなり、レビュー品質が向上する。v0.6 までで閲覧・コメント・承認・マージの全ワークフローが揃ったが、大きな PR を効率的にレビューするためにはコミット単位の差分確認が不可欠であった。

## スコープ

### 今回やること

- PR のコミット一覧取得（`GetCommitCommand` で親コミットを辿る）
- Tab / Shift+Tab によるビュー切り替え（All changes ↔ 各コミット）
- コミット単位の diff 表示（既存の `computeSimpleDiff` を再利用）
- コミットメタデータの表示（hash, message, author, date）

### 今回やらないこと

- コミット単位のインラインコメント投稿 → 将来検討
- 任意の 2 コミット間の比較（GitHub の "compare" 相当）→ 将来検討
- マージコミットの特別なハンドリング → 最初の親のみを辿る

## AWS SDK API

### GetCommitCommand（新規使用）

コミットのメタデータ（author, message, parents, date）を取得する。

```typescript
import { GetCommitCommand } from "@aws-sdk/client-codecommit";

// Input
{
  repositoryName: string;   // 必須: リポジトリ名
  commitId: string;         // 必須: コミットID
}

// Output
{
  commit?: {
    commitId?: string;
    treeId?: string;
    parents?: string[];          // 親コミットID（通常1つ、マージコミットは2つ）
    message?: string;            // コミットメッセージ全文
    author?: {
      name?: string;
      email?: string;
      date?: string;             // エポック秒の文字列
    };
    committer?: {
      name?: string;
      email?: string;
      date?: string;
    };
    additionalData?: string;
  };
}
```

**特徴**:
- 読み取り専用。副作用なし
- コミットの親情報（`parents`）を使って履歴を辿る
- `message` はコミットメッセージ全文。表示時に1行目のみ抽出する

### GetDifferencesCommand（既存・再利用）

コミット間の差分取得に再利用する。現在は sourceCommit ↔ destinationCommit 間で使用しているが、任意のコミットペアに対しても使用できる。

```typescript
// 各コミットの差分取得時の使い方
{
  repositoryName: string;
  beforeCommitSpecifier: parentCommitId;  // 親コミットID
  afterCommitSpecifier: commitId;         // 対象コミットID
}
```

### API 一覧

| API | 用途 | 既存/新規 |
|-----|------|----------|
| `GetCommitCommand` | コミットメタデータ取得 | 新規使用 |
| `GetDifferencesCommand` | コミット間差分取得 | 既存（再利用） |
| `GetBlobCommand` | ファイル内容取得 | 既存（再利用） |

## データモデル

### CommitInfo 型（新規）

```typescript
export interface CommitInfo {
  commitId: string;
  shortId: string;        // commitId の先頭7文字
  message: string;        // コミットメッセージの1行目
  authorName: string;
  authorDate: Date;
  parentIds: string[];
}
```

### ViewIndex

ビュー切り替え用のインデックス。`PullRequestDetail` のローカル state。

```
viewIndex = -1    → "All changes" ビュー（既存の差分全体表示）
viewIndex = 0     → 1番目のコミット（時系列で最も古い）
viewIndex = 1     → 2番目のコミット
...
viewIndex = N-1   → N番目のコミット（最新）
```

Tab で次のビュー、Shift+Tab で前のビューへ循環する:

```
All changes (-1) → Commit 0 → Commit 1 → ... → Commit N-1 → All changes (-1)
                 ←           ←           ←                  ←
```

## コミット一覧の取得アルゴリズム

PR オブジェクトの `PullRequestTarget` から `sourceCommit`（PR ブランチの先端）と `mergeBase`（共通祖先）を取得し、`sourceCommit` から `mergeBase` まで親コミットを辿る。

```
mergeBase ← commit1 ← commit2 ← commit3 (= sourceCommit)
                                           │
                              GetCommitCommand で parents を辿る
```

### アルゴリズム

1. `currentId = sourceCommit` から開始
2. `GetCommitCommand` で `currentId` のメタデータを取得
3. `commits` に追加
4. `currentId = commit.parents[0]`（最初の親を辿る）
5. `currentId === mergeBase` になるまで繰り返す
6. 最後に `reverse()` して時系列順（古い順）に並べる

### 制約

- 最初の親のみを辿る（リニアヒストリー前提）。マージコミットの 2 番目以降の親は無視
- 安全上限: 最大 100 コミット。通常の PR で 100 を超えるコミットは稀
- `mergeBase` が未設定の場合: コミット一覧は空配列（タブ切り替え不可）

## 画面設計

### タブヘッダー（All changes 選択時）

```
┌─ PR #42: fix: login timeout ────────────────┐
│  Author: watany  Status: OPEN   2h ago       │
│  main ← feature/fix-login                    │
│  Approvals: taro ✓                           │
│                                              │
│  [All changes]  Commits (3)                  │
│──────────────────────────────────────────────│
│  src/auth.ts                                 │
│  ──────────────────────────────────────────  │
│ > -   timeout: 3000,                         │
│   +   timeout: 10000,                        │
│  ...                                         │
│                                              │
│  Tab switch view  ↑↓ cursor  c comment ...   │
└──────────────────────────────────────────────┘
```

### タブヘッダー（コミット選択時）

```
┌─ PR #42: fix: login timeout ────────────────┐
│  Author: watany  Status: OPEN   2h ago       │
│  main ← feature/fix-login                    │
│  Approvals: taro ✓                           │
│                                              │
│  All changes  [Commit 1/3] aaa1234           │
│  Fix input validation  watany  2h ago        │
│──────────────────────────────────────────────│
│  src/validators.ts                           │
│  ──────────────────────────────────────────  │
│ > -   if (input) {                           │
│   +   if (input && input.length > 0) {       │
│  ...                                         │
│                                              │
│  Tab next  S-Tab prev  ↑↓ cursor  ...        │
└──────────────────────────────────────────────┘
```

### タブ表示ルール

| 状態 | Tab ヘッダー表示 |
|------|-----------------|
| All changes 選択中 | `[All changes]  Commits (N)` |
| コミット選択中 | `All changes  [Commit M/N] <shortId>` + 改行 + `<message>  <author>  <date>` |
| コミット 0 件 | タブヘッダー非表示（All changes のみ。Tab キー無効） |

### コミット差分ロード中

```
│  All changes  [Commit 1/3] aaa1234           │
│  Loading commit diff...                      │
```

## データフロー

```
App (状態管理)
 │
 ├─ 既存の state すべて（変更なし）
 │
 ├─ 新規 state:
 │   ├─ commits: CommitInfo[]                          // PR のコミット一覧
 │   ├─ commitDifferences: Difference[]                // 選択中コミットの差分
 │   ├─ commitDiffTexts: Map<string, {before, after}>  // 選択中コミットの blob
 │   └─ isLoadingCommitDiff: boolean                   // コミット差分ロード中
 │
 └─→ PullRequestDetail (表示 + 操作管理)
      │
      ├─ 新規 local state:
      │   └─ viewIndex: number              // -1 = All changes, 0..N-1 = コミット
      │
      ├─ Props から受け取る（追加分）:
      │   ├─ commits ──→ タブヘッダー・コミット情報表示
      │   ├─ commitDifferences ──→ コミット diff 表示
      │   ├─ commitDiffTexts ──→ コミット blob テキスト
      │   ├─ isLoadingCommitDiff ──→ ローディング表示
      │   └─ onLoadCommitDiff(index) ──→ App.handleLoadCommitDiff()
      │
      └─ Tab / Shift+Tab でビュー切り替え
           └─ viewIndex 変更 → onLoadCommitDiff 呼び出し
```

### ビュー切り替えシーケンス

```
ユーザー       PullRequestDetail            App              CodeCommit API
  │                    │                     │                    │
  │─── Tab ───────────→│                     │                    │
  │                    │── viewIndex = 0     │                    │
  │                    │── cursorIndex = 0   │                    │
  │                    │── onLoadCommitDiff(0)→                   │
  │                    │                     │── isLoadingCommit  │
  │                    │                     │   Diff = true      │
  │                    │                     │── GetDifferences   │
  │                    │                     │   (parent, commit) │
  │                    │                     │──────────────────→│
  │                    │                     │←── differences ───│
  │                    │                     │── GetBlob (各ファイル)
  │                    │                     │──────────────────→│
  │                    │                     │←── blob content ──│
  │                    │                     │── commitDifferences│
  │                    │                     │   commitDiffTexts  │
  │                    │                     │   設定             │
  │                    │                     │── isLoadingCommit  │
  │                    │                     │   Diff = false     │
  │                    │← re-render ─────────│                    │
  │                    │  コミット diff 表示  │                    │
  │                    │                     │                    │
  │─── Tab ───────────→│                     │                    │
  │                    │── viewIndex = 1     │                    │
  │                    │── onLoadCommitDiff(1)→                   │
  │                    │                     │  ... (同様)        │
  │                    │                     │                    │
  │─── Shift+Tab ─────→│                     │                    │
  │                    │── viewIndex = 0     │                    │
  │                    │── onLoadCommitDiff(0)→                   │
  │                    │                     │  ... (同様)        │
  │                    │                     │                    │
  │─── Shift+Tab ─────→│                     │                    │
  │                    │── viewIndex = -1    │                    │
  │                    │  All changes 表示   │                    │
  │                    │  (ロード不要)       │                    │
```

## コンポーネント設計

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/services/codecommit.ts` | `getCommit`, `getCommitsForPR`, `getCommitDifferences` 関数追加。`GetCommitCommand` の import 追加。`CommitInfo` 型を export |
| `src/services/codecommit.test.ts` | 上記関数のテスト追加 |
| `src/components/PullRequestDetail.tsx` | Tab/Shift+Tab ハンドラ、タブヘッダー表示、viewIndex state、Props 追加、コミットビューでのコメント操作無効化 |
| `src/components/PullRequestDetail.test.tsx` | タブ切り替え・コミットビュー表示のテスト追加 |
| `src/app.tsx` | コミット関連 state 追加、`handleLoadCommitDiff` ハンドラ追加、`loadPullRequestDetail` 拡張 |
| `src/app.test.tsx` | 統合テスト追加 |
| `src/components/Help.tsx` | Tab/Shift+Tab キーバインドの追加 |
| `src/components/Help.test.tsx` | テスト更新 |

### 1. サービス層の変更

#### getCommit（新規）

```typescript
import { GetCommitCommand } from "@aws-sdk/client-codecommit";

export interface CommitInfo {
  commitId: string;
  shortId: string;
  message: string;
  authorName: string;
  authorDate: Date;
  parentIds: string[];
}

export async function getCommit(
  client: CodeCommitClient,
  repositoryName: string,
  commitId: string,
): Promise<CommitInfo> {
  const command = new GetCommitCommand({ repositoryName, commitId });
  const response = await client.send(command);
  const commit = response.commit;
  if (!commit) throw new Error(`Commit ${commitId} not found.`);

  return {
    commitId: commit.commitId ?? commitId,
    shortId: (commit.commitId ?? commitId).slice(0, 7),
    message: (commit.message ?? "").split("\n")[0],
    authorName: commit.author?.name ?? "unknown",
    authorDate: commit.author?.date
      ? new Date(commit.author.date)
      : new Date(),
    parentIds: commit.parents ?? [],
  };
}
```

**設計判断**:
- `message` は 1 行目のみ抽出。コミット一覧・タブヘッダーでの表示に使用するため、全文は不要
- `shortId` は 7 文字。Git の標準的な短縮 hash 長
- `authorDate` の変換: CodeCommit API はエポック秒の文字列を返す。`new Date()` で変換

#### getCommitsForPR（新規）

`sourceCommit` から `mergeBase` まで親を辿り、PR に含まれるコミット一覧を時系列順（古い順）で返す。

```typescript
const MAX_COMMITS = 100;

export async function getCommitsForPR(
  client: CodeCommitClient,
  repositoryName: string,
  sourceCommit: string,
  mergeBase: string,
): Promise<CommitInfo[]> {
  const commits: CommitInfo[] = [];
  let currentId = sourceCommit;

  while (currentId !== mergeBase && commits.length < MAX_COMMITS) {
    const commit = await getCommit(client, repositoryName, currentId);
    commits.push(commit);
    if (commit.parentIds.length === 0) break;
    currentId = commit.parentIds[0]; // 最初の親を辿る（リニアヒストリー）
  }

  return commits.reverse(); // 時系列順（古い順）
}
```

**設計判断**:
- 最初の親のみを辿る: マージコミットがある場合、最初の親はメインライン（PR ブランチ上のコミット）を示す。2 番目以降の親（マージ元ブランチ）は辿らない
- `MAX_COMMITS = 100`: 安全上限。通常の PR で 100 を超えるコミットは稀
- 時系列順に `reverse()`: レビューでは古いコミットから順に見るのが自然
- `mergeBase` が見つからない場合: `MAX_COMMITS` でループを打ち切り、得られた分だけ返す

#### getCommitDifferences（新規）

既存の `GetDifferencesCommand` を使い、指定コミットペア間の差分を取得する。

```typescript
export async function getCommitDifferences(
  client: CodeCommitClient,
  repositoryName: string,
  beforeCommitId: string,
  afterCommitId: string,
): Promise<Difference[]> {
  const command = new GetDifferencesCommand({
    repositoryName,
    beforeCommitSpecifier: beforeCommitId,
    afterCommitSpecifier: afterCommitId,
  });
  const response = await client.send(command);
  return response.differences ?? [];
}
```

**設計判断**: `getPullRequestDetail` 内にある `GetDifferencesCommand` の呼び出しと同様だが、任意のコミットペアに対して使える独立関数として切り出す。コミット差分のロードは PR 詳細の初回ロードとは別タイミングで発生するため、専用関数が適切。

### 2. PullRequestDetail の変更

#### Props の追加

```typescript
interface Props {
  // ... 既存の Props すべて ...

  // コミット単位レビュー追加
  commits: CommitInfo[];
  commitDifferences: Difference[];
  commitDiffTexts: Map<string, { before: string; after: string }>;
  isLoadingCommitDiff: boolean;
  onLoadCommitDiff: (commitIndex: number) => void;
}
```

#### 状態管理の追加

```typescript
const [viewIndex, setViewIndex] = useState(-1); // -1 = All changes
```

#### Tab / Shift+Tab 入力ハンドリング

```typescript
useInput((input, key) => {
  if (
    isCommenting ||
    isInlineCommenting ||
    isReplying ||
    approvalAction ||
    mergeStep ||
    isClosing
  )
    return;

  // Tab / Shift+Tab: ビュー切り替え
  if (key.tab && commits.length > 0) {
    const newIndex = key.shift
      ? (viewIndex - 1 < -1 ? commits.length - 1 : viewIndex - 1)
      : (viewIndex + 1 > commits.length - 1 ? -1 : viewIndex + 1);

    setViewIndex(newIndex);
    setCursorIndex(0);
    if (newIndex >= 0) {
      onLoadCommitDiff(newIndex);
    }
    return;
  }

  // ... 既存のキーバインド ...

  // コミットビューでは c/C を無効化
  if (input === "c") {
    if (viewIndex >= 0) return;
    setIsCommenting(true);
    return;
  }
  if (input === "C") {
    if (viewIndex >= 0) return;
    // ... 既存のインラインコメントロジック ...
  }

  // a, r, m, x はビューに関係なく動作（PR レベルの操作）
});
```

**設計判断**:
- Tab / Shift+Tab は循環ナビゲーション: All changes → Commit 0 → ... → Commit N-1 → All changes
- ビュー切り替え時にカーソルを 0 にリセット: 異なる diff を表示するためスクロール位置は無意味
- コミットビューでは `c` / `C` を無効化: コメント投稿は `beforeCommitId` / `afterCommitId` が PR 全体の diff に紐づくため、コミット単位のコメント投稿は将来対応
- `a` / `r` / `m` / `x` は PR レベルの操作なのでビューに関係なく動作

#### diff 表示のビュー切り替え

```typescript
const lines = useMemo(() => {
  if (viewIndex === -1) {
    // All changes: 既存のロジック
    return buildDisplayLines(differences, diffTexts, commentThreads, collapsedThreads);
  }
  // Commit view: コミット差分のみ（コメントなし）
  return buildDisplayLines(commitDifferences, commitDiffTexts, [], new Set());
}, [
  viewIndex,
  differences,
  diffTexts,
  commentThreads,
  collapsedThreads,
  commitDifferences,
  commitDiffTexts,
]);
```

**設計判断**: 既存の `buildDisplayLines` をそのまま再利用する。コミットビューではコメントスレッドを空配列として渡すことで、diff のみの表示になる。新しいレンダリング関数は不要。

#### タブヘッダーのレンダリング

```tsx
{/* タブヘッダー */}
{commits.length > 0 && (
  <Box flexDirection="column" marginBottom={0}>
    <Box>
      {viewIndex === -1 ? (
        <>
          <Text bold color="cyan">[All changes]</Text>
          <Text>  Commits ({commits.length})</Text>
        </>
      ) : (
        <>
          <Text>All changes  </Text>
          <Text bold color="cyan">[Commit {viewIndex + 1}/{commits.length}]</Text>
          <Text> {commits[viewIndex]!.shortId}</Text>
        </>
      )}
    </Box>
    {viewIndex >= 0 && (
      <Text dimColor>
        {commits[viewIndex]!.message}  {commits[viewIndex]!.authorName}  {formatRelativeDate(commits[viewIndex]!.authorDate)}
      </Text>
    )}
  </Box>
)}
```

#### ローディング表示

```tsx
{isLoadingCommitDiff && viewIndex >= 0 && (
  <Box>
    <Text color="cyan">Loading commit diff...</Text>
  </Box>
)}
```

#### visibleLineCount の調整

変更なし。既存のモーダルガードにはタブ切り替え時は含まれないため、通常の 30 行表示。

#### フッターの変更

```tsx
<Box marginTop={1}>
  <Text dimColor>
    {isCommenting || isInlineCommenting || isReplying || approvalAction || mergeStep || isClosing
      ? ""
      : viewIndex === -1 && commits.length > 0
        ? "Tab switch view  ↑↓ cursor  c comment  C inline  R reply  o fold  a approve  r revoke  m merge  x close  q back  ? help"
        : viewIndex >= 0
          ? "Tab next  S-Tab prev  ↑↓ cursor  a approve  r revoke  m merge  x close  q back  ? help"
          : "↑↓ cursor  c comment  C inline  R reply  o fold  a approve  r revoke  m merge  x close  q back  ? help"}
  </Text>
</Box>
```

フッター表示ルール:

| 状態 | フッター |
|------|---------|
| All changes（コミットあり） | `Tab switch view  ↑↓ cursor  c comment  ...` |
| コミットビュー | `Tab next  S-Tab prev  ↑↓ cursor  a approve  ...`（c/C/R/o なし） |
| All changes（コミットなし） | 従来通り（Tab なし） |

### 3. App の変更

#### import の追加

```typescript
import {
  // 既存の import に追加
  type CommitInfo,
  getCommitsForPR,
  getCommitDifferences,
} from "./services/codecommit.js";
```

#### state の追加

```typescript
const [commits, setCommits] = useState<CommitInfo[]>([]);
const [commitDifferences, setCommitDifferences] = useState<Difference[]>([]);
const [commitDiffTexts, setCommitDiffTexts] = useState<
  Map<string, { before: string; after: string }>
>(new Map());
const [isLoadingCommitDiff, setIsLoadingCommitDiff] = useState(false);
```

#### loadPullRequestDetail の拡張

```typescript
async function loadPullRequestDetail(pullRequestId: string) {
  await withLoadingState(async () => {
    // ... 既存のロジック（変更なし） ...

    // コミット一覧を取得
    const target = detail.pullRequest.pullRequestTargets?.[0];
    if (target?.sourceCommit && target?.mergeBase) {
      const commitList = await getCommitsForPR(
        client,
        selectedRepo,
        target.sourceCommit,
        target.mergeBase,
      );
      setCommits(commitList);
    } else {
      setCommits([]);
    }
  });
}
```

**設計判断**:
- `mergeBase` を使用: `PullRequestTarget.mergeBase` は PR 作成時に CodeCommit が自動計算する共通祖先。`destinationCommit` はデスティネーションブランチの先端であり、コミット履歴の辿り先としては不適切
- コミット一覧取得は blob フェッチと同じ `withLoadingState` 内で実行。初回ロードでの UI 遷移を最小化

#### handleLoadCommitDiff（新規）

```typescript
async function handleLoadCommitDiff(commitIndex: number) {
  const commit = commits[commitIndex];
  if (!commit) return;

  setIsLoadingCommitDiff(true);
  try {
    // 親コミットIDを決定
    const parentId = commit.parentIds[0];
    const target = prDetail?.pullRequestTargets?.[0];
    const beforeCommit = parentId ?? target?.mergeBase ?? target?.destinationCommit;
    if (!beforeCommit) return;

    // コミットの差分を取得
    const diffs = await getCommitDifferences(
      client,
      selectedRepo,
      beforeCommit,
      commit.commitId,
    );
    setCommitDifferences(diffs);

    // blob content を取得（並列化）
    const blobFetches = diffs.map(async (diff) => {
      const beforeBlobId = diff.beforeBlob?.blobId;
      const afterBlobId = diff.afterBlob?.blobId;
      const key = `${beforeBlobId ?? ""}:${afterBlobId ?? ""}`;

      const [before, after] = await Promise.all([
        beforeBlobId
          ? getBlobContent(client, selectedRepo, beforeBlobId)
          : Promise.resolve(""),
        afterBlobId
          ? getBlobContent(client, selectedRepo, afterBlobId)
          : Promise.resolve(""),
      ]);

      return { key, before, after };
    });

    const blobResults = await Promise.all(blobFetches);
    const texts = new Map<string, { before: string; after: string }>();
    for (const result of blobResults) {
      texts.set(result.key, { before: result.before, after: result.after });
    }
    setCommitDiffTexts(texts);
  } finally {
    setIsLoadingCommitDiff(false);
  }
}
```

**設計判断**:
- 親コミットの決定順序: `commit.parentIds[0]` → `mergeBase` → `destinationCommit`。通常は `parentIds[0]` が使われる
- blob フェッチは `loadPullRequestDetail` と同じパターンで並列化
- `try/finally` で `isLoadingCommitDiff` を確実にリセット。エラー時は空の差分が表示される（App の `error` state を汚さない）

#### PullRequestDetail への Props 渡し

```tsx
case "detail":
  if (!prDetail) return null;
  return (
    <PullRequestDetail
      // ... 既存の Props すべて ...
      commits={commits}
      commitDifferences={commitDifferences}
      commitDiffTexts={commitDiffTexts}
      isLoadingCommitDiff={isLoadingCommitDiff}
      onLoadCommitDiff={handleLoadCommitDiff}
    />
  );
```

### 4. Help の変更

```typescript
<Text> Tab        Switch view / Next commit (PR Detail)</Text>
<Text> Shift+Tab  Previous commit (PR Detail)</Text>
```

## キーバインド一覧（更新後）

| キー | 動作 | 画面 |
|------|------|------|
| `Tab` | ビュー切り替え: All changes → コミット1 → ... → コミットN → All changes | PR 詳細画面（入力中・確認中は無効。コミット 0 件時は無効） |
| `Shift+Tab` | 逆方向ビュー切り替え: All changes → コミットN → ... → コミット1 → All changes | PR 詳細画面（同上） |
| `j` / `↓` | カーソル下移動 | 全画面（入力中・確認中は無効） |
| `k` / `↑` | カーソル上移動 | 全画面（入力中・確認中は無効） |
| `Enter` | 選択・決定 / コメント送信 | リスト画面 / コメント入力 / 戦略選択 |
| `q` / `Esc` | 前の画面に戻る / キャンセル | 全画面 / 入力 / 確認プロンプト / 戦略選択 |
| `Ctrl+C` | 即座に終了 | 全画面 |
| `?` | ヘルプ表示 | 全画面（入力中・確認中は無効） |
| `c` | 一般コメント投稿 | PR 詳細画面（**All changes ビューのみ**） |
| `C` | インラインコメント投稿 | PR 詳細画面（diff 行上のみ。**All changes ビューのみ**） |
| `R` | コメント返信 | PR 詳細画面（コメント行上のみ） |
| `o` | スレッド折りたたみ/展開 | PR 詳細画面（コメント行上のみ） |
| `a` | PR を承認 | PR 詳細画面 |
| `r` | 承認を取り消し | PR 詳細画面 |
| `m` | PR をマージ | PR 詳細画面 |
| `x` | PR をクローズ | PR 詳細画面 |

## エラーハンドリング

### GetCommitCommand 固有エラー

| エラー | 表示メッセージ |
|--------|---------------|
| `CommitIdDoesNotExistException` | "Commit not found. The branch history may have changed." |
| `CommitIdRequiredException` | "Internal error: Commit ID is required." |
| `InvalidCommitIdException` | "Internal error: Invalid commit ID format." |
| `RepositoryDoesNotExistException` | "Repository not found." |
| `EncryptionKeyAccessDeniedException` | "Encryption key access denied." |
| `AccessDeniedException` / `UnauthorizedException` | "Access denied. Check your IAM policy." |
| ネットワークエラー | "Network error. Check your connection." |
| その他 | エラーメッセージをサニタイズして表示 |

### formatErrorMessage の拡張

`src/app.tsx` の `formatErrorMessage` に `"commit"` コンテキストを追加する:

```typescript
function formatErrorMessage(
  err: unknown,
  context?: "comment" | "reply" | "approval" | "merge" | "close" | "commit",
  // ...
): string {
  // Commit-specific errors
  if (context === "commit") {
    if (name === "CommitIdDoesNotExistException") {
      return "Commit not found. The branch history may have changed.";
    }
  }
  // ... 既存のエラーハンドリング ...
}
```

ただし、コミット一覧取得は `loadPullRequestDetail` 内の `withLoadingState` で実行されるため、エラーは既存の `formatError()` で処理される。コミット差分ロード (`handleLoadCommitDiff`) はエラーを App の `error` state に伝播させず、`isLoadingCommitDiff` を `false` に戻すのみとする（UI がフリーズしないことを優先）。

### エラー一覧

| ケース | 対処 |
|--------|------|
| `GetCommitCommand` API エラー | 初回ロード時の `withLoadingState` で捕捉。エラー画面表示 |
| コミット差分ロードエラー | `isLoadingCommitDiff` を `false` に戻し、空の差分を表示 |
| `mergeBase` が `undefined` | `commits` を空配列に設定。タブ切り替え不可（All changes のみ表示） |
| コミット 0 件 | All changes のみ表示。Tab キーは無効 |
| 100 コミット超過 | 100 件で打ち切り。得られた分だけ表示 |
| マージコミット（親が 2 つ） | 最初の親のみを辿る |

## エッジケースと対処方針

| ケース | 対処 |
|--------|------|
| Tab 押下時にコミットが 0 件 | `commits.length > 0` のガードにより無効 |
| コミット差分ロード中に Tab | 新しいロードが開始され、前のロード結果は上書きされる |
| ビュー切り替え時のカーソル位置 | `setCursorIndex(0)` でリセット |
| コメント入力中の Tab | 入力ガードにより無効化（既存パターンと同じ） |
| All changes で `c` / `C` キー | 通常通り動作（既存の動作） |
| コミットビューで `c` / `C` キー | 無効化（`viewIndex >= 0` チェック） |
| コミットビューで `R` キー | コメント行がないため自然に無効（`getReplyTargetFromLine` が `null` を返す） |
| コミットビューで `o` キー | コメントスレッドがないため自然に無効（`threadIndex` が `undefined`） |
| コミットビューで `a` / `r` / `m` / `x` キー | 通常通り動作（PR レベルの操作） |
| 最後のコミットで Tab | viewIndex が -1 に戻る（All changes へ循環） |
| All changes で Shift+Tab | viewIndex が N-1 に変化（最後のコミットへ循環） |
| PR 詳細から Back して再度別の PR を開く | `loadPullRequestDetail` で `setCommits([])` が呼ばれ、PullRequestDetail がアンマウント→再マウントされるため viewIndex は自動的に -1 にリセットされる |
| `GetDifferencesCommand` のページネーション | 現在の実装は `nextToken` 未対応（PR 全体 diff と同様）。1 コミットで数百ファイル変更は稀であり、v0.7 スコープでは未対応 |
| 同じコミットへの再切り替え（Tab→Shift+Tab→Tab） | 毎回 API を呼び出す。キャッシュは将来の最適化候補（`commitDiffCache: Map<string, {diffs, texts}>` 等） |

## セキュリティ考慮

### IAM 権限

新たに以下の IAM 権限が必要:

```json
{
  "Effect": "Allow",
  "Action": [
    "codecommit:GetCommit"
  ],
  "Resource": "arn:aws:codecommit:<region>:<account-id>:<repository-name>"
}
```

`GetCommit` は読み取り専用操作であり、既存の `codecommit:GetDifferences` や `codecommit:GetBlob` と同レベルのリスク。

### 認証

既存の AWS SDK 標準認証チェーンをそのまま使用する。追加の認証フローは不要。

### コミットメッセージの表示

コミットメッセージは外部ユーザーが任意の文字列を設定可能であるため、表示時に以下を考慮する:

- **長さの制限**: `message` は 1 行目のみ抽出済み（`split("\n")[0]`）。Ink の `<Text>` コンポーネントがターミナル幅で自動折り返しするため、追加のトランケーションは不要
- **制御文字**: Ink のレンダリングエンジンが ANSI エスケープシーケンス等の制御文字を安全に処理するため、追加のサニタイズは不要
- **機密情報**: コミットメッセージ自体はリポジトリの読み取り権限があれば閲覧可能な情報であり、追加のマスキングは不要（既存の diff 表示と同レベル）

## 技術選定

### 新規依存パッケージ: なし

すべてのコマンドは既存の `@aws-sdk/client-codecommit` パッケージに含まれている。

### コミット履歴の取得: GetCommitCommand で親を辿る

| 選択肢 | 評価 |
|--------|------|
| **`GetCommitCommand` で親を逐次辿る（採用）** | シンプルで確実。`mergeBase` までの到達を保証できる。コミット数分の API コールが発生するが、通常の PR（数十コミット以内）では問題ない |
| `BatchGetCommitsCommand` で一括取得 | コミット ID を事前に知る必要があるが、そのためには結局親を辿る必要がある。初回取得の最適化には使えない |
| `git log` 相当の API | CodeCommit には存在しない |

### ビュー切り替え: viewIndex による単一 state

| 選択肢 | 評価 |
|--------|------|
| **`viewIndex: number`（採用）** | -1 で All changes、0..N-1 でコミット。Tab/Shift+Tab で ±1 するだけ。シンプル |
| `viewMode: "all" \| "commits"` + `selectedCommitIndex: number` | 2 つの state を同期する必要あり。循環ナビゲーションのロジックが複雑化 |

### コミットビューでのコメント: 無効化

| 選択肢 | 評価 |
|--------|------|
| **コミットビューでは `c` / `C` を無効化（採用）** | Phase 1+2 のスコープに適合。実装がシンプル。コメントは All changes ビューで投稿可能 |
| コミット単位のコメント対応 | `PostCommentForPullRequestCommand` の `beforeCommitId` / `afterCommitId` をコミット単位に設定すれば技術的に可能だが、スコープ外 |

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `getCommit` | `vi.fn()` で `client.send` をモック。正常系・コミット不在のテスト |
| `getCommitsForPR` | 複数コミット・1 コミット・0 コミット・MAX 到達のテスト |
| `getCommitDifferences` | `GetDifferencesCommand` のモック |
| `PullRequestDetail`（Tab/Shift+Tab） | ビュー切り替え・カーソルリセット・循環ナビゲーション |
| `PullRequestDetail`（コミットビュー表示） | タブヘッダー・コミット diff 表示・コメント無効化 |
| `App`（統合テスト） | コミット一覧ロード・コミット差分ロード |

カバレッジ 95% 以上を維持する。

### 具体的なテストケース

#### サービス層

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `getCommit`: 正常取得 | `CommitInfo` が正しく返る（shortId, message 1行目, author, date, parents） |
| 2 | `getCommit`: コミット不在（`commit` が `undefined`） | エラーがスローされる |
| 3 | `getCommit`: message が複数行 | 1 行目のみ `message` に含まれる |
| 4 | `getCommit`: author.name が未設定 | `authorName` が `"unknown"` |
| 5 | `getCommitsForPR`: 3 コミットのリニア履歴 | 時系列順で 3 件返る（`[oldest, middle, newest]`） |
| 6 | `getCommitsForPR`: 1 コミット（parent === mergeBase） | 1 件返る |
| 7 | `getCommitsForPR`: sourceCommit === mergeBase | 0 件返る |
| 8 | `getCommitsForPR`: MAX_COMMITS 到達 | 100 件で打ち切り |
| 9 | `getCommitDifferences`: 正常取得 | `Difference[]` が返る |
| 10 | `getCommitDifferences`: 差分なし | 空配列が返る |

#### PullRequestDetail（コンポーネント）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `commits` が空の場合、タブヘッダーが非表示 | タブ UI が表示されない |
| 2 | `commits` がある場合、`[All changes]  Commits (N)` が表示 | タブヘッダーが表示される |
| 3 | Tab キーで viewIndex が 0 に変化 | コミット 1 の表示に切り替わる |
| 4 | Tab キーで `onLoadCommitDiff(0)` が呼ばれる | コミット差分ロードがトリガーされる |
| 5 | Tab 連打で全コミットを巡回 | viewIndex が 0→1→...→N-1→-1 とラップ |
| 6 | Shift+Tab で逆方向に巡回 | viewIndex が -1→N-1→...→0→-1 とラップ |
| 7 | ビュー切り替え時にカーソルが 0 にリセット | `cursorIndex` が 0 になる |
| 8 | コミットビューで `c` キーが無効 | コメント入力モードに入らない |
| 9 | コミットビューで `C` キーが無効 | インラインコメント入力モードに入らない |
| 10 | コミットビューで `a` / `m` キーが有効 | 承認・マージ等の操作が可能 |
| 11 | `isLoadingCommitDiff` 時に "Loading commit diff..." 表示 | ローディング表示される |
| 12 | コミットビューでタブヘッダーにコミット情報が表示 | shortId, message, author, date が表示 |
| 13 | コメント入力中に Tab が無効 | ビュー切り替えが起こらない |
| 14 | commits が 0 件時に Tab が無効 | 何も起こらない |

#### App（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | PR 詳細ロード時にコミット一覧が取得される | `commits` が設定される |
| 2 | `mergeBase` が未設定の場合 | `commits` が空配列 |
| 3 | コミット差分ロードが正常動作 | `commitDifferences`, `commitDiffTexts` が設定される |
| 4 | コミット差分ロードエラー | `isLoadingCommitDiff` が `false` に戻る |

#### Help

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | ヘルプ画面に Tab / Shift+Tab が表示 | キーバインド情報が表示される |

## 実装順序

### Step 1: サービス層 — getCommit, getCommitsForPR, getCommitDifferences 追加

`src/services/codecommit.ts` に 3 つの関数と `GetCommitCommand` の import を追加。`CommitInfo` 型を export。テストを追加して通過を確認。

**この Step で変更するファイル**:
- `src/services/codecommit.ts`: 関数追加、import 追加、型定義追加
- `src/services/codecommit.test.ts`: テスト追加

**この Step の完了条件**: 全テストが通過。既存テストに影響なし。

### Step 2: PullRequestDetail にタブ UI を統合

Tab/Shift+Tab ハンドラ追加。`viewIndex` state 追加。タブヘッダー表示。ビュー切り替えロジック。Props 追加。コミットビューでのコメント操作無効化。フッター更新。

**この Step で変更するファイル**:
- `src/components/PullRequestDetail.tsx`: state 追加、キーハンドラ追加、レンダリング追加、Props 追加
- `src/components/PullRequestDetail.test.tsx`: タブ切り替えのテスト追加

**この Step の完了条件**: PullRequestDetail のタブ切り替えテストが通過。

### Step 3: App にコミット関連ハンドラを統合

`loadPullRequestDetail` 拡張（コミット一覧取得）。`handleLoadCommitDiff` 追加。state 追加。Props 渡し。

**この Step で変更するファイル**:
- `src/app.tsx`: ハンドラ追加、state 追加、Props 渡し、`loadPullRequestDetail` 拡張
- `src/app.test.tsx`: 統合テスト追加

**この Step の完了条件**: コミット一覧ロード・コミット差分ロードの統合テストが通過。

### Step 4: Help 更新

Tab / Shift+Tab キーバインドを追加。

**この Step で変更するファイル**:
- `src/components/Help.tsx`: キーバインド行追加
- `src/components/Help.test.tsx`: テスト更新

**この Step の完了条件**: Help 画面に Tab / Shift+Tab が表示される。

### Step 5: 全体テスト・カバレッジ確認

```bash
bun run ci
```

**この Step の完了条件**:
- oxlint: エラーなし
- Biome: フォーマットチェック通過
- TypeScript: 型チェック通過
- knip: 未使用 export なし
- vitest: カバレッジ 95% 以上
- build: 本番ビルド成功

### Step 6: ドキュメント更新

**この Step で変更するファイル**:
- `docs/requirements.md`: v0.7 機能スコープセクション追加、キーバインド表に Tab / Shift+Tab 追加
- `docs/roadmap.md`: v0.7 セクション更新
- `README.md`: 機能一覧にコミット単位レビューを追記
