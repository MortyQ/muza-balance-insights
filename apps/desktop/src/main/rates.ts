// Today's public Monobank rates (GET /bank/currency, no token): what the home screen converts every amount by. The
// request carries no headers and nothing of the user's; the answer is checked field by field and saved to rates.json,
// so the app keeps working offline with the last good rates. Monobank refreshes them at most every 5 minutes and answers
// more frequent calls with 429: never sooner than MIN_GAP_MS after the previous attempt.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { currencyExponent } from '@mono/core/currency';
import type { FetchLike } from '@mono/core/platform';
import type { RatesView } from '../shared/api.ts';

export const RATES_URL = 'https://api.monobank.ua/bank/currency';
export const RATES_FILE = 'rates.json';
export const MIN_GAP_MS = 5 * 60_000;
export const REFRESH_EVERY_MS = 4 * 3600_000;
export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_BYTES = 64 * 1024;
/** Nothing saved yet: how long an overview waits for the first answer before it goes on without rates. */
export const FIRST_WAIT_MS = 5_000;
/** Rates saved: how long an overview waits for a refresh in flight before it goes on with the saved ones. */
export const FRESH_WAIT_MS = 2_000;

const UAH = 980;

const Pair = z.object({
  currencyCodeA: z.number().int().positive(),
  currencyCodeB: z.number().int().positive(),
  rateSell: z.number().optional(),
  rateCross: z.number().optional(),
});

const Saved = z.object({
  fetchedAt: z.number().int().positive(),
  list: z.array(z.object({ currency: z.number().int().positive(), rate: z.number().positive().finite() })).min(1),
});
type SavedRates = z.infer<typeof Saved>;

/** Hryvnia kopecks per minor unit for every pair to hryvnia (sell rate, else cross); null — nothing usable. */
export function parseBankRates(text: string): RatesView['list'] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  const out = new Map<number, number>();
  for (const item of raw) {
    const p = Pair.safeParse(item);
    if (!p.success || p.data.currencyCodeB !== UAH || p.data.currencyCodeA === UAH) continue;
    const perUnit = p.data.rateSell ?? p.data.rateCross;
    if (perUnit === undefined || !Number.isFinite(perUnit) || perUnit <= 0) continue;
    // Rounded to 12 significant digits: 0.28 * 10 ** 2 would otherwise be 28.000000000000004.
    const rate = Number((perUnit * 10 ** (currencyExponent(UAH) - currencyExponent(p.data.currencyCodeA))).toPrecision(12));
    out.set(p.data.currencyCodeA, rate);
  }
  return out.size === 0 ? null : [...out].sort(([a], [b]) => a - b).map(([currency, rate]) => ({ currency, rate }));
}

export type RatesDeps = {
  /** allowlistedFetch over the guarded rates session (rates-session.ts); tests pass a fake. */
  fetch: FetchLike;
  userDataDir: string;
  nowMs: () => number;
  log: (msg: string) => void;
};

export type RatesTimers = { every: (fn: () => void, ms: number) => () => void };

export class RatesService {
  private saved: SavedRates | null;
  private failed = false;
  private lastAttemptMs: number | null = null;
  private inFlight: Promise<void> | null = null;
  /** Bumped by forget(): a refresh started before it neither saves nor restores anything. */
  private generation = 0;
  private stopTimer: (() => void) | null = null;

  constructor(private readonly d: RatesDeps) {
    this.saved = this.read();
  }

  /** A refresh now and every REFRESH_EVERY_MS until stop(). */
  start(timers: RatesTimers): () => void {
    this.stop();
    void this.refresh();
    this.stopTimer = timers.every(() => void this.refresh(), REFRESH_EVERY_MS);
    return () => this.stop();
  }

  stop(): void {
    this.stopTimer?.();
    this.stopTimer = null;
  }

  /** After «Delete all data»: no rates in memory; a refresh in flight is discarded. */
  forget(): void {
    this.generation++;
    this.saved = null;
    this.failed = false;
  }

  /** One GET unless one ran less than MIN_GAP_MS ago or is running; a failure keeps the saved rates. */
  refresh(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const now = this.d.nowMs();
    // A clock that went backwards counts as elapsed: otherwise the rates would freeze until it catches up.
    const since = this.lastAttemptMs === null ? Infinity : now - this.lastAttemptMs;
    if (since >= 0 && since < MIN_GAP_MS) return Promise.resolve();
    this.lastAttemptMs = now;
    this.inFlight = this.fetchOnce(now, this.generation).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /**
   * The rates every overview converts by; null — never fetched successfully. A refresh in flight is waited for (up to
   * FRESH_WAIT_MS with rates saved, FIRST_WAIT_MS without), so the launch screen gets today's rates, not yesterday's.
   */
  async current(): Promise<RatesView | null> {
    if (this.inFlight) {
      const wait = this.saved ? FRESH_WAIT_MS : FIRST_WAIT_MS;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([this.inFlight, new Promise((r) => (timer = setTimeout(r, wait)))]);
      } finally {
        clearTimeout(timer);
      }
    }
    return this.saved ? { list: this.saved.list, fetchedAt: this.saved.fetchedAt, saved: this.failed } : null;
  }

  private async fetchOnce(now: number, generation: number): Promise<void> {
    try {
      const res = await this.d.fetch(RATES_URL, { headers: {}, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      if (Number(res.headers.get('content-length')) > MAX_BYTES) throw new Error('response too large');
      const text = await res.text();
      if (text.length > MAX_BYTES) throw new Error('response too large');
      const list = parseBankRates(text);
      if (!list) throw new Error('no usable rates');
      const next: SavedRates = { fetchedAt: Math.floor(now / 1000), list };
      if (generation !== this.generation) return;
      await this.write(next);
      // forget() while the file was being written: the wipe has already run, so the file goes too.
      if (generation !== this.generation) return void (await fs.promises.rm(path.join(this.d.userDataDir, RATES_FILE), { force: true }));
      this.saved = next;
      this.failed = false;
    } catch (err) {
      if (generation !== this.generation) return;
      this.failed = true;
      this.d.log(`rates not refreshed: ${err instanceof Error ? err.message : 'error'}`);
    }
  }

  private read(): SavedRates | null {
    try {
      const p = Saved.safeParse(JSON.parse(fs.readFileSync(path.join(this.d.userDataDir, RATES_FILE), 'utf8')));
      return p.success ? p.data : null;
    } catch {
      return null;
    }
  }

  private async write(v: SavedRates): Promise<void> {
    const file = path.join(this.d.userDataDir, RATES_FILE);
    await fs.promises.writeFile(`${file}.tmp`, JSON.stringify(v), { mode: 0o600 });
    await fs.promises.rename(`${file}.tmp`, file);
  }
}
