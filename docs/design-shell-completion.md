# シェル補完設計書

**バージョン**: v0.3.0
**ステータス**: 📋 設計中
**最終更新**: 2026-02-15

> 📋 設計中
>
> CLI としての基本的な開発者体験を向上させるシェル補完機能。
> `--completions bash|zsh|fish` で各シェル用の補完スクリプトを生成し、
> `--profile`、`--region` オプションおよび AWS プロファイル名の動的補完を提供する。

## 概要

ターミナルツールとして、タブ補完は最も基本的な利便性機能である。`--profile`、`--region` 等の CLI オプション補完と、`~/.aws/config` から読み取った AWS プロファイル名の動的補完を提供する。bash / zsh / fish の 3 つのシェルに対応し、外部ライブラリに依存しない軽量な実装とする。

## スコープ

### 今回やること

- `--completions bash` で bash 用の補完スクリプトを標準出力に出力する
- `--completions zsh` で zsh 用の補完スクリプトを標準出力に出力する
- `--completions fish` で fish 用の補完スクリプトを標準出力に出力する
- CLI オプション（`--profile`, `--region`, `--help`, `--version`）の補完
- `--profile` 引数として `~/.aws/config` のプロファイル名を動的に補完
- `--region` 引数として CodeCommit がサポートする AWS リージョンを補完
- 補完スクリプト生成のユニットテスト
- AWS プロファイルパーサーのユニットテスト

### 今回やらないこと

- リポジトリ名の動的補完（API 呼び出しが必要で補完の応答速度が低下する） → 将来検討
- サブコマンドの補完（現時点でサブコマンドが存在しない）
- 補完スクリプトの自動インストール（ユーザーが手動で設定ファイルに追加する）
- PowerShell / nushell 等の補完対応 → 将来検討

## CLI インターフェース

### 新規オプション

```
--completions <shell>   Generate shell completion script (bash, zsh, fish)
```

### 使用イメージ

```bash
# bash: 補完スクリプトを生成し、ユーザーの補完ディレクトリに保存
npx review-codecommit --completions bash > ~/.bash_completion.d/review-codecommit
# または .bashrc に追記
echo 'eval "$(npx review-codecommit --completions bash)"' >> ~/.bashrc

# zsh: 補完スクリプトを fpath のディレクトリに保存
npx review-codecommit --completions zsh > ~/.zsh/completions/_review-codecommit
# または .zshrc に追記
echo 'eval "$(npx review-codecommit --completions zsh)"' >> ~/.zshrc

# fish: 補完スクリプトを fish の補完ディレクトリに保存
npx review-codecommit --completions fish > ~/.config/fish/completions/review-codecommit.fish
```

### 補完の動作例

```bash
npx review-codecommit --<Tab>
#=> --profile  --region  --help  --version  --completions

npx review-codecommit --profile <Tab>
#=> dev  staging  production    (← ~/.aws/config から動的に取得)

npx review-codecommit --region <Tab>
#=> ap-northeast-1  ap-northeast-2  ap-southeast-1  us-east-1  us-west-2  eu-west-1  ...

npx review-codecommit --completions <Tab>
#=> bash  zsh  fish
```

### 動作仕様

- `--completions` が指定された場合、補完スクリプトを標準出力に出力して `process.exit(0)` で終了する
- `--completions` に不正な値（bash/zsh/fish 以外）が指定された場合、エラーメッセージを stderr に出力して `process.exit(1)` で終了する
- `--completions` に値が指定されていない場合、エラーメッセージを stderr に出力して `process.exit(1)` で終了する
- `--help` と `--completions` が同時に指定された場合、`--help` が優先される（既存動作と同じ早期リターン順序）
- TUI の起動は行わない（非インタラクティブ出力）

## データモデル

### AWS リージョンリスト

CodeCommit がサポートするリージョンを定数として定義する。

```typescript
// src/completions.ts

export const CODECOMMIT_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "af-south-1",
  "ap-east-1",
  "ap-south-1",
  "ap-south-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-southeast-3",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-northeast-3",
  "ca-central-1",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-south-1",
  "eu-north-1",
  "il-central-1",
  "me-south-1",
  "me-central-1",
  "sa-east-1",
] as const;
```

