/**
 * Maps an array of items through an async function with bounded concurrency.
 *
 * Unlike `Promise.all(items.map(fn))` which launches all tasks at once,
 * this limits the number of concurrent operations to avoid API throttling
 * (e.g., AWS CodeCommit TPS limits of 15-25 per operation).
 */
export async function mapWithLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length }) as R[];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]!);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
