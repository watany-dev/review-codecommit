# Performance Metrics Report

**計測日**: 2026-03-03
**環境**: Linux 6.18.5 / Bun 1.3.9 / Node >= 20 / TypeScript 5.9.3

---

## 1. ビルド性能

| メトリクス | 値 | 備考 |
|---|---|---|
| ビルド時間（フルビルド） | **3.1s** | `bun run build.ts` + `tsc --emitDeclarationOnly` |
| cli.mjs バンドルサイズ | **1,211 KB** (1.18 MB) | minified, ESM |
| index.js バンドルサイズ | **1,175 KB** (1.15 MB) | minified, ESM |
| cli.mjs gzip 圧縮後 | **341 KB** | 72% 圧縮率 |
| index.js gzip 圧縮後 | **329 KB** | 72% 圧縮率 |
| 合計バンドル（非圧縮） | **2,386 KB** | cli + lib |

### バンドル膨張分析

| 項目 | サイズ |
|---|---|
| プロダクションソースコード（raw） | 140 KB (4,701行) |
| CLI バンドル（minified） | 1,211 KB |
| **膨張率** | **8.7x** |

バンドルの大部分は AWS SDK (@aws-sdk/client-codecommit + @smithy) が占める。プロダクションコードは 140KB だが、AWS SDK の tree-shaking 後でも約 1MB がバンドルに含まれる。

---

## 2. テスト性能

| メトリクス | 値 |
|---|---|
| テストファイル数 | 22 |
| テストケース数 | **805** |
| テスト実行時間（wall clock） | **9.4 - 11.5s** |
| transform | 2.2s |
| setup | 312ms |
| import | 9.3 - 10.1s |
| tests (CPU時間合計) | 14.8 - 19.5s |

### 遅いテストファイル Top 5

| ファイル | テスト数 | 実行時間 |
|---|---|---|
| PullRequestDetail.test.tsx | 189 | **6,212 - 6,897ms** |
| app.test.tsx | 107 | **5,547ms** |
| CommentInput.test.tsx | 14 | **1,234ms** |
| Help.test.tsx | 22 | 804ms |
| PullRequestList.test.tsx | 42 | 460 - 780ms |

**ボトルネック**: `PullRequestDetail.test.tsx` と `app.test.tsx` の2ファイルでテスト時間の約 70% を占める。いずれも `ink-testing-library` の `render()` + `vi.waitFor()` を多用しており、非同期UIレンダリングの待機がオーバーヘッドの主因。

### テストカバレッジ

| メトリクス | 値 | 閾値 |
|---|---|---|
| Statements | **97.65%** | 95% |
| Branches | **95.05%** | 95% |
| Functions | **99.63%** | 95% |
| Lines | **99.92%** | 95% |

---

## 3. CI パイプライン性能

| ステップ | 実行時間 | 備考 |
|---|---|---|
| lint (oxlint) | **0.14s** | 50ファイル, 132ルール, 4スレッド |
| format:check (Biome) | **0.20s** | 50ファイル |
| check (tsc --noEmit) | **2.6s** | strict mode, 型チェックのみ |
| dead-code (knip) | **2.1s** | 未使用エクスポート検出 |
| audit | ~0.5s | 依存脆弱性チェック |
| test:coverage | **11.9s** | vitest + v8 coverage |
| build | **3.1s** | bun build + tsc declarations |
| **CI 全体 (bun run ci)** | **~20.6s** | 全ステップ直列実行 |

---

## 4. 起動性能

### CLI 起動時間 (--help)

| 回 | 時間 | 備考 |
|---|---|---|
| 1回目（コールドスタート） | **674ms** | モジュールキャッシュなし |
| 2回目以降（ウォーム） | **166 - 183ms** | ファイルシステムキャッシュ効果 |

### モジュールインポート時間 (Node.js)

| メトリクス | 値 |
|---|---|
| import('./dist/cli.mjs') | **331ms** |
| import('./dist/index.js') | 同等 |

---

## 5. メモリ使用量

### ライブラリインポート (Node.js)

| メトリクス | before | after | delta |
|---|---|---|---|
| RSS | 42.86 MB | 79.02 MB | **+36.16 MB** |
| Heap Used | 3.60 MB | 13.72 MB | **+10.11 MB** |
| Heap Total | — | 21.65 MB | — |
| External | — | 19.42 MB | — |

### CLI 実行時 (Node.js)

| メトリクス | 値 |
|---|---|
| RSS | **81.93 MB** |
| Heap Used | **16.67 MB** |
| Heap Total | 22.22 MB |

