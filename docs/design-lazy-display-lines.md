# buildDisplayLines の遅延構築（Lazy Display Line Construction）設計書

## 概要

PR 詳細画面の `buildDisplayLines` は、表示に関わらず **全ファイルの全 DisplayLine オブジェクトを一括構築** している。ファイル数が多い大規模 PR では、数千〜数万の `DisplayLine` オブジェクトを生成し、メモリに保持する。実際に画面に表示されるのは常に **30 行程度** である。

本設計では、ファイル単位のセグメント分割と遅延実体化（lazy materialization）を導入し、**表示範囲付近のファイルのみ `DisplayLine` オブジェクトを生成** する仮想スクロール方式に変更する。

## 背景

### 現状のアーキテクチャ

```
buildDisplayLines(全ファイル)
  → lines[0..N] (全 DisplayLine を一括生成)
    → scrollOffset = f(cursorIndex)
      → visibleLines = lines.slice(offset, offset + 30)
        → render(visibleLines)
```

### 先行最適化との関係

| 施策 | 状態 | 効果 | 残る課題 |
|------|------|------|---------|
| `useMemo` 化（design-memoize-display-lines） | 実装済 | カーソル移動で再計算をスキップ | 依存値変更時の再構築コスト |
| `diffCacheRef`（computeSimpleDiff キャッシュ） | 実装済 | diff 再計算をスキップ | キャッシュ結果を全ファイル分イテレートして `DisplayLine` 配列を構築するコスト |
| Blob キャッシュ・並列化（design-optimize-resource-memory） | 実装済 | API コール削減・ロード高速化 | UI 層の処理コストは未対処 |

### 現状の問題

#### 1. DisplayLine オブジェクトの大量生成

`buildDisplayLines` は `differences` 配列の**全ファイル**に対して以下を実行する:

```typescript
for (const diff of differences) {
  // header + separator: 2 オブジェクト
  // computeSimpleDiff 結果の全行: 数十〜数百オブジェクト
  //   各行に filePath, diffKey を設定（既存キャッシュオブジェクトを変異）
  //   各行に対してインラインコメント照合
  // truncation 行: 0〜2 オブジェクト
  // trailing separator: 1 オブジェクト
}
```

50 ファイル × 平均 200 diff 行 = **10,000 個の DisplayLine オブジェクト**。CloudShell（1GB RAM）では、各オブジェクト約 200 バイトとして **約 2MB**。

#### 2. 全行スキャンの派生計算

`buildDisplayLines` の結果に対して、以下の派生計算が全行を走査する:

```typescript
// 全行スキャン: O(N)
const hasTruncation = useMemo(() => lines.some(l => l.type === "truncation"), [lines]);

// 全行スキャン: O(N)
const headerIndices = useMemo(() =>
  lines.reduce<number[]>((acc, line, i) => {
    if (line.type === "header") acc.push(i);
    return acc;
  }, []),
  [lines],
);
```

さらに `findNextHeaderIndex` / `findPrevHeaderIndex` は呼び出しのたびに `lines` 全体を走査して `headerIndices` を再構築する（メモ化されていない）。

#### 3. 依存値変更時の全再構築

`useMemo` の依存値（`collapsedThreads`, `diffLineLimits`, `reactionsByComment` 等）が変化すると、**全ファイルの DisplayLine を再構築** する。たとえば 1 ファイルのスレッド折り畳みを切り替えただけで、他の 49 ファイル分も再構築される。

### 定量分析

| PR 規模 | ファイル数 | 平均 diff 行 | DisplayLine 数 | メモリ（推定） | 表示行 |
|---------|-----------|-------------|---------------|-------------|--------|
| 小規模 | 5 | 50 | ~300 | ~60KB | 30 |
| 中規模 | 20 | 150 | ~3,500 | ~700KB | 30 |
| 大規模 | 50 | 300 | ~16,000 | ~3.2MB | 30 |
| 巨大 | 100 | 500（※截断あり） | ~35,000 | ~7MB | 30 |

※ `LARGE_DIFF_THRESHOLD = 1500` により個別ファイルは 300 行で截断されるが、ファイル数が多い場合の総量は依然として大きい。

## スコープ

### 今回やること

- `buildDisplayLines` をファイル単位のセグメント分割構造に置き換え
- 表示範囲のセグメントのみ `DisplayLine` を実体化する遅延構築の導入
- `headerIndices`, `fileNames`, `hasTruncation` をセグメントメタデータから O(F) で導出（F = ファイル数）
- `findNextHeaderIndex` / `findPrevHeaderIndex` をセグメントメタデータベースに最適化
- キャッシュ済み diff 行への `filePath` / `diffKey` の変異（mutation）を排除

### 今回やらないこと

- `computeSimpleDiff` アルゴリズム自体の改善
- Blob の遅延読み込み（表示ファイルのみ API 取得）— App 層の変更が必要
- 一般コメントセクションの遅延化（ファイル diff と異なり固定位置のため効果が薄い）
- `React.memo` / `useCallback` によるコンポーネントレベル最適化

## 技術選定

### セグメント分割 + 遅延実体化

