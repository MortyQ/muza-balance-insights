// @vitest-environment happy-dom
// The FOP tax screen (features/fop-tax): its pure helpers and the screen mounted — presets, a custom percent and
// amount, the period kinds, the base, the disclaimer, the ЄСВ note, no FOP account. Fictional figures only. Typechecked with the renderer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { FopTaxOverview, FopTaxQuery } from '@contract/api.ts';
import { quarterBounds, quarterOf } from '@contract/quarters.ts';
import { moneyFormat } from '@/entities/currency-display';
import type { PeriodPick } from '@/features/fop-tax/types.ts';
import { amountMinor, percentValue, periodBounds, periodName, quarterAllowed, taxMinor, taxView, yearOptions } from '@/features/fop-tax/utils.ts';
import { formatMoney } from '@/shared/lib';

const uah = (k: number) => formatMoney(k, 980);
const NONE = { uah: false, usd: false, eur: false, czk: false };
const RATES = { list: [{ currency: 840, rate: 40 }], fetchedAt: 0, saved: false };
const FMT = moneyFormat(RATES, { main: 980, also: NONE });

const VIEW: FopTaxOverview = {
  available: true,
  base: { from: '2026-10-01', to: '2026-11-10', total: 10_000_000, lines: 4, leftOut: [], incomplete: true },
  yearToDate: { from: '2026-01-01', to: '2026-11-10', total: 40_000_000, lines: 15, leftOut: [], incomplete: true },
  rates: RATES,
};
const pick = (o: Partial<PeriodPick>): PeriodPick => ({ kind: 'quarter', month: '2026-11', year: 2026, quarter: 4, from: '2026-11-01', to: '2026-11-10', ...o });

describe('FOP tax helpers', () => {
  it('quarters: of a date, their bounds, the ones offered, the years', () => {
    expect(quarterOf('2026-11-10')).toEqual({ year: 2026, quarter: 4 });
    expect(quarterOf('2026-03-31')).toEqual({ year: 2026, quarter: 1 });
    expect(quarterBounds(2024, 1)).toEqual({ from: '2024-01-01', to: '2024-03-31' });
    expect(quarterBounds(2026, 2)).toEqual({ from: '2026-04-01', to: '2026-06-30' });
    expect(quarterBounds(2026, 4)).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    const now = { year: 2026, quarter: 2 } as const;
    expect([1, 2, 3, 4].map((q) => quarterAllowed(2026, q as 1 | 2 | 3 | 4, now))).toEqual([true, true, false, false]);
    expect(quarterAllowed(2025, 4, now)).toBe(true);
    expect(yearOptions(2026)).toEqual([2026, 2025, 2024, 2023]);
  });

  it('a period of each kind: its days and its name', () => {
    expect(periodBounds(pick({ kind: 'month', month: '2024-02' }))).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(periodBounds(pick({ kind: 'quarter', year: 2025, quarter: 3 }))).toEqual({ from: '2025-07-01', to: '2025-09-30' });
    expect(periodBounds(pick({ kind: 'year', year: 2025 }))).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(periodBounds(pick({ kind: 'dates', from: '2026-03-15', to: '2026-06-20' }))).toEqual({ from: '2026-03-15', to: '2026-06-20' });
    expect(periodName(pick({ kind: 'month', month: '2026-09' }))).toBe('Сентябрь 2026');
    expect(periodName(pick({}))).toBe('4 квартал 2026');
    expect(periodName(pick({ kind: 'year', year: 2025 }))).toBe('2025 год');
    expect(periodName(pick({ kind: 'dates', from: '2026-03-15', to: '2026-06-20' }))).toContain(' – ');
  });

  it('a typed percent and amount; the tax rounded to a kopeck', () => {
    expect(percentValue('5')).toBe(5);
    expect(percentValue(' 5,5 ')).toBe(5.5);
    expect(percentValue('0.25')).toBe(0.25);
    for (const bad of ['', '0', '101', 'abc', '5.555', '-1']) expect(percentValue(bad)).toBeNull();
    expect(amountMinor('20 000')).toBe(2_000_000);
    expect(amountMinor('1500,50')).toBe(150_050);
    for (const bad of ['', '0', 'x', '1,234', '-5']) expect(amountMinor(bad)).toBeNull();
    expect(taxMinor(10_000_000, 5)).toBe(500_000);
    expect(taxMinor(333, 5)).toBe(17);
    expect(taxMinor(100_000, 0.5)).toBe(500);
  });

  it('the view: the period and the year to date from income; a typed amount alone; nothing without a percent', () => {
    const input = { percent: 5, base: 'business', amount: null, period: '4 квартал 2026' } as const;
    const v = taxView(VIEW, input, FMT);
    expect(v.rows.map((r) => [r.label, r.base, r.tax])).toEqual([
      ['Доход, 4 квартал 2026', uah(10_000_000), uah(500_000)],
      ['Доход с 1 января', uah(40_000_000), uah(2_000_000)],
    ]);
    expect(v.rateText).toBe('5% от дохода');
    expect(v.running).toBe(true);
    expect(taxView({ ...VIEW, yearToDate: null }, input, FMT).rows).toHaveLength(1);
    const own = taxView(VIEW, { ...input, percent: 1, base: 'custom', amount: 2_000_000 }, FMT);
    expect(own.rows.map((r) => [r.label, r.tax])).toEqual([['Твоя сумма', uah(20_000)]]);
    expect(own.running).toBe(false);
    expect(taxView(VIEW, { ...input, percent: null }, FMT).rows).toEqual([]);
    expect(taxView(VIEW, { ...input, base: 'custom' }, FMT).rows).toEqual([]);
    expect(taxView(null, input, FMT).rows).toEqual([]);
    const left = taxView({ ...VIEW, yearToDate: { ...VIEW.yearToDate!, leftOut: [{ currency: 985, total: 3_000 }] } }, input, FMT);
    expect(left.leftOut).toContain(formatMoney(3_000, 985));
  });
});

