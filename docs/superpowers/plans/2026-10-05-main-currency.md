# Main Currency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The home screen shows every amount in a main currency the user picks (₴ / $ / €), converted at today's Monobank
sell rate that main fetches from the public `/bank/currency` endpoint and caches in userData.

**Architecture:** Main gets a `RatesService` (fetch through its own guarded Electron session and a new allowlist entry,
zod-checked answer, `rates.json` cache, a 4-hour timer). `DataService` folds account currencies into hryvnia by those
rates instead of the user's own exchanges, and every overview answer carries the rates it used (`RatesView`). The renderer
entity `currency-display` keeps the choice (main + «also») and builds one `MoneyFormat` per answer; balances, the «Now»
strip and «Spending» format every hryvnia amount through it.

**Tech Stack:** Electron (main, `session.fromPartition`), zod, Vue 3.5 + Pinia, vue-i18n, Vitest (+ happy-dom for renderer).

**Spec:** `docs/superpowers/specs/2026-10-05-main-currency-design.md`.

**Rules that apply to every task** (from `CLAUDE.md`):
- English only in code, comments, docs, commits. UI texts only via i18n keys: a new key goes into `uk.json` (the
  reference), `en.json`, `ru.json` in the same change; `tests/i18n.test.ts` checks them.
- Fictional fixtures only.
- Run tests from `apps/desktop`: `pnpm --config.verify-deps-before-run=false exec vitest run <file>` (the plain
  `pnpm test` may try to install under the sandbox and fail on the store lock). Full checks at the root:
  `pnpm --config.verify-deps-before-run=false test` and `pnpm --config.verify-deps-before-run=false typecheck`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Do not push.

---

## File map

| File | Change |
|---|---|
| `apps/desktop/src/net/allowlist.ts` | + service `monobank-rates` (Task 1, trust anchor) |
| `apps/desktop/tests/allowlist.test.ts` | the list, scope tests (Task 1) |
| `apps/desktop/src/shared/api.ts` | `TrustedServiceView['id']` (Task 1); `RatesView`, overview `rates`, `FxPart`, `CardTotal.others` (Task 4) |
| `apps/desktop/src/renderer/src/features/settings/security-info/constants.ts` + i18n | `SERVICE_TEXT['monobank-rates']` (Task 1) |
| `apps/desktop/src/main/rates.ts` | **new**: `parseBankRates`, `RatesService` (Task 2) |
| `apps/desktop/tests/rates.test.ts` | **new** (Task 2) |
| `apps/desktop/src/main/rates-session.ts` | **new**: guarded partition + fetch (Task 3) |
| `apps/desktop/tests/rates-session.test.ts` | **new** (Task 3) |
| `apps/desktop/src/main/index.ts` | wiring, timer (Task 3), `DataService` dep (Task 4) |
| `apps/desktop/src/main/wipe.ts`, `tests/wipe.test.ts` | `rates.json` is wiped (Task 3) |
| `apps/desktop/src/main/data.ts` | today's rates, `rates` in answers (Task 4) |
| `apps/desktop/tests/data.test.ts`, `tests/now-main.test.ts`, `tests/spending-main.test.ts` | (Task 4) |
| `apps/desktop/src/renderer/src/entities/currency-display/*` | choice, `MoneyFormat`, store, toggle (Tasks 5–6) |
| `apps/desktop/tests/renderer/currency-display.test.ts` | (Tasks 5–6) |
| `apps/desktop/src/renderer/src/features/balances/*`, `tests/renderer/balances.test.ts` | (Task 7) |
| `apps/desktop/src/renderer/src/features/now-strip/*`, `tests/renderer/now-strip.test.ts` | (Task 8) |
| `apps/desktop/src/renderer/src/features/spending-summary/*`, `tests/renderer/spending*.test.ts` | (Task 9) |
| `apps/desktop/src/shared/i18n/{uk,en,ru}.json` | Tasks 1, 6, 7, 9 |
| `.agents/project/desktop-security.md`, `.agents/project/domain-rules.md`, `docs/backlog.md`, `CHANGELOG.md` | Task 10 |

---

### Task 1: Allowlist entry `monobank-rates` (trust anchor — its own commit)

**Files:**
- Modify: `apps/desktop/src/net/allowlist.ts` (`TRUSTED_SERVICES`)
- Modify: `apps/desktop/tests/allowlist.test.ts`
- Modify: `apps/desktop/src/shared/api.ts:82`
- Modify: `apps/desktop/src/renderer/src/features/settings/security-info/constants.ts`
- Modify: `apps/desktop/src/shared/i18n/{uk,en,ru}.json` (`settings.securityInfo.network.monobankRates`)

- [ ] **Step 1: Update the allowlist test first**

In `tests/allowlist.test.ts`, the first test:

```ts
  it('exactly these services and hosts, in this order (a new one is a reviewed change of this test)', () => {
    expect(TRUSTED_SERVICES.map((s) => [s.id, [...s.hosts]])).toEqual([
      ['github', ['github.com', 'release-assets.githubusercontent.com']],
      ['monobank', ['api.monobank.ua']],
      ['monobank-rates', ['api.monobank.ua']],
    ]);
    for (const s of TRUSTED_SERVICES) expect(s.purpose.length, s.id).toBeGreaterThan(10);
  });
```

Add after the «a scope sees only its own hosts» test:

```ts
  it('monobank-rates: the same host, its own scope (the rates request never borrows the import scope)', () => {
    expect(hostsOf(['monobank-rates'])).toEqual(['api.monobank.ua']);
    expect(isAllowedUrl('https://api.monobank.ua/bank/currency', ['monobank-rates'])).toBe(true);
    expect(isAllowedUrl('https://github.com/x', ['monobank-rates'])).toBe(false);
    // The import's scope is unchanged: still exactly one host.
    expect(hostsOf(['monobank'])).toEqual(['api.monobank.ua']);
  });
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --config.verify-deps-before-run=false exec vitest run tests/allowlist.test.ts`
Expected: FAIL — the list has two entries; `'monobank-rates'` is not a `ServiceId` (also a type error).

- [ ] **Step 3: Add the entry**

In `src/net/allowlist.ts`, after the `monobank` entry:

```ts
  {
    id: 'monobank-rates',
    purpose: "Today's public exchange rates for the home screen's currencies: no token, no headers, no user data",
    hosts: ['api.monobank.ua'],
  },
```

In `src/shared/api.ts:82`:

```ts
export type TrustedServiceView = { id: 'github' | 'monobank' | 'monobank-rates'; hosts: string[] };
```

In `features/settings/security-info/constants.ts`, add to `SERVICE_TEXT`:

```ts
  'monobank-rates': { title: 'Monobank', purpose: 'settings.securityInfo.network.monobankRates' },
```

i18n, next to `settings.securityInfo.network.monobank`:
- `uk.json`: `"monobankRates": "Курси валют на сьогодні для головного екрана. Без токена і без ваших даних."`
- `en.json`: `"monobankRates": "Today's exchange rates for the home screen. No token and none of your data."`
- `ru.json`: `"monobankRates": "Курсы валют на сегодня для главного экрана. Без токена и без ваших данных."`

- [ ] **Step 4: Run, expect PASS**

Run: `pnpm --config.verify-deps-before-run=false exec vitest run tests/allowlist.test.ts tests/services.test.ts tests/i18n.test.ts tests/renderer/settings.test.ts`
Expected: PASS. Then `pnpm --config.verify-deps-before-run=false typecheck` in `apps/desktop`: PASS.

- [ ] **Step 5: Commit (alone — trust anchor)**

```bash
git add apps/desktop/src/net/allowlist.ts apps/desktop/tests/allowlist.test.ts apps/desktop/src/shared/api.ts \
  apps/desktop/src/renderer/src/features/settings/security-info/constants.ts apps/desktop/src/shared/i18n
git commit -m "feat(desktop): trusted service monobank-rates for today's public exchange rates"
```

