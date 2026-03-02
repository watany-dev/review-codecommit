import { common, createEmphasize } from "emphasize";

const emphasize = createEmphasize(common);

const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".kt": "kotlin",
  ".swift": "swift",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".cc": "cpp",
  ".cs": "csharp",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".html": "xml",
  ".xml": "xml",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".md": "markdown",
  ".sql": "sql",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".lua": "lua",
  ".r": "r",
  ".pl": "perl",
  ".php": "php",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".ini": "ini",
  ".toml": "ini",
  ".mk": "makefile",
};

const FILENAME_TO_LANG: Record<string, string> = {
  Makefile: "makefile",
  Dockerfile: "bash",
};

export function detectLanguage(filePath: string): string | undefined {
  const slash = filePath.lastIndexOf("/");
  const filename = slash === -1 ? filePath : filePath.slice(slash + 1);

  const filenameLang = FILENAME_TO_LANG[filename];
  if (filenameLang) return filenameLang;

  const dot = filename.lastIndexOf(".");
  if (dot === -1) return undefined;
  return EXT_TO_LANG[filename.slice(dot)];
}

export interface HighlightSegment {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
}

const ESC = String.fromCharCode(0x1b);

function createAnsiSgrRegex(): RegExp {
  return new RegExp(`${ESC}\\[(\\d+(?:;\\d+)*)m`, "g");
}

const ANSI_FG: Record<number, string> = {
  30: "black",
  31: "red",
  32: "green",
  33: "yellow",
  34: "blue",
  35: "magenta",
  36: "cyan",
  37: "white",
  90: "gray",
  91: "redBright",
  92: "greenBright",
  93: "yellowBright",
  94: "blueBright",
  95: "magentaBright",
  96: "cyanBright",
  97: "whiteBright",
};

function buildSegment(
  text: string,
  color: string | undefined,
  bold: boolean,
  dim: boolean,
  italic: boolean,
): HighlightSegment {
  const seg: HighlightSegment = { text };
  if (color) seg.color = color;
  if (bold) seg.bold = true;
  if (dim) seg.dim = true;
  if (italic) seg.italic = true;
  return seg;
}

export function parseAnsiSegments(ansi: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let color: string | undefined;
  let bold = false;
  let dim = false;
  let italic = false;
  let lastIndex = 0;

  const re = createAnsiSgrRegex();
  let match: RegExpExecArray | null;

  while ((match = re.exec(ansi)) !== null) {
    /* v8 ignore start -- defensive guards: text always non-empty when index > lastIndex, regex always captures group 1 */
    if (match.index > lastIndex) {
      const text = ansi.slice(lastIndex, match.index);
      if (text) {
        segments.push(buildSegment(text, color, bold, dim, italic));
      }
    }
    lastIndex = match.index + match[0].length;

    const rawCodes = match[1];
    if (!rawCodes) continue;
    /* v8 ignore stop */
    const codes = rawCodes.split(";").map(Number);
    for (const code of codes) {
      if (code === 0) {
        color = undefined;
        bold = false;
        dim = false;
        italic = false;
      } else if (code === 1) {
        bold = true;
      } else if (code === 2) {
        dim = true;
      } else if (code === 3) {
        italic = true;
      } else if (code === 22) {
        bold = false;
        dim = false;
      } else if (code === 23) {
        italic = false;
      } else if (code === 39) {
        color = undefined;
      } else if (code in ANSI_FG) {
        color = ANSI_FG[code];
      }
    }
  }

  if (lastIndex < ansi.length) {
    const text = ansi.slice(lastIndex);
    /* v8 ignore start -- text is always non-empty when lastIndex < ansi.length */
    if (text) {
      segments.push(buildSegment(text, color, bold, dim, italic));
    }
    /* v8 ignore stop */
  }

  return segments;
}

export function highlightLine(text: string, language: string): HighlightSegment[] {
  if (!text) return [{ text }];
  try {
    const result = emphasize.highlight(language, text);
    return parseAnsiSegments(result.value);
  } catch {
    return [{ text }];
  }
}
