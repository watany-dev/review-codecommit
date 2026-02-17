# 低リスクパフォーマンス最適化 設計書

## 概要

`performance-analysis.md` で特定された 16 件のボトルネックのうち、**改修影響度が🟢（低〜非常に低）** の 5 項目を一括で対応する。いずれも 1〜5 行の変更で完結し、既存テストが壊れるリスクが極めて低い。

対象項目:

| # | 項目 | 改修影響度 | 変更規模 |
|---|------|-----------|---------|
| 10 | `diffTextStatus` のデフォルト値が毎レンダー新オブジェクト | 🟢 非常に低 | 1 行 |
| 13 | `TextDecoder` を毎回生成 | 🟢 非常に低 | 2 行 |
| 16 | `extractAuthorName` の繰り返し呼び出し | 🟢 非常に低 | 4 行 |
| 7 | `findNextHeaderIndex` / `findPrevHeaderIndex` でヘッダー位置を毎回再計算 | 🟢 低 | 10 行 |
| 8 | `buildDisplayLines` 内でキャッシュされた diff 行を変異（mutation） | 🟢 低 | 1 行 |

## 背景

パフォーマンス分析（`docs/performance-analysis.md`）の推奨アプローチに従い、「まず #10, #13, #16, #7, #8 を対応」する。これらは「リスクなし、即効性あり」と評価されている。

個々の改善幅は小さいが、累積的に以下の効果がある:

- **レンダリング効率向上**: #10 により `useMemo` の依存配列が安定化し、不要な再計算を防止
- **GC 負荷軽減**: #13 により `TextDecoder` の不要なインスタンス生成を排除
- **CPU 負荷軽減**: #16 により ARN パースの重複実行を排除、#7 によりヘッダー走査の重複実行を排除
- **キャッシュ汚染防止**: #8 により `diffCacheRef` のオブジェクトが意図せず変更されるリスクを排除

## スコープ

### 今回やること

- #10: `diffTextStatus` のデフォルト値をモジュールレベル定数に変更
- #13: `TextDecoder` をモジュールレベルシングルトンに変更
- #16: `extractAuthorName` に内部キャッシュを追加
- #7: `findNextHeaderIndex` / `findPrevHeaderIndex` を既存の `useMemo` 済み `headerIndices` を利用する形に変更
- #8: `buildDisplayLines` 内のキャッシュオブジェクト変異をスプレッドコピーに変更

### 今回やらないこと

- #1〜#6, #9, #11, #12, #14, #15 の中〜高リスク項目
- コンポーネント分割、状態管理の再設計
- `React.memo` / `useCallback` の導入
- アルゴリズム変更（`computeSimpleDiff` 等）

## 設計

### 変更対象ファイル

| ファイル | 変更項目 | 変更内容 |
|---------|---------|---------|
| `src/components/PullRequestDetail.tsx` | #10 | モジュールレベル定数 `EMPTY_STATUS_MAP` の追加、デフォルト値の差し替え |
| `src/components/PullRequestDetail.tsx` | #7 | `findNextHeaderIndex` / `findPrevHeaderIndex` に `headerIndices` 引数を追加し、内部での再計算を削除 |
| `src/components/PullRequestDetail.tsx` | #8 | `dl` オブジェクトのスプレッドコピー |
| `src/services/codecommit.ts` | #13 | モジュールレベル `TextDecoder` シングルトンの追加 |
| `src/utils/formatDate.ts` | #16 | `extractAuthorName` への `Map` キャッシュ追加 |

### #10: `diffTextStatus` デフォルト値の安定化

#### 問題

`src/components/PullRequestDetail.tsx:129` でデフォルト値として `new Map()` が毎レンダーで生成され、`useMemo` の依存配列で常に変更扱いになる。

#### Before

```typescript
export function PullRequestDetail({
  // ...
  diffTextStatus = new Map(),
  // ...
}) {
```

#### After

