# AI コードレビュー連携設計書

**バージョン**: v0.4.0
**ステータス**: ドラフト
**最終更新**: 2026-02-17

> **設計レビュー待ち**
>
> review-codecommit のレビュー結果を AI に読ませるための構造化出力機能。
> `--pr [id]` と `--output json|markdown` オプションで TUI を起動せず、
> PR のメタデータ・diff・コメントを標準出力に出力する。`--pr` に ID を指定すれば
> PR 詳細を、ID を省略すれば PR 一覧を出力する。パイプ連携により
> `review-codecommit my-repo --pr 123 | claude "レビューして"` のようなワークフローを実現する。

## 概要

review-codecommit は TUI ツールとして PR レビュー機能を提供しているが、取得したデータを外部ツール（AI、CI スクリプト等）に渡す手段がない。本機能では、TUI を起動せずに PR の構造化データを標準出力に出力する非インタラクティブモードを追加する。主なユースケースは AI によるコードレビュー支援だが、汎用的なデータエクスポートとしても機能する。

## スコープ

### 今回やること

- `--pr [id]` オプションで対象 PR を指定する（ID 省略時は PR 一覧を出力）
- `--output json` で PR 詳細（メタデータ・diff・コメント・承認状態）を JSON 出力する
- `--output markdown` で同じ情報を Markdown 形式で出力する
- stdout が非 TTY の場合（パイプ接続時）、`--output` 省略時に JSON をデフォルト出力する
- `--pr` の ID 省略時、または `--pr` なしで `--output` を指定した場合は PR 一覧を出力する
- 進捗・エラーは stderr に出力し、stdout はデータのみとする
- 既存の TUI 動作に影響を与えない

### 今回やらないこと

- `--fields` によるフィールド選択（全フィールド出力のみ） → 将来検討
- YAML・CSV 等の追加フォーマット → 将来検討
- 複数 PR の一括詳細出力（`--pr 123,456`） → 将来検討
- AI プロバイダーとの直接統合（API キー管理等） → スコープ外
- TUI 画面内からのエクスポート機能（キーバインド連携） → 将来検討

## CLI インターフェース

### 新規オプション

```
--pr [id]              Specify pull request ID (omit id for PR list)
--output <format>      Output format: json, markdown (short: -o)
```

### 使用イメージ

```bash
# 特定 PR の全情報を JSON 出力
review-codecommit my-repo --pr 123 --output json

# Markdown で出力
review-codecommit my-repo --pr 123 --output markdown
review-codecommit my-repo --pr 123 -o markdown

# パイプ時は --output 省略で自動 JSON
review-codecommit my-repo --pr 123 | claude "このPRをレビューして"
review-codecommit my-repo --pr 123 | jq '.comments'

# PR 一覧を JSON で取得（--pr の ID 省略）
review-codecommit my-repo --pr --output json

# PR 一覧を JSON で取得（--output のみ）
review-codecommit my-repo --output json

# PR 一覧をパイプで取得（--pr のみ、ID 省略）
review-codecommit my-repo --pr | jq '.pullRequests[].title'

# プロファイル・リージョン指定との併用
review-codecommit my-repo --pr 123 --output json --profile dev --region ap-northeast-1
```

### 動作仕様

| 条件 | 動作 |
|------|------|
| `--pr <id> --output json` | PR 詳細を JSON で stdout に出力して exit(0) |
| `--pr <id> --output markdown` | PR 詳細を Markdown で stdout に出力して exit(0) |
| `--pr <id>`（stdout が非 TTY） | `--output json` と同等（自動検出） |
| `--pr <id>`（stdout が TTY、`--output` なし） | エラー: `--output` の指定が必要な旨を stderr に出力して exit(1) |
| `--pr`（ID 省略）`--output json` | PR 一覧を JSON で stdout に出力して exit(0) |
| `--pr`（ID 省略）`--output markdown` | PR 一覧を Markdown で stdout に出力して exit(0) |
| `--pr`（ID 省略、stdout が非 TTY） | PR 一覧を JSON で stdout に出力して exit(0)（自動検出） |
| `--pr`（ID 省略、stdout が TTY、`--output` なし） | エラー: `--output` の指定が必要な旨を stderr に出力して exit(1) |
| `--output json`（`--pr` なし） | PR 一覧を JSON で stdout に出力して exit(0) |
| `--output markdown`（`--pr` なし） | PR 一覧を Markdown で stdout に出力して exit(0) |
| `--output invalid` | エラー: stderr にエラーメッセージを出力して exit(1) |
| `--output`（値なし） | エラー: stderr にエラーメッセージを出力して exit(1) |
| `--help` と `--output` が同時指定 | `--help` が優先（既存動作維持） |
| TUI モード（`--output` なし、`--pr` なし、stdout が TTY） | 従来どおり TUI を起動（変更なし） |
| TUI モード（`--output` なし、`--pr` なし、stdout が非 TTY） | 従来どおり TUI を起動（`--output` / `--pr` が明示されない限り出力モードにならない） |

### stderr 出力

非インタラクティブモードでは、進捗とエラーを stderr に出力する:

```
# 正常時の stderr 出力例
Fetching PR #123 from my-repo...

# エラー時の stderr 出力例
Error: Pull request 999 not found.
Error: Access denied. Check your IAM policy.
```

## データモデル

### PR 詳細 JSON スキーマ

```typescript
/** --pr <id> --output json の出力型 */
interface PRDetailOutput {
  pullRequest: {
    id: string;
    title: string;
    description: string;
    author: string;           // ARN からユーザー名を抽出
    status: "OPEN" | "CLOSED" | "MERGED";
    createdAt: string;        // ISO 8601
    sourceReference: string;  // ソースブランチ
    destinationReference: string; // デスティネーションブランチ
  };
  approvals: {
    user: string;             // ARN からユーザー名を抽出
    state: string;            // "APPROVE" | "REVOKE"
  }[];
  diffs: {
    filePath: string;
    changeType: "A" | "M" | "D";  // Add, Modify, Delete
    content: string;          // unified diff 文字列
  }[];
  comments: {
    id: string;
    author: string;           // ARN からユーザー名を抽出
    content: string;
    createdAt: string;        // ISO 8601
    filePath: string | null;  // インラインコメントの場合のみ
    line: number | null;      // インラインコメントの場合のみ
    inReplyTo: string | null; // 返信先コメント ID
    reactions: {
      emoji: string;
      count: number;
    }[];
  }[];
}
```

