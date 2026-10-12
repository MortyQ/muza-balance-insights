// @vitest-environment happy-dom
// «What's unusual» of the spending block (utils/insights.ts): which categories, in what order, the income line, the
// note; a running month and a small usual base. Fictional figures only.
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
  running: false,
  total: 0,
  categories: [
    { category: 'продукты', categoryId: 'groceries', net: 500_000 },
    { category: 'доставка', categoryId: 'delivery', net: 100_000 },
    { category: 'кафе и рестораны', categoryId: 'cafes', net: 200_000 },
    { category: 'такси и транспорт', categoryId: 'transport', net: 180_000 },
    { category: 'аптеки и здоровье', categoryId: 'health', net: 160_000 },
  ],
  income: { now: 70_000, usual: 100_000 },
};
const view = (categories: SpendingOverview['categories'], usual: SpendingUsual | null = USUAL) => ({ categories, usual }) as unknown as SpendingOverview;

describe('insightsView', () => {
  it('a month that is over: categories off by 20% and 500 ₴, the largest differences first, at most 3; income said with its own share', () => {
    const v = insightsView(
      view([
        cat('продукты', 'groceries', 560_000), // +12%: not unusual
        cat('доставка', 'delivery', 223_000), // +123%, +1 230 ₴
        cat('кафе и рестораны', 'cafes', 120_000), // −40%, −800 ₴
        cat('такси и транспорт', 'transport', 240_000), // +33%, +600 ₴
        // health: none this month, −1 600 ₴, −100%
      ]),
      FMT,
    )!;
    expect(v.lines).toEqual([
      { text: `Аптеки и здоровье — на 100% меньше обычного (−${uah(160_000)})`, tone: 'down' },
      { text: `Доставка — на 123% больше обычного (+${uah(123_000)})`, tone: 'up' },
      { text: `Кафе и рестораны — на 40% меньше обычного (−${uah(80_000)})`, tone: 'down' },
      { text: 'Доходы на 30% ниже обычного', tone: 'neutral' },
    ]);
    expect(v.note).toBe('Сравнение с медианой за 5 месяцев');
  });

  it('a usual under 1 000 ₴: more said by the amount alone, less not at all', () => {
    const usual = { ...USUAL, categories: [{ category: 'переводы людям', categoryId: 'p2p' as const, net: 2_000 }, { category: 'другое', categoryId: 'other' as const, net: 90_000 }] };
    const calm = { ...usual, income: { now: 100_000, usual: 100_000 } };
    // Transfers: 20 ₴ usually, 9 400 ₴ now — no 46 900%. Other: 900 → 0, under the base: not said.
    const v = insightsView(view([cat('переводы людям', 'p2p', 940_000)], calm), FMT)!;
    expect(v.lines).toEqual([
      { text: `Переводы людям — +${uah(938_000)}, обычно здесь почти ничего`, tone: 'up' },
      { text: 'Доходы на обычном уровне', tone: 'neutral' },
    ]);
  });

  it('a running month: only what is already over a whole usual month, no income, the note says so', () => {
    const running = { ...USUAL, running: true, income: null };
    const v = insightsView(
      view(
        [
          cat('продукты', 'groceries', 200_000), // under the usual month: nothing to say yet
          cat('доставка', 'delivery', 223_000), // already 1 230 ₴ over a whole usual month
        ],
        running,
      ),
      FMT,
    )!;
    expect(v.lines).toEqual([{ text: `Доставка — уже на ${uah(123_000)} больше, чем обычно за весь месяц`, tone: 'up' }]);
    expect(v.note).toBe('Сравнение с медианой целых месяцев за 5 месяцев: месяц ещё идёт');
  });

  it('income alone when only it is off; nothing at all — null; no usual — null', () => {
    const calm = USUAL.categories.map((c) => cat(c.category, c.categoryId, c.net));
    expect(insightsView(view(calm), FMT)!.lines).toEqual([{ text: 'Доходы на 30% ниже обычного', tone: 'neutral' }]);
    expect(insightsView(view(calm, { ...USUAL, income: { now: 100_000, usual: 100_000 } }), FMT)).toBeNull();
    expect(insightsView(view(calm, null), FMT)).toBeNull();
  });
});