---

### Task 2: `RatesService` — fetch, validation, cache

**Files:**
- Create: `apps/desktop/src/main/rates.ts`
- Create: `apps/desktop/tests/rates.test.ts`

Contract type used here (added to `src/shared/api.ts` in this task, next to `SpendingFx`):

```ts
/**
 * Today's Monobank rates (public /bank/currency): hryvnia kopecks per minor unit of each quoted currency — the bank's
 * sell rate, or its cross rate for a currency it quotes only so. One snapshot for every amount of an answer.
 */
export type RatesView = {
  list: Array<{ currency: number; rate: number }>;
  /** Epoch seconds of the fetch these rates come from. */
  fetchedAt: number;
  /** The latest refresh failed: these are the saved rates. */
  saved: boolean;
};
```

- [ ] **Step 1: Write the failing tests**

`tests/rates.test.ts`:

```ts
// Today's public Monobank rates: the answer is checked field by field, kept in rates.json, refreshed no more often than
// the bank allows. Fixtures are fictional numbers of the documented shape.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FetchLike, ResponseLike } from '@mono/core/platform';
import { MIN_GAP_MS, RATES_FILE, RATES_URL, RatesService, parseBankRates } from '../src/main/rates.ts';

const ANSWER = [
  { currencyCodeA: 840, currencyCodeB: 980, date: 1_790_000_000, rateBuy: 41.1, rateSell: 41.6 },
  { currencyCodeA: 978, currencyCodeB: 980, date: 1_790_000_000, rateBuy: 47.2, rateSell: 47.9 },
  { currencyCodeA: 978, currencyCodeB: 840, date: 1_790_000_000, rateBuy: 1.15, rateSell: 1.16 },
  { currencyCodeA: 985, currencyCodeB: 980, date: 1_790_000_000, rateCross: 11.3 },
  { currencyCodeA: 392, currencyCodeB: 980, date: 1_790_000_000, rateCross: 0.28 },
];

const res = (status: number, body: string): ResponseLike => ({ status, ok: status === 200, headers: { get: () => null }, text: async () => body });

describe('parseBankRates', () => {
  it('pairs to hryvnia only; sell rate, else cross; kopecks per minor unit (yen has no minor unit)', () => {
    expect(parseBankRates(JSON.stringify(ANSWER))).toEqual([
      { currency: 392, rate: 28 },
      { currency: 840, rate: 41.6 },
      { currency: 978, rate: 47.9 },
      { currency: 985, rate: 11.3 },
    ]);
  });

  it.each([
    ['not json', '{oops'],
    ['not an array', '{"rateSell":1}'],
    ['no usable pair', JSON.stringify([{ currencyCodeA: 978, currencyCodeB: 840, date: 1, rateSell: 1.1 }])],
  ])('null for %s', (_why, body) => {
    expect(parseBankRates(body)).toBeNull();
  });

  it('drops a broken pair, keeps the rest', () => {
    const body = JSON.stringify([
      { currencyCodeA: 840, currencyCodeB: 980, date: 1, rateSell: -1 },
      { currencyCodeA: 826, currencyCodeB: 980, date: 1, rateSell: 'x' },
      { currencyCodeA: 978, currencyCodeB: 980, date: 1, rateSell: 47.9, extra: 'ignored' },
    ]);
    expect(parseBankRates(body)).toEqual([{ currency: 978, rate: 47.9 }]);
  });
});

describe('RatesService', () => {
  let dir: string;
  let nowMs: number;
  let calls: Array<{ url: string; headers: Record<string, string> }>;
  let reply: () => Promise<ResponseLike>;
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers });
    return reply();
  };
  const make = () => new RatesService({ fetch, userDataDir: dir, nowMs: () => nowMs, log: () => undefined });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rates-'));
    nowMs = 1_790_000_000_000;
    calls = [];
    reply = async () => res(200, JSON.stringify(ANSWER));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('refresh: one GET of the public URL with no headers at all; saves and serves the rates', async () => {
    const s = make();
    await s.refresh();
    expect(calls).toEqual([{ url: RATES_URL, headers: {} }]);
    const v = await s.current();
    expect(v).toEqual({ list: expect.arrayContaining([{ currency: 840, rate: 41.6 }]), fetchedAt: 1_790_000_000, saved: false });
    expect(JSON.parse(fs.readFileSync(path.join(dir, RATES_FILE), 'utf8')).fetchedAt).toBe(1_790_000_000);
  });

  it('a new process reads the saved file; a failed refresh keeps it and flags saved', async () => {
    await make().refresh();
    const s = make();
    expect((await s.current())?.saved).toBe(false);
    nowMs += MIN_GAP_MS;
    reply = async () => res(429, '');
    await s.refresh();
    expect(await s.current()).toMatchObject({ fetchedAt: 1_790_000_000, saved: true });
    reply = async () => {
      throw new Error('offline');
    };
    nowMs += MIN_GAP_MS;
    await s.refresh();
    expect((await s.current())?.saved).toBe(true);
  });

  it('never twice within MIN_GAP_MS, also after a failure', async () => {
    const s = make();
    await s.refresh();
    await s.refresh();
    nowMs += MIN_GAP_MS - 1;
    await s.refresh();
    expect(calls).toHaveLength(1);
    nowMs += 1;
    await s.refresh();
    expect(calls).toHaveLength(2);
  });

  it('a too large or broken answer is a failure: the saved rates stay', async () => {
    await make().refresh();
    const s = make();
    nowMs += MIN_GAP_MS;
    reply = async () => res(200, 'x'.repeat(64 * 1024 + 1));
    await s.refresh();
    nowMs += MIN_GAP_MS;
    reply = async () => res(200, '{"not":"rates"}');
    await s.refresh();
    expect(await s.current()).toMatchObject({ fetchedAt: 1_790_000_000, saved: true });
  });

  it('a broken rates.json reads as none', async () => {
    fs.writeFileSync(path.join(dir, RATES_FILE), '{oops');
    reply = async () => res(500, '');
    const s = make();
    await s.refresh();
    expect(await s.current()).toBeNull();
  });

  it('nothing saved: current() waits for the refresh in flight', async () => {
    let release!: () => void;
    reply = () => new Promise((r) => (release = () => r(res(200, JSON.stringify(ANSWER)))));
    const s = make();
    const refreshing = s.refresh();
    const reading = s.current();
    release();
    await refreshing;
    expect((await reading)?.list.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --config.verify-deps-before-run=false exec vitest run tests/rates.test.ts`
Expected: FAIL — `../src/main/rates.ts` does not exist.

- [ ] **Step 3: Implement `src/main/rates.ts`**

```ts
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
    const rate = perUnit * 10 ** (currencyExponent(UAH) - currencyExponent(p.data.currencyCodeA));
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

export class RatesService {
  private saved: SavedRates | null;
  private failed = false;
  private lastAttemptMs: number | null = null;
  private inFlight: Promise<void> | null = null;

  constructor(private readonly d: RatesDeps) {
    this.saved = this.read();
  }

  /** One GET unless one ran less than MIN_GAP_MS ago or is running; a failure keeps the saved rates. */
  refresh(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const now = this.d.nowMs();
    if (this.lastAttemptMs !== null && now - this.lastAttemptMs < MIN_GAP_MS) return Promise.resolve();
    this.lastAttemptMs = now;
    this.inFlight = this.fetchOnce(now).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** The rates every overview converts by; null — never fetched successfully. */
  async current(): Promise<RatesView | null> {
    if (!this.saved && this.inFlight) {
      await Promise.race([this.inFlight, new Promise((r) => setTimeout(r, FIRST_WAIT_MS))]);
    }
    return this.saved ? { list: this.saved.list, fetchedAt: this.saved.fetchedAt, saved: this.failed } : null;
  }

  private async fetchOnce(now: number): Promise<void> {
    try {
      const res = await this.d.fetch(RATES_URL, { headers: {}, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length > MAX_BYTES) throw new Error('response too large');
      const list = parseBankRates(text);
      if (!list) throw new Error('no usable rates');
      const next: SavedRates = { fetchedAt: Math.floor(now / 1000), list };
      await this.write(next);
      this.saved = next;
      this.failed = false;
    } catch (err) {
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
```

