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