**分析**: RSS ~82MB のうち、Node.js ランタイム自体が ~43MB を占め、アプリケーション固有は ~37MB。Heap Used は 17MB 程度で、AWS SDK のメタデータモデル定義がその大部分。Ink (React for CLI) のオーバーヘッドは軽微。

---

## 6. 依存関係分析

### パッケージ数

| メトリクス | 値 |
|---|---|
| 直接依存 (devDependencies) | **14** |
| ディスク上のユニークパッケージ | **238** |
| 推移的依存（bun pm ls 行数） | **315** |
| node_modules 合計サイズ | **256 MB** |

### node_modules 内訳 Top 10

| パッケージ | サイズ | 用途 |
|---|---|---|
| @biomejs/ | 94.8 MB | フォーマッター (dev only) |
| @oxlint/ | 34.9 MB | リンター (dev only) |
| typescript/ | 22.9 MB | 型チェック (dev only) |
| es-toolkit/ | 11.6 MB | ユーティリティ (vitest 依存) |
| @esbuild/ | 10.6 MB | ビルドツール (dev only) |
| @aws-sdk/ | 9.0 MB | AWS SDK (本番バンドルに含む) |
| @smithy/ | 8.3 MB | AWS SDK 基盤 (本番バンドルに含む) |
| zod/ | 6.1 MB | バリデーション (knip 依存) |
| @babel/ | 5.2 MB | パーサー (vitest 依存) |
| knip/ | 4.8 MB | dead code 検出 (dev only) |

**注目点**: node_modules の 256MB のうち、本番バンドルに含まれるのは @aws-sdk (9MB) + @smithy (8.3MB) + ink (948KB) + react (260KB) のみ。dev ツール類が大部分を占めるが、CI 実行には必要。

---

## 7. コード品質メトリクス

| メトリクス | 値 |
|---|---|
| プロダクションコード行数 | **4,701 行** |
| テストコード行数 | **19,171 行** |
| テスト / プロダクション比 | **4.07x** |
| ソースファイル数（.ts/.tsx） | 50 |
| テストファイル数 | 22 |
| lint ルール数 | 132 |
| lint 警告 / エラー | **0** |

### 最大ファイル Top 5

| ファイル | 行数 | 役割 |
|---|---|---|
| PullRequestDetail.test.tsx | 7,863 | テスト |
| app.test.tsx | 4,877 | テスト |
| codecommit.test.ts | 2,331 | テスト |
| PullRequestDetail.tsx | 1,042 | コンポーネント |
| codecommit.ts | 710 | サービス層 |

---

## 8. 総合評価と改善提案

### 良い点

- **CI 全体が ~21秒**: ローカルでの高速フィードバックループが確保されている
- **テストカバレッジ 95%超**: 品質基準を満たしている
- **起動時間 ~170ms** (ウォーム): TUI アプリとして十分高速
- **メモリ使用 ~82MB RSS**: ターミナルアプリとして許容範囲
- **ビルド 3.1s**: Bun のバンドラが高速

### 改善検討項目

| 優先度 | 項目 | 期待効果 |
|---|---|---|
| **高** | PullRequestDetail.test.tsx の分割 | テスト実行時間 30-40% 短縮の可能性。7,863行の単一テストファイルが Vitest のワーカー並列化を阻害 |
| **高** | バンドルサイズ削減（AWS SDK v3 の個別コマンドインポート確認） | バンドル 1.2MB は CLIツールとして大きい。`@aws-sdk/client-codecommit` の tree-shaking 効率を検証すべき |
| **中** | テストの import 時間 (9-10s) | Vitest の `--pool=threads` や `--isolate=false` でテストインポートの重複排除を検討 |
| **中** | `computeSimpleDiff` O(n×m) アルゴリズム | 大規模 diff で遅延する可能性。Map ベースの O(n+m) に改善可能 |
| **低** | コールドスタート 674ms → ウォーム 170ms の差 | V8 のコード解析コスト。`--compile-cache` の活用で軽減可能 |

### ランタイムボトルネック（API 操作時）

既存の `docs/performance-analysis.md` に詳細分析済み。特に以下が未対応：

1. **listPullRequests の N+1 問題** — concurrency 5→10 で体感改善（低リスク）
2. **reaction の全件取得** — 遅延ロード化で API コール削減（中リスク）
3. **blob キャッシュ未実装** — 同一 blob の重複取得を防止（中リスク）