### PR 一覧 JSON スキーマ

```typescript
/** --output json（--pr なし）の出力型 */
interface PRListOutput {
  repository: string;
  pullRequests: {
    id: string;
    title: string;
    author: string;
    status: "OPEN" | "CLOSED" | "MERGED";
    createdAt: string;        // ISO 8601
  }[];
}
```

### 設計判断

**diff は unified diff 文字列をそのまま格納する**:
- 構造化しすぎる（行単位のオブジェクト配列等）とトークン数が増大し、AI 処理のコストが上がる
- unified diff は `git diff` の出力と同じ形式で、AI モデルにとって最も馴染みのある形式
- `jq` 等で後処理する場合もテキストとして扱えば十分

**author は ARN ではなくユーザー名を格納する**:
- ARN（例: `arn:aws:iam::123456789:user/watany`）は冗長で AI にとってノイズ
- 既存の `extractAuthorName()` ユーティリティを活用し、`/` で分割した最後の部分を抽出
- 元の ARN が必要なユースケースは現時点で想定されない

**日時は ISO 8601 形式**:
- JSON で日時を表現する標準的な形式
- AI がパースしやすく、タイムゾーン情報も保持される
- `Date.toISOString()` で変換

**リアクション情報はコメントに含める**:
- リアクションは各コメントに紐づくデータであり、コメントオブジェクト内に含めるのが自然
- 別セクションに分離するとコメント ID でのルックアップが必要になり、AI にとって扱いにくい

## Markdown 出力フォーマット

### PR 詳細

```markdown
# PR #123: fix: login timeout

- **Author**: watany
- **Status**: OPEN
- **Created**: 2026-02-17T10:30:00Z
- **Branch**: feature/fix-login → main

## Approvals

- taro: APPROVE

## Diffs

### src/auth.ts (Modified)

\`\`\`diff
@@ -15,7 +15,7 @@
 const config = {
-  timeout: 3000,
+  timeout: 10000,
 };
\`\`\`

### src/auth.test.ts (Added)

\`\`\`diff
@@ -0,0 +1,15 @@
+import { describe, it, expect } from "vitest";
+...
\`\`\`

## Comments

### General Comments

**watany** (2026-02-17T10:30:00Z):
タイムアウトを延長しました

> **taro** (2026-02-17T11:00:00Z) [reply]:
> LGTMです 👍×2 🎉×1

### Inline Comments

**taro** on `src/auth.ts` line 16 (2026-02-17T11:15:00Z):
この値はconfigから取る方が良さそう

> **watany** (2026-02-17T11:30:00Z) [reply]:
> 次のPRで修正します
```

### PR 一覧

```markdown
# Pull Requests: my-repo

| ID | Title | Author | Status | Created |
|----|-------|--------|--------|---------|
| 42 | fix: login timeout | watany | OPEN | 2026-02-17T10:30:00Z |
| 41 | feat: add search | taro | OPEN | 2026-02-16T08:00:00Z |
| 38 | chore: deps update | bot | MERGED | 2026-02-14T15:00:00Z |
```

### 設計判断: JSON vs Markdown のトレードオフ

| 観点 | JSON | Markdown |
|------|------|----------|
| AI へのトークン効率 | △ 構造タグがオーバーヘッド | ◎ テキストベースで無駄が少ない |
| プログラムでの後処理 | ◎ `jq` 等で自在に操作 | △ パースが必要 |
| AI の理解しやすさ | ○ 構造が明確 | ◎ 自然言語に近い形式 |
| パイプ連携 | ◎ 型安全で扱いやすい | ○ テキストとして扱える |

**パイプ時のデフォルトは JSON にする**:
- プログラム的な後処理（`jq`）が確実に動作する
- AI ツールの多くは JSON 入力に対応している
- Markdown が欲しい場合は `--output markdown` で明示指定すれば良い

## データフロー

### PR 詳細出力（`--pr <id> --output json`）

```
ユーザー                  CLI (cli.tsx)              output.ts                services/
  │                        │                          │                        │
  │── --pr 123 -o json ──→│                          │                        │
  │                        │── parseArgs() ──────────→│                        │
  │                        │   pr: "123", output: "json"                      │
  │                        │                          │                        │
  │                        │── isOutputMode() ────────→ true                  │
  │                        │                          │                        │
  │  stderr ←── "Fetching PR #123..."                 │                        │
  │                        │                          │                        │
  │                        │── outputPRDetail() ─────→│                        │
  │                        │                          │── createClient() ─────→│
  │                        │                          │── getPullRequestDetail()→│
  │                        │                          │←── PullRequestDetail ──│
  │                        │                          │── getApprovalStates() ─→│
  │                        │                          │←── Approval[] ─────────│
  │                        │                          │── getReactionsForComments()→│
  │                        │                          │←── ReactionsByComment ─│
  │                        │                          │                        │
  │                        │                          │── formatJSON() or formatMarkdown()
  │                        │←── formatted string ─────│                        │
  │                        │                          │                        │
  │  stdout ←── JSON/Markdown                         │                        │
  │                        │── process.exit(0)        │                        │
```

### パイプ自動検出

```
ユーザー                  CLI (cli.tsx)
  │                        │
  │── --pr 123 ──────────→│
  │  (stdout piped)        │
  │                        │── process.stdout.isTTY → undefined (non-TTY)
  │                        │── output を "json" にフォールバック
  │                        │── outputPRDetail(..., "json")
  │                        │
  │  stdout ←── JSON       │
```

### エラー時

```
ユーザー                  CLI (cli.tsx)
  │                        │
  │── --pr 999 -o json ──→│
  │                        │── outputPRDetail()
  │                        │   └── getPullRequestDetail() → throws Error
  │                        │
  │  stderr ←── "Error: Pull request 999 not found."
  │                        │── process.exit(1)
```