| 選択肢 | 評価 |
|--------|------|
| **セグメント分割 + 遅延実体化（採用）** | ファイル単位で行数メタデータを保持し、表示範囲のファイルのみ `DisplayLine[]` を生成。既存の `diffCacheRef` と自然に統合。メモリと計算の両方を最適化 |
| 仮想スクロールライブラリ（react-window 等） | Web 向けライブラリ。Ink（React for CLI）環境では非互換。「最小依存」方針にも反する |
| `DisplayLine[]` の遅延 Proxy | `new Proxy([], { get(target, prop) { ... } })` で配列アクセスをフックし遅延生成。既存コードの `lines[i]`, `lines.slice()`, `lines.length` を透過的にサポート可能だが、Proxy のオーバーヘッドと TypeScript の型安全性に懸念。デバッグが困難 |
| フラット配列を維持 + 部分再構築 | 変更されたセグメントのみ再構築し、配列を splice で更新。インデックスのずれ管理が複雑。不変データの原則に反する |

### 採用理由

セグメント分割は以下の要件を満たす:

1. **総行数の即時取得**: 各セグメントの `lineCount` の合計 → O(F)
2. **ヘッダー位置の即時取得**: 各セグメントの累積オフセット → O(F)
3. **表示範囲の行取得**: 対象セグメントのみ実体化 → O(visible lines)
4. **部分再構築**: `collapsedThreads` 変更時、対象ファイルのセグメントのみ再計算

### セグメント粒度がファイル単位である根拠

| 粒度 | 評価 |
|------|------|
| **ファイル単位（採用）** | `differences` 配列の各要素が 1 ファイルに対応しており、既存のデータ構造と自然に対応する。ヘッダー行（ファイルパス）がセグメントの先頭に固定されるため、`headerIndices` の導出が自明。`n`/`N` キーによるファイル間ジャンプもセグメント境界と一致。`visibleLineCount = 30` に対し、1 ファイルのセグメント行数は通常 50〜300 行であり、実体化のオーバーヘッドと遅延削減のバランスが良い |
| 行単位 | 行ごとにセグメントを作るのは粒度が細かすぎる。セグメント管理のオーバーヘッド（オフセット配列、二分探索）が実体化コスト削減を上回る |
| 固定チャンク（例: 100 行ずつ） | ファイル境界をまたぐチャンクが発生し、ヘッダー位置の導出が複雑化する。インラインコメントの紐づけがファイル単位のため、チャンク分割とコメント管理の整合性が取りにくい |

## 設計

### 核心データ構造

#### `FileSegment`

各ファイルの差分に対応するセグメント。行数メタデータを保持し、`DisplayLine[]` の実体化を遅延する。

```typescript
interface FileSegment {
  readonly filePath: string;
  readonly diffKey: string;
  readonly lineCount: number;       // このセグメントの総行数
  readonly hasTruncation: boolean;  // truncation 行を含むか

  /** 遅延実体化: 呼び出し時に DisplayLine[] を生成しキャッシュする */
  materialize(): readonly DisplayLine[];
}
```

#### `GeneralCommentsSegment`

一般コメントセクション（ファイルに紐づかないコメント）。

```typescript
interface GeneralCommentsSegment {
  readonly lineCount: number;
  materialize(): readonly DisplayLine[];
}
```

#### `VirtualDisplayLines`

コンポーネントが消費するインターフェース。現在の `DisplayLine[]` の代替。

```typescript
interface VirtualDisplayLines {
  /** 総行数（カーソル境界、G ジャンプ、半ページスクロールで使用） */
  readonly length: number;

  /** ファイルヘッダーのグローバルインデックス配列 */
  readonly headerIndices: readonly number[];

  /** ファイルパス一覧（headerIndices と同順） */
  readonly fileNames: readonly string[];

  /** truncation 行が存在するか（ステータスバーの "t more" 表示で使用） */
  readonly hasTruncation: boolean;

  /** 指定インデックスの DisplayLine を取得（遅延実体化） */
  at(index: number): DisplayLine | undefined;

  /** 指定範囲の DisplayLine を取得（遅延実体化、visibleLines 用） */
  slice(start: number, end: number): DisplayLine[];
}
```

### セグメント構築とラインカウント

`buildFileSegment` は各ファイルについて **行数の事前計算** と **実体化関数のクロージャ生成** を行う。`computeSimpleDiff` 結果は `diffCacheRef` 経由で取得（キャッシュ済み）し、行数のカウントに使う。実体化時のみ `DisplayLine` オブジェクトを生成する。