```typescript
const EMPTY_STATUS_MAP = new Map<string, "loading" | "loaded" | "error">();

export function PullRequestDetail({
  // ...
  diffTextStatus = EMPTY_STATUS_MAP,
  // ...
}) {
```

#### 設計判断

| 選択肢 | 評価 |
|--------|------|
| **モジュールレベル定数 `new Map<string, ...>()`（採用）** | レンダーごとの生成を排除。Props 型 `Map<string, "loading" \| "loaded" \| "error">` と完全一致。追加コード 1 行 |
| `ReadonlyMap` 型で定義 | `ReadonlyMap` は `Map` の supertype であり、`Map` 型のパラメータに `ReadonlyMap` は代入不可（`set()` / `delete()` メソッドがない）。TypeScript コンパイルエラーになるため不採用 |
| `Object.freeze(new Map())` | `Map` は `Object.freeze` で内部の `set()` / `delete()` を防げない。実行時エラーにもならないため効果なし。不採用 |

- `EMPTY_STATUS_MAP` はモジュールスコープに配置。コンポーネント外部に定義することで、レンダーごとの生成を完全に排除する
- 型パラメータは Props の `diffTextStatus` 定義 `Map<string, "loading" | "loaded" | "error">` と一致させる
- 空 Map に対する mutation リスクは実質ゼロ（この Map は読み取り専用に使われ、書き込みは `App` 側の `setDiffTextStatus` で行われる）

#### テストへの影響: なし

デフォルト値の参照が安定するだけで、動作は同一。既存テストはすべて `diffTextStatus` を明示的に渡すか、渡さない場合は空 Map の挙動を前提としており、影響なし。

---

### #13: `TextDecoder` シングルトン化

#### 問題

`src/services/codecommit.ts:347` で Blob 取得のたびに `new TextDecoder()` を生成している。50 ファイルの PR で 100 回のインスタンス生成が発生する。

#### Before

```typescript
return new TextDecoder().decode(response.content);
```

#### After

```typescript
// モジュールレベルに追加
const textDecoder = new TextDecoder();

// getBlobContent 内
return textDecoder.decode(response.content);
```

#### 設計判断

| 選択肢 | 評価 |
|--------|------|
| **モジュールレベルシングルトン（採用）** | 1 行追加、1 行変更。`TextDecoder` はステートレスであり副作用なし。エクスポート不要 |
| 関数内で毎回生成（現状維持） | 不要なインスタンス生成が継続。微小だが累積する |
| `getBlobContent` の引数に外から渡す | 関数シグネチャの変更が必要。テストのモック設計に影響。過剰 |

- `decode()` メソッドは入力バッファに依存して出力を生成する純粋な変換であり、内部状態を保持しない（`stream: true` オプションを使わない限り）
- エクスポートしない。モジュール内部のみで使用

#### テストへの影響: なし

テストは `getBlobContent` の戻り値（デコードされた文字列）を検証しており、`TextDecoder` のインスタンス生成方法には依存していない。

---

### #16: `extractAuthorName` のキャッシュ追加

#### 問題

`extractAuthorName` は ARN 文字列を `split("/")` で分割して末尾要素を返す関数。コメントが多い画面では同一 ARN に対して繰り返し呼ばれる（`PullRequestDetail.tsx` 内で 4 箇所、`PullRequestList.tsx` 内で 2 箇所）。

#### Before

```typescript
export function extractAuthorName(authorArn: string): string {
  const parts = authorArn.split("/");
  /* v8 ignore next -- split() always returns at least one element */
  return parts[parts.length - 1] ?? authorArn;
}
```

#### After

```typescript
const authorNameCache = new Map<string, string>();

export function extractAuthorName(authorArn: string): string {
  const cached = authorNameCache.get(authorArn);
  if (cached !== undefined) return cached;

  const parts = authorArn.split("/");
  /* v8 ignore next -- split() always returns at least one element */
  const name = parts[parts.length - 1] ?? authorArn;
  authorNameCache.set(authorArn, name);
  return name;
}
```

