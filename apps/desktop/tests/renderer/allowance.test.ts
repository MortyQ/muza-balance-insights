// @vitest-environment happy-dom
// «Available per day» on home (features/daily-allowance): its pure helpers and the block mounted. Fictional figures
// only. Typechecked with the renderer (tsconfig.web.json).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { AllowanceReserve } from '@contract/allowance.ts';
import type { AllowanceOverview, AllowanceQuery } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import { allowanceView, reserveField, reserveMinor } from '@/features/daily-allowance/utils.ts';
import { formatMoney } from '@/shared/lib';

const uah = (k: number) => formatMoney(k, 980);
const NONE = { uah: false, usd: false, eur: false };
const RATES = { list: [{ currency: 840, rate: 40 }, { currency: 978, rate: 45 }], fetchedAt: 0, saved: false };
const FMT = moneyFormat(RATES, { main: 980, also: NONE });
const EUR = moneyFormat(RATES, { main: 978, also: NONE });

const VIEW: AllowanceOverview = {
  today: '2026-10-07',
  money: 2_000_000,
  leftOut: [],
  reserve: { currency: 980, amount: 300_000, uah: 300_000 },
  mandatory: [{ key: 'rent', name: 'Rent', uah: 1_000_000, due: '2026-10-10' }],
  income: { key: 'pay', name: 'Від: Client Fictional', uah: 8_000_000, date: '2026-10-17', overdue: false },
  until: '2026-10-17',
  days: 10,
  free: 700_000,
  perDay: 70_000,
  rates: RATES,
};

describe('available per day: helpers', () => {
  it('reserveMinor: whole units from 0 up to the limit, spaces allowed', () => {
    expect(reserveMinor('5 000', 10_000_000)).toBe(500_000);
    expect(reserveMinor('0', 100)).toBe(0);
    for (const bad of ['', '-5', '1.5', '1,5', 'abc']) expect(reserveMinor(bad, 10_000_000)).toBeNull();
    expect(reserveMinor('2', 100)).toBeNull();
  });

  it('reserveField: as saved in the screen\'s currency, else converted at today\'s rate; no rate — its own currency', () => {
    expect(reserveField({ currency: 978, amount: 50_000, uah: 2_250_000 }, EUR)).toEqual({ currency: 978, units: 500 });
    expect(reserveField({ currency: 980, amount: 2_250_000, uah: 2_250_000 }, EUR)).toEqual({ currency: 978, units: 500 });
    expect(reserveField({ currency: 978, amount: 50_000, uah: 2_250_000 }, FMT)).toEqual({ currency: 980, units: 22_500 });
    expect(reserveField({ currency: 978, amount: 50_000, uah: null }, moneyFormat(null, { main: 980, also: NONE }))).toEqual({ currency: 978, units: 500 });
  });

  it('the sum per day until the income, the income line, every step of the count', () => {
    const v = allowanceView(VIEW, FMT, 2026);
    expect(v).toMatchObject({ amount: uah(70_000), short: false, until: 'до 17 октября · 10 дней', income: `Следующий доход: Від: Client Fictional, ≈ ${uah(8_000_000)}`, leftOut: '' });
    expect(v.lines.map((l) => [l.label, l.amount, l.strong])).toEqual([
      ['Деньги на картах', uah(2_000_000), false],
      ['Резерв', `−${uah(300_000)}`, false],
      ['Rent, 10 октября', `−${uah(1_000_000)}`, false],
      ['Свободно', uah(700_000), true],
      ['В день, 10 дней', uah(70_000), true],
    ]);
  });

  it('late income, no income, short of money, a payment without a rate, no reserve, a reserve without a rate', () => {
    const late = allowanceView({ ...VIEW, income: { ...VIEW.income!, date: '2026-10-05', overdue: true }, until: '2026-11-01', days: 25 }, FMT, 2026);
    expect(late.until).toBe('до конца месяца · 25 дней');
    expect(late.income).toBe('Доход ожидался 5 октября и пока не пришёл — считаю до конца месяца');
    expect(allowanceView({ ...VIEW, income: null }, FMT, 2026).income).toBe('Регулярный доход не найден — считаю до конца месяца');

    const short = allowanceView({ ...VIEW, reserve: { currency: 980, amount: 0, uah: 0 }, mandatory: [{ key: 'x', name: 'Codehub', uah: null, due: '2026-10-12' }], free: -50_000, perDay: 0 }, FMT, 2026);
    expect(short).toMatchObject({ amount: uah(50_000), short: true });
    expect(short.lines.map((l) => l.amount)).toEqual([uah(2_000_000), 'нет курса', `−${uah(50_000)}`, uah(0)]);

    const noRate = allowanceView({ ...VIEW, reserve: { currency: 978, amount: 50_000, uah: null } }, FMT, 2026);
    expect(noRate.lines[1]).toEqual({ label: 'Резерв', amount: 'нет курса', strong: false });
  });
});

let current: AllowanceOverview = VIEW;
const getAllowanceOverview = vi.fn(async (_q: AllowanceQuery) => current);
const setAllowanceReserve = vi.fn(async (r: AllowanceReserve) => r);
vi.mock('@/shared/api', () => ({
  balanceApi: {
    getAllowanceOverview: (...a: unknown[]) => getAllowanceOverview(...(a as [AllowanceQuery])),
    setAllowanceReserve: (...a: unknown[]) => setAllowanceReserve(...(a as [AllowanceReserve])),
  },
}));

describe('available per day: the block mounted', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getAllowanceOverview.mockClear();
    setAllowanceReserve.mockReset();
    setAllowanceReserve.mockImplementation(async (r: AllowanceReserve) => r);
    current = VIEW;
    localStorage.clear();
  });

  async function mountBlock(month: 'this' | 'past' = 'this') {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { useMonthStore } = await import('@/entities/period');
    const store = useMonthStore();
    if (month === 'past') store.set('2020-01', null);
    const { AllowanceFeature } = await import('@/features/daily-allowance');
    const w = mount(AllowanceFeature, { global: { plugins: [i18n] } });
    await flushPromises();
    return w;
  }

  it('the sum per day, the income, the count and the reserve field, all open', async () => {
    const w = await mountBlock();
    expect(getAllowanceOverview.mock.calls[0]?.[0]).toEqual({});
    expect(w.text()).toContain('Доступно в день');
    expect(w.text()).toContain(uah(70_000));
    expect(w.text()).toContain('Деньги на картах');
    expect((w.find('input').element as HTMLInputElement).value).toBe('3000');
  });

  it('another month picked on home: still shown, it is always about now', async () => {
    const w = await mountBlock('past');
    expect(w.find('section').exists()).toBe(true);
  });

  it('saving the reserve sends kopecks and reloads; a bad value is refused on the spot; a failed save says so', async () => {
    const w = await mountBlock();
    const input = w.find('input');

    await input.setValue('5 000');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(setAllowanceReserve).toHaveBeenCalledWith({ currency: 980, amount: 500_000 });
    expect(getAllowanceOverview).toHaveBeenCalledTimes(2);

    await input.setValue('-1');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(setAllowanceReserve).toHaveBeenCalledTimes(1);
    expect(w.text()).toContain('Целое число от 0');

    setAllowanceReserve.mockRejectedValueOnce(new Error('boom'));
    await input.setValue('100');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(w.text()).toContain('Не удалось сохранить резерв.');
  });
});
