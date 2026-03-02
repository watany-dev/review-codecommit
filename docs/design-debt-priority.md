# 設計負債：優先対応リスト

15件の設計負債を精査し、現行コードベースの安定性を保ちつつ段階的に改善できるものを選定した。

選定基準：
- **段階的に実施可能** — 全面書き直しではなく、1コミット単位で進められる
- **既存テストが安全網になる** — 変更後に既存テストで回帰を検出できる
- **次の機能追加を楽にする** — 直すことで将来の実装コストが具体的に下がる
- **リスクが低い** — 型変更やインターフェース変更が局所的

---

## A. PullRequestDetail のモーダル状態を union 型に統合

10個のboolean/nullable状態変数を1つのdiscriminated unionに統合する。

**なぜ今か**: 変更がPullRequestDetail.tsx内で完結する。既存テスト（7,561行）がそのまま回帰テストとして機能する。次にモーダル（例：PR description編集）を追加する際の修正箇所が10箇所→1箇所に減る。

**作業内容**:

1. `ModalState` union型を定義

```typescript
type ModalState =
  | { type: "none" }
  | { type: "commenting" }
  | { type: "inline-commenting"; location: InlineLocation }
  | { type: "replying"; target: { commentId: string; threadIndex: number } }
  | { type: "approving"; action: "approve" | "revoke" }
  | { type: "merging"; step: "strategy" | "confirm"; strategy?: MergeStrategy; conflicts?: ConflictSummary }
  | { type: "closing" }
  | { type: "editing"; target: { commentId: string; content: string } }
  | { type: "deleting"; target: { commentId: string } }
  | { type: "reacting"; target: { commentId: string } }
  | { type: "file-list" };
```

2. 10個の`useState`を`const [modal, setModal] = useState<ModalState>({ type: "none" })`に置換
3. `useInput`のガード条件を`modal.type !== "none"`に統一
4. `visibleLineCount`の計算を`modal.type === "none"`で簡素化

**対象ファイル**: `src/components/PullRequestDetail.tsx`

**リスク**: 低。インターフェース（Props）は変更なし。内部リファクタのみ。

---

## B. ページネーション状態を `usePagination` フックに抽出

App.tsxの`PaginationState`と関連ハンドラをカスタムフックに抽出する。

**なぜ今か**: 変更が局所的（App.tsx内のPagination関連コードの移動）。App.tsxのuseState数が減り、見通しが改善。将来リポジトリ一覧にもページネーションが必要になった際に再利用可能。

**作業内容**:

1. `src/hooks/usePagination.ts`を作成

```typescript
interface PaginationState {
  currentPage: number;
  currentToken: string | undefined;
  nextToken: string | undefined;
  previousTokens: (string | undefined)[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function usePagination() {
  const [state, setState] = useState<PaginationState>(initialPagination);
  const goNext = (nextToken: string) => { ... };
  const goPrevious = () => { ... };
  const reset = () => { ... };
  return { ...state, goNext, goPrevious, reset };
}
```

2. App.tsxの`pagination`/`setPagination`/`handleNextPage`/`handlePreviousPage`をフック呼び出しに置換
3. テストを追加（フック単体テスト + 既存App.tsxテストで回帰確認）

**対象ファイル**: `src/hooks/usePagination.ts`（新規）, `src/app.tsx`

**リスク**: 低。ロジックの移動のみで振る舞い変更なし。

---

## C. DisplayLine を discriminated union に変更

13種のtypeを持つ単一interfaceをdiscriminated unionに分割する。

**なぜ今か**: TypeScriptコンパイラが型の不整合を検出してくれるようになり、今後のDisplayLine利用箇所でのバグを防止できる。`noUncheckedIndexedAccess: true`の方針と合致。変更はutils内の型定義が中心で、利用側は`switch(line.type)`パターンで既に使っている箇所が多く、変更量が限定的。

**作業内容**:

1. `src/utils/formatDiff.ts`で各type用のinterfaceを定義

```typescript
interface HeaderLine { type: "header"; text: string; filePath?: string }
interface AddLine { type: "add"; text: string; afterLineNumber: number; filePath?: string; diffKey?: string }
interface DeleteLine { type: "delete"; text: string; beforeLineNumber: number; filePath?: string; diffKey?: string }
interface ContextLine { type: "context"; text: string; beforeLineNumber?: number; afterLineNumber?: number; filePath?: string; diffKey?: string }
interface CommentLine { type: "comment"; text: string; threadIndex: number; commentId?: string; reactionText?: string }
interface InlineCommentLine { type: "inline-comment"; text: string; threadIndex: number; commentId?: string; reactionText?: string }
// ... 他のtype

export type DisplayLine = HeaderLine | AddLine | DeleteLine | ContextLine | CommentLine | ...;
```

2. `buildDisplayLines`内のpush箇所が型チェックで検証される
3. `DiffLine.tsx`や`PullRequestDetail.tsx`のswitch文でnarrowingが効くようになる

**対象ファイル**: `src/utils/formatDiff.ts`, `src/utils/displayLines.ts`, `src/components/DiffLine.tsx`

**リスク**: 中。型変更が複数ファイルに波及するが、既存の振る舞いは変わらない。コンパイラが全ての不整合を検出する。

---

## 実施順序

```
A（モーダル状態統合）→ B（ページネーションフック）→ C（DisplayLine型安全化）
```

AとBは独立しているため並行作業も可能。CはAの後がベター（PullRequestDetail内のline型参照がシンプルになった後の方が安全）。

## 検証

各ステップ完了後に `bun run ci` を実行し、以下を確認：

1. TypeScript型チェック通過
2. 既存テスト全件パス
3. カバレッジ95%以上維持
4. oxlint / Biome / knip チェック通過
