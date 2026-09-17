/**
 * Maps items with limited concurrency using a worker pool pattern.
 * Processes at most `limit` items concurrently.
 */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length }) as R[];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]!);
    }
  }

  // A limit below 1 (or NaN) would spawn no workers and silently resolve to
  // an array of undefined, so always run at least one worker when there is work.
  const safeLimit = limit >= 1 ? limit : 1;
  const workers = Array.from({ length: Math.min(safeLimit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
