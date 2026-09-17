# アクティビティタイムライン設計書

**バージョン**: v0.4.0
**ステータス**: 実装完了 ✅
**最終更新**: 2026-02-18

---

## 実装ステータス

> **✅ 実装完了 — 2026-02-18**
>
> `feat: implement v0.4 activity timeline` (commit `de104d6`) にてすべての実装が完了し、CI 全チェック通過（カバレッジ 95.12%）を確認済み。
>
> **実装済みファイル**:
> - `src/services/codecommit.ts` — `getPullRequestActivity` 関数、`PrActivityEvent` 型、`PullRequestActivityResult` 型を追加
> - `src/components/ActivityTimeline.tsx` — 新規コンポーネント（タイムライン表示、j/k ナビゲーション、ページネーション、エラー表示）
> - `src/components/ActivityTimeline.test.tsx` — 20 件のテスト
> - `src/components/PullRequestDetail.tsx` — `A` キーハンドラ、`onShowActivity` Props、フッター更新
> - `src/app.tsx` — `"activity"` スクリーン、`loadActivity`/`handleShowActivity`/`handleLoadNextActivityPage` ハンドラ、activity 状態追加
> - `src/components/Help.tsx` — `A - Activity timeline` キーバインド追加
> - `src/utils/formatError.ts` — `"activity"` コンテキスト追加
>
> **後続の性能改善（2026-09-16）**: 全件レンダリングをやめ、カーソル周辺 30 行だけ描画する。`ActivityEventRow` は `React.memo`。詳細は `docs/design-perf-bottlenecks.md`（#102）。
>
> **後続のリファクタ（#112）**: `loadActivity` の手書き `isLoadingActivity` / `activityError` を `useAsyncAction` に寄せた。`ActivityTimeline` には `activityAction.isProcessing` / `activityAction.error` を渡す。画面全体の `withLoadingState` とは統合していない。
>
> **設計との主な差異**: 非同期状態は当初の専用 `useState` 2 つから `useAsyncAction` に変更（#112）。それ以外は設計書どおり。

---

## 概要

PR のイベント履歴をタイムライン形式で表示する機能を実装する。`DescribePullRequestEventsCommand` を使用し、コメント投稿・承認・マージ・ステータス変更などのイベントを時系列で一覧表示する。

TUI ツールとして、ブラウザを開かずに PR の流れ（誰がいつ何をしたか）を把握できるようにすることが目的。

## スコープ

### 今回やること

- PR 詳細画面から `A` キーでアクティビティタイムライン画面を表示
- `DescribePullRequestEventsCommand` でイベント一覧を取得・表示
- サポートするイベント種別:
  - `PULL_REQUEST_CREATED` — PR 作成
  - `PULL_REQUEST_STATUS_CHANGED` — ステータス変更（クローズ・再オープン）
  - `PULL_REQUEST_SOURCE_REFERENCE_UPDATED` — ソースブランチ更新（force push 等）
  - `PULL_REQUEST_MERGE_STATE_CHANGED` — マージ状態変更（コンフリクト解消等）
  - `PULL_REQUEST_APPROVAL_RULE_CREATED` — 承認ルール作成
  - `PULL_REQUEST_APPROVAL_RULE_DELETED` — 承認ルール削除
  - `PULL_REQUEST_APPROVAL_RULE_UPDATED` — 承認ルール更新
  - `PULL_REQUEST_APPROVAL_RULE_OVERRIDDEN` — 承認ルールのオーバーライド
  - `PULL_REQUEST_APPROVALS_RESET` — 承認リセット
  - `PULL_REQUEST_APPROVAL_STATE_CHANGED` — 承認状態変更（Approve / Revoke）
- j/k ナビゲーション
- ページネーション（`n` キーで次ページ、nextToken ベースの追記方式）
- タイムライン画面から `q`/`Esc` で PR 詳細画面に戻る

### 今回やらないこと

- コメントイベントの表示 — `DescribePullRequestEventsCommand` はコメント投稿をイベントとして返さない（別 API の `GetCommentsForPullRequest` で取得済みのため、タイムラインには含めない）
- 自動リフレッシュ（ポーリング） — v0.4.0 では手動でタイムラインを開くことでのみ最新状態を確認できる。自動リフレッシュは将来のバージョンで対応
- リアルタイム通知バッジ — 自動リフレッシュと組み合わせて将来対応
- イベントの詳細表示（承認ルールの内容等） — 基本的なイベント種別とアクターの表示にとどめる

## AWS SDK API

### DescribePullRequestEventsCommand（新規）

PR のイベント履歴を取得する。

```typescript
import { DescribePullRequestEventsCommand } from "@aws-sdk/client-codecommit";

// Input
{
  pullRequestId: string;             // 必須: PR ID
  pullRequestEventType?: string;     // 任意: フィルタするイベント種別
  actorArn?: string;                 // 任意: フィルタするアクター ARN
  nextToken?: string;                // 任意: ページネーショントークン
  maxResults?: number;               // 任意: 最大件数（デフォルト: 100、上限: 100）
}

// Output
{
  pullRequestEvents: PullRequestEvent[];  // イベント一覧（古い順）
  nextToken?: string;                     // 次ページトークン
}
```

**`PullRequestEvent` 型**:

