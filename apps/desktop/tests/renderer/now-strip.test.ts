// @vitest-environment happy-dom
// The now strip: pure helpers and the feature mounted. Fictional fixtures only.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { NowOverview, NowOverviewQuery, PeopleView } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import WeekBars from '@/features/now-strip/components/WeekBars.vue';
import { categoryColor, daysRange, dayLabel, nowChip, nowView, weekBars } from '@/features/now-strip/utils.ts';
import { formatMoney } from '@/shared/lib';

const uah = (k: number) => formatMoney(k, 980);

// Saturday 3 October: today 720 ₴ against a usual 520 ₴; the week 3 220 ₴ against 3 600 ₴ on the same days.
const NOW: NowOverview = {
  date: '2026-10-03',
  weekday: 6,
  dataUntil: '2026-10-03',
  today: { net: 72_000, purchases: 3 },
  usualDay: 52_000,
  week: {
    from: '2026-09-28',
    days: [40_000, 0, 120_000, 30_000, 60_000, 72_000, null],
    total: { net: 322_000, purchases: 28 },
    prev: 360_000,
    top: { category: 'продукты', categoryId: 'groceries', net: 125_580, purchases: 11, rank: 0 },
    pendingHolds: 0,
  },
  rates: { list: [{ currency: 840, rate: 41 }, { currency: 978, rate: 45 }], fetchedAt: 0, saved: false },
};
const NONE = { uah: false, usd: false, eur: false };
const OFF = moneyFormat(NOW.rates, { main: 980, also: NONE });

let current: NowOverview = NOW;
const getNowOverview = vi.fn(async (_q: NowOverviewQuery) => current);
vi.mock('@/shared/api', () => ({ balanceApi: { getNowOverview: (...a: unknown[]) => getNowOverview(...(a as [NowOverviewQuery])) } }));

describe('now strip helpers', () => {
  it('the day and the week range', () => {
    expect(dayLabel('2026-10-03', 6)).toBe('сб, 3 окт');
    expect(daysRange(6)).toBe('пн–сб');
    expect(daysRange(1)).toBe('пн');
  });

  it('bars: today, past, future; heights relative to the largest day, a small day stays visible', () => {
    expect(weekBars([40_000, 0, 120_000, 1_000, null, null, null], 4)).toEqual([
      { kind: 'past', height: 33 },
      { kind: 'past', height: 0 },
      { kind: 'past', height: 100 },
      { kind: 'today', height: 6 },
      { kind: 'future', height: 0 },
      { kind: 'future', height: 0 },
      { kind: 'future', height: 0 },
    ]);
  });

  it('chips: percent with the sign and the arrow, «as usual» under 3%, none without a base or with a base of 0', () => {
    expect(nowChip(72_000, 52_000, 'usual')).toEqual({ text: '+38%', tone: 'up', arrow: 'up', sr: 'больше, чем в обычный день' });
    expect(nowChip(322_000, 360_000, 'week')).toEqual({ text: '−11%', tone: 'down', arrow: 'down', sr: 'меньше, чем на прошлой неделе' });
    expect(nowChip(52_500, 52_000, 'usual')).toEqual({ text: 'как обычно', tone: 'neutral', arrow: null, sr: '' });
    expect(nowChip(100, null, 'week')).toBeNull();
    expect(nowChip(100, 0, 'usual')).toBeNull();
  });

  it('the category colour of the spending block: top 7 by rank, else «other»', () => {
    expect(categoryColor(0)).toBe('var(--category-1)');
    expect(categoryColor(6)).toBe('var(--category-7)');
    expect(categoryColor(7)).toBe('var(--category-other)');
    expect(categoryColor(null)).toBe('var(--category-other)');
  });

  it('the view: titles, amounts, chips with context, the top category, conversions only when switched on', () => {
    const v = nowView(NOW, OFF);
    expect(v.today).toEqual({
      title: 'Сегодня · сб, 3 окт',
      amount: uah(72_000),
      ops: '3 операции',
      conv: '',
      chip: { text: '+38%', tone: 'up', arrow: 'up', sr: 'больше, чем в обычный день' },
      context: `к обычному дню ≈ ${uah(52_000)}`,
      until: '',
    });
    expect(v.week).toMatchObject({ title: 'Эта неделя · пн–сб', amount: uah(322_000), context: 'к прошлой неделе, пн–сб', pending: 0 });
    expect(v.top).toEqual({ name: 'Продукты', color: 'var(--category-1)', amount: uah(125_580), caption: '39% недели · 11 оп.' });
    expect(nowView(NOW, moneyFormat(NOW.rates, { main: 980, also: { uah: true, usd: true, eur: true } })).today.conv).toBe(`≈ ${formatMoney(Math.round(72_000 / 41), 840)} · ${formatMoney(1_600, 978)}`);
  });

  it('euro main: every amount in euros (the top category too), «≈» in the other picked currencies', () => {
    const fmt = moneyFormat(NOW.rates, { main: 978, also: { uah: true, usd: false, eur: true } });
    const v = nowView(NOW, fmt);
    expect(v.today.amount).toBe(fmt.money(72_000));
    expect(v.today.amount).toBe(formatMoney(1_600, 978));
    expect(v.today.conv).toBe(fmt.approxInline(72_000));
    expect(v.today.conv).toBe(`≈ ${uah(72_000)}`);
    expect(v.today.context).toBe(`к обычному дню ≈ ${fmt.money(52_000)}`);
    expect(v.week).toMatchObject({ amount: fmt.money(322_000), conv: fmt.approxInline(322_000) });
    expect(v.top?.amount).toBe(fmt.money(125_580));
  });

  it('stale data: «data until» instead of the chip; no usual day or last week: no chip, no context; an empty week: no top', () => {
    expect(nowView({ ...NOW, dataUntil: '2026-10-02' }, OFF).today).toMatchObject({ chip: null, context: '', until: 'Данные до 02.10' });
    const bare = nowView({ ...NOW, usualDay: 0, week: { ...NOW.week, prev: null, top: null } }, OFF);
    expect(bare.today).toMatchObject({ chip: null, context: '' });
    expect(bare.week).toMatchObject({ chip: null, context: '' });
    expect(bare.top).toBeNull();
  });

  it('the top category\'s share stays within 100% when refunds in other categories pull the week below it', () => {
    const v = nowView({ ...NOW, week: { ...NOW.week, total: { net: 100_000, purchases: 12 } } }, OFF);
    expect(v.top?.caption).toBe('100% недели · 11 оп.');
  });
});

