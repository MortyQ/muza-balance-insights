// The change of an amount against a base (last month, a usual day, last week): the one rule every change chip shares
// (spec desktop-ui-wording «A change says money first»).
import { i18n } from './i18n.ts';

/** A change under this share of the base reads «as before». */
const SAME_SHARE = 0.03;
/** From this many times the base an increase reads «×N» instead of a percent… */
export const RATIO_FROM = 2;
/** …and above this many times, the money alone (the base belongs in the hint). */
export const RATIO_UNTIL = 10;

export type Change = { kind: 'up' | 'down' | 'same' | 'new'; diff: number; pct: number };

/** Against the base: under SAME_SHARE of it → same; a base of 0 or less (refunds only) → new; null — no comparison. */
export function change(now: number, prev: number | null): Change | null {
  if (prev === null) return null;
  if (prev <= 0) return now > 0 ? { kind: 'new', diff: now, pct: 0 } : { kind: 'same', diff: 0, pct: 0 };
  const diff = Math.abs(now - prev);
  const pct = Math.round((diff / prev) * 100);
  if (diff < prev * SAME_SHARE) return { kind: 'same', diff, pct };
  return { kind: now > prev ? 'up' : 'down', diff, pct };
}

/** «2.6», one decimal, in the app language's way: the «×N» of a change or a pace. */
export const times = (n: number): string =>
  new Intl.NumberFormat(i18n.global.locale.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

/**
 * A change said in money first, then in brackets: the percent below RATIO_FROM times the base («1 090 ₴ (9%)»), «×N»
 * up to RATIO_UNTIL («105 € (×5.0)»), nothing above it. A decrease keeps its percent (never over 100%). `signed` puts
 * «+» / «−» before it for a short chip that has no words to say the direction. `money` formats kopecks.
 */
export function changeText(c: Change, money: (kopecks: number) => string, signed = false): string {
  const sign = signed ? (c.kind === 'down' ? '−' : '+') : '';
  const text = `${sign}${money(c.diff)}`;
  if (c.kind !== 'up' || c.pct < (RATIO_FROM - 1) * 100) return `${text} (${c.pct}%)`;
  const ratio = 1 + c.pct / 100;
  return ratio <= RATIO_UNTIL ? `${text} (×${times(ratio)})` : text;
}