```typescript
interface PullRequestEvent {
  pullRequestId?: string;
  eventDate?: Date;
  pullRequestEventType?: string;       // イベント種別
  actorArn?: string;                   // 操作したユーザーの ARN
  pullRequestCreatedEventMetadata?: {
    repositoryName?: string;
    sourceCommitId?: string;
    destinationCommitId?: string;
    mergeBase?: string;
  };
  pullRequestStatusChangedEventMetadata?: {
    pullRequestStatus?: string;         // "OPEN" | "CLOSED"
  };
  pullRequestSourceReferenceUpdatedEventMetadata?: {
    repositoryName?: string;
    beforeCommitId?: string;
    afterCommitId?: string;
    mergeBase?: string;
  };
  pullRequestMergeStateChangedEventMetadata?: {
    repositoryName?: string;
    destinationReference?: string;
    beforeCommitId?: string;
    afterCommitId?: string;
    mergeMetadata?: {
      isMerged?: boolean;
      mergedBy?: string;
      mergeCommitId?: string;
      mergeOption?: string;
    };
  };
  approvalRuleEventMetadata?: {
    approvalRuleName?: string;
    approvalRuleId?: string;
    approvalRuleContent?: string;
  };
  approvalStateChangedEventMetadata?: {
    approvalStatus?: string;           // "APPROVE" | "REVOKE"
    overrideStatus?: string;
  };
  approvalRuleOverriddenEventMetadata?: {
    overrideStatus?: string;           // "OVERRIDE" | "REVOKE"
    approver?: {
      approvalState?: string;
      userArn?: string;
    };
  };
}
// 注意: MergeMetadata, Approval は @aws-sdk/client-codecommit からインポート可能だが、
// 実装では PullRequestEvent の SDK 型をそのまま使うため、明示的なインポートは実装時に確認する。
// `Approval` は既存の src/services/codecommit.ts に既に import 済み。
```

### API エラー一覧

| 例外 | HTTP | 説明 |
|------|------|------|
| `PullRequestDoesNotExistException` | 400 | PR が存在しない |
| `PullRequestIdRequiredException` | 400 | `pullRequestId` が未指定 |
| `InvalidPullRequestIdException` | 400 | `pullRequestId` のフォーマットが不正 |
| `InvalidPullRequestEventTypeException` | 400 | `pullRequestEventType` が不正 |
| `InvalidActorArnException` | 400 | `actorArn` が不正 |
| `InvalidContinuationTokenException` | 400 | ページネーショントークンが不正 |
| `InvalidMaxResultsException` | 400 | `maxResults` の値が不正 |
| `EncryptionIntegrityChecksFailedException` | 500 | 暗号化整合性チェックエラー |

## データモデル

### 新規型

```typescript
// src/services/codecommit.ts に追加

/** PR アクティビティイベントの表示用データ */
export interface PrActivityEvent {
  eventDate: Date;
  eventType: string;              // PULL_REQUEST_CREATED 等
  actorArn: string;               // 操作したユーザーの ARN（コンポーネント層で extractAuthorName を適用）
  description: string;            // 表示用の説明文（ARN ではなく actorArn をそのまま埋め込む）
}
```

**設計判断**: 既存の `PullRequestSummary.authorArn` パターンと同様に、サービス層は生の ARN を返す。コンポーネント層（`ActivityTimeline`）が `extractAuthorName(event.actorArn)` で表示名に変換する。`extractAuthorName` は `src/utils/formatDate.ts` にあり、サービス層ではなくコンポーネント・App層からのみ import される（既存の設計制約）。

`description` 内のアクター名は、サービス層では ARN を直接埋め込まず（`buildEventDescription` 内でも `extractAuthorName` を呼ばない）、ARN のままを入れるか、コンポーネント層で組み立てる。コードの簡潔さのため、`description` は `actorArn` を渡した後にコンポーネント側で `extractAuthorName(event.actorArn)` を呼び出して生成する実装とする。

### イベント種別 → 表示アイコン・説明文のマッピング

