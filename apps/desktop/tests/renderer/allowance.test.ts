// @vitest-environment happy-dom
// «Available per day» on the planning screen (features/daily-allowance): its pure helpers and the block mounted with its
// reserves. Fictional figures only. Typechecked with the renderer (tsconfig.web.json).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { ReserveInput } from '@contract/allowance.ts';
import type { AllowanceOverview, AllowanceQuery, AllowanceReserveView } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import { allowanceView, reserveMinor, reserveRows } from '@/features/daily-allowance/utils.ts';
import { formatMoney } from '@/shared/lib';
import { VDatepicker } from '@/shared/ui';

const uah = (k: number) => formatMoney(k, 980);
const NONE = { uah: false, usd: false, eur: false };
const RATES = { list: [{ currency: 840, rate: 40 }, { currency: 978, rate: 45 }], fetchedAt: 0, saved: false };
const FMT = moneyFormat(RATES, { main: 980, also: NONE });
const EUR = moneyFormat(RATES, { main: 978, also: NONE });

const reserve = (o: Partial<AllowanceReserveView>): AllowanceReserveView => ({
  id: 1, name: 'Подушка', currency: 980, amount: 300_000, until: null, active: true, uah: 300_000, ...o,
});
const VIEW: AllowanceOverview = {
  today: '2026-10-07',
  money: 2_000_000,
  leftOut: [],
  reserves: [reserve({})],
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

  it('the sum per day until the income, the income line, every step of the count', () => {
    const v = allowanceView(VIEW, FMT, 2026);
    expect(v).toMatchObject({ amount: uah(70_000), short: false, until: 'до 17 октября · 10 дней', income: `Следующий доход: Від: Client Fictional, ≈ ${uah(8_000_000)}`, leftOut: '' });
    expect(v.lines.map((l) => [l.label, l.amount, l.strong])).toEqual([
      ['Деньги на картах', uah(2_000_000), false],
      ['Резерв: Подушка', `−${uah(300_000)}`, false],
      ['Rent, 10 октября', `−${uah(1_000_000)}`, false],
      ['Свободно', uah(700_000), true],
      ['В день, 10 дней', uah(70_000), true],
    ]);
  });

  it('a line per active reserve: an ended or empty one is not there, one without a rate says so', () => {
    const reserves = [
      reserve({ id: 1, name: 'Квартира', currency: 978, amount: 50_000, uah: null }),
      reserve({ id: 2, name: 'Відпустка', until: '2026-10-01', active: false }),
      reserve({ id: 3, name: 'Порожній', amount: 0, uah: 0 }),
    ];
    const lines = allowanceView({ ...VIEW, reserves }, FMT, 2026).lines.map((l) => [l.label, l.amount]);
    expect(lines.slice(1, 3)).toEqual([['Резерв: Квартира', 'нет курса'], ['Rent, 10 октября', `−${uah(1_000_000)}`]]);
  });

  it('late income, no income, short of money, a payment without a rate', () => {
    const late = allowanceView({ ...VIEW, income: { ...VIEW.income!, date: '2026-10-05', overdue: true }, until: '2026-11-01', days: 25 }, FMT, 2026);
    expect(late.until).toBe('до конца месяца · 25 дней');
    expect(late.income).toBe('Доход ожидался 5 октября и пока не пришёл — считаю до конца месяца');
    expect(allowanceView({ ...VIEW, income: null }, FMT, 2026).income).toBe('Регулярный доход не найден — считаю до конца месяца');

    const short = allowanceView({ ...VIEW, reserves: [], mandatory: [{ key: 'x', name: 'Codehub', uah: null, due: '2026-10-12' }], free: -50_000, perDay: 0 }, FMT, 2026);
    expect(short).toMatchObject({ amount: uah(50_000), short: true });
    expect(short.lines.map((l) => l.amount)).toEqual([uah(2_000_000), 'нет курса', `−${uah(50_000)}`, uah(0)]);
  });

  it('the reserves list: own currency, ≈ the screen\'s when it differs, the term', () => {
    const reserves = [
      reserve({ id: 1, name: 'Квартира', currency: 978, amount: 50_000, uah: 2_250_000 }),
      reserve({ id: 2, name: 'Навчання', until: '2026-12-01' }),
      reserve({ id: 3, name: 'Відпустка', until: '2026-10-01', active: false }),
    ];
    expect(reserveRows({ ...VIEW, reserves }, FMT, 2026).map((r) => [r.name, r.amount, r.approx, r.term, r.active])).toEqual([
      ['Квартира', formatMoney(50_000, 978), `≈ ${uah(2_250_000)}`, 'без срока', true],
      ['Навчання', uah(300_000), '', 'до 1 декабря включительно', true],
      ['Відпустка', uah(300_000), '', 'срок истёк 1 октября', false],
    ]);
    expect(reserveRows({ ...VIEW, reserves: reserves.slice(0, 1) }, EUR, 2026)[0]).toMatchObject({
      approx: '',
      input: { name: 'Квартира', currency: 978, amount: 50_000, until: null },
    });
  });
});

