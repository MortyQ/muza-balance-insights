// The change of an amount against a base (last month, a usual day, last week): the one rule every change chip shares.

/** A change under this share of the base reads «as before». */
const SAME_SHARE = 0.03;

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

/**
 * A change said in money first, the share in brackets: «1 090 ₴ (9%)»; `signed` puts «+» / «−» before it for a short
 * chip that has no words to say the direction. `money` formats kopecks in the picked currency.
 */
export function changeText(c: Change, money: (kopecks: number) => string, signed = false): string {
  const sign = signed ? (c.kind === 'down' ? '−' : '+') : '';
  return `${sign}${money(c.diff)} (${c.pct}%)`;
}