| `pullRequestEventType` | アイコン | `description` フィールド（述語部分） | 画面表示例（`{actorName} {description}`） |
|------------------------|---------|--------------------------------------|------------------------------------------|
| `PULL_REQUEST_CREATED` | 📝 | `created this PR` | `watany created this PR` |
| `PULL_REQUEST_STATUS_CHANGED` (→CLOSED) | 🚫 | `closed this PR` | `watany closed this PR` |
| `PULL_REQUEST_STATUS_CHANGED` (→OPEN) | 🔄 | `reopened this PR` | `watany reopened this PR` |
| `PULL_REQUEST_SOURCE_REFERENCE_UPDATED` | 🔀 | `updated the source branch` | `watany updated the source branch` |
| `PULL_REQUEST_MERGE_STATE_CHANGED` (merged) | ✅ | `merged this PR` | `watany merged this PR` |
| `PULL_REQUEST_MERGE_STATE_CHANGED` (not merged) | ⚠️ | `merge state changed` | `watany merge state changed` |
| `PULL_REQUEST_APPROVAL_RULE_CREATED` | 📋 | `created approval rule "{name}"` | `taro created approval rule "2 approvers"` |
| `PULL_REQUEST_APPROVAL_RULE_DELETED` | 🗑️ | `deleted approval rule "{name}"` | `taro deleted approval rule "..."` |
| `PULL_REQUEST_APPROVAL_RULE_UPDATED` | ✏️ | `updated approval rule "{name}"` | `taro updated approval rule "..."` |
| `PULL_REQUEST_APPROVAL_RULE_OVERRIDDEN` (OVERRIDE) | 🔓 | `overrode approval rules` | `taro overrode approval rules` |
| `PULL_REQUEST_APPROVAL_RULE_OVERRIDDEN` (REVOKE) | 🔒 | `revoked approval rule override` | `taro revoked approval rule override` |
| `PULL_REQUEST_APPROVALS_RESET` | 🔃 | `approvals reset (source branch updated)` | `watany approvals reset (source branch updated)` |
| `PULL_REQUEST_APPROVAL_STATE_CHANGED` (APPROVE) | ✅ | `approved this PR` | `taro approved this PR` |
| `PULL_REQUEST_APPROVAL_STATE_CHANGED` (REVOKE) | ❌ | `revoked approval` | `taro revoked approval` |
| 未知のイベント種別 | ℹ️ | `{eventType}` | `watany PULL_REQUEST_XXX` |

**表示フォーマット**: `ActivityEventRow` コンポーネントが `extractAuthorName(event.actorArn)` でアクター名を変換し、`"{actorName} {event.description}"` として表示する。

## 画面設計

### アクティビティタイムライン画面

```
┌─ PR #42: Activity Timeline ────────────────┐
│                                              │
│  📝 watany   created this PR       3h ago   │
│  💬 taro     commented             2h ago   │  ← コメントは別途表示（将来）
│  ✅ taro     approved this PR      1h ago   │
│  ✅ hanako   approved this PR      50m ago  │
│  ✅ watany   merged this PR        10m ago  │
│                                              │
│  Total: 5 events                             │
│                                              │
│  ↑↓ scroll  q back                           │
└──────────────────────────────────────────────┘
```

カーソル位置（`>` マーカー付き）:

```
│  📝 watany   created this PR       3h ago   │
│> ✅ taro     approved this PR      1h ago   │
│  ✅ hanako   approved this PR      50m ago  │
```

ローディング中:

```
│  Loading activity...                         │
```

イベントなし:

```
│  No activity events found.                   │
```

エラー表示:

```
│  Failed to load activity:                    │
│  Access denied. Check your IAM policy.       │
│                                              │
│  Press q to go back                          │
```

ページネーション（次ページあり）:

```
│  ✅ taro     approved this PR      1h ago   │
│  ✅ hanako   approved this PR      50m ago  │
│                                              │
│  n: next page                                │
│  ↑↓ scroll  n next  q back                  │
```

### 日時フォーマット

既存の `formatRelativeDate` ユーティリティを流用する（`src/utils/formatDate.ts`）。`"X ago"` 形式（例: `"3h ago"`, `"2d ago"`）。

### カラム幅

```
[アイコン] [アクター名 最大12文字] [説明文] [右寄せ: 日時]
```

アクター名が 12 文字を超える場合は末尾を `…` で省略。ターミナル幅に応じて説明文を折り返す。

## データフロー

```
App (状態管理)
 │
 ├─ screen: "activity"          ← 新規スクリーン
 ├─ activityEvents: PrActivityEvent[]
 ├─ activityNextToken: string | null
 ├─ isLoadingActivity: boolean
 └─ activityError: string | null
 │
 └─→ ActivityTimeline コンポーネント（新規）
      │
      ├─ local state:
      │   └─ cursorIndex: number
      │
      └─ Props:
          ├─ pullRequestTitle: string
          ├─ events: PrActivityEvent[]
          ├─ isLoading: boolean
          ├─ error: string | null
          ├─ hasNextPage: boolean
          ├─ onLoadNextPage: () => void
          └─ onBack: () => void
          （将来: 前ページ戻り `onLoadPrevPage` は v0.4.0 では実装しない）
```

### 画面遷移シーケンス

```
ユーザー           PullRequestDetail    App              CodeCommit API
  │                    │               │                    │
  │─── A キー ────────→│               │                    │
  │                    │── onShowActivity()→│               │
  │                    │               │── setScreen("activity")
  │                    │               │── loadActivity()
  │                    │               │──────────────────→│
  │                    │               │   DescribePR      │
  │                    │               │   Events          │
  │                    │               │←──────────────────│
  │                    │               │── setActivityEvents
  │                    │               │── setIsLoadingActivity(false)
  │                    │               │                    │
  │               ←─ ActivityTimeline ←│                    │
  │                    │               │                    │
  │─── q キー ─────────────────────→  │                    │
  │                    │               │── setScreen("detail")
  │                    │               │                    │
```