#### 設計判断

| 選択肢 | 評価 |
|--------|------|
| **モジュールレベル `Map<string, string>` キャッシュ（採用）** | シンプルで効果的。関数シグネチャ変更なし。テスト影響なし |
| クロージャ内キャッシュ（IIFE パターン） | キャッシュが外部から不可視になるが、コードが冗長になる。テスト時のキャッシュクリアが不可能になるデメリットもあるが、純粋関数なのでクリア不要 |
| `WeakMap` によるキャッシュ | ARN は `string` 型であり `WeakMap` のキーにできない（`WeakMap` は object キーのみ）。不採用 |
| キャッシュなし（現状維持） | `split("/")` の繰り返し実行が継続。コメントが多い画面で累積する |

- キャッシュのクリア機構は不要。ARN 文字列は PR ごとにせいぜい数十種類であり、メモリ増加は無視できる（ARN 1 件あたり 100 バイト程度 × 数十件 = 数 KB）
- キャッシュはプロセスのライフサイクルに従い、TUI 終了時に自然に破棄される
- `extractAuthorName` は純粋関数であり、同一入力に対して常に同一出力を返す。キャッシュの正当性は自明

#### テストへの影響: なし

既存テストは戻り値を検証しており、内部のキャッシュ有無には依存していない。Property-based テストも `extractAuthorName` の冪等性（同一入力 → 同一出力）を検証しており、キャッシュ導入により冪等性がさらに強化される。

ただし、テスト間でキャッシュが共有されるため、テスト実行順序に依存するバグが理論上は発生しうる。しかし `extractAuthorName` は純粋関数であるため、キャッシュの有無で結果が変わることはない。

---

### #7: `findNextHeaderIndex` / `findPrevHeaderIndex` のヘッダー位置再計算排除

#### 問題

`src/components/PullRequestDetail.tsx:1567-1585` の `findNextHeaderIndex` / `findPrevHeaderIndex` は、呼び出しのたびに `lines` 全件を走査して `headerIndices` を再構築する。しかし、同じ `headerIndices` は `useMemo` で既に計算済み（417 行目）であり、重複計算になっている。

#### Before

```typescript
function findNextHeaderIndex(lines: DisplayLine[], currentIndex: number): number {
  const headerIndices = lines.reduce<number[]>((acc, line, i) => {
    if (line.type === "header") acc.push(i);
    return acc;
  }, []);
  if (headerIndices.length === 0) return -1;
  const next = headerIndices.find((i) => i > currentIndex);
  return next ?? headerIndices[0]!;
}

function findPrevHeaderIndex(lines: DisplayLine[], currentIndex: number): number {
  const headerIndices = lines.reduce<number[]>((acc, line, i) => {
    if (line.type === "header") acc.push(i);
    return acc;
  }, []);
  if (headerIndices.length === 0) return -1;
  const prev = [...headerIndices].reverse().find((i) => i < currentIndex);
  return prev ?? headerIndices[headerIndices.length - 1]!;
}
```

呼び出し側（`useInput` 内）:

```typescript
if (input === "n") {
  const idx = findNextHeaderIndex(lines, cursorIndex);
  if (idx !== -1) setCursorIndex(idx);
  return;
}
if (input === "N") {
  const idx = findPrevHeaderIndex(lines, cursorIndex);
  if (idx !== -1) setCursorIndex(idx);
  return;
}
```

#### After

```typescript
function findNextHeaderIndex(headerIndices: number[], currentIndex: number): number {
  if (headerIndices.length === 0) return -1;
  const next = headerIndices.find((i) => i > currentIndex);
  return next ?? headerIndices[0]!;
}

function findPrevHeaderIndex(headerIndices: number[], currentIndex: number): number {
  if (headerIndices.length === 0) return -1;
  const prev = [...headerIndices].reverse().find((i) => i < currentIndex);
  return prev ?? headerIndices[headerIndices.length - 1]!;
}
```