```typescript
function buildFileSegment(
  diff: Difference,
  diffTexts: Map<string, { before: string; after: string }>,
  diffTextStatus: Map<string, "loading" | "loaded" | "error">,
  diffLineLimits: Map<string, number>,
  inlineThreadsByKey: Map<string, { thread: CommentThread; index: number }[]>,
  collapsedThreads: Set<number>,
  reactionsByComment: ReactionsByComment,
  diffCache: Map<string, DisplayLine[]>,
): FileSegment {
  const filePath = diff.afterBlob?.path ?? diff.beforeBlob?.path ?? "(unknown file)";
  const blobKey = `${diff.beforeBlob?.blobId ?? ""}:${diff.afterBlob?.blobId ?? ""}`;
  const texts = diffTexts.get(blobKey);
  const status = diffTextStatus.get(blobKey) ?? "loading";

  // --- 行数の事前計算（DisplayLine オブジェクト生成なし） ---
  let lineCount = 2; // header + separator（常に固定）
  let hasTruncation = false;
  let diffLines: DisplayLine[] | undefined;
  let displayLimit = 0;
  let totalLines = 0;

  if (texts) {
    const beforeLines = texts.before.split("\n");
    const afterLines = texts.after.split("\n");
    totalLines = beforeLines.length + afterLines.length;
    const defaultLimit = totalLines > LARGE_DIFF_THRESHOLD ? DIFF_CHUNK_SIZE : totalLines;
    const currentLimit = diffLineLimits.get(blobKey) ?? defaultLimit;
    displayLimit = Math.min(currentLimit, totalLines);
    const cacheKey = `${blobKey}:${displayLimit}`;

    // diffCache から取得（キャッシュ済みなら O(1)）
    diffLines = diffCache.get(cacheKey);
    if (!diffLines) {
      const { beforeLimit, afterLimit } = getSliceLimits(
        beforeLines.length, afterLines.length, displayLimit,
      );
      diffLines = computeSimpleDiff(
        beforeLines.slice(0, beforeLimit),
        afterLines.slice(0, afterLimit),
      );
      diffCache.set(cacheKey, diffLines);
    }

    // diff 行数 + 各行に付随するインラインコメント行数をカウント
    for (const dl of diffLines) {
      lineCount++; // diff 行自体
      lineCount += countInlineCommentLines(
        inlineThreadsByKey, filePath, dl, collapsedThreads,
      );
    }

    // truncation 行
    if (totalLines > displayLimit) {
      lineCount += 2; // truncate-context + truncation
      hasTruncation = true;
    }
  } else {
    lineCount += 1; // "Loading..." or "Failed..." のプレースホルダー行
  }

  lineCount += 1; // trailing separator

  // --- 遅延実体化クロージャ ---
  let cached: DisplayLine[] | null = null;

  function materialize(): readonly DisplayLine[] {
    if (cached) return cached;

    const result: DisplayLine[] = [];
    result.push({ type: "header", text: filePath });
    result.push({ type: "separator", text: "─".repeat(50) });

    if (texts && diffLines) {
      for (const dl of diffLines) {
        // 元キャッシュを変異させず、新しいプロパティを付与したオブジェクトを生成
        const line: DisplayLine = { ...dl, filePath, diffKey: blobKey };
        result.push(line);

        const matchingEntries = findMatchingThreadEntries(
          inlineThreadsByKey, filePath, dl,
        );
        for (const { thread, index: threadIdx } of matchingEntries) {
          appendThreadLines(
            result, thread, threadIdx, collapsedThreads, "inline", reactionsByComment,
          );
        }
      }
      if (totalLines > displayLimit) {
        const moreCount = Math.min(DIFF_CHUNK_SIZE, totalLines - displayLimit);
        result.push({
          type: "truncate-context",
          text: `... truncated ${displayLimit}/${totalLines} lines`,
          filePath, diffKey: blobKey,
        });
        result.push({
          type: "truncation",
          text: `[t] show next ${moreCount} lines`,
          filePath, diffKey: blobKey,
        });
      }
    } else if (status === "error") {
      result.push({ type: "context", text: "(Failed to load file content)", filePath, diffKey: blobKey });
    } else {
      result.push({ type: "context", text: "(Loading file content...)", filePath, diffKey: blobKey });
    }

    result.push({ type: "separator", text: "", diffKey: blobKey, filePath });

    cached = result;
    return cached;
  }

  return { filePath, diffKey: blobKey, lineCount, hasTruncation, materialize };
}
```

#### `countInlineCommentLines`（行数カウント専用ヘルパー）

```typescript
function countInlineCommentLines(
  threadsByKey: Map<string, { thread: CommentThread; index: number }[]>,
  filePath: string,
  line: DisplayLine,
  collapsedThreads: Set<number>,
): number {
  const entries = findMatchingThreadEntries(threadsByKey, filePath, line);
  let count = 0;
  for (const { thread, index } of entries) {
    const comments = thread.comments;
    if (comments.length === 0) continue;
    count += 1; // root comment
    const replies = comments.filter((c) => c !== (comments.find((c2) => !c2.inReplyTo) ?? comments[0]));
    const shouldFold = comments.length >= FOLD_THRESHOLD;
    const isCollapsed = collapsedThreads.has(index);
    if (shouldFold && isCollapsed) {
      count += 1; // fold indicator
    } else {
      count += replies.length; // all replies
    }
  }
  return count;
}
```

### `VirtualDisplayLines` の実装

```typescript
function createVirtualDisplayLines(
  segments: FileSegment[],
  generalComments: GeneralCommentsSegment | null,
): VirtualDisplayLines {
  // --- セグメントオフセットの事前計算: O(F) ---
  const segmentOffsets: number[] = [];  // segments[i] の開始行インデックス
  let offset = 0;
  const headerIndices: number[] = [];
  const fileNames: string[] = [];
  let hasTruncation = false;

  for (let i = 0; i < segments.length; i++) {
    segmentOffsets.push(offset);
    headerIndices.push(offset);        // header は各セグメントの先頭
    fileNames.push(segments[i]!.filePath);
    if (segments[i]!.hasTruncation) hasTruncation = true;
    offset += segments[i]!.lineCount;
  }

  const generalCommentsOffset = offset;
  const generalCommentsLength = generalComments?.lineCount ?? 0;
  const totalLength = offset + generalCommentsLength;

  // --- セグメント検索: 二分探索 O(log F) ---
  function findSegmentIndex(globalIndex: number): number {
    if (segments.length === 0) return -1; // ファイルセグメントなし
    if (globalIndex >= generalCommentsOffset) return -1; // 一般コメント領域
    let lo = 0;
    let hi = segmentOffsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segmentOffsets[mid]! <= globalIndex) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo;
  }

  // --- 実体化キャッシュ: セグメント単位 ---
  const materializedCache = new Map<number, readonly DisplayLine[]>();

  function getSegmentLines(segIndex: number): readonly DisplayLine[] {
    const cached = materializedCache.get(segIndex);
    if (cached) return cached;
    const lines = segments[segIndex]!.materialize();
    materializedCache.set(segIndex, lines);
    return lines;
  }

  return {
    length: totalLength,
    headerIndices,
    fileNames,
    hasTruncation,

    at(index: number): DisplayLine | undefined {
      if (index < 0 || index >= totalLength) return undefined;
      if (index >= generalCommentsOffset) {
        return generalComments?.materialize()[index - generalCommentsOffset];
      }
      const segIdx = findSegmentIndex(index);
      const localIndex = index - segmentOffsets[segIdx]!;
      return getSegmentLines(segIdx)[localIndex];
    },

    slice(start: number, end: number): DisplayLine[] {
      const result: DisplayLine[] = [];
      const clampedStart = Math.max(0, start);
      const clampedEnd = Math.min(end, totalLength);

      for (let i = clampedStart; i < clampedEnd; i++) {
        const line = this.at(i);
        if (line) result.push(line);
      }
      return result;
    },
  };
}
```