let current: AllowanceOverview = VIEW;
const getAllowanceOverview = vi.fn(async (_q: AllowanceQuery) => current);
const addReserve = vi.fn(async (_r: ReserveInput) => undefined);
const updateReserve = vi.fn(async (_id: number, _r: ReserveInput) => undefined);
const deleteReserve = vi.fn(async (_id: number) => undefined);
vi.mock('@/shared/api', () => ({
  balanceApi: {
    getAllowanceOverview: (...a: unknown[]) => getAllowanceOverview(...(a as [AllowanceQuery])),
    addReserve: (...a: unknown[]) => addReserve(...(a as [ReserveInput])),
    updateReserve: (...a: unknown[]) => updateReserve(...(a as [number, ReserveInput])),
    deleteReserve: (...a: unknown[]) => deleteReserve(...(a as [number])),
  },
}));

describe('available per day: the block mounted', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    for (const f of [getAllowanceOverview, addReserve, updateReserve, deleteReserve]) f.mockClear();
    addReserve.mockReset();
    current = VIEW;
    localStorage.clear();
    document.body.innerHTML = '';
  });

  async function mountBlock(month: 'this' | 'past' = 'this') {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { useMonthStore } = await import('@/entities/period');
    const store = useMonthStore();
    if (month === 'past') store.set('2020-01', null);
    const { AllowanceFeature } = await import('@/features/daily-allowance');
    const w = mount(AllowanceFeature, { global: { plugins: [i18n] }, attachTo: document.body });
    await flushPromises();
    return w;
  }
  const button = (w: VueWrapper, text: string) => w.findAll('button').find((b) => b.text() === text)!;

  it('the sum per day, the income, the count and the reserves, all open', async () => {
    const w = await mountBlock();
    expect(getAllowanceOverview.mock.calls[0]?.[0]).toEqual({});
    for (const s of ['Доступно в день', uah(70_000), 'Деньги на картах', 'Резервы', 'Подушка', 'без срока', 'Добавить резерв']) expect(w.text()).toContain(s);
    w.unmount();
  });

  it('another month picked on home: still shown, it is always about now', async () => {
    const w = await mountBlock('past');
    expect(w.find('section').exists()).toBe(true);
    w.unmount();
  });

  it('adding: a bad form is refused on the spot; a good one is sent in the screen\'s currency with its last day, then reloads', async () => {
    const w = await mountBlock();
    await button(w, 'Добавить резерв').trigger('click');
    const form = w.find('form');
    await form.trigger('submit');
    expect(w.text()).toContain('От 1 до 60 символов');
    expect(w.text()).toContain('Целое число от 0');
    expect(addReserve).not.toHaveBeenCalled();

    const [name, amount] = form.findAll('input[type="text"]');
    await name!.setValue('  Квартира ');
    await amount!.setValue('1 200');
    await form.find('input[type="checkbox"]').setValue(false);
    await form.trigger('submit');
    expect(w.text()).toContain('Выбери последний день или «Без срока»');
    form.findComponent(VDatepicker).vm.$emit('update:modelValue', '2026-12-01');
    await form.trigger('submit');
    await flushPromises();
    expect(addReserve).toHaveBeenCalledWith({ name: 'Квартира', currency: 980, amount: 120_000, until: '2026-12-01' });
    expect(getAllowanceOverview).toHaveBeenCalledTimes(2);
    expect(w.find('form').exists()).toBe(false);
    w.unmount();
  });

  it('a failed save keeps the form and says so', async () => {
    addReserve.mockRejectedValueOnce(new Error('boom'));
    const w = await mountBlock();
    await button(w, 'Добавить резерв').trigger('click');
    const [name, amount] = w.find('form').findAll('input[type="text"]');
    await name!.setValue('Навчання');
    await amount!.setValue('500');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(w.text()).toContain('Не удалось сохранить резерв.');
    expect(w.find('form').exists()).toBe(true);
    w.unmount();
  });

  it('the row menu: edit opens the saved reserve and sends its id; delete sends it', async () => {
    const w = await mountBlock();
    document.body.querySelector<HTMLElement>('[aria-label="Действия: Подушка"]')!.click();
    await flushPromises();
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Изменить')!.click();
    await flushPromises();
    const [name, amount] = w.find('form').findAll('input[type="text"]');
    expect((name!.element as HTMLInputElement).value).toBe('Подушка');
    expect((amount!.element as HTMLInputElement).value).toBe('3000');
    await amount!.setValue('4000');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(updateReserve).toHaveBeenCalledWith(1, { name: 'Подушка', currency: 980, amount: 400_000, until: null });

    document.body.querySelector<HTMLElement>('[aria-label="Действия: Подушка"]')!.click();
    await flushPromises();
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Удалить')!.click();
    await flushPromises();
    expect(deleteReserve).toHaveBeenCalledWith(1);
    w.unmount();
  });

  it('at the limit: no «Add», the limit said', async () => {
    current = { ...VIEW, reserves: Array.from({ length: 20 }, (_, i) => reserve({ id: i + 1, name: `R${i + 1}` })) };
    const w = await mountBlock();
    expect(w.text()).toContain('Не больше 20 резервов.');
    expect(w.findAll('button').some((b) => b.text() === 'Добавить резерв')).toBe(false);
    w.unmount();
  });
});