## コンポーネント設計

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/output.ts` | **新規**: 非インタラクティブ出力ロジック。PR データの取得・整形・出力を担当 |
| `src/output.test.ts` | **新規**: 出力モジュールのテスト |
| `src/utils/diff.ts` | **新規**: 共通 diff 計算ロジック。`computeUnifiedDiff` と `computeSimpleDiff` の共有コア |
| `src/utils/diff.test.ts` | **新規**: diff ロジックのテスト |
| `src/cli.tsx` | `--pr`、`--output` / `-o` オプションのパース追加。出力モードの分岐ロジック追加。ヘルプテキスト更新 |
| `src/cli.test.ts` | 新規オプションのパーステスト追加 |
| `src/components/PullRequestDetail.tsx` | `computeSimpleDiff` を `src/utils/diff.ts` からの import に変更（Tidy First） |
| `src/completions.ts` | 補完スクリプトに `--pr` と `--output` オプションを追加 |
| `src/completions.test.ts` | 新規オプションの補完テスト追加 |

### 1. output モジュール（新規）

#### ファイル構成

```
src/output.ts        — 非インタラクティブ出力ロジック
src/output.test.ts   — テスト
```

#### 型定義

```typescript
// src/output.ts

export type OutputFormat = "json" | "markdown";

export function isValidOutputFormat(value: string): value is OutputFormat {
  return value === "json" || value === "markdown";
}
```

#### PR 詳細出力

```typescript
// src/output.ts

import type { CodeCommitClient } from "@aws-sdk/client-codecommit";
import { extractAuthorName } from "./utils/formatDate.js";
import {
  getApprovalStates,
  getBlobContent,
  getPullRequestDetail,
  getReactionsForComments,
  listPullRequests,
  type PullRequestDisplayStatus,
} from "./services/codecommit.js";
import { mapWithLimit } from "./utils/mapWithLimit.js";

export async function outputPRDetail(
  client: CodeCommitClient,
  repositoryName: string,
  pullRequestId: string,
  format: OutputFormat,
): Promise<void> {
  console.error(`Fetching PR #${pullRequestId} from ${repositoryName}...`);

  // 1. PR 詳細の取得（diff + コメント含む）
  const detail = await getPullRequestDetail(client, pullRequestId, repositoryName);
  const pr = detail.pullRequest;
  const target = pr.pullRequestTargets?.[0];

  // 2. 承認状態の取得
  const revisionId = pr.revisionId ?? "";
  const approvals = revisionId
    ? await getApprovalStates(client, { pullRequestId, revisionId })
    : [];

  // 3. diff テキストの生成（blob コンテンツの取得）
  const diffs = await buildDiffTexts(client, repositoryName, detail.differences);

  // 4. リアクションの取得
  const allCommentIds = detail.commentThreads
    .flatMap((t) => t.comments)
    .map((c) => c.commentId)
    .filter((id): id is string => id != null);
  const reactionsByComment = allCommentIds.length > 0
    ? await getReactionsForComments(client, allCommentIds)
    : new Map();

  // 5. 出力データの組み立て
  const apiStatus = pr.pullRequestStatus ?? "OPEN";
  const isMerged = target?.mergeMetadata?.isMerged === true;
  const displayStatus: PullRequestDisplayStatus =
    apiStatus === "CLOSED" && isMerged ? "MERGED" : (apiStatus as PullRequestDisplayStatus);

  const output = {
    pullRequest: {
      id: pr.pullRequestId ?? pullRequestId,
      title: pr.title ?? "(no title)",
      description: pr.description ?? "",
      author: extractAuthorName(pr.authorArn ?? "unknown"),
      status: displayStatus,
      createdAt: pr.creationDate?.toISOString() ?? "",
      sourceReference: target?.sourceReference ?? "",
      destinationReference: target?.destinationReference ?? "",
    },
    approvals: approvals.map((a) => ({
      user: extractAuthorName(a.userArn ?? "unknown"),
      state: a.approvalState ?? "APPROVE",
    })),
    diffs,
    comments: detail.commentThreads.flatMap((thread) =>
      thread.comments.map((c) => ({
        id: c.commentId ?? "",
        author: extractAuthorName(c.authorArn ?? "unknown"),
        content: c.content ?? "",
        createdAt: c.creationDate?.toISOString() ?? "",
        filePath: thread.location?.filePath ?? null,
        line: thread.location?.filePosition ?? null,
        inReplyTo: c.inReplyTo ?? null,
        reactions: (reactionsByComment.get(c.commentId ?? "") ?? []).map((r) => ({
          emoji: r.emoji,
          count: r.count,
        })),
      })),
    ),
  };

  // 6. フォーマットに応じた出力
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatPRDetailMarkdown(output)}\n`);
  }
}
```

#### diff テキストの構築

```typescript
// src/output.ts

import type { Difference } from "@aws-sdk/client-codecommit";

interface DiffOutput {
  filePath: string;
  changeType: "A" | "M" | "D";
  content: string;
}

async function buildDiffTexts(
  client: CodeCommitClient,
  repositoryName: string,
  differences: Difference[],
): Promise<DiffOutput[]> {
  return mapWithLimit(differences, 6, async (diff) => {
    const filePath =
      diff.afterBlob?.path ?? diff.beforeBlob?.path ?? "(unknown)";
    const changeType = diff.changeType === "A" ? "A" : diff.changeType === "D" ? "D" : "M";

    // blob コンテンツの取得
    const [beforeContent, afterContent] = await Promise.all([
      diff.beforeBlob?.blobId
        ? getBlobContent(client, repositoryName, diff.beforeBlob.blobId)
        : Promise.resolve(""),
      diff.afterBlob?.blobId
        ? getBlobContent(client, repositoryName, diff.afterBlob.blobId)
        : Promise.resolve(""),
    ]);

    // unified diff の生成
    const content = computeUnifiedDiff(filePath, beforeContent, afterContent);

    return { filePath, changeType, content };
  });
}
```

#### unified diff の生成

