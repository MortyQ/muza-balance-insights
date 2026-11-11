// @vitest-environment happy-dom
// «What's unusual» of the spending block (utils/insights.ts): core's ranked insights worded, at most five, a category
// line linked to its screen, each a row like «Spending»'s (colour by rank, now and the usual, the change chip, the bar),
// the note. Fictional figures only.
import { describe, expect, it } from 'vitest';
import type { SpendingInsight, SpendingInsights, SpendingOverview } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import { insightsView } from '@/features/spending-summary/utils/index.ts';
import { formatMoney } from '@/shared/lib';

const uah = (k: number) => formatMoney(k, 980);
const FMT = moneyFormat(null, { main: 980, also: { uah: false, usd: false, eur: false, czk: false } });
const ins = (o: Partial<SpendingInsight> & Pick<SpendingInsight, 'type' | 'amount'>): SpendingInsight => ({
  direction: 'up', percent: null, category: null, categoryId: null, now: 0, usual: 0, ...o,
});
// «Spending»'s categories in the family's order: «доставка» is second, so it takes `--category-2`.
const CATEGORIES = [{ category: 'продукты' }, { category: 'доставка' }];
const view = (insights: SpendingInsights | null) => ({ insights, categories: CATEGORIES }) as unknown as SpendingOverview;
const of = (list: SpendingInsight[], running = false) => view({ months: 5, running, insights: list });

describe('insightsView', () => {
  it('every type worded, the share beside the money, in the given order; income plain, a category linked', () => {
    const v = insightsView(
      of([
        ins({ type: 'category-less', direction: 'down', amount: 160_000, percent: 100, category: 'аптеки и здоровье', categoryId: 'health' }),
        ins({ type: 'category-more', amount: 123_000, percent: 123, category: 'доставка', categoryId: 'delivery' }),
        ins({ type: 'income-less', direction: 'down', amount: 30_000, percent: 30 }),
        ins({ type: 'category-rare', amount: 938_000, category: 'переводы людям', categoryId: 'p2p' }),
        ins({ type: 'income-more', amount: 25_000, percent: 25 }),
      ]),
      FMT,
      'personal',
    )!;
    expect(v.lines.map(({ text, tone }) => [text, tone])).toEqual([
      [`Аптеки и здоровье — на ${uah(160_000)} (100%) меньше обычного`, 'down'],
      [`Доставка — на ${uah(123_000)} (×2,2) больше обычного`, 'up'],
      [`Доходы на ${uah(30_000)} (30%) ниже обычного`, 'neutral'],
      [`Переводы людям — +${uah(938_000)}, обычно здесь почти ничего`, 'up'],
      [`Доходы на ${uah(25_000)} (25%) выше обычного`, 'neutral'],
    ]);
    expect(v.lines[0]!.to).toEqual({ name: 'category', params: { id: 'health' }, query: { scope: 'personal' } });
    expect(v.lines[2]!.to).toBeNull();
    expect(v.note).toBe('Сравнение с медианой за 5 месяцев');
  });

  it('a row: icon and colour by rank, now and the usual, the change chip, the bar of now against the usual', () => {
    const v = insightsView(
      of([
        ins({ type: 'category-more', amount: 105_000, percent: 404, category: 'доставка', categoryId: 'delivery', now: 131_000, usual: 26_000 }),
        ins({ type: 'category-less', direction: 'down', amount: 110_000, percent: 73, category: 'аптеки и здоровье', categoryId: 'health', now: 40_000, usual: 150_000 }),
        ins({ type: 'income-more', amount: 68_000, percent: 25, now: 340_000, usual: 272_000 }),
        ins({ type: 'category-rare', amount: 90_000, category: 'переводы людям', categoryId: 'p2p', now: 90_000, usual: 0 }),
      ]),
      FMT,
      'personal',
    )!;
    const [more, less, income, rare] = v.lines;
    expect(more).toMatchObject({
      name: 'Доставка', icon: 'lucide:truck', color: 'var(--category-2)', caption: `${uah(131_000)} · обычно ${uah(26_000)}`,
      chip: { text: `+${uah(105_000)} (×5,0)`, tone: 'up', arrow: 'up' },
    });
    expect(more!.bar.value).toBe(100);
    expect(Math.round(more!.bar.mark)).toBe(20);
    expect(less).toMatchObject({ color: 'var(--category-other)', chip: { text: `−${uah(110_000)} (73%)`, tone: 'down' } });
    expect(less!.bar.mark).toBe(100);
    expect(Math.round(less!.bar.value)).toBe(27);
    expect(income).toMatchObject({ name: 'Доходы', icon: 'lucide:wallet', color: 'var(--success)', to: null, chip: { tone: 'neutral', arrow: null } });
    expect(rare).toMatchObject({ caption: `${uah(90_000)} · обычно почти ничего`, chip: { text: `+${uah(90_000)}` } });
    expect(rare!.bar).toEqual({ value: 100, mark: 0 });
  });

  it('at most five lines', () => {
    const list = Array.from({ length: 7 }, (_, i) => ins({ type: 'category-rare', amount: 900_000 - i * 1_000, category: 'другое', categoryId: 'other' }));
    expect(insightsView(of(list), FMT, 'personal')!.lines).toHaveLength(5);
  });

  it('a running month: the share against a whole usual month, the note says so', () => {
    const v = insightsView(of([ins({ type: 'category-over-month', amount: 123_000, percent: 41, category: 'доставка', categoryId: 'delivery' })], true), FMT, 'business')!;
    expect(v.lines[0]!.text).toBe(`Доставка — уже на ${uah(123_000)} (41%) больше, чем обычно за весь месяц`);
    expect(v.lines[0]!.to).toEqual({ name: 'category', params: { id: 'delivery' }, query: { scope: 'business' } });
    expect(v.note).toBe('Сравнение с медианой целых месяцев за 5 месяцев: месяц ещё идёт');
  });

  it('the picked «also» currency under the caption: now, approximate; none picked — empty', () => {
    const rates = { list: [{ currency: 978, rate: 45 }], fetchedAt: 0, saved: false };
    const eur = moneyFormat(rates, { main: 978, also: { uah: true, usd: false, eur: false, czk: false } });
    const line = (fmt: typeof FMT) =>
      insightsView(of([ins({ type: 'category-rare', amount: 90_000, category: 'доставка', categoryId: 'delivery', now: 90_000 })]), fmt, 'personal')!.lines[0]!;
    expect(line(eur).also).toBe(`≈ ${uah(90_000)}`);
    expect(line(FMT).also).toBe('');
  });

  it('nothing found or no usual: null', () => {
    expect(insightsView(of([]), FMT, 'personal')).toBeNull();
    expect(insightsView(view(null), FMT, 'personal')).toBeNull();
  });
});
