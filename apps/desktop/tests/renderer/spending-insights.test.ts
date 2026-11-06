// @vitest-environment happy-dom
// «What's unusual» of the spending block (utils/insights.ts): core's ranked insights worded, at most five, a category
// line linked to its screen, the note. Fictional figures only.
import { describe, expect, it } from 'vitest';
import type { SpendingInsight, SpendingInsights, SpendingOverview } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import { insightsView } from '@/features/spending-summary/utils/index.ts';
import { formatMoney } from '@/shared/lib';

const uah = (k: number) => formatMoney(k, 980);
const FMT = moneyFormat(null, { main: 980, also: { uah: false, usd: false, eur: false } });
const ins = (o: Partial<SpendingInsight> & Pick<SpendingInsight, 'type' | 'amount'>): SpendingInsight => ({
  direction: 'up', percent: null, category: null, categoryId: null, now: 0, usual: 0, ...o,
});
const view = (insights: SpendingInsights | null) => ({ insights }) as unknown as SpendingOverview;
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

  it('nothing found or no usual: null', () => {
    expect(insightsView(of([]), FMT, 'personal')).toBeNull();
    expect(insightsView(view(null), FMT, 'personal')).toBeNull();
  });
});
