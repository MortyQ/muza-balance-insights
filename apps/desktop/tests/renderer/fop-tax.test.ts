// @vitest-environment happy-dom
// The FOP tax screen (features/fop-tax): its pure helpers and the screen mounted — presets, a custom percent and
// amount, the disclaimer, the ЄСВ note, no FOP account. Fictional figures only. Typechecked with the renderer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { FopTaxOverview, FopTaxQuery } from '@contract/api.ts';
import { quarterBounds, quarterOf } from '@contract/quarters.ts';
import { moneyFormat } from '@/entities/currency-display';
import { amountMinor, percentValue, quarterAllowed, taxMinor, taxView, yearOptions } from '@/features/fop-tax/utils.ts';
import { formatMoney } from '@/shared/lib';

const uah = (k: number) => formatMoney(k, 980);
const NONE = { uah: false, usd: false, eur: false, czk: false };
const RATES = { list: [{ currency: 840, rate: 40 }], fetchedAt: 0, saved: false };
const FMT = moneyFormat(RATES, { main: 980, also: NONE });

const VIEW: FopTaxOverview = {
  year: 2026,
  quarter: 4,
  available: true,
  current: { year: 2026, quarter: 4 },
  base: { from: '2026-10-01', to: '2026-11-10', total: 10_000_000, lines: 4, leftOut: [], incomplete: true },
  yearToDate: { from: '2026-01-01', to: '2026-11-10', total: 40_000_000, lines: 15, leftOut: [], incomplete: true },
  rates: RATES,
};

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

  it('the view: quarter and year to date from income; a typed amount alone; nothing without a percent', () => {
    const v = taxView(VIEW, { percent: 5, base: 'income', amount: null }, FMT);
    expect(v.rows.map((r) => [r.base, r.tax])).toEqual([
      [uah(10_000_000), uah(500_000)],
      [uah(40_000_000), uah(2_000_000)],
    ]);
    expect(v.rateText).toBe('5% от дохода');
    expect(v.running).toBe(true);
    const own = taxView(VIEW, { percent: 1, base: 'custom', amount: 2_000_000 }, FMT);
    expect(own.rows.map((r) => [r.label, r.tax])).toEqual([['Твоя сумма', uah(20_000)]]);
    expect(own.running).toBe(false);
    expect(taxView(VIEW, { percent: null, base: 'income', amount: null }, FMT).rows).toEqual([]);
    expect(taxView(VIEW, { percent: 5, base: 'custom', amount: null }, FMT).rows).toEqual([]);
    const left = taxView({ ...VIEW, yearToDate: { ...VIEW.yearToDate, leftOut: [{ currency: 985, total: 3_000 }] } }, { percent: 5, base: 'income', amount: null }, FMT);
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
  const taxes = (w: Awaited<ReturnType<typeof mountScreen>>) => w.findAll('[data-test="tax-amount"]').map((e) => e.text());
  const pick = async (w: Awaited<ReturnType<typeof mountScreen>>, group: string, label: string) => {
    const b = w.get(`[data-test="${group}"]`).findAll('button').find((x) => x.text() === label);
    if (!b) throw new Error(`no ${label}`);
    await b.trigger('click');
  };

  it('asks for the current quarter; 5% at first, then 1% and 6%; «from income»; later quarters not offered', async () => {
    const w = await mountScreen();
    expect(getFopTaxOverview.mock.calls[0]?.[0]).toEqual({ year: 2026, quarter: 4 });
    expect(taxes(w)).toEqual([uah(500_000), uah(2_000_000)]);
    expect(w.text()).toContain('5% от дохода');
    expect(w.text()).toContain('Доход, 4 квартал 2026');
    expect(w.text()).toContain('Доход с 1 января');
    await pick(w, 'rate', '1%');
    expect(taxes(w)).toEqual([uah(100_000), uah(400_000)]);
    await pick(w, 'rate', '6%');
    expect(taxes(w)).toEqual([uah(600_000), uah(2_400_000)]);

    const quarters = w.get('[data-test="quarter-picker"]').findAll('button[aria-pressed]');
    expect(quarters.map((b) => b.attributes('disabled') === undefined)).toEqual([true, true, true, true]);
    await quarters[0]!.trigger('click');
    await flushPromises();
    expect(getFopTaxOverview.mock.calls.at(-1)?.[0]).toEqual({ year: 2026, quarter: 1 });
  });

  it('a custom percent: a valid one counts, an invalid one says so and shows no tax', async () => {
    const w = await mountScreen();
    await pick(w, 'rate', 'Своя');
    const input = w.get('[data-test="custom-percent"] input');
    await input.setValue('2,5');
    expect(taxes(w)).toEqual([uah(250_000), uah(1_000_000)]);
    expect(w.text()).toContain('2,5% от дохода');
    await input.setValue('150');
    expect(taxes(w)).toEqual([]);
    expect(w.text()).toContain('Введи процент больше 0 и не больше 100');
  });

  it('a custom amount replaces the base: one row, no year to date', async () => {
    const w = await mountScreen();
    await pick(w, 'base', 'Своя сумма');
    await w.get('[data-test="custom-amount"] input').setValue('20 000');
    await pick(w, 'rate', '1%');
    expect(taxes(w)).toEqual([uah(20_000)]);
    expect(w.text()).toContain('Твоя сумма');
    expect(w.text()).not.toContain('Доход с 1 января');
  });

  it('the disclaimer and the ЄСВ note are always there; no ЄСВ amount', async () => {
    const w = await mountScreen();
    expect(w.get('[data-test="fop-disclaimer"]').text()).toBe('Это оценка, а не налоговая консультация. Проверь ставку и сумму перед оплатой.');
    expect(w.get('[data-test="fop-esv"]').text()).toBe('Единый социальный взнос (ЕСВ) не учтён.');
    expect(w.findAll('[data-test="tax-row"]')).toHaveLength(2);
  });

  it('no FOP account in the view: says so, no pickers, no figures; the notes stay', async () => {
    current = { ...VIEW, available: false, base: { ...VIEW.base, total: 0 }, yearToDate: { ...VIEW.yearToDate, total: 0 } };
    const w = await mountScreen();
    expect(w.find('[data-test="fop-unavailable"]').exists()).toBe(true);
    expect(w.find('[data-test="quarter-picker"]').exists()).toBe(false);
    expect(w.find('[data-test="tax-result"]').exists()).toBe(false);
    expect(w.find('[data-test="fop-disclaimer"]').exists()).toBe(true);
  });
});