```typescript
// src/output.ts

/**
 * 2 つのテキストから unified diff 文字列を生成する。
 * 既存の PullRequestDetail.computeSimpleDiff と同等のグリーディアルゴリズムを使用し、
 * TUI 用の DisplayLine[] ではなくプレーンテキストの unified diff 形式で出力する。
 *
 * アルゴリズム:
 * 1. 両方の行配列を先頭から走査
 * 2. 一致する行はコンテキスト行（` ` prefix）として出力
 * 3. 不一致の場合:
 *    a. before 側の行を消費（`-` prefix）: 5行以内に after 側でマッチが見つかれば停止
 *    b. after 側の行を消費（`+` prefix）: 5行以内に before 側でマッチが見つかれば停止
 * 4. 無限ループ防止: 両方が進まない場合は強制的に1行ずつ消費
 */
export function computeUnifiedDiff(
  filePath: string,
  before: string,
  after: string,
): string {
  const beforeLines = before ? before.split("\n") : [];
  const afterLines = after ? after.split("\n") : [];

  const header = [`--- a/${filePath}`, `+++ b/${filePath}`];

  // 差分行の計算（computeSimpleDiff と同等のロジック）
  const diffLines: string[] = [];
  let bi = 0;
  let ai = 0;

  while (bi < beforeLines.length || ai < afterLines.length) {
    if (bi < beforeLines.length && ai < afterLines.length && beforeLines[bi] === afterLines[ai]) {
      diffLines.push(` ${beforeLines[bi]}`);
      bi++;
      ai++;
    } else {
      const startBi = bi;
      const startAi = ai;

      // 削除行: before 側を消費
      while (bi < beforeLines.length && (ai >= afterLines.length || beforeLines[bi] !== afterLines[ai])) {
        const nextMatch = afterLines.indexOf(beforeLines[bi]!, ai);
        if (nextMatch !== -1 && nextMatch - ai < 5) break;
        diffLines.push(`-${beforeLines[bi]}`);
        bi++;
      }

      // 追加行: after 側を消費
      while (ai < afterLines.length && (bi >= beforeLines.length || afterLines[ai] !== beforeLines[bi])) {
        const nextMatch = beforeLines.indexOf(afterLines[ai]!, bi);
        if (nextMatch !== -1 && nextMatch - bi < 5) break;
        diffLines.push(`+${afterLines[ai]}`);
        ai++;
      }

      // 無限ループ防止
      if (bi === startBi && ai === startAi) {
        if (bi < beforeLines.length) {
          diffLines.push(`-${beforeLines[bi]}`);
          bi++;
        }
        if (ai < afterLines.length) {
          diffLines.push(`+${afterLines[ai]}`);
          ai++;
        }
      }
    }
  }

  // ハンクヘッダーの生成
  // 簡易実装: 変更がある場合は全体を1つのハンクとして出力
  if (diffLines.length > 0) {
    const hunkHeader = `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`;
    return [...header, hunkHeader, ...diffLines].join("\n");
  }

  return header.join("\n");
}
```

**設計判断**: diff 生成は既存の `PullRequestDetail` コンポーネント内の `computeSimpleDiff`（`src/components/PullRequestDetail.tsx:1382`）と同等のグリーディアルゴリズムを使う。ただし以下の点が異なる:

- **出力形式**: `DisplayLine[]`（TUI 用構造体）ではなく、プレーンテキストの unified diff 文字列
- **メタデータ**: `beforeLineNumber` / `afterLineNumber` 等の UI 用メタデータは不要
- **ハンクヘッダー**: `@@ -1,N +1,M @@` 形式のヘッダーを付与

共通ロジックの抽出は Tidy First の原則に従い、実装時に `src/utils/diff.ts` への Extract Helper を検討する。抽出後は `computeSimpleDiff` と `computeUnifiedDiff` の両方がコアの diff アルゴリズムを共有する形にする。

#### Markdown フォーマッター

```typescript
// src/output.ts

function formatPRDetailMarkdown(output: PRDetailOutput): string {
  const lines: string[] = [];

  // ヘッダー
  lines.push(`# PR #${output.pullRequest.id}: ${output.pullRequest.title}`);
  lines.push("");
  lines.push(`- **Author**: ${output.pullRequest.author}`);
  lines.push(`- **Status**: ${output.pullRequest.status}`);
  lines.push(`- **Created**: ${output.pullRequest.createdAt}`);
  lines.push(
    `- **Branch**: ${output.pullRequest.sourceReference} → ${output.pullRequest.destinationReference}`,
  );
  if (output.pullRequest.description) {
    lines.push("");
    lines.push(`## Description`);
    lines.push("");
    lines.push(output.pullRequest.description);
  }

  // 承認状態
  if (output.approvals.length > 0) {
    lines.push("");
    lines.push("## Approvals");
    lines.push("");
    for (const a of output.approvals) {
      lines.push(`- ${a.user}: ${a.state}`);
    }
  }

  // diff
  if (output.diffs.length > 0) {
    lines.push("");
    lines.push("## Diffs");
    for (const diff of output.diffs) {
      const typeLabel = diff.changeType === "A" ? "Added" : diff.changeType === "D" ? "Deleted" : "Modified";
      lines.push("");
      lines.push(`### ${diff.filePath} (${typeLabel})`);
      lines.push("");
      lines.push("```diff");
      lines.push(diff.content);
      lines.push("```");
    }
  }

  // コメント
  const generalComments = output.comments.filter((c) => c.filePath === null && c.inReplyTo === null);
  const inlineComments = output.comments.filter((c) => c.filePath !== null && c.inReplyTo === null);
  const replies = output.comments.filter((c) => c.inReplyTo !== null);

  if (output.comments.length > 0) {
    lines.push("");
    lines.push("## Comments");
  }

  if (generalComments.length > 0) {
    lines.push("");
    lines.push("### General Comments");
    for (const c of generalComments) {
      lines.push("");
      lines.push(formatCommentMarkdown(c));
      appendReplies(lines, c.id, replies);
    }
  }

  if (inlineComments.length > 0) {
    lines.push("");
    lines.push("### Inline Comments");
    for (const c of inlineComments) {
      lines.push("");
      lines.push(
        `**${c.author}** on \`${c.filePath}\` line ${c.line} (${c.createdAt}):`,
      );
      lines.push(c.content);
      formatReactionBadges(lines, c.reactions);
      appendReplies(lines, c.id, replies);
    }
  }

  return lines.join("\n");
}