呼び出し側:

```typescript
if (input === "n") {
  const idx = findNextHeaderIndex(headerIndices, cursorIndex);
  if (idx !== -1) setCursorIndex(idx);
  return;
}
if (input === "N") {
  const idx = findPrevHeaderIndex(headerIndices, cursorIndex);
  if (idx !== -1) setCursorIndex(idx);
  return;
}
```

#### 設計判断

- 関数のシグネチャを `(lines: DisplayLine[], currentIndex: number)` から `(headerIndices: number[], currentIndex: number)` に変更する
- `headerIndices` は既に `useMemo`（417 行目）で計算・キャッシュされているため、引数として渡すだけで重複計算を完全に排除できる
- 関数はコンポーネント外に定義されており、`useMemo` の結果を直接参照することはできない。引数として渡す設計が適切
- 関数名は変更しない。既存の意味（「次/前のヘッダーインデックスを見つける」）と一致している
- `lines` 引数の削除により、関数の責務がより明確になる（ヘッダーインデックスの「計算」ではなく「検索」のみを行う）

#### テストへの影響: なし

`findNextHeaderIndex` / `findPrevHeaderIndex` はコンポーネント外部のヘルパー関数であり、直接のユニットテストはない。テストは `n`/`N` キー押下時のカーソル位置の変化（`useInput` の結果）を検証しており、内部で呼ばれる関数のシグネチャには依存していない。ヘッダー検索のロジック自体は変更しないため、出力結果は同一。

---

### #8: `buildDisplayLines` 内のキャッシュオブジェクト変異の修正

#### 問題

`src/components/PullRequestDetail.tsx:1220-1222` で `diffCacheRef` にキャッシュされたオブジェクトの `filePath` / `diffKey` プロパティを直接変更している。キャッシュ済みオブジェクトへの mutation であり、キャッシュ汚染のリスクがある。

#### Before

```typescript
for (const dl of diffLines) {
  dl.filePath = filePath;   // キャッシュ済みオブジェクトを直接変更
  dl.diffKey = blobKey;     // 同上
  lines.push(dl);
```

#### After

```typescript
for (const dl of diffLines) {
  lines.push({ ...dl, filePath, diffKey: blobKey });
```

#### 設計判断

- スプレッドコピーにより、キャッシュ内のオブジェクトは不変に保たれる
- `DisplayLine` は浅いオブジェクト（ネストされた参照型プロパティを持たない）であるため、スプレッドコピーで十分。ディープコピーは不要
- パフォーマンスへの影響: 各行に対してオブジェクトコピーが発生するが、`DisplayLine` のプロパティ数は少ない（約 8 プロパティ）ため、コピーコストは微小。キャッシュ汚染防止による安全性向上のほうが価値が高い
- 現状バグが顕在化していない理由: 同一キャッシュキーでは同じ `filePath` / `diffKey` が設定されるため、mutation しても結果が変わらない。しかし、将来のリファクタリングでキャッシュの共有範囲が変わった場合にバグが顕在化するリスクがある

#### テストへの影響: なし

テストは `DisplayLine` の `text`、`type` 等の表示内容を検証しており、`filePath` / `diffKey` の付与方法（コピーか mutation か）は検証対象外。出力結果は同一。

---

## データフロー

この設計では全体的なデータフローに変更はない。各項目はデータの**生成方法**または**アクセス方法**のみを最適化する。

