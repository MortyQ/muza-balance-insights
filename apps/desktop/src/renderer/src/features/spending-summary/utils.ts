import type { SpendingAmounts, SpendingOverview, SpendingPersonPart } from '@contract/api.ts';
import type { CategoryId } from '@contract/categories.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { change, formatMoney, monthName, monthShortName, shortDate, t, type Change } from '@/shared/lib';
import { CATEGORY_COLORS, TOP } from './constants.ts';
import type { BarSegment, BlockPerson, ChipView, OpsView, PersonRowView, RowView, SpendingPrefs } from './types.ts';

/** «N more categories». */
const GREY = 'var(--border-strong)';
/** A named category ranked below the family's top 7 (shown when a person is picked): muted, apart from the rest-grey. */
const OTHER = 'var(--category-other)';
type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** The month before `month` ('YYYY-MM') as a number 1–12. */
function prevMonthNumber(month: string): MonthNumber {
  const m = Number(month.slice(5, 7));
  // 'YYYY-MM' holds a month 01–12, so m − 1 (or 12 for January) is within 1–12.
  return (m === 1 ? 12 : m - 1) as MonthNumber;
}
const prevIn = (month: string) => t(`common.monthIn.${prevMonthNumber(month)}`);

/** Why the numbers may be partial or empty; null when the month is complete. */
export function periodNote(p: Readonly<SpendingOverview['period']>): string | null {
  if (p.dataUntil === null) return t('home.spending.noData');
  if (p.dataUntil < p.from) return t('home.spending.notYet', { date: shortDate(p.dataUntil) });
  if (!p.incomplete) return null;
  return t('home.spending.partial', { date: shortDate(p.dataUntil) });
}

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

const partial = (view: Readonly<SpendingOverview>) => view.compare?.partial ?? false;

/**
 * The period compared with, for `home.spending.compareFull`: the month («August», with the year when it is not
 * `thisYear`), or its days while this month is in progress («Aug 1–2»).
 */
export function comparePeriodText(compare: Readonly<NonNullable<SpendingOverview['compare']>>, thisYear: number): string {
  const y = Number(compare.from.slice(0, 4));
  const m = Number(compare.from.slice(5, 7));
  if (compare.partial) {
    const month = t(`common.monthGen.${m as MonthNumber}`);
    const from = Number(compare.from.slice(8, 10));
    const to = Number(compare.to.slice(8, 10));
    return from === to ? t('home.spending.compareDay', { day: from, month }) : t('home.spending.compareRange', { from, to, month });
  }
  const name = monthName(m);
  return y === thisYear ? name : `${name} ${y}`;
}

/** Whole percent of `whole` (0 when there is no whole). */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function shareOf(part: number, whole: number): string {
  return `${percentOf(part, whole)}%`;
}

/** `home.spending.familyShare` — a person's share of the family's spending. */
export function familyShareText(net: number, familyTotal: number): string {
  return t('home.spending.familyShare', { pct: percentOf(net, familyTotal) });
}

/** The ring: each part with a small gap; nothing → a plain sunken ring. */
export function ringStops(parts: ReadonlyArray<{ value: number; color: string }>): string {
  const sum = parts.reduce((s, p) => s + p.value, 0);
  if (sum <= 0) return 'conic-gradient(var(--surface-sunken) 0deg 360deg)';
  const gap = parts.length > 1 ? 1.4 : 0;
  let deg = 0;
  const stops: string[] = [];
  for (const p of parts) {
    const d = (p.value / sum) * 360;
    stops.push(`${p.color} ${deg.toFixed(2)}deg ${(deg + d - gap).toFixed(2)}deg`);
    if (gap) stops.push(`var(--surface) ${(deg + d - gap).toFixed(2)}deg ${(deg + d).toFixed(2)}deg`);
    deg += d;
  }
  return `conic-gradient(${stops.join(', ')})`;
}

/** Under the ring: the amount in each picked «also» currency (no change chip: one rate for both months). */
export function centerConv(now: number, fmt: MoneyFormat): string[] {
  return fmt.approx(now);
}

/** The family or the picked person. */
export function totalFor(view: Readonly<SpendingOverview>, pick: number | null): SpendingAmounts & { prev: SpendingAmounts | null } {
  if (pick === null) return { net: view.total.net, purchases: view.total.purchases, prev: view.total.prev };
  const p = view.people.find((x) => x.participantId === pick);
  return p ? { net: p.net, purchases: p.purchases, prev: p.prev } : { net: 0, purchases: 0, prev: view.total.prev ? { net: 0, purchases: 0 } : null };
}