### `slice` の最適化

上記の `slice` は `at` を行ごとに呼ぶ素朴な実装だが、実際には連続する行は同一セグメント内にある。セグメント境界をまたぐ場合のみセグメントを切り替える最適化版:

```typescript
slice(start: number, end: number): DisplayLine[] {
  const result: DisplayLine[] = [];
  const s = Math.max(0, start);
  const e = Math.min(end, totalLength);
  if (s >= e) return result;

  let i = s;

  // ファイルセグメント領域
  while (i < e && i < generalCommentsOffset) {
    const segIdx = findSegmentIndex(i);
    const segStart = segmentOffsets[segIdx]!;
    const segEnd = segStart + segments[segIdx]!.lineCount;
    const lines = getSegmentLines(segIdx);

    const localStart = i - segStart;
    const localEnd = Math.min(e, segEnd) - segStart;
    for (let j = localStart; j < localEnd; j++) {
      result.push(lines[j]!);
    }
    i = segEnd;
  }

  // 一般コメント領域
  if (i < e && generalComments) {
    const gcLines = generalComments.materialize();
    const localStart = i - generalCommentsOffset;
    const localEnd = e - generalCommentsOffset;
    for (let j = localStart; j < localEnd; j++) {
      result.push(gcLines[j]!);
    }
  }

  return result;
},
```

### `buildVirtualDisplayLines`（トップレベル関数）

`buildDisplayLines` を置き換えるエントリポイント関数。内部で `buildFileSegment` と `createVirtualDisplayLines` を組み合わせる。

```typescript
function buildVirtualDisplayLines(
  differences: Difference[],
  diffTexts: Map<string, { before: string; after: string }>,
  diffTextStatus: Map<string, "loading" | "loaded" | "error">,
  diffLineLimits: Map<string, number>,
  commentThreads: CommentThread[],
  collapsedThreads: Set<number>,
  reactionsByComment: ReactionsByComment,
  diffCache?: Map<string, DisplayLine[]>,
): VirtualDisplayLines {
  // インラインコメントのインデックス構築（既存ロジックと同一）
  const inlineThreadsByKey = new Map<string, { thread: CommentThread; index: number }[]>();
  for (let i = 0; i < commentThreads.length; i++) {
    const thread = commentThreads[i]!;
    if (thread.location) {
      const key = `${thread.location.filePath}:${thread.location.filePosition}:${thread.location.relativeFileVersion}`;
      const existing = inlineThreadsByKey.get(key) ?? [];
      existing.push({ thread, index: i });
      inlineThreadsByKey.set(key, existing);
    }
  }

  // ファイルセグメント構築
  const segments: FileSegment[] = differences.map((diff) =>
    buildFileSegment(
      diff, diffTexts, diffTextStatus, diffLineLimits,
      inlineThreadsByKey, collapsedThreads, reactionsByComment,
      diffCache ?? new Map(),
    ),
  );

  // 一般コメントセグメント構築
  const generalThreads = commentThreads
    .map((t, i) => ({ thread: t, index: i }))
    .filter(({ thread }) => thread.location === null);

  let generalComments: GeneralCommentsSegment | null = null;
  if (generalThreads.length > 0) {
    const gcLines: DisplayLine[] = [];
    const totalComments = generalThreads.reduce(
      (sum, { thread }) => sum + thread.comments.length, 0,
    );
    gcLines.push({ type: "separator", text: "─".repeat(50) });
    gcLines.push({ type: "comment-header", text: `Comments (${totalComments}):` });
    for (const { thread, index: threadIdx } of generalThreads) {
      appendThreadLines(gcLines, thread, threadIdx, collapsedThreads, "general", reactionsByComment);
    }
    generalComments = {
      lineCount: gcLines.length,
      materialize: () => gcLines, // 一般コメントは即時構築（遅延化の効果が薄いため）
    };
  }

  return createVirtualDisplayLines(segments, generalComments);
}
```

#### 関数シグネチャの互換性

`buildVirtualDisplayLines` は `buildDisplayLines` と**同一の引数**を受け取る。戻り値の型が `DisplayLine[]` から `VirtualDisplayLines` に変わるが、コンポーネント内の消費箇所は以下の対応で吸収する（次セクション参照）。

### コンポーネント側の変更

#### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/components/PullRequestDetail.tsx` | `buildDisplayLines` → `buildVirtualDisplayLines` に置換。消費箇所を `VirtualDisplayLines` インターフェースに合わせて変更 |
| `src/components/PullRequestDetail.test.tsx` | 遅延構築の動作検証テスト追加。既存テストの `lines[i]` アクセスを `at(i)` に対応 |

