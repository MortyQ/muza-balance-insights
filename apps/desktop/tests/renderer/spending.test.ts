// Pure helpers of the spending block. balanceApi is never called here: the participant slice pulls it in, so it is stubbed.
import { describe, expect, it, vi } from 'vitest';
import type { SpendingOverview } from '@contract/api.ts';
import type { CategoryId } from '@contract/categories.ts';
import {
  centerChip,
  change,
  convertLines,
  opsView,
  parsePrefs,
  ringOf,
  ringStops,
  rowsFor,
  shareOf,
  totalFor,
} from '@/features/spending-summary/utils.ts';
import { formatMoney } from '@/shared/lib';

vi.mock('@/shared/api', () => ({ balanceApi: {} }));

const uah = (kopecks: number) => formatMoney(kopecks, 980);

const P = [
  { id: 1, name: 'Сергей', color: 'var(--series-blue)' },
  { id: 2, name: 'Аня', color: 'var(--series-orange)' },
];
const part = (participantId: number, net: number, purchases: number, prev: { net: number; purchases: number } | null) => ({ participantId, net, purchases, prev });
const cat = (category: string, categoryId: CategoryId | null, net: number, purchases: number, prevNet: number | null, people: ReturnType<typeof part>[] = []): SpendingOverview['categories'][number] =>
  ({ category, categoryId, net, purchases, prev: prevNet === null ? null : { net: prevNet, purchases: purchases - 1 }, people });

const VIEW: SpendingOverview = {
  month: '2026-09',
  period: { from: '2026-09-01', to: '2026-09-30', days: 30, incomplete: false, dataUntil: '2026-10-01', coveredDays: 30, pendingHolds: 0 },
  compare: { from: '2026-08-01', to: '2026-08-31', partial: false },
  total: { net: 100_000, purchases: 20, netPerDay: 3_333, prev: { net: 80_000, purchases: 18 } },
  people: [part(1, 60_000, 12, { net: 50_000, purchases: 10 }), part(2, 40_000, 8, { net: 30_000, purchases: 8 })],
  categories: [
    cat('продукты', 'groceries', 50_000, 10, 40_000, [part(1, 30_000, 6, { net: 25_000, purchases: 5 }), part(2, 20_000, 4, { net: 15_000, purchases: 4 })]),
    cat('кафе и рестораны', 'cafes', 30_000, 6, 30_000, [part(1, 30_000, 6, { net: 30_000, purchases: 5 }), part(2, 0, 0, { net: 0, purchases: 0 })]),
    cat('подарки', 'gifts', 20_000, 4, 0, [part(1, 0, 0, { net: 0, purchases: 0 }), part(2, 20_000, 4, { net: 0, purchases: 0 })]),
  ],
  fx: [{ currency: 840, rate: 41, prevRate: 40, nearest: false }, { currency: 978, rate: null, prevRate: null, nearest: false }],
  leftOut: [],
  familyTotal: null,
};
const PREFS = { split: true, mark: false, usd: false, eur: false };

describe('change', () => {
  it('more / less with the percent and the amount; under 3% → same; last month 0 → new; no comparison → null', () => {
    expect(change(110, 100)).toEqual({ kind: 'up', diff: 10, pct: 10 });
    expect(change(80, 100)).toEqual({ kind: 'down', diff: 20, pct: 20 });
    expect(change(102, 100)).toEqual({ kind: 'same', diff: 2, pct: 2 });
    expect(change(50, 0)).toEqual({ kind: 'new', diff: 50, pct: 0 });
    expect(change(50, null)).toBeNull();
  });

  it('the chip under the ring: more / less with the percent (by this day while partial), new, same', () => {
    expect(centerChip(114, 100, '2026-09', false)).toMatchObject({ text: 'на 14% больше, чем в августе', tone: 'up', arrow: 'up' });
    expect(centerChip(86, 100, '2026-09', true)).toMatchObject({ text: 'на 14% меньше, чем к этому дню в августе', tone: 'down', arrow: 'down' });
    expect(centerChip(101, 100, '2026-09', false)).toMatchObject({ text: 'как в августе', tone: 'neutral', arrow: null });
    expect(centerChip(50, 0, '2026-09', false)).toMatchObject({ text: 'новое', tone: 'neutral', arrow: null });
    expect(centerChip(50, null, '2026-09', false)).toBeNull();
  });
});