```
変更前:                              変更後:
┌─────────────────────┐             ┌─────────────────────┐
│ #10: new Map() 毎回  │ ──→        │ #10: EMPTY_STATUS_MAP│
│     生成            │             │     定数参照         │
└─────────────────────┘             └─────────────────────┘

┌─────────────────────┐             ┌─────────────────────┐
│ #13: new TextDecoder│ ──→         │ #13: textDecoder     │
│     毎回生成         │             │     シングルトン      │
└─────────────────────┘             └─────────────────────┘

┌─────────────────────┐             ┌─────────────────────┐
│ #16: split("/")     │ ──→         │ #16: キャッシュ参照   │
│     毎回実行         │             │     or split("/")    │
└─────────────────────┘             └─────────────────────┘

┌─────────────────────┐             ┌─────────────────────┐
│ #7: lines全件走査    │ ──→         │ #7: headerIndices    │
│    → headerIndices  │             │    引数として受取     │
│    を毎回再構築      │             │    (useMemo済み)     │
└─────────────────────┘             └─────────────────────┘

┌─────────────────────┐             ┌─────────────────────┐
│ #8: dl.filePath =   │ ──→         │ #8: { ...dl,         │
│    (mutation)       │             │      filePath }      │
└─────────────────────┘             └─────────────────────┘
```

## 影響範囲の分析

### コンポーネント・Props への影響: なし

この設計ではコンポーネントの追加・削除・Props 変更は行わない。

| コンポーネント | Props 変更 | レンダリング変更 |
|--------------|-----------|----------------|
| `PullRequestDetail` | なし | なし |
| `PullRequestList` | なし | なし |
| `CommentInput` | なし | なし |
| `App` | なし | なし |

### 機能的影響: なし

5 つの変更はすべて内部実装の最適化であり、API の呼び出し結果・画面表示・ユーザー操作に変化はない。

### 既存テストへの影響

| 変更 | 既存テストへの影響 |
|------|-----------------|
| #10: `EMPTY_STATUS_MAP` 定数化 | 影響なし。デフォルト値の参照安定化のみ |
| #13: `TextDecoder` シングルトン化 | 影響なし。戻り値は同一 |
| #16: `extractAuthorName` キャッシュ | 影響なし。純粋関数の冪等性に変化なし |
| #7: `findNextHeaderIndex` 引数変更 | 影響なし。コンポーネントテストはカーソル位置を検証 |
| #8: スプレッドコピー | 影響なし。表示内容は同一 |

### エッジケース

| ケース | 対処 |
|--------|------|
| `diffTextStatus` が呼び出し側から明示的に渡される場合 | デフォルト値は使われないため影響なし |
| `TextDecoder` が並行して `decode()` を呼ばれる場合 | Node.js/Bun はシングルスレッドであり、並行呼び出しは発生しない。`stream: false`（デフォルト）で状態を持たないため安全 |
| `extractAuthorName` に空文字列が渡される場合 | `"".split("/")` → `[""]` → `""` が返りキャッシュされる。正常動作 |
| `headerIndices` が空配列の場合 | `findNextHeaderIndex` / `findPrevHeaderIndex` は先頭で `-1` を返す。変更前後で同一の挙動 |
| diff 行数が非常に多い場合（#8 のコピーコスト） | `DisplayLine` は浅いオブジェクト（8 プロパティ程度）。10,000 行でもコピーコストは数 ms 以下で実用上無視できる |

### リスク

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| `EMPTY_STATUS_MAP` が誤って変更される | 極低 | 低 | この Map は `PullRequestDetail` 内で読み取り専用に使われる。書き込みは `App` 側で `setDiffTextStatus` を通じて行われるため、定数が変更されるコードパスは存在しない |
| `authorNameCache` のメモリリーク | 極低 | 極低 | ARN は数十種類以下。TUI プロセス終了で破棄 |
| スプレッドコピーで予期しないプロパティが消える | なし | — | `DisplayLine` の全プロパティはスプレッドでコピーされる。プロトタイプチェーンの参照は不要 |

## AWS SDK 連携

### 使用 API: 変更なし

この変更では AWS API の呼び出しパターンに変更はない。#13 の `TextDecoder` シングルトン化は `getBlobContent` 内部の文字列デコード処理のみに影響する。

## セキュリティ考慮

5 つの変更はいずれもモジュール内部の最適化であり、セキュリティ上の影響はない。