**設計判断**: リージョンリストはハードコーディングする。理由:
- 補完スクリプト生成は非インタラクティブ処理であり、API 呼び出しは不適切
- CodeCommit のリージョン追加頻度は非常に低い（年に 0〜2 回程度）
- AWS SDK の `describe-regions` は EC2 API であり、追加依存が必要

### AWS プロファイルパーサー

`~/.aws/config` ファイルをパースし、プロファイル名のリストを抽出する。

```typescript
// src/completions.ts

/**
 * Parse AWS config file and extract profile names.
 * Returns profile names sorted alphabetically.
 * Returns empty array if file does not exist or cannot be read.
 */
export function parseAwsProfiles(configContent: string): string[] {
  const profiles: string[] = [];
  for (const line of configContent.split("\n")) {
    const trimmed = line.trim();
    // [profile name] or [default]
    const profileMatch = trimmed.match(/^\[profile\s+(.+?)\]$/);
    if (profileMatch?.[1]) {
      profiles.push(profileMatch[1]);
      continue;
    }
    if (trimmed === "[default]") {
      profiles.push("default");
    }
  }
  return profiles.sort();
}
```

**設計判断**: `~/.aws/config` のフォーマットは INI ライクで、`[profile <name>]` または `[default]` のセクションヘッダーからプロファイル名を抽出する。`~/.aws/credentials` も同様にパース可能だが、`~/.aws/config` のみで十分（credentials ファイルは profile ヘッダーが `[<name>]` 形式で config と異なる）。

### シェル補完スクリプトの型

```typescript
// src/completions.ts

export type ShellType = "bash" | "zsh" | "fish";

export function isValidShellType(value: string): value is ShellType {
  return value === "bash" || value === "zsh" || value === "fish";
}
```

## 補完スクリプト設計

### bash 補完スクリプト

```typescript
export function generateBashCompletion(): string {
  return `# bash completion for review-codecommit
_review_codecommit() {
    local cur prev opts
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    opts="--profile --region --help --version --completions"

    case "\${prev}" in
        --profile)
            local profiles=""
            if [ -f "\${HOME}/.aws/config" ]; then
                profiles=$(grep -E '^\\[profile |^\\[default\\]' "\${HOME}/.aws/config" | sed -E 's/^\\[profile (.+)\\]/\\1/; s/^\\[default\\]/default/')
            fi
            COMPREPLY=( $(compgen -W "\${profiles}" -- "\${cur}") )
            return 0
            ;;
        --region)
            local regions="${CODECOMMIT_REGIONS.join(" ")}"
            COMPREPLY=( $(compgen -W "\${regions}" -- "\${cur}") )
            return 0
            ;;
        --completions)
            COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
            return 0
            ;;
    esac

    if [[ "\${cur}" == -* ]]; then
        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
        return 0
    fi
}

complete -F _review_codecommit review-codecommit
`;
}
```

**設計判断**:
- `--profile` の補完は補完実行時に `~/.aws/config` を動的に読み取る（スクリプト生成時ではなく実行時）
- `--region` のリージョンリストはスクリプト生成時に埋め込む（静的リスト）
- `complete -F` で関数ベースの補完を登録

### zsh 補完スクリプト

```typescript
export function generateZshCompletion(): string {
  const regionsArray = CODECOMMIT_REGIONS.map((r) => `"${r}"`).join(" ");
  return `#compdef review-codecommit
# zsh completion for review-codecommit

_review_codecommit() {
    local -a opts regions profiles

    opts=(
        '--profile[AWS profile to use]:profile:->profile'
        '--region[AWS region to use]:region:->region'
        '--help[Show help message]'
        '--version[Show version number]'
        '--completions[Generate shell completion script]:shell:(bash zsh fish)'
    )

    _arguments -s $opts '*:repository:' && return

    case "$state" in
        profile)
            profiles=()
            if [[ -f "\${HOME}/.aws/config" ]]; then
                profiles=(\${(f)"$(grep -E '^\\[profile |^\\[default\\]' "\${HOME}/.aws/config" | sed -E 's/^\\[profile (.+)\\]/\\1/; s/^\\[default\\]/default/')"})
            fi
            _describe 'AWS profile' profiles
            ;;
        region)
            regions=(${regionsArray})
            _describe 'AWS region' regions
            ;;
    esac
}