#### Before → After の差分

**1. lines の構築**

```typescript
// Before
const lines = useMemo(() => {
  return buildDisplayLines(differences, diffTexts, ...);
}, [dependencies]);

// After
const lines = useMemo(() => {
  return buildVirtualDisplayLines(differences, diffTexts, ...);
}, [dependencies]);
```

**2. カーソル境界**

```typescript
// Before
setCursorIndex((prev) => Math.min(prev + 1, lines.length - 1));

// After（変更なし: VirtualDisplayLines.length で同じ）
setCursorIndex((prev) => Math.min(prev + 1, lines.length - 1));
```

**3. visibleLines の取得**

```typescript
// Before
const visibleLines = lines.slice(scrollOffset, scrollOffset + visibleLineCount);

// After（変更なし: VirtualDisplayLines.slice で同じシグネチャ）
const visibleLines = lines.slice(scrollOffset, scrollOffset + visibleLineCount);
```

**4. headerIndices / fileNames**

```typescript
// Before
const headerIndices = useMemo(() =>
  lines.reduce<number[]>((acc, line, i) => {
    if (line.type === "header") acc.push(i);
    return acc;
  }, []),
  [lines],
);
const fileNames = useMemo(() =>
  headerIndices.map((i) => lines[i]!.text),
  [headerIndices, lines],
);

// After（VirtualDisplayLines に組み込み済み、useMemo 不要）
const headerIndices = lines.headerIndices;
const fileNames = lines.fileNames;
```

**5. hasTruncation**

```typescript
// Before
const hasTruncation = useMemo(() =>
  lines.some((line) => line.type === "truncation"),
  [lines],
);

// After（VirtualDisplayLines に組み込み済み）
const hasTruncation = lines.hasTruncation;
```

**6. findNextHeaderIndex / findPrevHeaderIndex**

```typescript
// Before
function findNextHeaderIndex(lines: DisplayLine[], currentIndex: number): number {
  const headerIndices = lines.reduce<number[]>((acc, line, i) => { ... }, []);
  // 全行スキャン O(N)
}

// After
function findNextHeaderIndex(
  headerIndices: readonly number[],
  currentIndex: number,
): number {
  if (headerIndices.length === 0) return -1;
  const next = headerIndices.find((i) => i > currentIndex);
  return next ?? headerIndices[0]!;
  // O(F) — ファイル数のみ
}
```

**7. 現在行へのアクセス（各種アクション）**

```typescript
// Before
const currentLine = lines[cursorIndex];

// After
const currentLine = lines.at(cursorIndex);
```

**8. レンダリング**

```typescript
// Before
{visibleLines.map((line, index) => {
  const globalIndex = scrollOffset + index;
  const isCursor = globalIndex === cursorIndex;
  return (
    <Box key={globalIndex}>
      <Text>{isCursor ? "> " : "  "}</Text>
      {renderDiffLine(line, isCursor)}
    </Box>
  );
})}

// After（変更なし: visibleLines は DisplayLine[] のまま）
// slice() が DisplayLine[] を返すため、レンダリングロジックに変更なし
```

### 実体化のライフサイクル

```
useMemo 依存値変更（例: collapsedThreads）
  │
  ▼
buildVirtualDisplayLines() 実行
  │
  ├── 全ファイルの FileSegment を構築（行数計算のみ、O(F × avg_diff_lines)）
  ├── セグメントオフセット計算（O(F)）
  ├── headerIndices / fileNames / hasTruncation を算出（O(F)）
  │
  ▼
VirtualDisplayLines オブジェクト生成（実体化なし）
  │
  ├── lines.length → 即座に返却（事前計算済み）
  ├── lines.headerIndices → 即座に返却（事前計算済み）
  ├── lines.hasTruncation → 即座に返却（事前計算済み）
  │
  ├── lines.at(cursorIndex) → 対象セグメントのみ実体化（初回時）
  ├── lines.slice(offset, offset+30) → 対象セグメント（1〜2 個）のみ実体化
  │
  ▼
scrollOffset 変更（カーソル移動）
  │
  ├── useMemo 依存値に含まれない → VirtualDisplayLines 再構築なし
  ├── lines.slice(newOffset, newOffset+30) → 同一セグメント内ならキャッシュヒット
  │                                        → 新セグメントに入ったら追加実体化
  ▼
```

### キャッシュ変異の排除

現在の `buildDisplayLines` は、`diffCacheRef` に格納されたオブジェクトを変異させている:

```typescript
// 現状: キャッシュ済みオブジェクトを変異
for (const dl of diffLines) {
  dl.filePath = filePath;  // ← 変異!
  dl.diffKey = blobKey;    // ← 変異!
  lines.push(dl);
}
```

本設計では、実体化時にスプレッド構文で新しいオブジェクトを生成する:

```typescript
// 変更後: 新オブジェクトを生成
const line: DisplayLine = { ...dl, filePath, diffKey: blobKey };
result.push(line);
```

これにより `diffCacheRef` の内容が副作用で汚染されることを防ぐ。

## データフロー

### Before（現状）

```
differences, diffTexts, commentThreads, collapsedThreads, ...
  │
  ▼
buildDisplayLines()                    ← 全ファイルの DisplayLine[] を一括生成
  │
  ▼
lines: DisplayLine[10000]             ← メモリに全行保持
  │
  ├─ headerIndices = useMemo(全行スキャン)     ← O(N)
  ├─ fileNames = useMemo(headerIndices + lines) ← O(F)
  ├─ hasTruncation = useMemo(全行スキャン)      ← O(N)
  ├─ filePosition = useMemo(headerIndices)      ← O(F)
  ├─ scrollOffset = useMemo(cursorIndex)        ← O(1)
  │
  ▼
visibleLines = lines.slice(offset, offset + 30)  ← 30 行のみ使用
```