## コンポーネント設計

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/services/codecommit.ts` | `getPullRequestActivity` 関数を追加。`PrActivityEvent` 型を追加。イベント種別の変換ロジック |
| `src/services/codecommit.test.ts` | `getPullRequestActivity` のテスト追加 |
| `src/components/ActivityTimeline.tsx` | **新規**: タイムライン表示コンポーネント |
| `src/components/ActivityTimeline.test.tsx` | **新規**: ActivityTimeline のテスト |
| `src/components/PullRequestDetail.tsx` | `A` キーハンドラ追加。Props に `onShowActivity` 追加 |
| `src/components/PullRequestDetail.test.tsx` | `A` キー操作のテスト追加 |
| `src/app.tsx` | `screen: "activity"` ケース追加。`loadActivity` ハンドラ追加。state 追加 |
| `src/app.test.tsx` | アクティビティ統合テスト追加 |
| `src/components/Help.tsx` | `A` キーバインドの追加 |
| `src/components/Help.test.tsx` | テスト更新 |

### 1. サービス層

#### getPullRequestActivity（新規）

```typescript
// src/services/codecommit.ts
// 追加 import:
import {
  DescribePullRequestEventsCommand,
  type PullRequestEvent,
} from "@aws-sdk/client-codecommit";
// 既存 import の extractAuthorName は src/utils/formatDate.ts から参照（サービス層では直接使わない場合、
// もしくは codecommit.ts 内部に formatDate をインラインする設計も可）
// 実装時は PullRequestDetail 等の既存パターンを確認して統一すること

export interface PrActivityEvent {
  eventDate: Date;
  eventType: string;
  actorName: string;
  description: string;
}

export interface PullRequestActivityResult {
  events: PrActivityEvent[];
  nextToken?: string;
}

export async function getPullRequestActivity(
  client: CodeCommitClient,
  params: {
    pullRequestId: string;
    nextToken?: string;
    maxResults?: number;
  },
): Promise<PullRequestActivityResult> {
  const command = new DescribePullRequestEventsCommand({
    pullRequestId: params.pullRequestId,
    nextToken: params.nextToken,
    maxResults: params.maxResults ?? 50,
  });
  const response = await client.send(command);

  const events = (response.pullRequestEvents ?? []).map(mapPrEvent);

  return {
    events,
    nextToken: response.nextToken,
  };
}
```

#### mapPrEvent（内部ヘルパー）

```typescript
function mapPrEvent(event: PullRequestEvent): PrActivityEvent {
  const actorArn = event.actorArn ?? "";
  const eventDate = event.eventDate ?? new Date(0);
  const eventType = event.pullRequestEventType ?? "UNKNOWN";
  const description = buildEventDescription(event);

  return { eventDate, eventType, actorArn, description };
}

function buildEventDescription(event: PullRequestEvent): string {
  // アクター名の変換はコンポーネント層で行うため、ここでは {actor} プレースホルダーを使わず
  // アクションの「述語部分のみ」を返すアプローチとする。
  // コンポーネント側で extractAuthorName(event.actorArn) と description を組み合わせて表示する。
  const type = event.pullRequestEventType ?? "";

  switch (type) {
    case "PULL_REQUEST_CREATED":
      return "created this PR";

    case "PULL_REQUEST_STATUS_CHANGED": {
      const status =
        event.pullRequestStatusChangedEventMetadata?.pullRequestStatus;
      if (status === "CLOSED") return "closed this PR";
      if (status === "OPEN") return "reopened this PR";
      return "changed PR status";
    }

    case "PULL_REQUEST_SOURCE_REFERENCE_UPDATED":
      return "updated the source branch";

    case "PULL_REQUEST_MERGE_STATE_CHANGED": {
      const merged =
        event.pullRequestMergeStateChangedEventMetadata?.mergeMetadata?.isMerged;
      if (merged) return "merged this PR";
      return "merge state changed";
    }

    case "PULL_REQUEST_APPROVAL_RULE_CREATED": {
      const name = event.approvalRuleEventMetadata?.approvalRuleName ?? "";
      return `created approval rule "${name}"`;
    }

    case "PULL_REQUEST_APPROVAL_RULE_DELETED": {
      const name = event.approvalRuleEventMetadata?.approvalRuleName ?? "";
      return `deleted approval rule "${name}"`;
    }

    case "PULL_REQUEST_APPROVAL_RULE_UPDATED": {
      const name = event.approvalRuleEventMetadata?.approvalRuleName ?? "";
      return `updated approval rule "${name}"`;
    }

    case "PULL_REQUEST_APPROVAL_RULE_OVERRIDDEN": {
      const overrideStatus =
        event.approvalRuleOverriddenEventMetadata?.overrideStatus;
      if (overrideStatus === "OVERRIDE") return "overrode approval rules";
      if (overrideStatus === "REVOKE") return "revoked approval rule override";
      return "changed approval rule override";
    }

    case "PULL_REQUEST_APPROVALS_RESET":
      return "approvals reset (source branch updated)";

    case "PULL_REQUEST_APPROVAL_STATE_CHANGED": {
      const approvalStatus =
        event.approvalStateChangedEventMetadata?.approvalStatus;
      if (approvalStatus === "APPROVE") return "approved this PR";
      if (approvalStatus === "REVOKE") return "revoked approval";
      return "changed approval state";
    }

    default:
      return type;
  }
}
```

**設計判断**:
- `extractAuthorName` は `src/utils/formatDate.ts` にあり、サービス層からは import しない（既存アーキテクチャの制約）。ARN はそのまま `actorArn` フィールドで返し、コンポーネント層で変換する
- `description` はアクターを含まない「述語部分のみ」とし、コンポーネント側で `"{actorName} {description}"` として組み合わせて表示する
- イベント種別ごとにメタデータの参照箇所が異なるため、`switch` で明示的に分岐
- 未知のイベント種別はイベント種別文字列をそのまま表示（将来の API 追加に対応）

### 2. ActivityTimeline コンポーネント（新規）

#### Props

```typescript
interface Props {
  pullRequestTitle: string;
  events: PrActivityEvent[];
  isLoading: boolean;
  error: string | null;
  hasNextPage: boolean;
  onLoadNextPage: () => void;
  onBack: () => void;
}
```

#### 実装概要

```typescript
// src/components/ActivityTimeline.tsx