const fade = (color: string) => `color-mix(in oklch, ${color} 22%, var(--surface))`;
const personOf = (people: ReadonlyArray<BlockPerson>, id: number): BlockPerson => people.find((p) => p.id === id) ?? { id, name: '?', color: GREY };
/** % of `max`, one decimal. */
const pctOf = (value: number, max: number) => Math.round((value / max) * 1000) / 10;

/** `net` / `purchases` / `prev` — the pick's (family or person); `family` — the family's, which sets the bar scale. */
type Line = {
  key: string;
  categoryId: CategoryId | null;
  name: string;
  icon: string;
  color: string;
  net: number;
  purchases: number;
  prev: SpendingAmounts | null;
  family: { net: number; prev: SpendingAmounts | null };
  parts: SpendingPersonPart[];
};

/** «Other»: each person's parts summed over the rest categories (they come in the same participant order). */
function sumParts(lists: ReadonlyArray<ReadonlyArray<SpendingPersonPart>>): SpendingPersonPart[] {
  const first = lists[0] ?? [];
  return first.map((p0, i) => {
    let net = 0;
    let purchases = 0;
    let prevNet = 0;
    let prevPurchases = 0;
    let hasPrev = true;
    for (const l of lists) {
      const p = l[i];
      if (!p) continue;
      net += p.net;
      purchases += p.purchases;
      if (p.prev) {
        prevNet += p.prev.net;
        prevPurchases += p.prev.purchases;
      } else hasPrev = false;
    }
    return { participantId: p0.participantId, net, purchases, prev: hasPrev ? { net: prevNet, purchases: prevPurchases } : null };
  });
}

function sumPrev(prevs: ReadonlyArray<SpendingAmounts | null>): SpendingAmounts | null {
  let net = 0;
  let purchases = 0;
  for (const p of prevs) {
    if (!p) return null;
    net += p.net;
    purchases += p.purchases;
  }
  return { net, purchases };
}

/** The rows of the list for the family (pick null) or one picked person; colours stay those of the family's rank. */
export function rowsFor(
  view: Readonly<SpendingOverview>,
  pick: number | null,
  people: ReadonlyArray<BlockPerson>,
  prefs: Readonly<SpendingPrefs>,
  fmt: MoneyFormat,
): RowView[] {
  const lines: Line[] = view.categories
    .map((c, i): Line => {
      const own = pick === null ? c : c.people.find((p) => p.participantId === pick);
      return {
        key: c.category,
        categoryId: c.categoryId,
        name: categoryName(c),
        icon: CATEGORY_ICON[c.categoryId ?? 'other'],
        color: CATEGORY_COLORS[i] ?? OTHER,
        net: own?.net ?? 0,
        purchases: own?.purchases ?? 0,
        prev: own ? own.prev : null,
        family: { net: c.net, prev: c.prev },
        parts: c.people,
      };
    })
    .filter((l) => l.net > 0)
    .sort((a, b) => b.net - a.net);

  const top = lines.slice(0, TOP);
  const rest = lines.slice(TOP);
  if (rest.length > 0) {
    top.push({
      key: 'rest',
      categoryId: null,
      name: t('home.spending.rest', rest.length),
      icon: CATEGORY_ICON.rest,
      color: GREY,
      net: rest.reduce((s, l) => s + l.net, 0),
      purchases: rest.reduce((s, l) => s + l.purchases, 0),
      prev: sumPrev(rest.map((l) => l.prev)),
      family: { net: rest.reduce((s, l) => s + l.family.net, 0), prev: sumPrev(rest.map((l) => l.family.prev)) },
      parts: sumParts(rest.map((l) => l.parts)),
    });
  }

  const total = totalFor(view, pick).net;
  // One scale for the family and a pick: the family's amounts, so a picked person's bar is their part of the family's.
  const max = Math.max(1, ...top.map((l) => Math.max(l.family.net, l.family.prev?.net ?? 0)));
  return top.map((l): RowView => {
    // A pick's own segment comes first (it starts at 0, where its mark is measured from), the others follow faded.
    const parts = pick === null ? l.parts : [...l.parts].sort((a, b) => Number(b.participantId === pick) - Number(a.participantId === pick));
    // The split by people only with more than one person (main sends no parts for the only one).
    const split = prefs.split && view.people.length > 1
      ? parts.filter((p) => p.net > 0).map((p): BarSegment => {
          const who = personOf(people, p.participantId);
          return { value: p.net, color: pick === null || pick === p.participantId ? who.color : fade(who.color), title: `${who.name} — ${fmt.money(p.net)}` };
        })
      : [];
    const segments: BarSegment[] = split.length > 0 ? split : [{ value: 1, color: l.color, title: '' }];
    // Split by people with a pick: the bar is the family's amount; otherwise the pick's own.
    const barNet = pick !== null && split.length > 0 ? l.family.net : l.net;
    return {
      key: l.key,
      categoryId: l.categoryId,
      name: l.name,
      icon: l.icon,
      color: l.color,
      share: shareOf(l.net, total),
      amount: fmt.money(l.net),
      conv: fmt.approx(l.net),
      ops: opsView(l.purchases, l.prev?.purchases ?? null, view.month, partial(view)),
      chip: amountChip(l.net, l.prev?.net ?? null, view.month, fmt, partial(view)),
      width: pctOf(barNet, max),
      mark: prefs.mark && l.prev && l.prev.net > 0 ? pctOf(l.prev.net, max) : null,
      markTitle: l.prev && l.prev.net > 0 ? t('home.spending.markTitle', { month: prevIn(view.month), amount: fmt.money(l.prev.net) }) : '',
      segments,
    };
  });
}

