/**
 * Answers of the data screens, kept in memory so a screen opened again shows its numbers at once. An answer is fresh
 * while no data change happened since its request started and it is younger than READ_FRESH_MS; an older one is shown
 * and asked for again. Every write to main and every refresh of the data status moves the generation on
 * (shared/api/balance.ts, the sync-status store), so nothing changed is ever served fresh. Memory only: the lock's
 * reload leaves nothing behind. Keys: readKey(method, args).
 */
import type { Method } from '@contract/channels.ts';

export const READ_CACHE_SIZE = 50;
export const READ_FRESH_MS = 60_000;

type Entry = { data: unknown; generation: number; at: number };

export const readKey = (method: Method, args: readonly unknown[]): string => `${method}:${JSON.stringify(args)}`;

export class ReadCache {
  private gen = 0;
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly size = READ_CACHE_SIZE,
    private readonly freshMs = READ_FRESH_MS,
  ) {}

  /** Read at a request's start and passed to put(): an answer that raced a data change lands stale. */
  get generation(): number {
    return this.gen;
  }

  peek<T>(key: string): { data: T; fresh: boolean } | null {
    const e = this.entries.get(key);
    if (!e) return null;
    // Most recently used last: the first entry is the one dropped.
    this.entries.delete(key);
    this.entries.set(key, e);
    return { data: e.data as T, fresh: e.generation === this.gen && this.now() - e.at < this.freshMs };
  }

  put(key: string, data: unknown, generation: number): void {
    this.entries.delete(key);
    this.entries.set(key, { data, generation, at: this.now() });
    while (this.entries.size > this.size) this.entries.delete(this.entries.keys().next().value as string);
  }

  /** A data change: every kept answer is stale from now on. */
  invalidate(): void {
    this.gen += 1;
  }
}

/** The renderer's one cache. */
export const readCache = new ReadCache();

/** A data change from outside a call (an imported window, the end of an import, a status refresh). */
export function invalidateReads(): void {
  readCache.invalidate();
}