Check that `@mono/core/currency` exports `currencyExponent` (the renderer already imports it in `features/balances/utils.ts`). The `HTTP ${status}` and `err.message` log lines carry no user data (the request has none).

- [ ] **Step 4: Run, expect PASS**

Run: `pnpm --config.verify-deps-before-run=false exec vitest run tests/rates.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/rates.ts apps/desktop/tests/rates.test.ts apps/desktop/src/shared/api.ts
git commit -m "feat(desktop): today's Monobank rates in main — validated, cached, rate-limited"
```

---

### Task 3: Guarded session, wiring, wipe

**Files:**
- Create: `apps/desktop/src/main/rates-session.ts`
- Create: `apps/desktop/tests/rates-session.test.ts`
- Modify: `apps/desktop/src/main/index.ts` (after `const data = new DataService(...)`, ~line 142)
- Modify: `apps/desktop/src/main/wipe.ts` (`OTHER_FILES`), `apps/desktop/tests/wipe.test.ts:52`

- [ ] **Step 1: Failing test for the session guard**

`tests/rates-session.test.ts`:

```ts
// The rates request runs in its own Electron session: every request and redirect hop is checked against the
// monobank-rates service only, permissions are refused, and the fetch goes through allowlistedFetch.
import { describe, expect, it } from 'vitest';
import { RATES_PARTITION, guardRatesSession, ratesFetch, type RatesSessionLike } from '../src/main/rates-session.ts';

function fakeSession() {
  let before: ((d: { url: string }, cb: (r: { cancel: boolean }) => void) => void) | null = null;
  let perm: ((wc: unknown, p: string, cb: (g: boolean) => void) => void) | null = null;
  const fetched: Array<[string, unknown]> = [];
  const ses: RatesSessionLike = {
    webRequest: { onBeforeRequest: (h) => void (before = h) },
    setPermissionRequestHandler: (h) => void (perm = h),
    fetch: async (url, init) => {
      fetched.push([url, init]);
      return new Response('[]', { status: 200 });
    },
  };
  const check = (url: string) => {
    let cancel: boolean | undefined;
    before!({ url }, (r) => (cancel = r.cancel));
    return cancel;
  };
  const granted = () => {
    let g: boolean | undefined;
    perm!(null, 'geolocation', (x) => (g = x));
    return g;
  };
  return { ses, check, granted, fetched };
}

describe('rates session', () => {
  it('its own partition', () => {
    expect(RATES_PARTITION).toBe('monobank-rates');
  });

  it('only the rates host passes; permissions refused', () => {
    const f = fakeSession();
    guardRatesSession(f.ses);
    expect(f.check('https://api.monobank.ua/bank/currency')).toBe(false);
    expect(f.check('https://github.com/x')).toBe(true);
    expect(f.check('http://api.monobank.ua/bank/currency')).toBe(true);
    expect(f.granted()).toBe(false);
  });

  it('ratesFetch refuses other hosts before the network and never follows redirects', async () => {
    const f = fakeSession();
    const fetch = ratesFetch(f.ses);
    await fetch('https://api.monobank.ua/bank/currency', { headers: {} });
    await expect(fetch('https://evil.example/x', { headers: {} })).rejects.toThrow();
    expect(f.fetched).toEqual([['https://api.monobank.ua/bank/currency', { headers: {}, redirect: 'error' }]]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (module missing)

Run: `pnpm --config.verify-deps-before-run=false exec vitest run tests/rates-session.test.ts`

- [ ] **Step 3: Implement `src/main/rates-session.ts`**

```ts
// The network of the rates request: its own Electron session (the default one is the renderer's and refuses
// everything), guarded for every request and redirect hop by the monobank-rates service only. No cookies or cache
// shared with anything else; nothing but the public /bank/currency ever goes through it.
import type { FetchLike, ResponseLike } from '@mono/core/platform';
import { allowlistedFetch, isAllowedUrl } from '../net/allowlist.ts';

export const RATES_PARTITION = 'monobank-rates';

type Callback<T> = (response: T) => void;
export type RatesSessionLike = {
  webRequest: { onBeforeRequest(h: (details: { url: string }, cb: Callback<{ cancel: boolean }>) => void): void };
  setPermissionRequestHandler(h: ((wc: unknown, permission: string, cb: (granted: boolean) => void) => void) | null): void;
  fetch(url: string, init: { headers: Record<string, string>; signal?: AbortSignal; redirect: 'error' }): Promise<ResponseLike>;
};

export function guardRatesSession(ses: RatesSessionLike, onBlocked?: (host: string) => void): void {
  ses.webRequest.onBeforeRequest((details, cb) => {
    const ok = isAllowedUrl(details.url, ['monobank-rates']);
    if (!ok) onBlocked?.(hostOf(details.url));
    cb({ cancel: !ok });
  });
  ses.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
}