_review_codecommit "$@"
`;
}
```

**設計判断**:
- `_arguments` による zsh ネイティブの補完フレームワークを活用
- `->profile`、`->region` で状態遷移を使い、引数に応じた動的補完を実現
- zsh の `#compdef` ヘッダーにより `fpath` に配置するだけで自動認識される

### fish 補完スクリプト

```typescript
export function generateFishCompletion(): string {
  const regionCompletions = CODECOMMIT_REGIONS.map(
    (r) => `complete -c review-codecommit -l region -xa "${r}"`,
  ).join("\n");

  return `# fish completion for review-codecommit

# Disable file completion by default
complete -c review-codecommit -f

# Options
complete -c review-codecommit -l profile -x -d "AWS profile to use" -a "(test -f ~/.aws/config; and grep -E '^\\[profile |^\\[default\\]' ~/.aws/config | sed -E 's/^\\[profile (.+)\\]/\\1/; s/^\\[default\\]/default/')"
complete -c review-codecommit -l help -d "Show help message"
complete -c review-codecommit -s h -d "Show help message"
complete -c review-codecommit -l version -d "Show version number"
complete -c review-codecommit -s v -d "Show version number"
complete -c review-codecommit -l completions -xa "bash zsh fish" -d "Generate shell completion script"

# Regions
${regionCompletions}
`;
}
```

**設計判断**:
- fish は `complete` コマンドで宣言的に補完を定義する
- `-x` は排他フラグ（ファイル補完を無効にする）
- `-a "(...)"` でコマンド置換による動的プロファイル取得
- `-l` はロングオプション、`-s` はショートオプション

## データフロー

```
ユーザー                     CLI (cli.tsx)              completions.ts
  │                            │                          │
  │── --completions bash ─────→│                          │
  │                            │── parseArgs() ──────────→│
  │                            │   completions: "bash"    │
  │                            │                          │
  │                            │── generateBashCompletion()→│
  │                            │←── completion script ────│
  │                            │                          │
  │←── stdout に出力 ──────────│                          │
  │                            │── process.exit(0)        │
```

### 不正な --completions 値の場合

```
ユーザー                     CLI (cli.tsx)
  │                            │
  │── --completions invalid ──→│
  │                            │── isValidShellType("invalid") → false
  │                            │
  │←── stderr にエラー出力 ────│
  │    "Invalid shell type: invalid. Use bash, zsh, or fish."
  │                            │── process.exit(1)
```

## コンポーネント設計

### 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/completions.ts` | **新規**: 補完スクリプト生成関数、AWS プロファイルパーサー、リージョンリスト定数、シェル種別バリデーション |
| `src/completions.test.ts` | **新規**: 補完関連のテスト |
| `src/cli.tsx` | `--completions` オプションのパース追加、補完スクリプト出力ロジック追加、ヘルプテキスト更新 |
| `src/cli.test.ts` | `--completions` オプションのテスト追加 |
| `src/components/Help.tsx` | ヘルプ画面は変更なし（`--completions` は CLI オプションであり、TUI キーバインドではない） |

### 1. completions モジュール（新規）

#### ファイル構成

```
src/completions.ts       — 補完ロジック
src/completions.test.ts  — テスト
```

#### エクスポート一覧

```typescript
// src/completions.ts

export const CODECOMMIT_REGIONS: readonly string[];  // as const で定義されるため readonly string[]
export type ShellType = "bash" | "zsh" | "fish";

export function isValidShellType(value: string): value is ShellType;
export function parseAwsProfiles(configContent: string): string[];
export function generateBashCompletion(): string;
export function generateZshCompletion(): string;
export function generateFishCompletion(): string;
export function generateCompletion(shell: ShellType): string;
```

#### generateCompletion（エントリーポイント）