### After（遅延構築）

```
differences, diffTexts, commentThreads, collapsedThreads, ...
  │
  ▼
buildVirtualDisplayLines()             ← FileSegment[] 構築（行数計算のみ）
  │
  ▼
VirtualDisplayLines {
  length: 10000,                       ← 事前計算済み（O(F)）
  headerIndices: [0, 210, 450, ...],   ← 事前計算済み（O(F)）
  fileNames: ["file1.ts", ...],        ← 事前計算済み（O(F)）
  hasTruncation: true,                 ← 事前計算済み（O(F)）
  segments: FileSegment[50],           ← 実体化なし
}
  │
  ├─ headerIndices → 直接参照          ← O(1)
  ├─ fileNames → 直接参照              ← O(1)
  ├─ hasTruncation → 直接参照          ← O(1)
  ├─ filePosition = useMemo(headerIndices) ← O(F)（変更なし）
  ├─ scrollOffset = useMemo(cursorIndex)   ← O(1)（変更なし）
  │
  ▼
visibleLines = lines.slice(offset, offset + 30)
  │
  ├─ セグメント #3 を実体化（初回）    ← O(segment_lines)
  ├─ 以降はキャッシュヒット           ← O(1)
  ▼
render(visibleLines)                   ← 30 行のみ
```

## 影響範囲の分析

### 機能的影響: なし

`VirtualDisplayLines` は現在の `DisplayLine[]` と同一のデータを遅延生成する。`at(i)` と `slice()` が返す `DisplayLine` の内容は、`buildDisplayLines` が返す配列の対応要素と同一。

### 既存テストへの影響

| テストカテゴリ | 影響 | 理由 |
|--------------|------|------|
| diff 表示テスト | 変更あり（軽微） | `lastFrame()` の出力は同一。テスト内で `lines[i]` を直接参照する箇所があれば `at(i)` に変更 |
| コメント表示テスト | なし | `visibleLines` 経由のレンダリング結果に変化なし |
| スレッド折り畳みテスト | なし | `collapsedThreads` 変更 → 再構築 → 同一の表示結果 |
| カーソルナビゲーションテスト | なし | `lines.length` / `headerIndices` の値は同一 |
| 各種モーダルテスト | なし | `at(cursorIndex)` の返す `DisplayLine` は同一 |

### 既存の `diffCacheRef` との関係

`diffCacheRef` は `computeSimpleDiff` の結果をキャッシュする。本設計はこのキャッシュを引き続き使用する:

1. `buildFileSegment` で `diffCache.get(cacheKey)` → キャッシュヒットなら diff 再計算をスキップ
2. `materialize()` 内でも同じ `diffLines` を参照（クロージャでキャプチャ）
3. キャッシュ済みオブジェクトの変異は排除（スプレッド構文で新オブジェクト生成）

**`diffCacheRef` のリセットタイミング**: 既存の `useEffect(() => { diffCacheRef.current = new Map(); }, [differences])` は変更なし。`differences` が変化すると `diffCacheRef` がクリアされ、次の `useMemo` 実行で `buildFileSegment` 内の `diffCache.get()` がミスし、`computeSimpleDiff` が再実行される。`VirtualDisplayLines` のセグメントキャッシュ（`materializedCache`）は `useMemo` の戻り値に内包されるため、`useMemo` 再実行時に自動的にリセットされる。二重キャッシュの不整合は発生しない。

### 既存の `scrollOffset` useMemo との関係

```typescript
const scrollOffset = useMemo(() => {
  // ...
}, [cursorIndex, lines.length, visibleLineCount]);
```

`lines.length` は `VirtualDisplayLines.length`（number プリミティブ）であり、セグメント再構築後も総行数が同一なら再計算されない。**既存の動作と完全に互換性がある。**

### コンポーネントインターフェースの変更

`PullRequestDetail` の Props に変更なし。内部実装の変更に留まる。

### エッジケース

| ケース | 動作 |
|--------|------|
| `differences` が空配列 | セグメント 0 個。`length = 0`（一般コメントがなければ）。正常動作 |
| 単一ファイル PR | セグメント 1 個。全行が常に表示範囲内 → 即座に実体化。現状と同等の動作 |
| 一般コメントのみ（diff なし） | ファイルセグメント 0 個。一般コメントセグメントのみ。正常動作 |
| `collapsedThreads` 変更 | `useMemo` が再実行 → 全セグメント再構築（行数再計算）→ 実体化キャッシュはリセット。対象セグメントのみ再実体化 |
| `diffLineLimits` 変更（t キー） | 対象ファイルの `lineCount` が変化 → セグメントオフセット再計算。カーソル位置は `cursorIndex` state で保持されるため、ジャンプなし |
| `G`（末尾ジャンプ） | `lines.length - 1` → 最後のセグメント（または一般コメント）を実体化。他のセグメントは未実体化のまま |
| `n`/`N`（ファイル間ジャンプ） | `headerIndices` から次/前のヘッダー位置を取得 → 対象セグメントのみ実体化 |
| Blob が順次到着（diffTexts 更新） | `useMemo` 再実行 → 全セグメント再構築。新たに diff が利用可能になったファイルは行数が増加 |
| commitView（Tab 切り替え） | `buildVirtualDisplayLines` に `commitDifferences` を渡す。コメントなし。同じロジックで動作 |

