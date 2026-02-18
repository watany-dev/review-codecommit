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

type ShellType = "bash" | "zsh" | "fish";

export function isValidShellType(value: string): value is ShellType {
  return value === "bash" || value === "zsh" || value === "fish";
}

export function parseAwsProfiles(configContent: string): string[] {
  const profiles: string[] = [];
  for (const line of configContent.split("\n")) {
    const trimmed = line.trim();
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
                while IFS= read -r _profile; do
                    _profile="\${_profile//[^a-zA-Z0-9_.@-]/}"
                    [ -n "$_profile" ] && profiles="$profiles $_profile"
                done < <(grep -E '^\\[profile |^\\[default\\]' "\${HOME}/.aws/config" | sed -E 's/^\\[profile (.+)\\]/\\1/; s/^\\[default\\]/default/')
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
                while IFS= read -r _profile; do
                    _profile="\${_profile//[^a-zA-Z0-9_.@-]/}"
                    [[ -n "$_profile" ]] && profiles+=("$_profile")
                done < <(grep -E '^\\[profile |^\\[default\\]' "\${HOME}/.aws/config" | sed -E 's/^\\[profile (.+)\\]/\\1/; s/^\\[default\\]/default/')
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

export function generateFishCompletion(): string {
  const regionCompletions = CODECOMMIT_REGIONS.map(
    (r) => `complete -c review-codecommit -l region -xa "${r}"`,
  ).join("\n");

  return `# fish completion for review-codecommit

# Disable file completion by default
complete -c review-codecommit -f

# Options
complete -c review-codecommit -l profile -x -d "AWS profile to use" -a "(test -f ~/.aws/config; and grep -E '^\\[profile |^\\[default\\]' ~/.aws/config | sed -E 's/^\\[profile (.+)\\]/\\1/; s/^\\[default\\]/default/' | string replace -ra '[^a-zA-Z0-9_.@-]' '')"
complete -c review-codecommit -l help -d "Show help message"
complete -c review-codecommit -s h -d "Show help message"
complete -c review-codecommit -l version -d "Show version number"
complete -c review-codecommit -s v -d "Show version number"
complete -c review-codecommit -l completions -xa "bash zsh fish" -d "Generate shell completion script"

# Regions
${regionCompletions}
`;
}

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