const PEOPLE: PeopleView = {
  people: [
    { id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] },
    { id: 2, label: 'Аня', labelFromBank: false, labelPending: false, color: 'orange', connections: [] },
  ],
  secureStorage: true,
};

describe('now strip mounted', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getNowOverview.mockClear();
    current = NOW;
    localStorage.clear();
  });

  async function mountStrip() {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { useParticipantStore } = await import('@/entities/participant');
    useParticipantStore().view = PEOPLE;
    const { NowStripFeature } = await import('@/features/now-strip');
    const w = mount(NowStripFeature, { global: { plugins: [i18n] } });
    await flushPromises();
    return w;
  }

  it('three cells for the whole family, the bars hidden from screen readers', async () => {
    const w = await mountStrip();
    expect(getNowOverview.mock.calls[0]?.[0]).toEqual({});
    expect(w.find('section').attributes('aria-label')).toBe('Сейчас');
    for (const s of ['Сегодня · сб, 3 окт', uah(72_000), '+38%', 'Эта неделя · пн–сб', 'к прошлой неделе, пн–сб', 'Больше всего за неделю', 'Продукты', '39% недели · 11 оп.']) {
      expect(w.text()).toContain(s);
    }
    expect(w.find('.v-change-chip__sr').text()).toBe('больше, чем в обычный день');
    const bars = w.findComponent(WeekBars);
    expect(bars.attributes('aria-hidden')).toBe('true');
    expect(bars.findAll('span')).toHaveLength(7);
  });

  it('follows the global people filter', async () => {
    const w = await mountStrip();
    const { useParticipantStore } = await import('@/entities/participant');
    useParticipantStore().select(2);
    await flushPromises();
    expect(getNowOverview.mock.calls.at(-1)?.[0]).toEqual({ participantId: 2 });
    w.unmount();
  });

  it('hidden while a past month is picked; back for the current month', async () => {
    const w = await mountStrip();
    const { useMonthStore } = await import('@/entities/period');
    const months = useMonthStore();
    const thisMonth = months.thisMonth;
    months.set('2020-01', null);
    await flushPromises();
    expect(w.find('section').exists()).toBe(false);
    months.set(thisMonth, null);
    await flushPromises();
    expect(w.find('section').exists()).toBe(true);
  });

  it('reloads quietly on new data; currencies follow the shared choice; pending holds and an empty week', async () => {
    const w = await mountStrip();
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    useCurrencyDisplayStore().setAlso('usd', true);
    await flushPromises();
    expect(w.text()).toContain(`≈ ${formatMoney(Math.round(72_000 / 41), 840)}`);

    current = { ...NOW, week: { ...NOW.week, pendingHolds: 2, top: null } };
    const { useSyncStatusStore } = await import('@/entities/sync-status');
    useSyncStatusStore().version++;
    await flushPromises();
    expect(getNowOverview).toHaveBeenCalledTimes(2);
    expect(w.text()).toContain('В обработке банком: 2');
    expect(w.text()).toContain('На этой неделе трат ещё нет');
  });
});