### リスク

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| `lineCount` 計算と `materialize()` 結果の行数不整合 | 中 | 高（表示崩れ・カーソル位置ずれ） | テストで `lineCount === materialize().length` を全セグメントで検証。プロパティベーステストで入力パターンを網羅 |
| セグメント境界をまたぐ `slice` でのオフバイワンエラー | 中 | 中（1 行ずれ） | 境界ケースのテスト（セグメント末尾〜次セグメント先頭をまたぐ slice）を追加 |
| 実体化キャッシュのメモリ累積（全セグメントをスクロール通過） | 低 | 低 | 最悪ケースでも現状と同等。`useMemo` 再実行時にキャッシュは破棄される |
| `diffCacheRef` のオブジェクト変異排除による微小なメモリ増加 | 確実 | 低 | スプレッド構文で生成するオブジェクトは表示範囲分のみ。全体では削減 |

## 性能改善の見積もり

### 定量的効果（50 ファイル、平均 200 diff 行の PR）

| 項目 | Before | After | 改善幅 |
|------|--------|-------|--------|
| `buildDisplayLines` 実行時の DisplayLine 生成数 | ~10,000 個 | 0 個（行数計算のみ） | **-10,000 個** |
| `visibleLines` 取得時の DisplayLine 生成数 | 0 個（slice のみ） | ~250 個（1 セグメント実体化） | +250 個（遅延） |
| メモリ上の DisplayLine オブジェクト数 | ~10,000 個（常時） | ~250〜500 個（表示範囲のみ） | **-95%** |
| `headerIndices` 計算 | O(10,000) 全行スキャン | O(50) セグメントメタデータ | **-99%** |
| `hasTruncation` 計算 | O(10,000) 全行スキャン | O(1) 事前計算済み | **-100%** |
| `findNextHeaderIndex` | O(10,000) 全行スキャン / 呼出 | O(50) ヘッダー配列のみ / 呼出 | **-99%** |

### 定性的効果

- **大規模 PR のメモリ消費が表示行数に比例** する（ファイル数・diff 行数に比例しない）
- `collapsedThreads` / `diffLineLimits` 変更時、表示範囲外のファイルは実体化をスキップ
- `diffCacheRef` のオブジェクト変異が排除され、キャッシュの健全性が向上

## AWS SDK 連携

この変更は UI レイヤーのレンダリング最適化であり、AWS SDK の呼び出し・認証フロー・エラーハンドリングに変更はない。

## セキュリティ考慮

この変更はコンポーネント内部のデータ構造変更であり、セキュリティ上の影響はない。

- **入力**: 変更なし。`buildVirtualDisplayLines` の引数は従来通り
- **出力**: 変更なし。`DisplayLine` の内容は同一
- **認証**: 変更なし
- **データの永続化**: なし。セグメントの実体化キャッシュは `useMemo` のライフサイクルに従う

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `buildFileSegment` | `lineCount` と `materialize().length` の一致を検証 |
| `countInlineCommentLines` | 各パターンのコメント行数を検証 |
| `VirtualDisplayLines` | `at()`, `slice()`, メタデータの正確性を検証 |
| `PullRequestDetail`（統合） | 既存テストの通過 + 遅延構築固有のケースを追加 |

カバレッジ 95% 以上を維持する。

### 具体的なテストケース

#### `buildFileSegment`（ユニットテスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | diff テキストあり、インラインコメントなし | `lineCount === materialize().length` |
| 2 | diff テキストあり、インラインコメントあり | コメント行を含む正確な `lineCount` |
| 3 | diff テキストあり、折り畳みコメントあり | fold indicator を含む正確な `lineCount` |
| 4 | diff テキストなし（ローディング中） | `lineCount === 4`（header + separator + placeholder + separator） |
| 5 | diff テキストエラー | `lineCount === 4` |
| 6 | 大規模 diff（truncation あり） | `hasTruncation === true`, truncation 行を含む `lineCount` |
| 7 | `materialize()` を 2 回呼び出し | 同一の配列参照が返る（キャッシュ） |

#### `VirtualDisplayLines`（ユニットテスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `length` が全セグメントの `lineCount` の合計 | 正確な総行数 |
| 2 | `headerIndices` が各セグメントの先頭位置 | 累積オフセットと一致 |
| 3 | `at(0)` が最初のファイルの header 行 | `type === "header"` |
| 4 | `at(length - 1)` が最後の行 | 正しい DisplayLine |
| 5 | `at(-1)` が `undefined` | 範囲外 |
| 6 | `at(length)` が `undefined` | 範囲外 |
| 7 | `slice()` がセグメント境界をまたぐ場合 | 正しい連続した行が返る |
| 8 | `slice()` が単一セグメント内の場合 | 対象セグメントのみ実体化される |
| 9 | 空の differences | `length === 0`, `headerIndices === []` |
| 10 | 一般コメントのみ | ファイルセグメント 0 個 + コメント行 |

#### `countInlineCommentLines`（ユニットテスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | マッチするスレッドなし | `0` |
| 2 | root コメントのみのスレッド | `1` |
| 3 | root + 2 replies | `3` |
| 4 | 折り畳み状態の 5 件スレッド | `2`（root + fold indicator） |
| 5 | 展開状態の 5 件スレッド | `5`（root + 4 replies） |

#### 等価性テスト（`buildDisplayLines` vs `buildVirtualDisplayLines`）