/** The people list: `home.spending.whole` first, then each person. */
export function peopleRows(view: Readonly<SpendingOverview>, pick: number | null, people: ReadonlyArray<BlockPerson>, fmt: MoneyFormat): PersonRowView[] {
  const family: PersonRowView = {
    participantId: null,
    name: t('home.spending.whole'),
    color: '',
    dots: people.map((p) => p.color),
    caption: t('home.spending.together', { ops: t('home.spending.opsShort', { n: view.total.purchases }) }),
    amount: fmt.money(view.total.net),
    chip: pctChip(view.total.net, view.total.prev?.net ?? null, view.month, partial(view)),
    pressed: pick === null,
  };
  return [
    family,
    ...view.people.map((p): PersonRowView => {
      const who = personOf(people, p.participantId);
      return {
        participantId: p.participantId,
        name: who.name,
        color: who.color,
        dots: [],
        caption: t('home.spending.personShare', { pct: percentOf(p.net, view.total.net), ops: t('home.spending.opsShort', { n: p.purchases }) }),
        amount: fmt.money(p.net),
        chip: pctChip(p.net, p.prev?.net ?? null, view.month, partial(view)),
        pressed: pick === p.participantId,
      };
    }),
  ];
}

/**
 * The ring of the rows: each named row its own net; «Other» gets the rest of the total, so a refund-only category
 * (counted in the total, absent from the rows) never makes the ring larger than the total.
 */
export function ringOf(rows: ReadonlyArray<RowView>, view: Readonly<SpendingOverview>, pick: number | null): string {
  const netOf = (key: string) => {
    const c = view.categories.find((x) => x.category === key);
    if (!c) return 0;
    return pick === null ? c.net : (c.people.find((p) => p.participantId === pick)?.net ?? 0);
  };
  const named = rows.filter((r) => r.key !== 'rest').map((r) => ({ value: netOf(r.key), color: r.color }));
  const rest = rows.find((r) => r.key === 'rest');
  const parts = rest ? [...named, { value: Math.max(0, totalFor(view, pick).net - named.reduce((s, p) => s + p.value, 0)), color: rest.color }] : named;
  return ringStops(parts);
}

/** `home.spending.inMonth` («In August») — the stats line under the ring. */
export function prevInText(month: string): string {
  return t('home.spending.inMonth', { month: prevIn(month) });
}

/** `home.spending.noCompare` — last month is not covered by the data. */
export function noCompareText(month: string): string {
  return t('home.spending.noCompare', { month: prevIn(month) });
}

/** `home.spending.leftOut` lines: currencies without a rate, out of the totals. */
export function leftOutLines(view: Readonly<SpendingOverview>): string[] {
  return view.leftOut.map((l) => t('home.spending.leftOut', { amount: formatMoney(l.net, l.currency) }));
}

/**
 * The menu choices from storage: each field on its own, defaults for anything else (the old `usd` / `eur` fields are
 * the currency entity's now). The one `as` reads a parsed JSON object's fields after the object / array guard.
 */
export function parsePrefs(raw: string | null): SpendingPrefs {
  const d: SpendingPrefs = { split: true, mark: true };
  if (raw === null) return d;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return d;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return d;
  const o = v as Record<string, unknown>;
  const field = (k: keyof SpendingPrefs): boolean => {
    const x = o[k];
    return typeof x === 'boolean' ? x : d[k];
  };
  return { split: field('split'), mark: field('mark') };
}