describe('opsView', () => {
  it('the count with its plural; the difference against last month', () => {
    expect(opsView(38, 36, '2026-09')).toMatchObject({ text: '38 операций', diff: '+2', tone: 'up', title: 'В августе — 36 операций' });
    expect(opsView(21, 24, '2026-09')).toMatchObject({ text: '21 операция', diff: '−3', tone: 'down' });
    expect(opsView(5, 5, '2026-09')).toMatchObject({ diff: 'столько же', tone: 'neutral' });
    expect(opsView(2, 0, '2026-09')).toMatchObject({ diff: 'новое' });
    expect(opsView(2, null, '2026-09')).toMatchObject({ diff: '', title: '' });
  });
});

describe('rowsFor', () => {
  it('the family: colours by rank, people segments, share of the total, change chips', () => {
    const rows = rowsFor(VIEW, null, P, PREFS);
    expect(rows.map((r) => [r.key, r.color, r.share])).toEqual([
      ['продукты', 'var(--category-1)', '50%'],
      ['кафе и рестораны', 'var(--category-2)', '30%'],
      ['подарки', 'var(--category-3)', '20%'],
    ]);
    expect(rows[0]!.name).toBe('Продукты');
    expect(rows[0]!.icon).toBe('lucide:shopping-cart');
    expect(rows[0]!.segments.map((s) => [s.value, s.color])).toEqual([[30_000, 'var(--series-blue)'], [20_000, 'var(--series-orange)']]);
    expect(rows[0]!.chip).toMatchObject({ tone: 'up', arrow: 'up', text: uah(10_000) });
    expect(rows[1]!.chip).toMatchObject({ tone: 'neutral', arrow: null, text: 'как в августе' });
    expect(rows[2]!.chip).toMatchObject({ text: 'новое' });
    expect(rows[0]!.people.map((p) => p.name)).toEqual(['Сергей', 'Аня']);
    // a person who spent nothing in a category, now or last month, has no line in it
    expect(rows[2]!.people.map((p) => p.participantId)).toEqual([2]);
  });

  it('a picked person: their amounts, re-sorted, the others fade; categories without them drop out', () => {
    const rows = rowsFor(VIEW, 2, P, PREFS);
    expect(rows.map((r) => [r.key, r.amount, r.share])).toEqual([['продукты', uah(20_000), '50%'], ['подарки', uah(20_000), '50%']]);
    expect(rows[0]!.segments.map((s) => s.color)).toEqual(['color-mix(in oklch, var(--series-blue) 22%, var(--surface))', 'var(--series-orange)']);
    expect(rows[0]!.people.find((p) => p.participantId === 1)!.faded).toBe(true);
    // colours stay those of the family's rank
    expect(rows[1]!.color).toBe('var(--category-3)');
  });

  it('split off → one segment in the category colour, also for a picked person; mark on → last month position', () => {
    const rows = rowsFor(VIEW, null, P, { ...PREFS, split: false, mark: true });
    expect(rows[0]!.segments).toEqual([{ value: 1, color: 'var(--category-1)', title: '' }]);
    expect(rows[0]!.mark).toBe(80);
    expect(rows[2]!.mark).toBeNull(); // nothing last month
    expect(rowsFor(VIEW, 2, P, { ...PREFS, split: false })[1]!.segments).toEqual([{ value: 1, color: 'var(--category-3)', title: '' }]);
  });

  it('no comparison → no chips, no operation differences, no marks', () => {
    const none: SpendingOverview = { ...VIEW, compare: null, total: { ...VIEW.total, prev: null }, categories: [cat('продукты', 'groceries', 50_000, 10, null)] };
    const [row] = rowsFor(none, null, P, { ...PREFS, mark: true });
    expect(row).toMatchObject({ chip: null, mark: null, markTitle: '' });
    expect(row!.ops.diff).toBe('');
  });

  it('more than seven categories → the top seven and «Остальное · N»', () => {
    const many = { ...VIEW, categories: Array.from({ length: 9 }, (_, i) => cat(`c${i}`, null, 1_000 * (9 - i), 1, null)) };
    const rows = rowsFor(many, null, P, PREFS);
    expect(rows).toHaveLength(8);
    expect(rows[0]!.name).toBe('C0');
    expect(rows[6]!.color).toBe('var(--category-7)');
    expect(rows[7]).toMatchObject({ key: 'rest', name: 'Остальное · 2', color: 'var(--border-strong)', icon: 'lucide:list', amount: uah(3_000) });
  });
});

