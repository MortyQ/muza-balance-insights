// Money on screen: «12 340 ₴» (summary tables, no minor units) or «12 340,56 ₴» (details). Amounts arrive as integer
// minor units of an ISO 4217 numeric currency; the exponent (JPY 0, KWD 3) comes from the core.
import { currencyAlpha, currencyExponent, toMajor } from '@mono/core/currency';

const SYMBOL: Readonly<Record<string, string>> = { UAH: '₴', USD: '$', EUR: '€', GBP: '£', PLN: 'zł' };

export function currencySymbol(code: number): string {
  const alpha = currencyAlpha(code);
  return SYMBOL[alpha] ?? alpha;
}

const formatters = new Map<number, Intl.NumberFormat>();
function formatter(digits: number): Intl.NumberFormat {
  let f = formatters.get(digits);
  if (!f) {
    f = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    formatters.set(digits, f);
  }
  return f;
}

/** `minor` in minor units of `currency`. `minorUnits: false` rounds to whole units. */
export function formatMoney(minor: number, currency: number, opts: { minorUnits?: boolean } = {}): string {
  const digits = opts.minorUnits ? currencyExponent(currency) : 0;
  return `${formatter(digits).format(toMajor(minor, currency))} ${currencySymbol(currency)}`;
}