let current: FopTaxOverview = VIEW;
const getFopTaxOverview = vi.fn(async (_q: FopTaxQuery) => current);
vi.mock('@/shared/api', () => ({ balanceApi: { getFopTaxOverview: (...a: unknown[]) => getFopTaxOverview(...(a as [FopTaxQuery])) } }));

describe('FOP tax screen mounted', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 10, 12));
    setActivePinia(createPinia());
    getFopTaxOverview.mockClear();
    current = VIEW;
  });
  afterEach(() => vi.useRealTimers());

  async function mountScreen() {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { FopTaxFeature } = await import('@/features/fop-tax');
    const w = mount(FopTaxFeature, { global: { plugins: [i18n] } });
    await flushPromises();
    return w;
  }
  type W = Awaited<ReturnType<typeof mountScreen>>;
  const taxes = (w: W) => w.findAll('[data-test="tax-amount"]').map((e) => e.text());
  const click = async (w: W, group: string, label: string) => {
    const b = w.get(`[data-test="${group}"]`).findAll('button').find((x) => x.text() === label);
    if (!b) throw new Error(`no ${label}`);
    await b.trigger('click');
    await flushPromises();
  };
  const pressed = (w: W, group: string) => w.get(`[data-test="${group}"]`).findAll('button[aria-pressed="true"]').map((b) => b.text());

  it('asks for the current quarter with the year to date, FOP income; 5% at first, then 6%', async () => {
    const w = await mountScreen();
    expect(getFopTaxOverview.mock.calls[0]?.[0]).toEqual({ from: '2026-10-01', to: '2026-12-31', base: 'business', yearToDate: true });
    expect(taxes(w)).toEqual([uah(500_000), uah(2_000_000)]);
    expect(w.text()).toContain('5% от дохода');
    expect(w.text()).toContain('Доход, 4 квартал 2026');
    expect(w.text()).toContain('Доход с 1 января');
    expect(pressed(w, 'base')).toEqual(['Доход на счетах ФОП']);
    await click(w, 'rate', '6%');
    expect(taxes(w)).toEqual([uah(600_000), uah(2_400_000)]);
  });

  it('period kinds: a month, a year, dates; a quarter of this year after today is not offered', async () => {
    const w = await mountScreen();
    const quarters = w.get('[data-test="quarter-picker"]').findAll('button[aria-pressed]');
    expect(quarters.map((b) => b.attributes('disabled') === undefined)).toEqual([true, true, true, true]);
    await quarters[0]!.trigger('click');
    await flushPromises();
    expect(getFopTaxOverview.mock.calls.at(-1)?.[0]).toEqual({ from: '2026-01-01', to: '2026-03-31', base: 'business', yearToDate: true });
    await click(w, 'period-kind', 'Месяц');
    expect(getFopTaxOverview.mock.calls.at(-1)?.[0]).toEqual({ from: '2026-11-01', to: '2026-11-30', base: 'business' });
    await click(w, 'period-kind', 'Год');
    expect(getFopTaxOverview.mock.calls.at(-1)?.[0]).toEqual({ from: '2026-01-01', to: '2026-12-31', base: 'business' });
    await click(w, 'period-kind', 'Даты');
    expect(getFopTaxOverview.mock.calls.at(-1)?.[0]).toEqual({ from: '2026-11-01', to: '2026-11-10', base: 'business' });
    expect(w.find('[data-test="period-from"]').exists()).toBe(true);
  });

  it('own percent: a valid one counts and unmarks the preset; an invalid one says so; a preset click clears it', async () => {
    const w = await mountScreen();
    const input = w.get('[data-test="custom-percent"] input');
    await input.setValue('2,5');
    expect(taxes(w)).toEqual([uah(250_000), uah(1_000_000)]);
    expect(w.text()).toContain('2,5% от дохода');
    expect(pressed(w, 'rate')).toEqual([]);
    await input.setValue('150');
    expect(w.text()).toContain('Введи процент больше 0 и не больше 100');
    await click(w, 'rate', '6%');
    expect((input.element as HTMLInputElement).value).toBe('');
    expect(taxes(w)).toEqual([uah(600_000), uah(2_400_000)]);
  });

  it('all income: asked with the «all» base', async () => {
    const w = await mountScreen();
    await click(w, 'base', 'Весь доход');
    expect(getFopTaxOverview.mock.calls.at(-1)?.[0]).toMatchObject({ base: 'all' });
  });

  it('a custom amount replaces the base: one row, no year to date, no period', async () => {
    const w = await mountScreen();
    await click(w, 'base', 'Своя сумма');
    await w.get('[data-test="custom-amount"] input').setValue('20 000');
    expect(taxes(w)).toEqual([uah(100_000)]);
    expect(w.text()).toContain('Твоя сумма');
    expect(w.text()).not.toContain('Доход с 1 января');
    expect(w.find('[data-test="period-picker"]').exists()).toBe(false);
  });

  it('the disclaimer and the ЄСВ note are always there; no ЄСВ amount', async () => {
    const w = await mountScreen();
    expect(w.get('[data-test="fop-disclaimer"]').text()).toBe('Это оценка, а не налоговая консультация. Проверь ставку и сумму перед оплатой.');
    expect(w.get('[data-test="fop-esv"]').text()).toBe('Единый социальный взнос (ЕСВ) не учтён.');
    expect(w.findAll('[data-test="tax-row"]')).toHaveLength(2);
  });

  it('no FOP account in the view: the FOP base is not offered, all income is counted', async () => {
    current = { ...VIEW, available: false };
    const w = await mountScreen();
    expect(getFopTaxOverview.mock.calls.at(-1)?.[0]).toMatchObject({ base: 'all' });
    expect(w.get('[data-test="base"]').text()).not.toContain('Доход на счетах ФОП');
    expect(pressed(w, 'base')).toEqual(['Весь доход']);
    expect(taxes(w)).toHaveLength(2);
  });
});