export function ratesFetch(ses: RatesSessionLike): FetchLike {
  return allowlistedFetch((url, init) => ses.fetch(url, init), ['monobank-rates']);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '(bad url)';
  }
}
```

The allowlist scan (`tests/allowlist.test.ts`, «nothing in the app goes around the allowlist») does not match
`ses.fetch(` (preceded by `.`), so no exception is needed; run it to confirm.

- [ ] **Step 4: Wire it in `src/main/index.ts`**

Imports: `import { RatesService, REFRESH_EVERY_MS } from './rates.ts';` and
`import { RATES_PARTITION, guardRatesSession, ratesFetch, type RatesSessionLike } from './rates-session.ts';`

Right before `const data = new DataService(...)`:

```ts
  // Today's public rates: their own guarded session, asked at launch (the request carries nothing of the user's, so
  // the lock does not matter) and every few hours while the app runs.
  const ratesSession = session.fromPartition(RATES_PARTITION, { cache: false }) as unknown as RatesSessionLike;
  guardRatesSession(ratesSession, (host) => process.stderr.write(`[rates] blocked request to ${host}\n`));
  const rates = new RatesService({
    fetch: ratesFetch(ratesSession),
    userDataDir: userData,
    nowMs: () => Date.now(),
    log: (msg) => process.stderr.write(`[rates] ${msg}\n`),
  });
  void rates.refresh();
  const ratesTimer = setInterval(() => void rates.refresh(), REFRESH_EVERY_MS);
  app.on('will-quit', () => clearInterval(ratesTimer));
```

(The `as unknown as` bridges Electron's `Session` to the narrow test type: `Session.fetch` takes a `RequestInit`
superset and returns `Response`, which satisfies `ResponseLike`. If `vue-tsc`/`tsc` accepts `session.fromPartition(...)`
assigned to `RatesSessionLike` without the cast — as `update/electron.ts` does for `UpdateSessionLike` — drop the cast.)

- [ ] **Step 5: Wipe `rates.json` too**

`src/main/wipe.ts`: `import { RATES_FILE } from './rates.ts';` and add `RATES_FILE, \`${RATES_FILE}.tmp\`` to `OTHER_FILES`
(after `JOB_FILE`). Update the sorted list in `tests/wipe.test.ts:52` to include `'rates.json'` and `'rates.json.tmp'`.

- [ ] **Step 6: Run**

Run: `pnpm --config.verify-deps-before-run=false exec vitest run tests/rates-session.test.ts tests/wipe.test.ts tests/allowlist.test.ts tests/hardening.test.ts`
Expected: PASS. `pnpm --config.verify-deps-before-run=false typecheck` in `apps/desktop`: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/main/rates-session.ts apps/desktop/tests/rates-session.test.ts apps/desktop/src/main/index.ts \
  apps/desktop/src/main/wipe.ts apps/desktop/tests/wipe.test.ts
git commit -m "feat(desktop): rates in their own guarded session, refreshed at launch and every 4 hours; wiped with all data"
```

---

### Task 4: Main overviews fold by today's rates

**Files:**
- Modify: `apps/desktop/src/shared/api.ts` (`SpendingFx` removed; `SpendingOverview.fx` → `rates`; `NowOverview.fx` →
  `rates`; `MonthOverview` + `rates`; `FxPart` without `nearest`; `CardTotal.others` + `rate`)
- Modify: `apps/desktop/src/main/data.ts`, `apps/desktop/src/main/index.ts:142`
- Modify: `apps/desktop/tests/data.test.ts`, `apps/desktop/tests/now-main.test.ts`, `apps/desktop/tests/spending-main.test.ts` (as they reference `fx`)

- [ ] **Step 1: Contract changes in `src/shared/api.ts`**

```ts
// Removed: export type SpendingFx = …

// SpendingOverview: replace `fx: SpendingFx[];` with
  /** Today's rates every amount of this answer was folded by; null — never fetched (foreign parts are in leftOut). */
  rates: RatesView | null;

// NowOverview: replace `fx: SpendingFx[];` (and its comment) with the same `rates: RatesView | null;`

// MonthOverview: add the same `rates: RatesView | null;`

export type FxPart = {
  currency: number;
  /** Minor units of `currency`. */
  income: number;
  spending: number;
  /** Today's rate (hryvnia kopecks per minor unit); null — not quoted / no rates yet, the part is left out of the sums. */
  rate: number | null;
};

// CardTotal: ownFunds now folds foreign accounts in:
  /** Own funds in hryvnia at the end of the month, foreign accounts folded in at today's rate (accounts with data only). */
  ownFunds: number;
  /** Foreign-currency own funds, each with today's rate; rate null — left out of ownFunds. */
  others: Array<{ currency: number; ownFunds: number; rate: number | null }>;
```

Update the doc comments of `NowOverview` («folded by this month's own exchange rates» → «folded by today's rates»).

- [ ] **Step 2: Update the main tests first (failing)**

`tests/data.test.ts`: give `DataService` a `rates` dep. In `beforeEach`:

```ts
const RATES: RatesView = { list: [{ currency: 840, rate: 40 }, { currency: 978, rate: 50 }], fetchedAt: NOW - 3600, saved: false };
let rates: RatesView | null;
// in beforeEach:
  rates = RATES;
  svc = new DataService({ open: async () => db, release: async () => undefined, nowSec: () => NOW, rates: async () => rates });
```

Rewrite the rate tests (lines ~229–313 and 350–391, 519–544) to today's rate instead of own exchanges. The new cases
(replace the old «month's own sale rate», «nearest», «euros with no exchange», «purchase rate» cases):

```ts
  it('income and spending in dollars count in hryvnia at today\'s rate, whatever the month\'s exchanges were', async () => {
    // a USD account with +100 $ income and −20 $ spending this month, an own exchange at 38 the same month
    // expected: total.income includes 100_00 * 40, total.spending includes 20_00 * 40; fx part rate 40
  });

  it('no rates at all: foreign parts are left out (rate null), hryvnia counts as is; the answer says rates null', async () => {
    rates = null;
    // expect total.fx[0].rate === null, ov.rates === null, income/spending hryvnia only
  });

  it('a currency the bank does not quote is left out', async () => {
    // an account in 826 (GBP), RATES has no 826 → fx part rate null, not in the sums
  });

  it('balances: a dollar account folds into own funds at today\'s rate; others lists it with the rate', async () => {
    // UAH card 1_000_00, USD account 100_00 → ownFunds 1_000_00 + 100_00 * 40; others [{ currency: 840, ownFunds: 100_00, rate: 40 }]
  });

  it('spending: this month and the compared one fold by the same rate; rates echoed in the answer', async () => {
    // USD spending in both months → prev net = prev USD * 40; ov.rates toEqual(RATES)
  });

  it('now strip: folds by today\'s rate and echoes it', async () => {
    // a USD purchase today → today.net = minor * 40; ov.rates toEqual(RATES)
  });
```

Write each body with the existing helpers (`account`, `tx`, `synced`) the same way the replaced tests do; the expected
numbers are `minor * 40` (USD) / `minor * 50` (EUR), `Math.round` where they are not whole. Keep the canary tests
untouched (they must still pass). Run: `pnpm --config.verify-deps-before-run=false exec vitest run tests/data.test.ts`
→ FAIL (no `rates` dep yet, old `fx` fields).

- [ ] **Step 3: Implement in `src/main/data.ts`**

```ts
// imports: drop `exchangeRates`; keep `toUah`, add `type FxRate` from '@mono/core/fx'; add `RatesView` to the api import;
// drop `SpendingFx`; remove `FX_CURRENCIES`.

export type DataServiceDeps = {
  open: () => Promise<Db>;
  release: () => Promise<unknown>;
  nowSec: () => number;
  /** Today's rates (RatesService.current); null — never fetched. */
  rates: () => Promise<RatesView | null>;
};

/** Today's rates as the core's fold expects them (one rate for every period). */
function rateMap(r: RatesView | null): Map<number, FxRate> {
  return new Map((r?.list ?? []).map((x) => [x.currency, { rate: x.rate, nearest: false }]));
}
```

- `monthOverview`: `const today = await this.d.rates(); const rates = rateMap(today);` replaces
  `await exchangeRates(db, period)`. In `flowOf`, the `fx.push` drops `nearest`. In `cardTotal`:

```ts
      const foreign = balances.totals.filter((t) => t.currency !== UAH);
      const others = foreign.map((t) => ({ currency: t.currency, ownFunds: t.own_funds, rate: rates.get(t.currency)?.rate ?? null }));
      const folded = others.reduce((s, o) => s + (toUah(o.ownFunds, o.currency, rates) ?? 0), 0);
      // …
          ownFunds: (balances.totals.find((t) => t.currency === UAH)?.own_funds ?? 0) + folded,
          others,
```

  Return `rates: today` in both branches (`{ ...base, rates: today, people, accounts: [] }` and the person one).
- `spendingOverview`: `const today = await this.d.rates(); const rates = rateMap(today);`;
  `const before = compare ? { period: compare, rates } : null;` (same rate); drop the `fx` block; return `rates: today`.
- `nowOverview`: `const today = await this.d.rates(); const rates = rateMap(today);` (rename the local `today` date
  variable conflict: the date is already named `today` — call the rates `todayRates`); drop `fx:`; return
  `rates: todayRates`.
- Update the doc comments that say «own exchanges» / «this month's own exchange rates» to «today's rates».

`src/main/index.ts:142`: `new DataService({ …, rates: () => rates.current() })` — the `rates` service from Task 3 is
created right before it.

- [ ] **Step 4: Run main tests**

Run: `pnpm --config.verify-deps-before-run=false exec vitest run tests/data.test.ts tests/now-main.test.ts tests/spending-main.test.ts`
Expected: PASS. The renderer typecheck is red now (it still reads `fx`): that is fixed by Tasks 5–9. Do not commit
yet; the commits for Tasks 4–9 are made in Task 9, Step 4.

---

### Task 5: Renderer entity — choice, `MoneyFormat`, store

**Files:**
- Modify: `apps/desktop/src/renderer/src/entities/currency-display/{types.ts,constants.ts,utils.ts,index.ts}`
- Modify: `apps/desktop/src/renderer/src/entities/currency-display/store/useCurrencyDisplayStore.ts`
- Create: `apps/desktop/src/renderer/src/entities/currency-display/composables/useMoneyFormat.ts`
- Modify: `apps/desktop/tests/renderer/currency-display.test.ts`

- [ ] **Step 1: Tests first** — replace the `parseCurrencyPrefs` / conversions describes in
`tests/renderer/currency-display.test.ts` with:

```ts
import type { RatesView } from '@contract/api.ts';
import { moneyFormat, parseCurrencyChoice, shownText } from '@/entities/currency-display';
import { formatMoney } from '@/shared/lib';

const RATES: RatesView = { list: [{ currency: 840, rate: 40 }, { currency: 978, rate: 50 }], fetchedAt: 1_790_000_000, saved: false };
const NONE = { uah: false, usd: false, eur: false };

describe('parseCurrencyChoice', () => {
  it('hryvnia and nothing else by default, for garbage too', () => {
    for (const raw of [null, '{oops', '[1]', '{"main":123}']) expect(parseCurrencyChoice(raw)).toEqual({ main: 980, also: NONE });
  });
  it('the new shape; each «also» field on its own', () => {
    expect(parseCurrencyChoice('{"main":978,"also":{"uah":true,"usd":"x"}}')).toEqual({ main: 978, also: { uah: true, usd: false, eur: false } });
  });
  it('the old { usd, eur } (and spending.view) value: hryvnia main, the same «≈» currencies', () => {
    expect(parseCurrencyChoice('{"usd":true,"eur":false}')).toEqual({ main: 980, also: { uah: false, usd: true, eur: false } });
    expect(parseCurrencyChoice('{"split":false,"mark":true,"usd":false,"eur":true}')).toEqual({ main: 980, also: { uah: false, usd: false, eur: true } });
  });
});

describe('moneyFormat', () => {
  it('hryvnia main: as is, «≈» lines in the other picked currencies', () => {
    const f = moneyFormat(RATES, { main: 980, also: { uah: true, usd: true, eur: true } });
    expect(f.currency).toBe(980);
    expect(f.money(4_000_00)).toBe(formatMoney(4_000_00, 980));
    expect(f.approx(4_000_00)).toEqual([`≈ ${formatMoney(100_00, 840)}`, `≈ ${formatMoney(80_00, 978)}`]);
    expect(f.approxInline(4_000_00)).toBe(`≈ ${formatMoney(100_00, 840)} · ${formatMoney(80_00, 978)}`);
  });
  it('euro main: amounts in euros, hryvnia as a «≈» line; convert gives euro cents', () => {
    const f = moneyFormat(RATES, { main: 978, also: { uah: true, usd: false, eur: true } });
    expect(f.currency).toBe(978);
    expect(f.convert(5_000_00)).toBe(100_00);
    expect(f.money(5_000_00)).toBe(formatMoney(100_00, 978));
    expect(f.approx(5_000_00)).toEqual([`≈ ${formatMoney(5_000_00, 980)}`]);
  });
  it('no rates: back to hryvnia, no «≈» lines', () => {
    const f = moneyFormat(null, { main: 840, also: { uah: true, usd: true, eur: true } });
    expect(f.currency).toBe(980);
    expect(f.money(100)).toBe(formatMoney(100, 980));
    expect(f.approx(100)).toEqual([]);
    expect(f.approxInline(100)).toBe('');
  });
});

describe('shownText', () => {
  it('main first, then the «≈» currencies that have a rate', () => {
    expect(shownText(RATES, { main: 840, also: { uah: true, usd: true, eur: true } })).toBe('$ · ₴ €');
    expect(shownText(RATES, { main: 980, also: NONE })).toBe('₴');
    expect(shownText(null, { main: 978, also: { uah: false, usd: true, eur: false } })).toBe('₴');
  });
});
```

Also keep / adapt the store tests in that file: storage round-trip of the new shape under `home.currencies`; the legacy
`spending.view` value is carried over once (as now); broken storage → defaults.

Run → FAIL.

- [ ] **Step 2: Implement**

`types.ts`:

```ts
/** The home screen's main currency (every amount is shown in it) and the «≈» currencies next to it. */
export type MainCurrency = 980 | 840 | 978;
export type CurrencyKey = 'uah' | 'usd' | 'eur';
export interface CurrencyChoice {
  main: MainCurrency;
  also: Record<CurrencyKey, boolean>;
}

/** Every home amount goes through this: hryvnia kopecks in, the main currency's text out. */
export interface MoneyFormat {
  /** The currency on screen: the chosen main one, or hryvnia while it has no rate. */
  currency: number;
  /** Hryvnia kopecks → minor units of `currency`. */
  convert(kopecks: number): number;
  money(kopecks: number): string;
  /** «≈ 100 $» per picked «also» currency that has a rate (never the main one). */
  approx(kopecks: number): string[];
  /** The same on one line: «≈ 100 $ · 80 €»; '' — none. */
  approxInline(kopecks: number): string;
}
```

`constants.ts`:

```ts
import type { MessageKey } from '@contract/i18n/index.ts';
import type { CurrencyKey, MainCurrency } from './types.ts';

/** The currencies of the switch, in menu order. */
export const CURRENCIES: ReadonlyArray<{ currency: MainCurrency; key: CurrencyKey; label: MessageKey }> = [
  { currency: 980, key: 'uah', label: 'entities.currencyDisplay.uah' },
  { currency: 840, key: 'usd', label: 'entities.currencyDisplay.usd' },
  { currency: 978, key: 'eur', label: 'entities.currencyDisplay.eur' },
];

/** localStorage key of the choice (a convenience: defaults when storage is unavailable). */
export const STORAGE_KEY = 'home.currencies';

/** Where the spending block kept the choice before it became home-wide: read once, then STORAGE_KEY. */
export const LEGACY_KEY = 'spending.view';
```

`utils.ts`:

```ts
import type { RatesView } from '@contract/api.ts';
import { currencySymbol, formatMoney, UAH } from '@/shared/lib';
import { CURRENCIES } from './constants.ts';
import type { CurrencyChoice, CurrencyKey, MainCurrency, MoneyFormat } from './types.ts';

const MAINS: ReadonlyArray<number> = CURRENCIES.map((c) => c.currency);

/**
 * The choice from storage. The new shape `{ main, also }`; the old `{ usd, eur }` (also spending.view's, whose other
 * fields are ignored) reads as hryvnia main with the same «≈» currencies. Anything else — defaults. The `as` casts read
 * a parsed JSON object's fields after the object / array guard.
 */
export function parseCurrencyChoice(raw: string | null): CurrencyChoice {
  const d: CurrencyChoice = { main: UAH as MainCurrency, also: { uah: false, usd: false, eur: false } };
  if (raw === null) return d;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return d;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return d;
  const o = v as Record<string, unknown>;
  const flags = (src: unknown): Record<CurrencyKey, boolean> => {
    const s = typeof src === 'object' && src !== null && !Array.isArray(src) ? (src as Record<string, unknown>) : {};
    const f = (k: CurrencyKey) => s[k] === true;
    return { uah: f('uah'), usd: f('usd'), eur: f('eur') };
  };
  if ('main' in o) {
    return typeof o.main === 'number' && MAINS.includes(o.main) ? { main: o.main as MainCurrency, also: flags(o.also) } : d;
  }
  return { main: d.main, also: { ...flags(o), uah: false } };
}

/** Kopecks per minor unit of `currency`; hryvnia 1; null — no rate. */
function rateOf(rates: RatesView | null, currency: number): number | null {
  if (currency === UAH) return 1;
  return rates?.list.find((r) => r.currency === currency)?.rate ?? null;
}

export function moneyFormat(rates: RatesView | null, choice: Readonly<CurrencyChoice>): MoneyFormat {
  const mainRate = rateOf(rates, choice.main);
  const currency = mainRate === null ? UAH : choice.main;
  const rate = mainRate ?? 1;
  const also = CURRENCIES.filter((c) => choice.also[c.key] && c.currency !== currency).flatMap((c) => {
    const r = rateOf(rates, c.currency);
    return r === null ? [] : [{ currency: c.currency, rate: r }];
  });
  const parts = (k: number) => also.map((c) => formatMoney(Math.round(k / c.rate), c.currency));
  const convert = (k: number) => Math.round(k / rate);
  return {
    currency,
    convert,
    money: (k) => formatMoney(convert(k), currency),
    approx: (k) => parts(k).map((p) => `≈ ${p}`),
    approxInline: (k) => {
      const p = parts(k);
      return p.length === 0 ? '' : `≈ ${p.join(' · ')}`;
    },
  };
}

/** The button's text: the currency on screen, then the «≈» ones — «$ · ₴ €», or just «₴». */
export function shownText(rates: RatesView | null, choice: Readonly<CurrencyChoice>): string {
  const f = moneyFormat(rates, choice);
  const also = CURRENCIES.filter((c) => choice.also[c.key] && c.currency !== f.currency && rateOf(rates, c.currency) !== null);
  const main = currencySymbol(f.currency);
  return also.length === 0 ? main : `${main} · ${also.map((c) => currencySymbol(c.currency)).join(' ')}`;
}
```

`store/useCurrencyDisplayStore.ts` — same structure, new state:

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RatesView } from '@contract/api.ts';
import { LEGACY_KEY, STORAGE_KEY } from '../constants.ts';
import type { CurrencyChoice, CurrencyKey, MainCurrency } from '../types.ts';
import { parseCurrencyChoice } from '../utils.ts';

function save(choice: CurrencyChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // Storage unavailable: the choice holds until the app restarts.
  }
}

function read(): CurrencyChoice {
  try {
    const own = localStorage.getItem(STORAGE_KEY);
    if (own !== null) return parseCurrencyChoice(own);
    const legacy = localStorage.getItem(LEGACY_KEY);
    const choice = parseCurrencyChoice(legacy);
    // Carried over once and saved at once: the spending block's store drops usd / eur from its key on its next write.
    if (legacy !== null) save(choice);
    return choice;
  } catch {
    return parseCurrencyChoice(null);
  }
}

/**
 * The home screen's currency choice (main + «≈»), remembered on this computer, and the newest rates any block's
 * answer carried — for the switch's footer (`undefined` until the first answer: not loaded yet, which is not «no rates»).
 */
export const useCurrencyDisplayStore = defineStore('currency-display', () => {
  const choice = ref<CurrencyChoice>(read());
  const rates = ref<RatesView | null | undefined>(undefined);

  function setMain(main: MainCurrency): void {
    choice.value = { ...choice.value, main };
    save(choice.value);
  }

  function setAlso(key: CurrencyKey, value: boolean): void {
    choice.value = { ...choice.value, also: { ...choice.value.also, [key]: value } };
    save(choice.value);
  }

  /** The newest snapshot wins; null (never fetched) only until a real one arrives. */
  function setRates(next: RatesView | null): void {
    const cur = rates.value;
    if (cur === undefined || cur === null || (next !== null && next.fetchedAt >= cur.fetchedAt)) rates.value = next ?? cur ?? null;
  }

  return { choice, rates, setMain, setAlso, setRates };
});
```

`composables/useMoneyFormat.ts`:

```ts
import { computed, watch, type ComputedRef } from 'vue';
import type { RatesView } from '@contract/api.ts';
import { useCurrencyDisplayStore } from '../store/useCurrencyDisplayStore.ts';
import type { MoneyFormat } from '../types.ts';
import { moneyFormat } from '../utils.ts';

/**
 * The format of one block's answer: its own rates (every amount of an answer was folded by them) and the home-wide
 * choice. Also publishes the rates to the switch.
 */
export function useMoneyFormat(rates: () => RatesView | null | undefined): ComputedRef<MoneyFormat> {
  const store = useCurrencyDisplayStore();
  watch(rates, (r) => {
    if (r !== undefined) store.setRates(r);
  }, { immediate: true });
  return computed(() => moneyFormat(rates() ?? null, store.choice));
}
```

`index.ts`:

```ts
export { default as CurrencyToggle } from './components/CurrencyToggle.vue';
export { useMoneyFormat } from './composables/useMoneyFormat.ts';
export { useCurrencyDisplayStore } from './store/useCurrencyDisplayStore.ts';
export type { CurrencyChoice, MainCurrency, MoneyFormat } from './types.ts';
export { moneyFormat, parseCurrencyChoice, shownText } from './utils.ts';
```

`CurrencyToggle.vue` is rewritten in Task 6; until then make it compile minimally (read `store.choice`,
`shownText(store.rates ?? null, store.choice)`), or do Task 6 in the same commit.

- [ ] **Step 3: Run**

Run: `pnpm --config.verify-deps-before-run=false exec vitest run tests/renderer/currency-display.test.ts` → PASS.

Commit together with Task 4 only once the renderer compiles (end of Task 9 at the latest). If the typecheck is still
red here, keep going and commit Tasks 4–9 as consecutive commits after Task 9 passes typecheck, each with its own files.

---

### Task 6: The switch — main currency, «also», rate footer

**Files:**
- Modify: `apps/desktop/src/renderer/src/entities/currency-display/components/CurrencyToggle.vue`
- Modify: `apps/desktop/src/shared/i18n/{uk,en,ru}.json` (`entities.currencyDisplay.*`)
- Modify: `apps/desktop/tests/renderer/currency-display.test.ts` (the button describe)

- [ ] **Step 1: i18n.** Replace `entities.currencyDisplay` in all three dictionaries:

| key | en | uk | ru |
|---|---|---|---|
| `button` | `Currencies: {shown}` | `Валюти: {shown}` | `Валюты: {shown}` |
| `mainTitle` | `Main currency` | `Основна валюта` | `Основная валюта` |
| `mainNote` | `Every amount on the home screen` | `Усі суми на головному екрані` | `Все суммы на главном экране` |
| `alsoTitle` | `Also show` | `Показувати також` | `Показывать также` |
| `uah` | `Hryvnia ₴` | `Гривня ₴` | `Гривна ₴` |
| `usd` | `Dollars $` | `Долари $` | `Доллары $` |
| `eur` | `Euro €` | `Євро €` | `Евро €` |
| `rate` | `Monobank sell rate, {date}` | `Курс продажу Monobank, {date}` | `Курс продажи Monobank, {date}` |
| `savedRate` | `Saved rate from {date}: no connection` | `Збережений курс від {date}: немає зʼєднання` | `Сохранённый курс от {date}: нет соединения` |
| `noRates` | `Rates not loaded yet: only hryvnia for now` | `Курси ще не завантажено: поки лише гривня` | `Курсы ещё не загружены: пока только гривна` |

Remove `nearestHint`, `noRate`, `note`, `rateHint`, `title`. Keep the existing `uk`/`ru` wording of `usd`/`eur` if it
differs from the table (check the current files). `{date}` is «05.10, 10:00» — format with the existing helper the
global filters use for «Updated…» (`shortDate` + time; look in `widgets/global-filters/utils.ts` for the date-time
format of `lastSyncAt` and reuse it, or `toKyivDateTime`-style formatting from `@/shared/lib`).

- [ ] **Step 2: Component**

```vue
<script setup lang="ts">
import { computed, useId } from 'vue';
import { VPopover, VSegmentedControl, VSwitch, type SegmentOption } from '@/shared/ui';
import { t } from '@/shared/lib';
import { CURRENCIES } from '../constants.ts';
import { useCurrencyDisplayStore } from '../store/useCurrencyDisplayStore.ts';
import type { MainCurrency } from '../types.ts';
import { rateDate, shownText } from '../utils.ts';

const store = useCurrencyDisplayStore();
const id = useId();
const rates = computed(() => store.rates ?? null);
const shown = computed(() => shownText(rates.value, store.choice));
const hasRate = (c: number) => c === 980 || !!rates.value?.list.some((r) => r.currency === c);
const options = computed<SegmentOption<MainCurrency>[]>(() =>
  CURRENCIES.filter((c) => hasRate(c.currency)).map((c) => ({ label: t(c.label), value: c.currency })),
);
const main = computed<MainCurrency>({
  get: () => (hasRate(store.choice.main) ? store.choice.main : 980),
  set: (v) => store.setMain(v),
});
const also = computed(() => CURRENCIES.filter((c) => c.currency !== main.value && hasRate(c.currency)));
const footer = computed(() => {
  if (store.rates === undefined) return '';
  const r = store.rates;
  if (r === null) return t('entities.currencyDisplay.noRates');
  return t(r.saved ? 'entities.currencyDisplay.savedRate' : 'entities.currencyDisplay.rate', { date: rateDate(r.fetchedAt) });
});
</script>

<template>
  <VPopover icon="lucide:chevron-down" :text="shown" :label="$t('entities.currencyDisplay.button', { shown })" align="start">
    <div class="flex flex-col gap-1">
      <p class="px-2 pt-2 text-xs font-semibold text-foreground-muted">{{ $t('entities.currencyDisplay.mainTitle') }}</p>
      <p class="px-2 text-xs text-foreground-muted">{{ $t('entities.currencyDisplay.mainNote') }}</p>
      <div class="px-2 py-1.5">
        <VSegmentedControl v-model="main" :options :aria-label="$t('entities.currencyDisplay.mainTitle')" />
      </div>
      <template v-if="also.length > 0">
        <p class="px-2 pt-1 text-xs font-semibold text-foreground-muted">{{ $t('entities.currencyDisplay.alsoTitle') }}</p>
        <div v-for="c in also" :key="c.key" class="flex items-center gap-3 rounded-lg px-2 py-2">
          <label :for="`${id}-${c.key}`" class="grow cursor-pointer font-semibold">{{ $t(c.label) }}</label>
          <VSwitch :id="`${id}-${c.key}`" :model-value="store.choice.also[c.key]" role="switch" @update:model-value="store.setAlso(c.key, $event)" />
        </div>
      </template>
      <p v-if="footer" class="border-t border-border-subtle px-2 pt-2 pb-1 text-xs text-foreground-muted">{{ footer }}</p>
    </div>
  </VPopover>
</template>
```

Check `VSegmentedControl`'s props (`shared/ui/components/inputs/VSegmentedControl.vue`): if it has no `aria-label`
prop, it falls through to the root (look at how `SpendingHeader.vue` names its control and do the same).

Add `rateDate(epochSec: number): string` to `utils.ts` (Kyiv «05.10, 10:00», using the same helper as the sync status
line) and export it from `index.ts`.

- [ ] **Step 3: Tests** (in `tests/renderer/currency-display.test.ts`, mount `CurrencyToggle` with Pinia as the existing
button tests do, open the popover the same way):
  - no answer yet (`store.rates` undefined): no footer; only ₴ in the segmented control;
  - `setRates(null)`: footer «Rates not loaded yet…»;
  - `setRates(RATES)`: segments ₴ $ €; clicking $ calls `setMain(840)` and saves `{"main":840,…}` to `home.currencies`;
    the «also» list then shows hryvnia and euro, not dollars; footer «Monobank sell rate, …»;
  - `saved: true` → «Saved rate from …».

Run: `pnpm --config.verify-deps-before-run=false exec vitest run tests/renderer/currency-display.test.ts tests/i18n.test.ts` → PASS.

---

### Task 7: Balances in the main currency

**Files:**
- Modify: `apps/desktop/src/renderer/src/features/balances/utils.ts` (`slidesOf`, `fxNote`, `others`)
- Modify: `apps/desktop/src/renderer/src/features/balances/composables/useMonthOverview.ts`
- Modify: `apps/desktop/src/renderer/src/features/balances/types.ts` (comment of `approxIncome`)
- Modify: `apps/desktop/src/shared/i18n/*.json` (`home.balances.fxRate`, `fxNoRate`; remove `fxNearestRate`)
- Modify: `apps/desktop/tests/renderer/balances.test.ts`

- [ ] **Step 1: Tests first** (adapt the `slidesOf` tests): `slidesOf(v, { …, fmt })` where
`fmt = moneyFormat(RATES, { main: 978, also: NONE })`:
  - a total card's `amount` is `formatMoney(fmt.convert(total.ownFunds), 978, { minorUnits: true })`;
  - its `flow` is `{ currency: 978, income: fmt.convert(total.income), spending: fmt.convert(total.spending), … }` and
    each segment is converted the same way;
  - `netText` uses the converted net in 978;
  - an account card (`v.accounts`) keeps its own currency and numbers untouched;
  - `others` line: a rated foreign part → «incl. 100 $ at the rate 40,00»; a part with `rate: null` → «without 100 £ — no rate»;
  - with `fmt` for hryvnia main the old expectations hold (minus `nearest`).

- [ ] **Step 2: Implement**
  - `slidesOf(v, ctx: { …; fmt: MoneyFormat })`: in `totalSlide`, `amount: formatMoney(fmt.convert(total.ownFunds), fmt.currency, { minorUnits: true })`,
    `others: othersNote(total)`, `netText: … netText(fmt.convert(total.income - total.spending), fmt.currency)`,
    `flow: { currency: fmt.currency, income: fmt.convert(total.income), spending: fmt.convert(total.spending), … }`;
    family segments: `income: fmt.convert(p.total.income), spending: fmt.convert(p.total.spending)`. Account slides unchanged.
  - `fxNote`: drop the `nearest` branch.
  - `others(total)` → `othersNote(total)`: `total.others.map((o) => o.rate === null ? t('home.balances.fxNoRate', { amount }) : t('home.balances.fxRate', { amount, rate: rateText(o.rate, o.currency) })).join(' · ')` with `amount = formatMoney(o.ownFunds, o.currency, { minorUnits: true })`.
  - `useMonthOverview`: `const fmt = useMoneyFormat(() => state.value.data?.overview.rates);` and pass `fmt: fmt.value`
    into `slidesOf`.
  - i18n `home.balances.fxNoRate`: en `without {amount} — no rate`, uk `без {amount} — немає курсу`, ru `без {amount} — нет курса`.
    Remove `fxNearestRate` from all three.

- [ ] **Step 3: Run** `pnpm --config.verify-deps-before-run=false exec vitest run tests/renderer/balances.test.ts tests/renderer/card-stack.test.ts tests/i18n.test.ts` → PASS.

---

### Task 8: «Now» strip in the main currency

**Files:**
- Modify: `apps/desktop/src/renderer/src/features/now-strip/utils.ts`, `composables/useNowStrip.ts`
- Modify: `apps/desktop/tests/renderer/now-strip.test.ts`

- [ ] **Step 1: Tests first**: `nowView(o, fmt)` replaces `nowView(o, prefs)`. With `fmt` for euro main:
`today.amount === fmt.money(o.today.net)`, `today.conv === fmt.approxInline(o.today.net)`, `context` uses
`fmt.money(usual)`, `week.amount`/`week.conv` likewise, and `top.amount === fmt.money(top.net)` («Most this week» is now
in the main currency). Fixtures: replace `fx: [...]` with `rates: RATES`.

- [ ] **Step 2: Implement**: remove the module-level `money`; `nowView(o, fmt: MoneyFormat)`; `topCell(top, weekNet, fmt)`;
every `money(x)` → `fmt.money(x)`, every `convertInline(x, o.fx, prefs)` → `fmt.approxInline(x)`.
`useNowStrip`: `const fmt = useMoneyFormat(() => state.value.data?.rates);` and
`nowView(state.value.data, fmt.value)`; drop the store import.

- [ ] **Step 3: Run** `pnpm --config.verify-deps-before-run=false exec vitest run tests/renderer/now-strip.test.ts` → PASS.

---

### Task 9: «Spending» in the main currency

**Files:**
- Modify: `apps/desktop/src/renderer/src/features/spending-summary/{utils.ts,types.ts,SpendingFeature.vue}`
- Modify: `apps/desktop/src/renderer/src/features/spending-summary/composables/{useSpending.ts,useSpendingView.ts}`
- Modify: `apps/desktop/src/shared/i18n/*.json` (remove `home.spending.inCurrencyTitle`)
- Modify: `apps/desktop/tests/renderer/spending.test.ts`, `tests/renderer/spending-feature.test.ts`

- [ ] **Step 1: Tests first**: every helper that formats money takes `fmt: MoneyFormat` (see Step 2). Update fixtures
(`fx` → `rates`). New expectations with euro main: row `amount === fmt.money(l.net)`, `conv === fmt.approx(l.net)`,
`amountChip` text `+${fmt.money(diff)}`, `markTitle` with `fmt.money(prev)`, people rows and the per-day line in euros;
`centerConv` returns `fmt.approx(now)` lines without a chip or title (one rate for both months: the percentage is the
ring's own chip). Feature test: with `localStorage['home.currencies'] = '{"main":978,"also":{"uah":true}}'` the ring's
amount is in euros and a «≈ … ₴» line is under it.

- [ ] **Step 2: Implement**
  - `utils.ts`: delete `export const money`; add a `fmt: MoneyFormat` parameter to `amountChip`, `rowsFor`, `peopleRows`;
    replace `money(` with `fmt.money(` inside them and `convertLines(x, view.fx, prefs)` with `fmt.approx(x)`.
    `centerConv(now: number, fmt: MoneyFormat): string[]` → `fmt.approx(now)`; delete `rateFormat`/`rateText` if unused.
    `leftOutLines` unchanged (minor units of the left-out currency).
  - `types.ts`: `ViewPrefs` → `SpendingPrefs` only (drop `& CurrencyPrefs`); `conv` of the ring becomes `string[]`
    (update `CategoryRing.vue`'s prop type and template: one `<p>` per line, no chip).
  - `useSpending.ts`: delete the `setFx` watch; add `fmt: useMoneyFormat(() => state.value.data?.rates)` to the return
    (and to `UseSpendingReturn`).
  - `useSpendingView.ts`: take `fmt` from `base`; pass `fmt.value` to `rowsFor`, `peopleRows`, `centerConv`; `perDay`
    and `memberCard.family` use `fmt.value.money(...)`; also return `money: (k: number) => fmt.value.money(k)`.
  - `SpendingFeature.vue`: `shown` becomes `prefs` (no currency merge); the two template `money(...)` calls use the
    `money` returned by `useSpendingView`; drop the `./utils.ts` `money` import and the store.
  - `amountChip` is also used by `pctChip`/others in the file — follow the type errors until `vue-tsc` is clean.
  - i18n: remove `home.spending.inCurrencyTitle` from all three dictionaries.

- [ ] **Step 3: Run everything**

```bash
cd apps/desktop
pnpm --config.verify-deps-before-run=false exec vitest run tests/renderer
cd ../..
pnpm --config.verify-deps-before-run=false test
pnpm --config.verify-deps-before-run=false typecheck
```

Expected: all PASS. `tests/architecture.test.ts` must pass (features import only `@/entities/currency-display`'s public
`index.ts`).

- [ ] **Step 4: Commit Tasks 4–9** as separate commits by files (main + contract; entity + switch; balances; now strip;
spending), each message `feat(desktop): …` describing its part. Every commit after the first must typecheck at the end of
the series; intermediate commits may not typecheck on their own only if it is impossible to split otherwise — then
squash 4–9 into one commit `feat(desktop): main currency at today's Monobank rate`.

---

### Task 10: Docs, backlog, changelog

**Files:**
- Modify: `.agents/project/desktop-security.md` (the «Сеть» bullet), `.agents/project/domain-rules.md` (the `day` grouping
  line that mentions «this month's own exchange rates»; add a line that the desktop shows today's Monobank rate and core
  `exchangeRates` is for the MCP), `docs/backlog.md`, `CHANGELOG.md`.

- [ ] **Step 1: `desktop-security.md`**: in the trusted-services bullet add `monobank-rates` (`api.monobank.ua`,
  `GET /bank/currency` only, its own session `monobank-rates` guarded like the updater's, no headers — the import's
  `X-Token` cannot reach it; answer ≤ 64 KiB, zod-checked; `rates.json` in userData, removed by «Delete all data»).
  Write in English (the file's new lines; do not translate the existing ones).

- [ ] **Step 2: `docs/backlog.md`**: replace the «Later: PLN and card-purchase rates» section with:

```md
## Later: currencies

- PLN (or other currencies) as a main / «≈» currency: one entry in `CURRENCIES` (`entities/currency-display`) and the
  dictionaries; the rate is already in the Monobank answer.
- The `CurrencyToggle` popover and the «Spending» gear popover have no accessible name for the dialog itself: give
  `VPopover` a `title` / `aria-labelledby` option.
- `pendingHolds` ignores the participant and scope filters, in «Spending» and in the «Now» strip alike.
```

  and remove «курсы (`/bank/currency`)» from the «Погода (Open-Meteo) и курсы» line (leave the weather part).

- [ ] **Step 3: `CHANGELOG.md`**: if `apps/desktop/package.json` is `0.1.7` by now (release merged), create
  `## 0.1.8 — unreleased` at the top; if it is still `0.1.6`, add to `## 0.1.7 — unreleased` and tell the user. Entry:

```md
- **Main currency.** Pick hryvnia, dollars or euros in the currency menu next to the filters, and every amount on the
  home screen — balances, «In / Out», the «Now» strip and «Spending» — is shown in it. The other currencies can still
  be added as «≈» lines.
- Amounts in other currencies are now converted at today's Monobank sell rate, not at the rate of your own exchanges.
  The app asks Monobank for its public rates at launch and every few hours; nothing about you is sent. Without a
  connection it uses the last rates it got, and the menu says so.
```

  Replace the 0.1.7 bullet's last sentence about «Most this week» showing hryvnia only, if that section is still
  unreleased; if 0.1.7 is released, leave it.

- [ ] **Step 4: Final checks**

```bash
node apps/desktop/scripts/release-notes.mjs check 0.1.8   # expect: not ready (unreleased) — only checks the section parses
pnpm --config.verify-deps-before-run=false test
pnpm --config.verify-deps-before-run=false typecheck
```

- [ ] **Step 5: Commit**

```bash
git add .agents/project docs/backlog.md CHANGELOG.md
git commit -m "docs: main currency at today's Monobank rate — security notes, backlog, changelog"
```

---

## Self-review notes

- Spec coverage: rate source (Tasks 1–3), conversion incl. balances and the compared period (Task 4), main currency
  and switch (Tasks 5–6), every block (7–9), settings «Network» (Task 1), docs/backlog/CHANGELOG (Task 10), wipe (Task 3).
- Changes against the spec, decided while planning (the spec is updated to match): `RatesView` has no `bankDate` (the
  footer shows the fetch time); `FxPart` keeps `rate` (today's) and loses `nearest`; the ring's per-currency chip goes
  away (one rate → the same percentage as the ring's chip); `rates.json` is removed by «Delete all data»; an overview
  waits up to 5 s for the very first fetch when nothing is saved.
