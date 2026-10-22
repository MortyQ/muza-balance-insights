// Money read from text: exact minor units, no floating point.
import { currencyExponent } from './currency.ts';

/** A decimal string → minor units of the currency, without floating point (`-845.5` → -84550); null if it does not read. */
export function toMinor(s: string, currencyCode: number): number | null {
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(s.trim());
  if (!m) return null;
  const exp = currencyExponent(currencyCode);
  const frac = m[3] ?? '';
  // Extra decimals are allowed only as zeros (`1000.0` for a currency without a minor unit).
  if (frac.length > exp && /[^0]/.test(frac.slice(exp))) return null;
  const minor = Number(`${m[2]}${frac.slice(0, exp).padEnd(exp, '0')}`);
  if (!Number.isSafeInteger(minor)) return null;
  return m[1] && minor !== 0 ? -minor : minor;
}