/** 単一コメントを Markdown 形式にフォーマット */
function formatCommentMarkdown(comment: PRDetailOutput["comments"][number]): string {
  const reactionBadge =
    comment.reactions.length > 0
      ? ` ${comment.reactions.map((r) => `${r.emoji}×${r.count}`).join(" ")}`
      : "";
  return `**${comment.author}** (${comment.createdAt}):\n${comment.content}${reactionBadge}`;
}

/** コメントへのリアクションバッジを行に追加 */
function formatReactionBadges(
  lines: string[],
  reactions: { emoji: string; count: number }[],
): void {
  if (reactions.length > 0) {
    lines.push(reactions.map((r) => `${r.emoji}×${r.count}`).join(" "));
  }
}

/** 指定コメントへの返信を `>` 引用形式で追加 */
function appendReplies(
  lines: string[],
  parentId: string,
  allReplies: PRDetailOutput["comments"],
): void {
  const replies = allReplies.filter((r) => r.inReplyTo === parentId);
  for (const reply of replies) {
    const reactionBadge =
      reply.reactions.length > 0
        ? ` ${reply.reactions.map((r) => `${r.emoji}×${r.count}`).join(" ")}`
        : "";
    lines.push("");
    lines.push(`> **${reply.author}** (${reply.createdAt}) [reply]:`);
    lines.push(`> ${reply.content}${reactionBadge}`);
  }
}
```

#### PR 一覧出力

```typescript
// src/output.ts

export async function outputPRList(
  client: CodeCommitClient,
  repositoryName: string,
  format: OutputFormat,
): Promise<void> {
  console.error(`Fetching pull requests from ${repositoryName}...`);

  const { pullRequests } = await listPullRequests(client, repositoryName);

  const output = {
    repository: repositoryName,
    pullRequests: pullRequests.map((pr) => ({
      id: pr.pullRequestId,
      title: pr.title,
      author: extractAuthorName(pr.authorArn),
      status: pr.status,
      createdAt: pr.creationDate.toISOString(),
    })),
  };

  if (format === "json") {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatPRListMarkdown(output)}\n`);
  }
}

function formatPRListMarkdown(output: PRListOutput): string {
  const lines: string[] = [];
  lines.push(`# Pull Requests: ${output.repository}`);
  lines.push("");
  lines.push("| ID | Title | Author | Status | Created |");
  lines.push("|----|-------|--------|--------|---------|");
  for (const pr of output.pullRequests) {
    lines.push(`| ${pr.id} | ${pr.title} | ${pr.author} | ${pr.status} | ${pr.createdAt} |`);
  }
  return lines.join("\n");
}
```

### 2. CLI の変更

#### ParsedArgs の変更

```typescript
interface ParsedArgs {
  repoName?: string;
  profile?: string;
  region?: string;
  help?: boolean;
  version?: boolean;
  completions?: string;
  pr?: string;            // v0.4.0 追加
  output?: string;        // v0.4.0 追加
}
```

#### parseArgs の変更

```typescript
export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    // ... 既存のオプション処理 ...
    } else if (arg === "--pr") {
      if (nextArg && !nextArg.startsWith("-")) {
        result.pr = nextArg;
        i++;
      } else {
        result.pr = "";
      }
    } else if (arg === "--output" || arg === "-o") {
      if (nextArg && !nextArg.startsWith("-")) {
        result.output = nextArg;
        i++;
      } else {
        result.output = "";
      }
    // ...
  }

  return result;
}
```

#### モジュールレベル実行の変更

```typescript
// cli.tsx
import { isValidOutputFormat, outputPRDetail, outputPRList } from "./output.js";

// ... 既存の --help, --version, --completions 処理 ...

// v0.4.0: 非インタラクティブ出力モード
// --output または --pr が明示的に指定された場合のみ出力モードに入る。
// !process.stdout.isTTY だけでは出力モードにしない（意図しない挙動を防ぐため）。
// ただし --pr 指定時に --output が省略され、かつ非 TTY の場合は JSON にフォールバック。
const isOutputMode =
  parsed.output !== undefined ||
  parsed.pr !== undefined;