移行の安全性を担保するため、旧関数 `buildDisplayLines` と新関数 `buildVirtualDisplayLines` の出力が等価であることを検証する。

| # | テストケース | 不変条件 |
|---|-------------|---------|
| 1 | 同一入力に対する全行一致 | `for (i in 0..old.length-1): virtual.at(i) deep-equals old[i]` |
| 2 | 総行数の一致 | `virtual.length === old.length` |
| 3 | headerIndices の一致 | `virtual.headerIndices` が旧 `headerIndices` 算出結果と同一 |
| 4 | インラインコメント付きファイルでの等価性 | コメント行の位置と内容が一致 |
| 5 | 折り畳みスレッド付きファイルでの等価性 | fold indicator の位置が一致 |
| 6 | truncation 付き大規模ファイルでの等価性 | truncation 行の位置と内容が一致 |

**実装方針**: Step 5（コンポーネント統合）の前に、`buildDisplayLines` を削除せず両関数を並行で呼び出し、全行の一致を `expect` で検証する。統合完了後に `buildDisplayLines` を削除する。

#### プロパティベーステスト

| # | テストケース | 不変条件 |
|---|-------------|---------|
| 1 | ランダムな differences + diffTexts | `segment.lineCount === segment.materialize().length` |
| 2 | ランダムな cursorIndex | `lines.at(i)` と全行展開時の `lines[i]` が一致 |

#### `PullRequestDetail`（統合テスト）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 既存の全テスト | 通過（表示内容に変化なし） |
| 2 | 50 ファイル PR でカーソル移動 | 表示範囲のみ実体化される（メモリ検証は割愛、行数整合性で担保） |
| 3 | `G` で末尾ジャンプ → 最初に戻る | 両端のセグメントのみ実体化 |
| 4 | `n`/`N` でファイル間ジャンプ | `headerIndices` ベースで正しくジャンプ |

## 実装順序

### コミット粒度と関数配置方針

- **1 Step = 1 コミット**: 各ステップを独立したコミットとする。Tidy First のステップ（Step 1, 2）は機能変更と分離してコミットする
- **関数の配置**: 新関数（`buildFileSegment`, `countInlineCommentLines`, `createVirtualDisplayLines`, `buildVirtualDisplayLines`）は `src/components/PullRequestDetail.tsx` 内のモジュールレベル関数として配置する。既存の `buildDisplayLines`, `computeSimpleDiff`, `appendThreadLines` と同一ファイルに置き、ファイル分割は行わない
- **テスト可能性**: 新関数はコンポーネントファイル内の非 export 関数とする。テストはコンポーネントの `render` 経由（統合テスト）で検証する。`lineCount === materialize().length` の不変条件テストは、`buildVirtualDisplayLines` を直接テスト用に export するか、テストヘルパーで `buildDisplayLines` と `buildVirtualDisplayLines` の出力を比較する方式とする

### Step 1: Tidy First — `findNextHeaderIndex` / `findPrevHeaderIndex` の最適化

現在の実装は呼び出しのたびに `lines` 全体を走査して `headerIndices` を再構築している。既に `useMemo` で算出済みの `headerIndices` を引数として渡すように変更する。

```typescript
// Before
const idx = findNextHeaderIndex(lines, cursorIndex);

// After
const idx = findNextHeaderIndex(headerIndices, cursorIndex);
```

**変更ファイル**: `src/components/PullRequestDetail.tsx`
**完了条件**: 既存テスト全通過。

### Step 2: Tidy First — `diffCacheRef` オブジェクト変異の排除

`buildDisplayLines` 内で `diffCacheRef` の格納オブジェクトに `filePath` / `diffKey` を直接設定している変異を排除する。スプレッド構文で新オブジェクトを生成するように変更する。

```typescript
// Before
dl.filePath = filePath;
dl.diffKey = blobKey;
lines.push(dl);

// After
lines.push({ ...dl, filePath, diffKey: blobKey });
```

**変更ファイル**: `src/components/PullRequestDetail.tsx`
**完了条件**: 既存テスト全通過。

### Step 3: `FileSegment` と `countInlineCommentLines` の実装

`buildFileSegment` と `countInlineCommentLines` を実装する。`lineCount === materialize().length` の不変条件をユニットテストで検証する。

**変更ファイル**:
- `src/components/PullRequestDetail.tsx`: 関数追加
- `src/components/PullRequestDetail.test.tsx`: テスト追加

**完了条件**: `buildFileSegment` のテスト全通過。

### Step 4: `VirtualDisplayLines` の実装

`createVirtualDisplayLines` を実装する。`at()`, `slice()`, メタデータの正確性をユニットテストで検証する。

**変更ファイル**:
- `src/components/PullRequestDetail.tsx`: 関数追加
- `src/components/PullRequestDetail.test.tsx`: テスト追加

**完了条件**: `VirtualDisplayLines` のテスト全通過。

### Step 5: コンポーネント統合

`buildDisplayLines` の呼び出しを `buildVirtualDisplayLines` に置き換え、コンポーネント内の消費箇所を `VirtualDisplayLines` インターフェースに合わせて変更する。

**変更ファイル**:
- `src/components/PullRequestDetail.tsx`: 統合変更
- `src/components/PullRequestDetail.test.tsx`: 既存テストの更新

**完了条件**: 既存テスト + 新規テスト全通過。

### Step 6: CI 確認

```bash
bun run ci
```

全チェック通過を確認。

### Step 7: ドキュメント更新

この変更はパフォーマンス最適化であり、ユーザー向け機能や API に変更はない。要件定義書（`docs/requirements.md`）および README の更新は不要。