```typescript
export function generateCompletion(shell: ShellType): string {
  switch (shell) {
    case "bash":
      return generateBashCompletion();
    case "zsh":
      return generateZshCompletion();
    case "fish":
      return generateFishCompletion();
  }
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
  completions?: string;  // v0.3.0 追加
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
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--version" || arg === "-v") {
      result.version = true;
    } else if (arg === "--profile" && nextArg) {
      result.profile = nextArg;
      i++;
    } else if (arg === "--region" && nextArg) {
      result.region = nextArg;
      i++;
    } else if (arg === "--completions") {  // v0.3.0 追加
      // nextArg が存在し、かつフラグ（-で始まる）でない場合のみ値として消費
      if (nextArg && !nextArg.startsWith("-")) {
        result.completions = nextArg;
        i++;
      } else {
        result.completions = "";
      }
    } else if (arg && !arg.startsWith("-")) {
      result.repoName = arg;
    }
  }

  return result;
}
```

**設計判断**: `--completions` の値消費ルール:
- `--completions bash` → `completions: "bash"`（正常）
- `--completions --help` → `completions: ""`（`--help` はフラグとして次のループで処理される）
- `--completions`（末尾） → `completions: ""`（値なし）
- `completions: ""` は `isValidShellType("")` が `false` を返すため、エラーメッセージが表示される

これにより `--profile`/`--region` と同様に、フラグが引数の値として誤消費されることを防ぐ。

#### モジュールレベル実行の変更

```typescript
import { generateCompletion, isValidShellType } from "./completions.js";

const parsed = parseArgs(process.argv);

if (parsed.help) {
  console.log(HELP_TEXT);
  process.exit(0);
}

if (parsed.version) {
  console.log(VERSION);
  process.exit(0);
}

// v0.3.0: 補完スクリプト生成
if (parsed.completions !== undefined) {
  if (!isValidShellType(parsed.completions)) {
    console.error(
      `Invalid shell type: "${parsed.completions}". Use bash, zsh, or fish.`,
    );
    process.exit(1);
  }
  console.log(generateCompletion(parsed.completions));
  process.exit(0);
}

// ... 既存の TUI 起動ロジック ...
```

#### HELP_TEXT の変更

```typescript
const HELP_TEXT = `review-codecommit - A TUI tool for reviewing AWS CodeCommit pull requests

Usage: review-codecommit [options] [repository]

Options:
  --profile <name>       AWS profile to use
  --region <region>       AWS region to use
  --completions <shell>   Generate completion script (bash, zsh, fish)
  --help, -h              Show this help message
  --version, -v           Show version number

Navigation:
  j/k or arrows       Move cursor
  Enter               Select item
  Esc/q               Go back / quit
  ?                   Show help`;
```

## エッジケースと対処方針

### CLI オプション解析

| ケース | 動作 |
|--------|------|
| `--completions bash` | 正常: bash 補完スクリプトを出力して exit(0) |
| `--completions zsh` | 正常: zsh 補完スクリプトを出力して exit(0) |
| `--completions fish` | 正常: fish 補完スクリプトを出力して exit(0) |
| `--completions invalid` | エラー: stderr にエラーメッセージを出力して exit(1) |
| `--completions`（値なし、末尾） | エラー: `completions: ""` → `isValidShellType("")` が false → exit(1) |
| `--completions --help` | `--help` はフラグとして扱い、`completions: ""` に設定。`--help` が先に評価されてヘルプ表示 |
| `--completions --profile dev` | `--profile` はフラグとして扱い、`completions: ""` に設定。`--profile dev` は正常にパース |
| `--help --completions bash` | `--help` が先にパースされ、ヘルプ表示で exit(0)（`--completions` は評価されない） |
| `--version --completions bash` | `--version` が先にパースされ、バージョン表示で exit(0) |

### 補完スクリプト実行時

| ケース | 動作 |
|--------|------|
| `~/.aws/config` が存在しない | bash/zsh: `if [ -f ... ]` / `if [[ -f ... ]]` ガードにより空リストを返す。fish: `test -f` ガードにより空リスト |
| `~/.aws/config` が空ファイル | grep がマッチなしを返すため、空リストとなる |
| `~/.aws/config` に不正なフォーマット | grep の正規表現にマッチしないため、不正な行は無視される |
| `~/.aws/config` の権限が読み取り不可 | grep がエラーを返すが、シェルの補完フレームワークは出力なしとして扱う（補完候補なし） |
| `$HOME` が未設定 | `${HOME}` が空文字列に展開され、`~/.aws/config` へのパスが不正になる。ファイル存在チェックが false を返し、空リストとなる |