import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import type { PrActivityEvent } from "../services/codecommit.js";
import { formatRelativeDate } from "../utils/formatDate.js";

export function ActivityTimeline({
  pullRequestTitle,
  events,
  isLoading,
  error,
  hasNextPage,
  onLoadNextPage,
  onBack,
}: Props) {
  const [cursorIndex, setCursorIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === "q") {
      onBack();
      return;
    }

    if (input === "j" || key.downArrow) {
      setCursorIndex((prev) => Math.min(prev + 1, events.length - 1));
      return;
    }

    if (input === "k" || key.upArrow) {
      setCursorIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (input === "n" && hasNextPage && !isLoading) {
      onLoadNextPage();
      return;
    }
  });

  // 初回ローディング中（イベントがまだない状態）
  if (isLoading && events.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>Activity: {pullRequestTitle}</Text>
        <Text color="cyan">Loading activity...</Text>
      </Box>
    );
  }
  // 次ページロード中（既存イベントを表示しつつ下部にインジケーター表示）
  // isLoading && events.length > 0 の場合は通常表示のまま、フッターに "Loading..." を追加する

  // エラー表示
  if (error) {
    return (
      <Box flexDirection="column">
        <Text bold>Activity: {pullRequestTitle}</Text>
        <Text color="red">Failed to load activity:</Text>
        <Text color="red">{error}</Text>
        <Text dimColor>Press q to go back</Text>
      </Box>
    );
  }

  // イベントなし
  if (events.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>Activity: {pullRequestTitle}</Text>
        <Text dimColor>No activity events found.</Text>
        <Text dimColor>q back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Activity: {pullRequestTitle}</Text>
      <Box flexDirection="column" marginTop={1}>
        {events.map((event, i) => (
          <ActivityEventRow
            key={`${event.eventDate.toISOString()}-${i}`}
            event={event}
            isCursor={i === cursorIndex}
          />
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {isLoading
            ? "Loading more events..."
            : hasNextPage
              ? "↑↓ scroll  n next page  q back"
              : "↑↓ scroll  q back"}
        </Text>
      </Box>
    </Box>
  );
}
```

#### ActivityEventRow（内部コンポーネント）

```typescript
function ActivityEventRow({
  event,
  isCursor,
}: {
  event: PrActivityEvent;
  isCursor: boolean;
}) {
  const icon = getEventIcon(event.eventType);
  const timeAgo = formatRelativeDate(event.eventDate);
  const actorName = extractAuthorName(event.actorArn);
  const actorDisplay =
    actorName.length > 12
      ? `${actorName.slice(0, 11)}…`
      : actorName.padEnd(12);

  return (
    <Box>
      <Text>{isCursor ? "> " : "  "}</Text>
      <Text>{icon} </Text>
      <Text color="cyan">{actorDisplay}  </Text>
      <Text>{event.description.padEnd(40)}</Text>
      <Text dimColor>{timeAgo}</Text>
    </Box>
  );
}

function getEventIcon(eventType: string): string {
  const iconMap: Record<string, string> = {
    PULL_REQUEST_CREATED: "📝",
    PULL_REQUEST_STATUS_CHANGED: "🔄",
    PULL_REQUEST_SOURCE_REFERENCE_UPDATED: "🔀",
    PULL_REQUEST_MERGE_STATE_CHANGED: "✅",
    PULL_REQUEST_APPROVAL_RULE_CREATED: "📋",
    PULL_REQUEST_APPROVAL_RULE_DELETED: "🗑️",
    PULL_REQUEST_APPROVAL_RULE_UPDATED: "✏️",
    PULL_REQUEST_APPROVAL_RULE_OVERRIDDEN: "🔓",
    PULL_REQUEST_APPROVALS_RESET: "🔃",
    PULL_REQUEST_APPROVAL_STATE_CHANGED: "✅",
  };
  return iconMap[eventType] ?? "ℹ️";
}
```

**設計判断**:
- アクター名は最大 12 文字で省略（カラム幅の一貫性を確保）
- `formatDate` は既存ユーティリティを流用（`"X ago"` 形式）
- イベント行はシンプルな 1 行表示（メタデータの詳細は表示しない）
- カーソル行には `>` マーカーを表示（既存 UI パターンとの統一）

### 3. PullRequestDetail の変更

#### Props の変更

```typescript
interface Props {
  // ... 既存の Props すべて ...
  // v0.4.0 追加
  onShowActivity: () => void;
}
```

#### useInput の変更

```typescript
if (input === "A") {   // 大文字 A
  onShowActivity();
  return;
}
```

**設計判断**: `A` は小文字 `a`（Approve）と区別するため大文字を使用。既存のキーバインドと衝突しない。

#### フッターの変更

```tsx
// viewIndex === -1 かつコミットあり
"Tab switch view  ↑↓ cursor  c comment  C inline  R reply  o fold  e edit  d delete  g react  a approve  r revoke  m merge  x close  A activity  q back  ? help"

// コミットなし
"↑↓ cursor  c comment  C inline  R reply  o fold  e edit  d delete  g react  a approve  r revoke  m merge  x close  A activity  q back  ? help"

// コミットビュー（viewIndex >= 0）
"Tab next  S-Tab prev  ↑↓ cursor  e edit  d delete  a approve  r revoke  m merge  x close  q back  ? help"
```

### 4. App の変更

#### screen の追加

```typescript
type Screen = "repos" | "prs" | "detail" | "activity";
```

#### state の追加

```typescript
// v0.4.0: アクティビティ状態
const [activityEvents, setActivityEvents] = useState<PrActivityEvent[]>([]);
const [activityNextToken, setActivityNextToken] = useState<string | undefined>(undefined);
const [isLoadingActivity, setIsLoadingActivity] = useState(false);
const [activityError, setActivityError] = useState<string | null>(null);
```

#### loadActivity（新規）

```typescript
async function loadActivity(pullRequestId: string, nextToken?: string) {
  setIsLoadingActivity(true);
  setActivityError(null);
  try {
    const result = await getPullRequestActivity(client, {
      pullRequestId,
      nextToken,
      maxResults: 50,
    });
    if (nextToken) {
      // ページネーション: 既存イベントに追記
      setActivityEvents((prev) => [...prev, ...result.events]);
    } else {
      // 初回ロード: 置き換え
      setActivityEvents(result.events);
    }
    setActivityNextToken(result.nextToken);
  } catch (err) {
    setActivityError(formatActivityError(err));
  } finally {
    setIsLoadingActivity(false);
  }
}
```

#### handleShowActivity（新規）

```typescript
function handleShowActivity() {
  if (!selectedPr) return;
  setScreen("activity");
  setActivityEvents([]);
  setActivityNextToken(undefined);
  setActivityError(null);
  void loadActivity(selectedPr.pullRequestId!);
}
```

#### handleLoadNextActivityPage（新規）

```typescript
function handleLoadNextActivityPage() {
  if (!selectedPr || !activityNextToken || isLoadingActivity) return;
  void loadActivity(selectedPr.pullRequestId!, activityNextToken);
}
```

#### renderScreen の変更

```typescript
case "activity":
  return (
    <ActivityTimeline
      pullRequestTitle={prDetail?.title ?? ""}
      events={activityEvents}
      isLoading={isLoadingActivity}
      error={activityError}
      hasNextPage={!!activityNextToken}
      onLoadNextPage={handleLoadNextActivityPage}
      onBack={() => setScreen("detail")}
    />
  );
```

#### PullRequestDetail Props の変更

```tsx
case "detail":
  return (
    <PullRequestDetail
      // ... 既存の Props すべて ...
      onShowActivity={handleShowActivity}  // v0.4.0 追加
    />
  );
```

#### formatActivityError（新規）

```typescript
function formatActivityError(err: unknown): string {
  return formatErrorMessage(err, "activity");
}
```

`formatErrorMessage` に `"activity"` コンテキストを追加。アクティビティ固有のエラーメッセージを適切に変換する。

### 5. Help の変更

```typescript
<Text> A          Show activity timeline (PR Detail)</Text>
```

## キーバインド一覧（更新後）

| キー | 動作 | 画面 |
|------|------|------|
| `j` / `↓` | カーソル下移動 | アクティビティ画面 |
| `k` / `↑` | カーソル上移動 | アクティビティ画面 |
| `n` | 次ページ | アクティビティ画面（次ページあり時） |
| `q` / `Esc` | PR 詳細画面に戻る | アクティビティ画面 |
| `A` | アクティビティタイムライン表示 | PR 詳細画面 |

## エラーハンドリング

### アクティビティエラー

| エラー | 表示メッセージ |
|--------|---------------|
| `PullRequestDoesNotExistException` | "Pull request not found." |
| `InvalidContinuationTokenException` | "Page token expired. Reloading from the beginning." ＋ 自動で 1 ページ目に戻る |
| `AccessDeniedException` / `UnauthorizedException` | "Access denied. Check your IAM policy." |
| その他 | サニタイズしたエラーメッセージ |

### `InvalidContinuationTokenException` の特別処理

ページネーション中にトークンが無効になった場合（既存の `listPullRequests` の実装と同様）、自動的に 1 ページ目からリロードする。

既存コードのパターン（`err instanceof Error && err.name === "InvalidContinuationTokenException"`）に従い、ヘルパー関数は使わずインライン判定する。

```typescript
} catch (err) {
  if (err instanceof Error && err.name === "InvalidContinuationTokenException") {
    // 1ページ目からリロード
    setActivityEvents([]);
    setActivityNextToken(undefined);
    void loadActivity(selectedPr.pullRequestId!);
    return;
  }
  setActivityError(formatActivityError(err));
}
```

**注意**: `loadActivity` 本体（`handleLoadNextActivityPage` から呼ばれる場合）でこの判定を行うため、`loadActivity` のcatchブロックに `InvalidContinuationTokenException` 専用分岐を追加し、`handleLoadNextActivityPage` から `selectedPr` を参照できるよう `loadActivity` の外側でガードする。

### エッジケース

| ケース | 対処 |
|--------|------|
| アクティビティ画面表示中に PR が削除された | `PullRequestDoesNotExistException` → エラー表示。`q` で戻れる |
| ページネーション中のローディング状態 | `n` キーを押しても `isLoadingActivity` の間は無視 |
| イベントが 0 件 | 「No activity events found.」メッセージを表示 |
| 次ページ読み込み後のカーソル位置 | リセットしない（既に表示されている行にとどまる） |
| PR 詳細画面でない状態（コミットビュー等）での `A` キー | PR 詳細ルートビューのみで有効。コミットビューでも `A` が押されたら遷移する（コミットビューの表示は activity 画面から戻ると元に戻る） |

## セキュリティ考慮

### IAM 権限

v0.4.0 で追加の IAM 権限が必要:

```json
{
  "Effect": "Allow",
  "Action": [
    "codecommit:DescribePullRequestEvents"
  ],
  "Resource": "arn:aws:codecommit:<region>:<account-id>:<repository-name>"
}
```

### データのサニタイズ

- `actorArn` から抽出した表示名（`extractAuthorName`）は既存のサニタイズロジックを流用
- イベントの説明文は API レスポンスの値を直接テンプレートに埋め込むが、承認ルール名（`approvalRuleName`）はユーザー入力由来のため、ターミナルエスケープシーケンスが含まれないよう注意する
  - Ink のレンダリング経由のため XSS は発生しないが、異常に長い名前は省略表示する（将来対応）

## 技術選定

### 新規依存パッケージ: なし

`DescribePullRequestEventsCommand` は既存の `@aws-sdk/client-codecommit` パッケージに含まれている。

### スクリーン管理: 既存の `screen` state に追加

現在の `screen: "repos" | "prs" | "detail"` に `"activity"` を追加する。独立したコンポーネントとして実装することで、PR 詳細画面のコード量を増やさずに済む。

### ページネーション: 追記方式

次ページ読み込み時は既存イベントに追記する（`[...prev, ...result.events]`）。これにより：
- ページ間の移動が素早い（ネットワーク待ちなし）
- カーソル位置を維持できる

ただし、イベント数が多い場合はメモリ使用量が増加する。初期実装では簡素な追記方式を採用し、問題が発生した場合にページ置き換え方式に変更する。

### イベント表示: 全件リスト vs 仮想スクロール

Ink は仮想スクロールをサポートしていないため、全件をそのままレンダリングする。既存の `PullRequestDetail` でも同様のアプローチを採用している。PR あたりのイベント数は通常数十件以内のため、パフォーマンス上の問題は発生しにくい。

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `getPullRequestActivity` | `vi.fn()` で `client.send` をモック。イベント種別ごとの変換テスト（`buildEventDescription` は `getPullRequestActivity` の返り値の `description` フィールドを通じて間接テスト） |
| `ActivityTimeline` | `ink-testing-library` の `render` でスナップショットテストおよびキー入力テスト。表示・ナビゲーション・エラー・ページネーションを網羅 |
| `PullRequestDetail`（`A` キー） | `onShowActivity` が呼ばれることを確認 |
| `App`（統合テスト） | 画面遷移・データロード・エラーハンドリングの統合テスト |

**設計判断**: `buildEventDescription` は `getPullRequestActivity` の内部実装であり、非 export 関数としてモジュール境界を守る。テストは `getPullRequestActivity` の返り値（`PrActivityEvent.description`）を通じて行う。これにより内部実装の変更に対してテストが耐性を持つ。

カバレッジ 95% 以上を維持する。

### 具体的なテストケース

#### サービス層

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `getPullRequestActivity`: 正常取得 | `PrActivityEvent[]` が正しく返る |
| 2 | `getPullRequestActivity`: ページネーション | `nextToken` が返り、次ページ取得に使える |
| 3 | `getPullRequestActivity`: イベント 0 件 | 空配列と `nextToken: undefined` が返る |
| 4 | `getPullRequestActivity`: API エラー | エラーが上位に伝播する |
| 5 | `getPullRequestActivity`: PULL_REQUEST_CREATED イベント | `description` が `"{actor} created this PR"` になる |
| 6 | `getPullRequestActivity`: PULL_REQUEST_STATUS_CHANGED (CLOSED) | `description` が `"{actor} closed this PR"` になる |
| 7 | `getPullRequestActivity`: PULL_REQUEST_STATUS_CHANGED (OPEN) | `description` が `"{actor} reopened this PR"` になる |
| 8 | `getPullRequestActivity`: PULL_REQUEST_APPROVAL_STATE_CHANGED (APPROVE) | `description` が `"{actor} approved this PR"` になる |
| 9 | `getPullRequestActivity`: PULL_REQUEST_APPROVAL_STATE_CHANGED (REVOKE) | `description` が `"{actor} revoked approval"` になる |
| 10 | `getPullRequestActivity`: PULL_REQUEST_MERGE_STATE_CHANGED (merged) | `description` が `"{actor} merged this PR"` になる |
| 11 | `getPullRequestActivity`: 未知のイベント種別 | `description` にイベント種別文字列がそのまま入る |
| 12 | `getPullRequestActivity`: `actorArn` が空文字 | `actorName` が空文字（`extractAuthorName` のフォールバック） |

#### ActivityTimeline コンポーネント

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | スナップショット: 初回ローディング中 | "Loading activity..." が含まれる |
| 2 | スナップショット: イベントあり（標準状態） | イベント一覧・アイコン・アクター名・説明文・時刻が含まれる |
| 3 | スナップショット: イベントなし | "No activity events found." が含まれる |
| 4 | スナップショット: エラー表示 | エラーメッセージと "Press q to go back" が含まれる |
| 5 | スナップショット: 次ページあり | "n next page" ヒントが含まれる |
| 6 | `j` で下移動 | カーソルが次のイベントに移動する（`>` マーカーが移動） |
| 7 | `↓` で下移動 | `j` と同等 |
| 8 | `k` で上移動 | カーソルが前のイベントに移動する |
| 9 | 先頭で `k` | カーソルが 0 のまま |
| 10 | 末尾で `j` | カーソルが末尾のまま |
| 11 | `q` で戻る | `onBack` が呼ばれる |
| 12 | Esc で戻る | `onBack` が呼ばれる |
| 13 | `hasNextPage: true` かつ `n` | `onLoadNextPage` が呼ばれる |
| 14 | `hasNextPage: false` かつ `n` | 何も起こらない |
| 15 | ローディング中（次ページ）に `n` | 何も起こらない (`isLoading: true` でガード) |
| 16 | 次ページロード中（既存イベントあり） | イベント一覧が表示されつつフッターに "Loading more events..." が表示される |

#### PullRequestDetail

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `A` キー押下 | `onShowActivity` が呼ばれる |
| 2 | フッターに `A activity` が表示される | ナビゲーションヒントが更新されている |

#### App（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `handleShowActivity` 呼び出し | `screen: "activity"` に遷移し `loadActivity` が実行される |
| 2 | アクティビティ取得成功 | `activityEvents` にイベントが設定される |
| 3 | アクティビティ取得失敗 | `activityError` にメッセージが設定される |
| 4 | 次ページ読み込み | 既存イベントに新しいイベントが追記される |
| 5 | `onBack` 呼び出し | `screen: "detail"` に戻る |

#### Help

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | ヘルプ画面表示 | `A` のキーバインドが表示される |

## 実装順序

各 Step は TDD サイクル（Red → Green → Refactor）で進める。

### Step 1: サービス層 — getPullRequestActivity 追加

`src/services/codecommit.ts` に `getPullRequestActivity` 関数、`PrActivityEvent`・`PullRequestActivityResult` 型、`DescribePullRequestEventsCommand` の import を追加。内部ヘルパー `mapPrEvent`・`buildEventDescription` を追加。

**変更ファイル**:
- `src/services/codecommit.ts`
- `src/services/codecommit.test.ts`

**完了条件**: 全テストが通過。既存テストに影響なし。

### Step 2: ActivityTimeline コンポーネント作成

新規コンポーネントとして `ActivityTimeline` を作成。イベント一覧表示、j/k ナビゲーション、ページネーション、エラー表示を実装。

**変更ファイル**:
- `src/components/ActivityTimeline.tsx`
- `src/components/ActivityTimeline.test.tsx`

**完了条件**: ActivityTimeline の全テストが通過。

### Step 3: PullRequestDetail に A キーを追加

`A` キーハンドラを追加。`onShowActivity` Props を追加。フッター更新。

**変更ファイル**:
- `src/components/PullRequestDetail.tsx`
- `src/components/PullRequestDetail.test.tsx`

**完了条件**: `A` キーで `onShowActivity` が呼ばれるテストが通過。

### Step 4: App に activity スクリーンを統合

`screen: "activity"` ケース追加。`loadActivity`・`handleShowActivity`・`handleLoadNextActivityPage` を追加。state 追加。`formatErrorMessage` 拡張。

**変更ファイル**:
- `src/app.tsx`
- `src/app.test.tsx`

**完了条件**: 画面遷移・データロードの統合テストが通過。

### Step 5: Help 更新

`A` キーバインドを追加。

**変更ファイル**:
- `src/components/Help.tsx`
- `src/components/Help.test.tsx`

**完了条件**: Help 画面に `A Show activity timeline` が表示される。

### Step 6: 全体テスト・カバレッジ確認

```bash
bun run ci
```

**完了条件**:
- oxlint: エラーなし
- Biome: フォーマットチェック通過
- TypeScript: 型チェック通過
- knip: 未使用 export なし
- vitest: カバレッジ 95% 以上
- build: 本番ビルド成功

### Step 7: ドキュメント更新

**変更ファイル**:
- `docs/requirements.md`: v0.4.0 機能スコープ追加、キーバインド表に `A` 追加、エラーハンドリング表にアクティビティエラー追加
- `docs/roadmap.md`: v0.4.0 セクションに詳細情報を更新
- `README.md`: 機能一覧にアクティビティタイムラインを追記
