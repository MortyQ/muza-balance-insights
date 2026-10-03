import type { SpendingFx } from '@contract/api.ts';
import { currencySymbol, formatMoney, UAH } from '@/shared/lib';
import { FX_CURRENCIES } from './constants.ts';
import type { CurrencyPrefs } from './types.ts';


/**
 * The choice from storage: `usd` / `eur`, each on its own, off for anything else (the old spending.view value has
 * them too; its other fields are ignored). The one `as` reads a parsed JSON object's fields after the object / array
 * guard.
 */
export function parseCurrencyPrefs(raw: string | null): CurrencyPrefs {
  const d: CurrencyPrefs = { usd: false, eur: false };
  if (raw === null) return d;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return d;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return d;
  const o = v as Record<string, unknown>;
  const field = (k: keyof CurrencyPrefs): boolean => {
    const x = o[k];
    return typeof x === 'boolean' ? x : d[k];
  };
  return { usd: field('usd'), eur: field('eur') };
}

/** The switched-on currencies that have a rate, in menu order. */
export function ratedCurrencies(fx: ReadonlyArray<SpendingFx>, prefs: Readonly<CurrencyPrefs>): Array<SpendingFx & { rate: number }> {
  return FX_CURRENCIES.filter((c) => prefs[c.key])
    .map((c) => fx.find((f) => f.currency === c.currency))
    .filter((f): f is SpendingFx & { rate: number } => !!f && f.rate !== null);
}

/** «≈ 359 $» for each switched-on currency that has a rate. */
export function convertLines(kopecks: number, fx: ReadonlyArray<SpendingFx>, prefs: Readonly<CurrencyPrefs>): string[] {
  return ratedCurrencies(fx, prefs).map((f) => `≈ ${formatMoney(Math.round(kopecks / f.rate), f.currency)}`);
}

/** The same on one line: «≈ 15 $ · 13 €»; '' — none. */
export function convertInline(kopecks: number, fx: ReadonlyArray<SpendingFx>, prefs: Readonly<CurrencyPrefs>): string {
  const rated = ratedCurrencies(fx, prefs);
  return rated.length === 0 ? '' : `≈ ${rated.map((f) => formatMoney(Math.round(kopecks / f.rate), f.currency)).join(' · ')}`;
}

/** The button's text: «₴», or «₴ · $ €» with the currencies on screen. */
export function shownText(fx: ReadonlyArray<SpendingFx>, prefs: Readonly<CurrencyPrefs>): string {
  const rated = ratedCurrencies(fx, prefs);
  const uah = currencySymbol(UAH);
  return rated.length === 0 ? uah : `${uah} · ${rated.map((f) => currencySymbol(f.currency)).join(' ')}`;
}