### 生成されるスクリプトの互換性

| ケース | 対処 |
|--------|------|
| bash 3.x（macOS デフォルト）| `complete -F` と `compgen -W` は bash 3.x 以降で利用可能。互換性あり |
| zsh 5.x | `_arguments` と `_describe` は zsh 5.x 以降の標準機能。互換性あり |
| fish 3.x | `complete` コマンドは fish 3.x 以降で安定。互換性あり |
| `grep -E` の可用性 | POSIX 準拠の grep で `-E`（拡張正規表現）はサポートされる。非 POSIX 環境（BusyBox 等）では動作しない可能性があるが、AWS CLI が動作する環境では問題なし |

## セキュリティ考慮

### ファイルアクセス

- `~/.aws/config` の読み取りは補完スクリプト内のシェルコマンドで行う（Node.js 側ではなく、補完実行時のシェル環境で動作）
- 補完スクリプト生成自体は静的なテンプレート文字列の出力のみで、ファイル I/O は行わない
- `parseAwsProfiles` はテスト用のヘルパーおよびドキュメント目的で export する。実行時の補完スクリプトではシェル側の grep/sed でパースするため、Node.js 側でのファイル I/O は行わない。将来的にリポジトリ名の動的補完（Node.js 側での AWS API 呼び出し）を実装する場合に、プロファイル取得のベースとして活用できる

### シェルインジェクション

- 補完スクリプトに動的な入力値は埋め込まない（リージョンリストは定数、プロファイルはシェル側で動的取得）
- テンプレートリテラル内の値はすべてコンパイル時に決定される静的データ

### IAM 権限

v0.3.0 で追加の IAM 権限は不要。補完スクリプトの生成は AWS API を使用しない。

## 技術選定

### 補完スクリプト生成: テンプレート文字列 vs 外部ライブラリ

| 選択肢 | 評価 |
|--------|------|
| **テンプレート文字列（採用）** | 外部依存なし。最小依存の方針に合致。補完スクリプトはシェルごとに異なる構文を持つため、テンプレートが最もシンプル |
| `omelette` / `tabtab` 等のライブラリ | 追加依存が発生。多くのライブラリは独自のプロトコルを使用し、シェルネイティブの補完と統合しにくい |

### プロファイル取得: シェル側 vs Node.js 側

| 選択肢 | 評価 |
|--------|------|
| **シェル側で grep/sed（採用）** | 補完スクリプト内でシェルコマンドを実行。補完実行時のリアルタイムなプロファイル一覧を取得可能。Node.js プロセスの起動が不要で高速 |
| Node.js でファイルを読み取り、スクリプトに埋め込む | スクリプト生成時点のプロファイルしか反映されない。プロファイル追加時にスクリプトの再生成が必要 |

### 補完スクリプトの配置方法: 自動インストール vs 手動

| 選択肢 | 評価 |
|--------|------|
| **手動配置（採用）** | ユーザーの環境に依存しない。各シェルの設定方法はドキュメントで案内。`eval "$(cmd --completions bash)"` パターンは広く知られている |
| `--install-completions` コマンド | シェル環境の自動検出が複雑。権限問題（`/usr/share/bash-completion` 等への書き込み）が発生する可能性 |

## テスト方針

### テスト対象と方針

| テスト対象 | 方針 |
|-----------|------|
| `parseAwsProfiles` | 様々な `~/.aws/config` フォーマットに対するパース結果を検証 |
| `isValidShellType` | 有効値・無効値のバリデーション |
| `generateBashCompletion` | 生成されたスクリプトの構造検証（関数名、complete コマンド、リージョン含有） |
| `generateZshCompletion` | 生成されたスクリプトの構造検証（#compdef ヘッダー、_arguments、リージョン含有） |
| `generateFishCompletion` | 生成されたスクリプトの構造検証（complete コマンド、リージョン含有） |
| `generateCompletion` | ShellType に応じた適切な関数呼び出し |
| `parseArgs` (拡張) | `--completions` オプションのパース |
| CLI モジュールレベル | `--completions bash` で正常終了、不正値でエラー終了 |

カバレッジ 95% 以上を維持する。

### 具体的なテストケース

