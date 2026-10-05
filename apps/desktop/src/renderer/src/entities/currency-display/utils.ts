import type { RatesView } from '@contract/api.ts';
import { localDateTime } from '@contract/dates.ts';
import { currencySymbol, formatMoney, shortDate, UAH } from '@/shared/lib';
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

/** Whether `currency` can be shown: hryvnia always, any other one only with a rate. */
export function hasRate(rates: RatesView | null, currency: number): boolean {
  return rateOf(rates, currency) !== null;
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
  const also = CURRENCIES.filter((c) => choice.also[c.key] && c.currency !== f.currency && hasRate(rates, c.currency));
  const main = currencySymbol(f.currency);
  return also.length === 0 ? main : `${main} · ${also.map((c) => currencySymbol(c.currency)).join(' ')}`;
}

/** When the rates were fetched (epoch seconds), in the system time zone: «05.10, 10:00». */
export function rateDate(epochSec: number): string {
  return shortDate(localDateTime(epochSec * 1000));
}
