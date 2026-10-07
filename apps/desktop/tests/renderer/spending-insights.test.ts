// @vitest-environment happy-dom
// «What's unusual» of the spending block (utils/insights.ts): which categories, in what order, the income line, the
// note. Fictional figures only.
import { describe, expect, it } from 'vitest';
import type { SpendingOverview, SpendingUsual } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import { insightsView } from '@/features/spending-summary/utils/index.ts';
import { formatMoney } from '@/shared/lib';

const uah = (k: number) => formatMoney(k, 980);
const FMT = moneyFormat(null, { main: 980, also: { uah: false, usd: false, eur: false } });
const cat = (category: string, categoryId: SpendingOverview['categories'][number]['categoryId'], net: number) => ({
  category, categoryId, net, purchases: 1, prev: null, people: [],
});
const USUAL: SpendingUsual = {
  months: 5,
  cutDay: 10,
  total: 0,
  categories: [
    { category: 'продукты', categoryId: 'groceries', net: 500_000 },
    { category: 'доставка', categoryId: 'delivery', net: 100_000 },
    { category: 'кафе и рестораны', categoryId: 'cafes', net: 200_000 },
    { category: 'такси и транспорт', categoryId: 'transport', net: 80_000 },
    { category: 'аптеки и здоровье', categoryId: 'health', net: 60_000 },
  ],
  income: { now: 70_000, usual: 100_000 },
};
const view = (categories: SpendingOverview['categories'], usual: SpendingUsual | null = USUAL) => ({ categories, usual }) as unknown as SpendingOverview;

describe('insightsView', () => {
  it('categories off by 20% and 500 ₴, the largest differences first, at most 3; income said with its own share', () => {
    const v = insightsView(
      view([
        cat('продукты', 'groceries', 560_000), // +12%: not unusual
        cat('доставка', 'delivery', 223_000), // +123%, +1 230 ₴
        cat('кафе и рестораны', 'cafes', 120_000), // −40%, −800 ₴
        cat('такси и транспорт', 'transport', 140_000), // +75%, +600 ₴
        // health: none this month, −600 ₴, −100%
      ]),
      FMT,
    )!;
    expect(v.lines).toEqual([
      { text: `Доставка — на 123% больше обычного (+${uah(123_000)})`, tone: 'up' },
      { text: `Кафе и рестораны — на 40% меньше обычного (−${uah(80_000)})`, tone: 'down' },
      { text: `Аптеки и здоровье — на 100% меньше обычного (−${uah(60_000)})`, tone: 'down' },
      { text: 'Доходы на 30% ниже обычного', tone: 'neutral' },
    ]);
    expect(v.note).toBe('Сравнение с медианой за 5 месяцев к 10-му числу');
  });

  it('income alone when only it is off; nothing at all — null; no usual — null', () => {
    const calm = USUAL.categories.map((c) => cat(c.category, c.categoryId, c.net));
    expect(insightsView(view(calm), FMT)!.lines).toEqual([{ text: 'Доходы на 30% ниже обычного', tone: 'neutral' }]);
    expect(insightsView(view(calm, { ...USUAL, income: { now: 100_000, usual: 100_000 } }), FMT)).toBeNull();
    expect(insightsView(view(calm, null), FMT)).toBeNull();
  });
});