#### parseAwsProfiles

| # | テストケース | 入力 | 期待結果 |
|---|-------------|------|---------|
| 1 | default プロファイルのみ | `[default]\nregion=us-east-1` | `["default"]` |
| 2 | 名前付きプロファイル | `[profile dev]\nregion=us-east-1` | `["dev"]` |
| 3 | 複数プロファイル | `[default]\n[profile dev]\n[profile prod]` | `["default", "dev", "prod"]` |
| 4 | 空文字列 | `""` | `[]` |
| 5 | セクションヘッダーなし | `region=us-east-1\noutput=json` | `[]` |
| 6 | スペースを含むプロファイル名 | `[profile my profile]` | `["my profile"]` |
| 7 | コメント行を含む | `# comment\n[default]` | `["default"]` |
| 8 | 不正なセクションヘッダー | `[invalid]` | `[]`（`[default]` でも `[profile ...]` でもないため） |
| 9 | ソート順 | `[profile zebra]\n[profile alpha]` | `["alpha", "zebra"]`（アルファベット順） |
| 10 | SSO プロファイル | `[sso-session my-sso]\n[profile sso-user]` | `["sso-user"]`（sso-session は除外） |

#### isValidShellType

| # | テストケース | 入力 | 期待結果 |
|---|-------------|------|---------|
| 1 | bash | `"bash"` | `true` |
| 2 | zsh | `"zsh"` | `true` |
| 3 | fish | `"fish"` | `true` |
| 4 | 空文字列 | `""` | `false` |
| 5 | 不正な値 | `"powershell"` | `false` |
| 6 | 大文字 | `"BASH"` | `false` |

#### generateBashCompletion

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 関数定義を含む | `_review_codecommit()` が含まれる |
| 2 | complete コマンドを含む | `complete -F _review_codecommit review-codecommit` が含まれる |
| 3 | オプション一覧を含む | `--profile`, `--region`, `--help`, `--version`, `--completions` が含まれる |
| 4 | リージョンリストを含む | `us-east-1`, `ap-northeast-1` 等が含まれる |
| 5 | プロファイル動的取得を含む | `~/.aws/config` を参照する grep コマンドが含まれる |
| 6 | completions の補完値を含む | `bash zsh fish` が含まれる |

#### generateZshCompletion

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | compdef ヘッダーを含む | `#compdef review-codecommit` が含まれる |
| 2 | _arguments を使用 | `_arguments` が含まれる |
| 3 | プロファイル補完を含む | `->profile` 状態遷移が含まれる |
| 4 | リージョン補完を含む | `->region` 状態遷移が含まれる |
| 5 | リージョンリストを含む | `us-east-1`, `ap-northeast-1` 等が含まれる |

#### generateFishCompletion

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | complete コマンドを含む | `complete -c review-codecommit` が含まれる |
| 2 | profile オプションを含む | `-l profile` が含まれる |
| 3 | region オプションを含む | `-l region` が含まれる |
| 4 | リージョン一行ずつ | 各リージョンに対して `complete` コマンドが生成される |
| 5 | ファイル補完無効化 | `complete -c review-codecommit -f` が含まれる |

#### generateCompletion

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | bash | `generateBashCompletion()` と同一の結果 |
| 2 | zsh | `generateZshCompletion()` と同一の結果 |
| 3 | fish | `generateFishCompletion()` と同一の結果 |

#### parseArgs（拡張）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `--completions bash` | `{ completions: "bash" }` |
| 2 | `--completions zsh` | `{ completions: "zsh" }` |
| 3 | `--completions fish` | `{ completions: "fish" }` |
| 4 | `--completions` のみ（値なし、末尾） | `{ completions: "" }` |
| 5 | `--completions` と他のオプション | 他のオプションも正常にパースされる |
| 6 | `--completions --help` | `{ completions: "", help: true }`（`--help` はフラグとして処理される） |
| 7 | `--completions --profile dev` | `{ completions: "", profile: "dev" }`（`--profile` はフラグとして処理される） |
| 8 | `--completions invalid` | `{ completions: "invalid" }`（バリデーションは parseArgs の責務外） |