- **入力**: 変更なし
- **出力**: 変更なし
- **認証**: 変更なし
- **データの永続化**: なし。すべてのキャッシュはメモリ上のみ

## テスト方針

### 基本方針

5 項目すべてが**既存テストに影響しない**変更であるため、既存テストの通過をもって正しさを担保する。新規テストは追加しない。

### 理由

| 項目 | 新規テスト不要の根拠 |
|------|-------------------|
| #10 | デフォルト値の参照安定化は `useMemo` の内部動作に関するものであり、外部から観測可能な動作変化がない。React は `useMemo` の再計算をセマンティック保証しないため（将来のバージョンでキャッシュを破棄する可能性がある）、「再計算されないこと」をテストするのは不適切 |
| #13 | `TextDecoder` のインスタンス数はテストの関心事ではない。`getBlobContent` の既存テストが戻り値を検証済み |
| #16 | `extractAuthorName` の Property-based テストが冪等性を検証済み。キャッシュ導入は冪等性を強化するだけ |
| #7 | `n`/`N` キーのナビゲーションテストが既存で充実。出力結果は同一 |
| #8 | diff 表示テストが `DisplayLine` の内容を検証済み。コピー方法は外部から観測不能 |

### 検証手順

```bash
bun run ci
```

全チェック（lint, format, type check, dead-code, audit, test:coverage, build）の通過をもって完了とする。

## 実装順序

5 項目は互いに依存関係がないため、任意の順序で実装可能。コミットは以下の単位で分割する:

### Step 1: #10 — `diffTextStatus` デフォルト値定数化

**変更ファイル**: `src/components/PullRequestDetail.tsx`

1. モジュールスコープに `EMPTY_STATUS_MAP` 定数を追加
2. `PullRequestDetail` の引数デフォルト値を差し替え

**完了条件**: `bun run check` が通過。`EMPTY_STATUS_MAP` の型が `Map<string, "loading" | "loaded" | "error">` と一致すること。

### Step 2: #13 — `TextDecoder` シングルトン化

**変更ファイル**: `src/services/codecommit.ts`

1. モジュールスコープに `textDecoder` 定数を追加
2. `getBlobContent` 内の `new TextDecoder()` を `textDecoder` に差し替え

**完了条件**: `bun run check` が通過。`textDecoder` がエクスポートされていないこと。

### Step 3: #16 — `extractAuthorName` キャッシュ追加

**変更ファイル**: `src/utils/formatDate.ts`

1. モジュールスコープに `authorNameCache` を追加
2. `extractAuthorName` 内にキャッシュ参照・書き込みロジックを追加

**完了条件**: `bun run test -- src/utils/formatDate.test.ts` が通過。Property-based テストを含む全テストが成功すること。

### Step 4: #7 — `findNextHeaderIndex` / `findPrevHeaderIndex` の引数変更

**変更ファイル**: `src/components/PullRequestDetail.tsx`

1. `findNextHeaderIndex` の第 1 引数を `lines: DisplayLine[]` → `headerIndices: number[]` に変更、内部の `reduce` を削除
2. `findPrevHeaderIndex` も同様に変更
3. `useInput` 内の呼び出し箇所で `headerIndices`（`useMemo` 済み）を引数に渡す

**完了条件**: `bun run check` が通過。`n`/`N` キーの既存テストが通過すること。

### Step 5: #8 — `buildDisplayLines` のスプレッドコピー

**変更ファイル**: `src/components/PullRequestDetail.tsx`

1. `dl.filePath = filePath; dl.diffKey = blobKey;` を `{ ...dl, filePath, diffKey: blobKey }` に変更

**完了条件**: diff 表示の既存テストが通過すること。

### Step 6: CI 確認

```bash
bun run ci
```

**完了条件**: 全チェック（lint, format:check, check, dead-code, audit, test:coverage, build）が通過。カバレッジ 95% 以上を維持。