if (isOutputMode) {
  // 出力フォーマットの決定
  let format: OutputFormat;
  if (parsed.output !== undefined) {
    if (!isValidOutputFormat(parsed.output)) {
      console.error(`Invalid output format: "${parsed.output}". Use json or markdown.`);
      process.exit(1);
    }
    format = parsed.output;
  } else if (!process.stdout.isTTY) {
    // --pr のみ指定 + パイプ接続 → JSON にフォールバック
    format = "json";
  } else {
    // --pr のみ指定 + TTY → --output の指定が必要
    console.error('Specify --output format (json or markdown) or pipe the output.');
    process.exit(1);
  }

  // リポジトリ名の確認
  if (!parsed.repoName) {
    console.error("Repository name is required for output mode.");
    process.exit(1);
  }

  const client = createClient({
    ...(parsed.profile != null ? { profile: parsed.profile } : {}),
    ...(parsed.region != null ? { region: parsed.region } : {}),
  });

  try {
    if (parsed.pr !== undefined && parsed.pr !== "") {
      // --pr <id> → PR 詳細出力
      await outputPRDetail(client, parsed.repoName, parsed.pr, format);
    } else {
      // --pr（ID 省略）または --output のみ → PR 一覧出力
      await outputPRList(client, parsed.repoName, format);
    }
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// ... 既存の TUI 起動ロジック（変更なし） ...
```

#### HELP_TEXT の変更

```typescript
const HELP_TEXT = `review-codecommit - A TUI tool for reviewing AWS CodeCommit pull requests

Usage: review-codecommit [options] [repository]

Options:
  --profile <name>       AWS profile to use
  --region <region>       AWS region to use
  --pr [id]              Specify pull request ID (omit id for PR list)
  --output, -o <format>   Output format: json, markdown
  --completions <shell>   Generate completion script (bash, zsh, fish)
  --help, -h              Show this help message
  --version, -v           Show version number

Navigation (TUI mode):
  j/k or arrows       Move cursor
  Enter               Select item
  Esc/q               Go back / quit
  ?                   Show help

Output mode:
  review-codecommit <repo> --pr <id> --output json      PR detail as JSON
  review-codecommit <repo> --pr <id> --output markdown   PR detail as Markdown
  review-codecommit <repo> --pr <id> | <command>        Auto JSON via pipe
  review-codecommit <repo> --pr --output json              PR list as JSON
  review-codecommit <repo> --pr | <command>               PR list as JSON via pipe
  review-codecommit <repo> --output json                   PR list as JSON`;
```

## エッジケースと対処方針

### CLI オプション解析

| ケース | 動作 |
|--------|------|
| `--pr 123 --output json` | 正常: PR 詳細を JSON 出力 |
| `--pr 123 --output markdown` | 正常: PR 詳細を Markdown 出力 |
| `--pr 123 -o json` | 正常: `-o` は `--output` の短縮形 |
| `--pr 123`（パイプ接続） | 正常: 自動的に JSON 出力 |
| `--pr 123`（TTY、`--output` なし） | エラー: フォーマット指定を促すメッセージ |
| `--output json`（`--pr` なし） | 正常: PR 一覧を JSON 出力 |
| `--pr`（ID 省略）+ `--output json` | 正常: PR 一覧を JSON 出力 |
| `--pr`（ID 省略）+ パイプ接続 | 正常: PR 一覧を JSON 出力（自動検出） |
| `--pr`（ID 省略）+ TTY + `--output` なし | エラー: フォーマット指定を促すメッセージ |
| `--output`（値なし） | エラー: フォーマット指定が必要な旨のメッセージ |
| `--output yaml` | エラー: 不正なフォーマットのメッセージ |
| `--pr 123 --output json --help` | `--help` が優先 |
| リポジトリ名なしで `--output json` | エラー: リポジトリ名が必要な旨のメッセージ |
| `--pr abc`（数値以外） | CodeCommit API に渡す。API がバリデーション（PR 不在エラー） |

### データ取得時

| ケース | 動作 |
|--------|------|
| 存在しない PR ID | stderr: `Error: Pull request 999 not found.` → exit(1) |
| 存在しないリポジトリ | stderr: `Error: Repository not found.` → exit(1) |
| AWS 認証失敗 | stderr: `Error: ...` → exit(1) |
| 権限不足 | stderr: `Error: Access denied. Check your IAM policy.` → exit(1) |
| ネットワークエラー | stderr: `Error: ...` → exit(1) |
| Blob が 1MB 超 | diff content に `[File too large to display]` を含める（既存動作と同一） |
| diff がないPR（コミットなし） | `diffs: []` を出力 |
| コメントがない PR | `comments: []` を出力 |
| 承認がない PR | `approvals: []` を出力 |

### 出力時

| ケース | 動作 |
|--------|------|
| JSON の特殊文字（改行、引用符） | `JSON.stringify` が自動エスケープ |
| Markdown のパイプ文字（テーブル内） | PR 一覧テーブルで `|` を含むタイトルは `\|` にエスケープ |
| 非常に大きな PR（大量の diff） | メモリに読み込み後出力。並行取得数は既存の 6 を維持 |
| stdout への書き込みエラー（パイプ切断） | EPIPE エラーは無視して exit(0)（`head` 等との連携時に発生） |

## セキュリティ考慮

### 出力データ

- 出力に含まれるのは CodeCommit API から取得したデータのみ。ローカルファイルの内容は含まれない
- ARN の IAM アカウント ID 部分はユーザー名抽出により除去される
- AWS プロファイル名やリージョンは出力に含まれない

### Markdown 出力時のコンテンツインジェクション

コメント内容や PR タイトル/説明は CodeCommit ユーザーが自由に入力できるテキストであり、Markdown 構文を含む可能性がある:

- **コメント内の Markdown 構文**: `# heading`、`[link](url)` 等がコメント内容に含まれている場合、Markdown 出力に影響する可能性がある
- **テーブル内のパイプ文字**: PR 一覧テーブルでタイトルに `|` が含まれる場合、テーブルが崩れる
- **PR 説明内のコードブロック**: ` ``` ` が含まれる場合、diff セクションのコードブロックと入れ子になる

**対処方針**:
- コメント内容・PR 説明はそのまま出力する（エスケープしない）。AI に読ませる用途では、元のテキストを忠実に伝えることが重要
- PR 一覧テーブルのタイトル列のみ、`|` を `\|` にエスケープする（テーブル構造の維持）
- PR 説明内の ` ``` ` は、Description セクションをコードブロックで囲まないため問題にならない
- JSON 出力では `JSON.stringify` が自動エスケープするため、インジェクションの心配はない

### IAM 権限

v0.4.0 で追加の IAM 権限は不要。既存の読み取り権限のみで動作する:

```json
{
  "Action": [
    "codecommit:GetPullRequest",
    "codecommit:GetDifferences",
    "codecommit:GetBlob",
    "codecommit:GetCommentsForPullRequest",
    "codecommit:GetPullRequestApprovalStates",
    "codecommit:GetCommentReactions",
    "codecommit:ListPullRequests"
  ]
}
```

### EPIPE ハンドリング

パイプ先が途中で閉じた場合（`| head` 等）、EPIPE エラーが発生する。これを適切にハンドリングし、クラッシュスタックトレースを表示しない:

```typescript
process.on("EPIPE", () => {
  process.exit(0);
});
```

## 技術選定

### diff 生成: 自前実装 vs 外部ライブラリ

| 選択肢 | 評価 |
|--------|------|
| **自前実装（採用）** | 最小依存の方針に合致。既存の `computeSimpleDiff` ロジックを抽出して再利用。TUI 用のカラーコードを除いたプレーンテキスト版を実装 |
| `diff` / `jsdiff` ライブラリ | 追加依存が発生。unified diff の生成のみであればシンプルな自前実装で十分 |

### TTY 検出: `process.stdout.isTTY`

| 選択肢 | 評価 |
|--------|------|
| **`process.stdout.isTTY`（採用）** | Node.js 標準の API。Bun でも同様に動作。追加依存なし |
| `is-interactive` 等のライブラリ | 追加依存が発生。内部で同じ API を使っているため、直接使う方がシンプル |

### 出力: `process.stdout.write` vs `console.log`

| 選択肢 | 評価 |
|--------|------|
| **`process.stdout.write`（採用）** | stdout と stderr を明確に分離。データ出力は stdout、進捗/エラーは stderr（`console.error`） |
| `console.log` | 内部で `process.stdout.write` を呼ぶが、自動改行が付く。JSON 出力の改行制御が不明確になる |

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `isValidOutputFormat` | 有効値・無効値のバリデーション |
| `formatPRDetailMarkdown` | PR 詳細の Markdown 出力フォーマット検証 |
| `formatPRListMarkdown` | PR 一覧の Markdown 出力フォーマット検証 |
| `outputPRDetail` | AWS SDK をモックし、JSON/Markdown の出力内容を検証 |
| `outputPRList` | AWS SDK をモックし、JSON/Markdown の出力内容を検証 |
| `parseArgs`（拡張） | `--pr`、`--output`、`-o` オプションのパース |
| CLI 分岐ロジック | 出力モード判定、TTY 検出、エラー処理 |

カバレッジ 95% 以上を維持する。

### 具体的なテストケース

#### isValidOutputFormat

| # | テストケース | 入力 | 期待結果 |
|---|-------------|------|---------|
| 1 | json | `"json"` | `true` |
| 2 | markdown | `"markdown"` | `true` |
| 3 | 空文字列 | `""` | `false` |
| 4 | 不正な値 | `"yaml"` | `false` |
| 5 | 大文字 | `"JSON"` | `false` |

#### formatPRDetailMarkdown

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 基本的な PR | タイトル、Author、Status、Branch が含まれる |
| 2 | 承認あり | Approvals セクションにユーザー名と状態が含まれる |
| 3 | diff あり | Diffs セクションに diff コードブロックが含まれる |
| 4 | 一般コメントあり | General Comments セクションにコメント内容が含まれる |
| 5 | インラインコメントあり | Inline Comments セクションにファイルパスと行番号が含まれる |
| 6 | 返信あり | 返信が `>` 引用形式で表示される |
| 7 | リアクションあり | コメント末尾にリアクションバッジが含まれる |
| 8 | 空の PR（diff/コメントなし） | ヘッダーのみ出力、空セクションは省略 |
| 9 | description あり | Description セクションが含まれる |

#### formatPRListMarkdown

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 複数 PR | Markdown テーブルに全 PR が含まれる |
| 2 | 空の一覧 | ヘッダーとテーブルヘッダーのみ |
| 3 | タイトルにパイプ文字 | `\|` にエスケープされる |

#### computeUnifiedDiff

| # | テストケース | 入力 | 期待結果 |
|---|-------------|------|---------|
| 1 | ファイル追加（before が空） | before: `""`, after: `"line1\nline2"` | `+line1` / `+line2` が含まれる |
| 2 | ファイル削除（after が空） | before: `"line1\nline2"`, after: `""` | `-line1` / `-line2` が含まれる |
| 3 | 行変更 | before: `"old"`, after: `"new"` | `-old` / `+new` が含まれる |
| 4 | コンテキスト行 | before: `"same"`, after: `"same"` | ` same` が含まれる（スペース prefix） |
| 5 | 混合（追加・削除・コンテキスト） | before: `"a\nb\nc"`, after: `"a\nB\nc"` | ` a` / `-b` / `+B` / ` c` |
| 6 | ハンクヘッダー | 任意 | `@@ -1,N +1,M @@` 形式のヘッダーが含まれる |
| 7 | ファイルヘッダー | filePath: `"src/app.ts"` | `--- a/src/app.ts` / `+++ b/src/app.ts` |
| 8 | 両方空（変更なし） | before: `""`, after: `""` | ハンクなし（ヘッダーのみ） |
| 9 | 大きなファイル（1000行） | 1000行の before/after | タイムアウトせずに完了 |

#### buildDiffTexts

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 追加ファイル（beforeBlob なし） | changeType が `"A"`、diff content が `+` 行のみ |
| 2 | 削除ファイル（afterBlob なし） | changeType が `"D"`、diff content が `-` 行のみ |
| 3 | 変更ファイル（両方あり） | changeType が `"M"`、diff content に `+` と `-` が含まれる |
| 4 | 複数ファイル | 並行取得（mapWithLimit 6）で全ファイル処理 |
| 5 | Blob 1MB 超 | `[File too large to display]` が content に含まれる |

#### outputPRDetail（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | JSON 出力 | stdout に有効な JSON が出力される |
| 2 | Markdown 出力 | stdout に Markdown が出力される |
| 3 | PR 不在 | stderr にエラーメッセージ、process.exit(1) |
| 4 | 認証エラー | stderr にエラーメッセージ、process.exit(1) |
| 5 | 進捗メッセージ | stderr に `Fetching PR #...` が出力される |

#### outputPRList（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | JSON 出力 | stdout に有効な JSON が出力される |
| 2 | Markdown 出力 | stdout に Markdown テーブルが出力される |
| 3 | 空リスト | 空配列/空テーブルが出力される |

#### parseArgs（拡張）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `--pr 123` | `{ pr: "123" }` |
| 2 | `--pr`（ID 省略、末尾） | `{ pr: "" }`（一覧モードとして扱う） |
| 3 | `--pr --output json` | `{ pr: "", output: "json" }`（一覧モードとして扱う） |
| 4 | `--output json` | `{ output: "json" }` |
| 5 | `--output markdown` | `{ output: "markdown" }` |
| 6 | `-o json` | `{ output: "json" }` |
| 7 | `--output`（値なし） | `{ output: "" }` |
| 8 | `my-repo --pr 123 --output json` | `{ repoName: "my-repo", pr: "123", output: "json" }` |
| 9 | `--pr 123 --profile dev` | `{ pr: "123", profile: "dev" }` |
| 10 | `--help --pr 123` | `{ help: true, pr: "123" }` |

#### CLI 分岐ロジック

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `--pr 123 --output json` | `outputPRDetail` が呼ばれ exit(0) |
| 2 | `--output json`（`--pr` なし） | `outputPRList` が呼ばれ exit(0) |
| 3 | `--pr`（ID 省略）`--output json` | `outputPRList` が呼ばれ exit(0) |
| 4 | `--pr`（ID 省略、非 TTY） | `outputPRList` が JSON で呼ばれ exit(0) |
| 5 | `--pr 123`（非 TTY） | JSON で出力 |
| 6 | `--pr 123`（TTY、`--output` なし） | エラーメッセージ、exit(1) |
| 7 | `--pr`（ID 省略、TTY、`--output` なし） | エラーメッセージ、exit(1) |
| 8 | `--output invalid` | エラーメッセージ、exit(1) |
| 9 | リポジトリ名なし `--output json` | エラーメッセージ、exit(1) |

#### Property-Based Tests（fast-check）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 任意の文字列配列で parseArgs がスローしない | `--pr`、`--output` を含む入力でもクラッシュしない |
| 2 | `isValidOutputFormat` が任意の文字列でスローしない | 不正な入力でもクラッシュしない |

## 実装順序

各 Step は TDD サイクル（Red → Green → Refactor）で進める。

### Step 1: parseArgs 拡張 — `--pr`、`--output`、`-o` オプション

CLI オプションのパース拡張。TUI 動作に影響なし。

**この Step で変更するファイル**:
- `src/cli.tsx`: `ParsedArgs` に `pr`、`output` フィールド追加。`parseArgs` に分岐追加
- `src/cli.test.ts`: 新規オプションのパーステスト。property-based テスト拡張

**この Step の完了条件**: `parseArgs` の全テスト（既存 + 新規）が通過。

### Step 2: output モジュール — 型定義とフォーマッター

出力フォーマットのバリデーション、Markdown フォーマッター（純粋関数）の実装。

**この Step で変更するファイル**:
- `src/output.ts`: 新規作成。`OutputFormat` 型、`isValidOutputFormat`、`formatPRDetailMarkdown`、`formatPRListMarkdown`
- `src/output.test.ts`: 新規作成。フォーマッターのテスト

**この Step の完了条件**: フォーマッター関数の全テストが通過。

### Step 3: Tidy First — diff ロジックの Extract Helper

**この Step を先に行う理由**: Step 4 の `outputPRDetail` で unified diff を生成するために `computeUnifiedDiff` が必要。このロジックは既存の `computeSimpleDiff`（`PullRequestDetail.tsx:1382`）と同じ diff アルゴリズムを使う。先に共通部分を抽出しておくことで、Step 4 での重複実装を避ける。

`PullRequestDetail` コンポーネント内の `computeSimpleDiff` のコアアルゴリズムを `src/utils/diff.ts` に抽出し、TUI 用（`DisplayLine[]` を返す）とプレーンテキスト用（`string` を返す `computeUnifiedDiff`）の両方で再利用可能にする。

**この Step で変更するファイル**:
- `src/utils/diff.ts`: 新規作成。共通の diff 計算ロジック + `computeUnifiedDiff`
- `src/utils/diff.test.ts`: 新規作成。diff ロジックのテスト（`computeUnifiedDiff` のテストケース含む）
- `src/components/PullRequestDetail.tsx`: `computeSimpleDiff` を `src/utils/diff.ts` からの import に変更

**この Step の完了条件**: 既存テスト + 新規テストが全て通過。diff ロジックが一箇所に集約。画面表示は変更なし。

### Step 4: output モジュール — データ取得と出力

AWS SDK を使った PR データ取得・整形・出力ロジックの実装。Step 3 で抽出した `computeUnifiedDiff` を使用する。

**この Step で変更するファイル**:
- `src/output.ts`: `outputPRDetail`、`outputPRList`、`buildDiffTexts` 関数を追加。`computeUnifiedDiff` を `src/utils/diff.ts` から import
- `src/output.test.ts`: AWS SDK モックを使った統合テスト追加

**この Step の完了条件**: 出力関数の全テストが通過。

### Step 5: CLI — 出力モード分岐

CLI のモジュールレベル実行に出力モードの分岐ロジックを追加。

**この Step で変更するファイル**:
- `src/cli.tsx`: 出力モード判定、`outputPRDetail` / `outputPRList` 呼び出し、HELP_TEXT 更新、EPIPE ハンドリング
- `src/cli.test.ts`: 出力モードの分岐テスト追加

**この Step の完了条件**: CLI の全テスト（既存 + 新規）が通過。

### Step 6: シェル補完の更新

補完スクリプトに `--pr` と `--output` オプションを追加。

**この Step で変更するファイル**:
- `src/completions.ts`: 各シェルの補完スクリプトに `--pr` と `--output` を追加。`--output` の補完値は `json markdown`
- `src/completions.test.ts`: 新規オプションが補完に含まれることを確認

**この Step の完了条件**: 補完テストが通過。

### 実装順序の依存関係

```
Step 1: parseArgs 拡張 ←── 他の Step に依存なし（最初に実装）
  │
Step 2: 型定義とフォーマッター ←── Step 1 不要（独立した純粋関数）
  │
Step 3: Tidy First（diff 抽出）←── Step 1, 2 不要（既存コードのリファクタリング）
  │
Step 4: データ取得と出力 ←── Step 2（フォーマッター）+ Step 3（computeUnifiedDiff）
  │
Step 5: CLI 分岐 ←── Step 1（parseArgs）+ Step 4（output 関数）
  │
Step 6: シェル補完 ←── Step 1（新オプション名の確定）
  │
Step 7: CI チェック ←── 全 Step 完了後
  │
Step 8: ドキュメント ←── Step 7 通過後
```

Step 1, 2, 3 は互いに独立しており、並行して進めることも可能。

### Step 7: 全体テスト・カバレッジ確認

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

### Step 8: ドキュメント更新

**この Step で変更するファイル**:
- `docs/requirements.md`: v0.4.0 機能スコープセクション追加
- `docs/roadmap.md`: v0.4.0 セクション更新
- `README.md`: 出力モードの使用例を追記