#### CLI モジュールレベル

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | `--completions bash` | 標準出力に bash 補完スクリプトが出力され、`process.exit(0)` |
| 2 | `--completions zsh` | 標準出力に zsh 補完スクリプトが出力され、`process.exit(0)` |
| 3 | `--completions fish` | 標準出力に fish 補完スクリプトが出力され、`process.exit(0)` |
| 4 | `--completions invalid` | 標準エラー出力にエラーメッセージ、`process.exit(1)` |
| 5 | `--completions`（値なし） | 標準エラー出力にエラーメッセージ、`process.exit(1)` |
| 6 | `--help --completions bash` | help が優先（既存動作維持） |

#### generateBashCompletion（追加エッジケース）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 7 | `~/.aws/config` 存在チェック | `if [ -f` によるファイル存在チェックが含まれる |

#### generateZshCompletion（追加エッジケース）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 6 | `~/.aws/config` 存在チェック | `if [[ -f` によるファイル存在チェックが含まれる |

#### generateFishCompletion（追加エッジケース）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 6 | `~/.aws/config` 存在チェック | `test -f` によるファイル存在チェックが含まれる |

#### Property-Based Tests（fast-check）

| # | テストケース | 期待結果 |
|---|-------------|---------|
| 1 | 任意の文字列配列で parseArgs がスローしない | `--completions` を含む入力でもクラッシュしない |
| 2 | `--completions` の値が入力配列に含まれる | round-trip テスト |
| 3 | `parseAwsProfiles` が任意の文字列でスローしない | 不正な config 内容でもクラッシュしない |
| 4 | `--completions` の次引数がフラグの場合、completions は空文字列 | `--completions --X` → `completions: ""` |

## 実装順序

各 Step は TDD サイクル（Red → Green → Refactor）で進める。テストを先に書き、最小限の実装で通し、その後リファクタリングする。

### Step 1: completions モジュール — parseAwsProfiles, isValidShellType

AWS プロファイルパーサーとシェル種別バリデーションの実装。

**この Step で変更するファイル**:
- `src/completions.ts`: 新規作成。`CODECOMMIT_REGIONS` 定数、`ShellType` 型、`isValidShellType` 関数、`parseAwsProfiles` 関数
- `src/completions.test.ts`: 新規作成。上記のテスト

**この Step の完了条件**: `parseAwsProfiles` と `isValidShellType` の全テストが通過。

### Step 2: completions モジュール — bash / zsh / fish スクリプト生成

3 つのシェル用の補完スクリプト生成関数と `generateCompletion` エントリーポイントの実装。

**この Step で変更するファイル**:
- `src/completions.ts`: `generateBashCompletion`、`generateZshCompletion`、`generateFishCompletion`、`generateCompletion` 関数を追加
- `src/completions.test.ts`: 生成スクリプトの構造テスト追加

**この Step の完了条件**: 各生成関数のテストが通過。生成されたスクリプトが正しい構造を持つ。

### Step 3: CLI — parseArgs 拡張

`--completions` オプションのパースを追加。

**この Step で変更するファイル**:
- `src/cli.tsx`: `ParsedArgs` に `completions` フィールド追加、`parseArgs` の `--completions` 分岐追加
- `src/cli.test.ts`: `--completions` パーステスト追加、property-based テスト拡張

**この Step の完了条件**: `parseArgs` の全テスト（既存 + 新規）が通過。

### Step 4: CLI — 補完スクリプト出力ロジック

`--completions` 指定時のスクリプト出力とプロセス終了ロジックの実装。ヘルプテキストの更新。

**この Step で変更するファイル**:
- `src/cli.tsx`: `--completions` ハンドリング追加（`isValidShellType` チェック、`generateCompletion` 呼び出し、`process.exit`）、`HELP_TEXT` 更新
- `src/cli.test.ts`: モジュールレベル実行テスト追加（正常終了、エラー終了、help 優先）

**この Step の完了条件**: CLI の全テスト（既存 + 新規）が通過。

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
- `docs/requirements.md`: v0.3.0 機能スコープセクション追加
- `docs/roadmap.md`: v0.3.0 セクションに詳細追加
- `README.md`: シェル補完のセットアップ手順を追記

**この Step の完了条件**: 要件定義書・ロードマップ・README が設計書の内容と整合している。
