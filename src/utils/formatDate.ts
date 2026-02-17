export function formatRelativeDate(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
}

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