describe('totalFor / shareOf / ringStops / convertLines', () => {
  it('the family or a person', () => {
    expect(totalFor(VIEW, null)).toEqual({ net: 100_000, purchases: 20, prev: { net: 80_000, purchases: 18 } });
    expect(totalFor(VIEW, 2)).toEqual({ net: 40_000, purchases: 8, prev: { net: 30_000, purchases: 8 } });
  });
  it('share in whole percent', () => {
    expect(shareOf(1, 3)).toBe('33%');
    expect(shareOf(1, 0)).toBe('0%');
  });
  it('ring stops: each part with a gap', () => {
    expect(ringStops([{ value: 1, color: 'a' }, { value: 1, color: 'b' }])).toBe(
      'conic-gradient(a 0.00deg 178.60deg, var(--surface) 178.60deg 180.00deg, b 180.00deg 358.60deg, var(--surface) 358.60deg 360.00deg)',
    );
    expect(ringStops([])).toBe('conic-gradient(var(--surface-sunken) 0deg 360deg)');
  });
  it('ringOf: the rows own nets in their colours', () => {
    expect(ringOf(rowsFor(VIEW, null, P, PREFS), VIEW, null)).toBe(
      ringStops([{ value: 50_000, color: 'var(--category-1)' }, { value: 30_000, color: 'var(--category-2)' }, { value: 20_000, color: 'var(--category-3)' }]),
    );
  });
  it('ringOf: «Other» takes the rest of the total (a refund-only category counts in the total, not in the rows)', () => {
    const many: SpendingOverview = { ...VIEW, total: { ...VIEW.total, net: 44_000 }, categories: Array.from({ length: 9 }, (_, i) => cat(`c${i}`, null, 1_000 * (9 - i), 1, null)) };
    const named = Array.from({ length: 7 }, (_, i) => ({ value: 1_000 * (9 - i), color: `var(--category-${i + 1})` }));
    expect(ringOf(rowsFor(many, null, P, PREFS), many, null)).toBe(ringStops([...named, { value: 44_000 - 42_000, color: 'var(--border-strong)' }]));
  });
  it('currency lines for the switched-on currencies with a rate', () => {
    expect(convertLines(41_000, VIEW.fx, { ...PREFS, usd: true, eur: true })).toEqual([`≈ ${formatMoney(1_000, 840)}`]);
    expect(convertLines(41_000, VIEW.fx, PREFS)).toEqual([]);
  });
});

describe('parsePrefs', () => {
  it('defaults for nothing or garbage; each field on its own', () => {
    expect(parsePrefs(null)).toEqual({ split: true, mark: false, usd: false, eur: false });
    expect(parsePrefs('{oops')).toEqual({ split: true, mark: false, usd: false, eur: false });
    expect(parsePrefs('[true]')).toEqual({ split: true, mark: false, usd: false, eur: false });
    expect(parsePrefs('{"mark":true,"usd":"yes","split":false}')).toEqual({ split: false, mark: true, usd: false, eur: false });
  });
});
