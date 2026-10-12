import type { MoneyFormat } from '@/entities/currency-display';
import { change, monthShortName, t, type Change } from '@/shared/lib';
import type { ChipView, OpsView } from '../types.ts';
import { prevIn, prevMonthNumber } from './month.ts';

const tone = (c: Change): ChipView['tone'] => (c.kind === 'up' ? 'up' : c.kind === 'down' ? 'down' : 'neutral');
const arrow = (c: Change): ChipView['arrow'] => (c.kind === 'up' ? 'up' : c.kind === 'down' ? 'down' : null);
const sameOrNew = (c: Change, month: string): ChipView => ({
  text: c.kind === 'new' ? t('home.spending.change.new') : t('home.spending.change.same', { month: prevIn(month) }),
  tone: 'neutral',
  arrow: null,
  sr: '',
});

/** For screen readers: what a short difference («+1 090 ₴», «+9%», «+2») means, so it does not rest on colour or the arrow. */
export function directionText(up: boolean, month: string, partial: boolean): string {
  const key = up
    ? (partial ? 'home.spending.change.srMorePartial' : 'home.spending.change.srMore')
    : (partial ? 'home.spending.change.srLessPartial' : 'home.spending.change.srLess');
  return t(key, { month: prevIn(month) });
}

const sign = (c: Change) => (c.kind === 'up' ? '+' : '−');

/** The chip of a row or a person: the amount difference («+1 090 ₴»), `home.spending.change.same`, `home.spending.change.new`. */
export function amountChip(now: number, prev: number | null, month: string, fmt: MoneyFormat, partial = false): ChipView | null {
  const c = change(now, prev);
  if (!c) return null;
  if (c.kind === 'same' || c.kind === 'new') return sameOrNew(c, month);
  return { text: `${sign(c)}${fmt.money(c.diff)}`, tone: tone(c), arrow: arrow(c), sr: directionText(c.kind === 'up', month, partial) };
}

/** The chip under the ring: `home.spending.change.more` / `less` (`…Partial` while the month is in progress); its text says the direction. */
export function centerChip(now: number, prev: number | null, month: string, partial: boolean): ChipView | null {
  const c = change(now, prev);
  if (!c) return null;
  if (c.kind === 'same' || c.kind === 'new') return sameOrNew(c, month);
  const key = c.kind === 'up'
    ? (partial ? 'home.spending.change.morePartial' : 'home.spending.change.more')
    : (partial ? 'home.spending.change.lessPartial' : 'home.spending.change.less');
  return { text: t(key, { pct: c.pct, month: prevIn(month) }), tone: tone(c), arrow: arrow(c), sr: '' };
}

/** The short chip of the people list: «+9%». */
export function pctChip(now: number, prev: number | null, month: string, partial = false): ChipView | null {
  const c = change(now, prev);
  if (!c) return null;
  if (c.kind === 'same' || c.kind === 'new') return sameOrNew(c, month);
  return { text: `${sign(c)}${c.pct}%`, tone: tone(c), arrow: null, sr: directionText(c.kind === 'up', month, partial) };
}

/** `home.spending.ops` and the difference against last month («+2», `home.spending.opsSame`, `home.spending.change.new`; empty — no comparison). */
export function opsView(now: number, prev: number | null, month: string, partial = false): OpsView {
  const text = t('home.spending.ops', now);
  if (prev === null) return { text, diff: '', tone: 'neutral', title: '', sr: '' };
  const title = prev ? t('home.spending.opsPrev', { month: prevIn(month), ops: t('home.spending.ops', prev) }) : '';
  if (prev === 0) return { text, diff: now > 0 ? t('home.spending.change.new') : '', tone: 'neutral', title, sr: '' };
  const d = now - prev;
  if (d === 0) return { text, diff: t('home.spending.opsSame'), tone: 'neutral', title, sr: '' };
  return { text, diff: `${d > 0 ? '+' : '−'}${Math.abs(d)}`, tone: d > 0 ? 'up' : 'down', title, sr: directionText(d > 0, month, partial) };
}

/** `home.spending.opsVs` under the ring («+4 vs Aug.»), with the tone of the difference. */
export function opsVs(now: number, prev: number | null, month: string, partial = false): Pick<OpsView, 'text' | 'tone' | 'sr'> {
  const v = opsView(now, prev, month, partial);
  if (!v.diff || v.tone === 'neutral') return { text: v.diff, tone: v.tone, sr: '' };
  return { text: t('home.spending.opsVs', { diff: v.diff, month: monthShortName(prevMonthNumber(month)) }), tone: v.tone, sr: v.sr };
}
