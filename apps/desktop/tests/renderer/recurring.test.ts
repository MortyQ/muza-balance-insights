// @vitest-environment happy-dom
// The regular payments screen (features/recurring-payments): its pure helpers and the screen mounted. Fictional
// fixtures only. Typechecked with the renderer (tsconfig.web.json).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { PeopleView, RecurringMarkQuery, RecurringOverview, RecurringOverviewQuery, RecurringPaymentView } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import { dayText, rowView, summaryView } from '@/features/recurring-payments/utils.ts';
import { formatMoney } from '@/shared/lib';

const uah = (k: number) => formatMoney(k, 980);
const NONE = { uah: false, usd: false, eur: false };
const RATES = { list: [{ currency: 840, rate: 40 }, { currency: 978, rate: 45 }], fetchedAt: 0, saved: false };
const FMT = moneyFormat(RATES, { main: 980, also: NONE });

const payment = (o: Partial<RecurringPaymentView>): RecurringPaymentView => ({
  key: 'k', name: 'Streamio', category: 'связь и цифровые сервисы', categoryId: 'telecom', participantId: 1,
  account: { kind: 'card', type: 'black', currency: 980, tag: null }, uah: 19_900, currency: 980, amount: 19_900, operation: null,
  payments: 4, mark: null, first: '2026-06-05', last: '2026-09-05', next: '2026-10-05', ...o,
});

const VIEW: RecurringOverview = {
  since: '2025-09-01',
  active: [
    payment({ key: 'a', name: 'Codehub', uah: 40_000, currency: 980, amount: 40_000, operation: { currency: 840, amount: 1_000 }, participantId: 2 }),
    payment({ key: 'b' }),
  ],
  ended: [payment({ key: 'c', name: 'Gym Fictional', category: 'спорт', categoryId: 'sport', last: '2026-07-04', next: '2026-08-04' })],
  hidden: [],
  monthly: 59_900,
  mandatory: 0,
  rates: RATES,
};

describe('regular payments helpers', () => {
  it('dayText: day and month, the year only outside the current one', () => {
    expect(dayText('2026-10-05', 2026)).toBe('5 октября');
    expect(dayText('2025-09-01', 2026)).toBe('1 сентября 2025');
  });

  it('summary: the monthly total, how many, since when', () => {
    expect(summaryView(VIEW, FMT, 2026)).toEqual({
      total: uah(59_900), approx: '', mandatory: '', count: '2 регулярных платежа', since: 'Найдено в выписке с 1 сентября 2025',
    });
    expect(summaryView({ ...VIEW, mandatory: 40_000 }, FMT, 2026).mandatory).toBe(`из них обязательные ${uah(40_000)}`);
  });

  it('a row: category icon and name, the person only when given, the operation currency, next or last', () => {
    const active = rowView(VIEW.active[0]!, { fmt: FMT, currentYear: 2026, active: true, person: { name: 'Аня', color: 'var(--series-orange)' } });
    expect(active).toEqual({
      key: 'a', name: 'Codehub', caption: 'Связь и цифровые сервисы · Аня', icon: 'lucide:smartphone', amount: uah(40_000),
      operation: formatMoney(1_000, 840, { minorUnits: true }), when: 'следующий 5 октября', person: { name: 'Аня', color: 'var(--series-orange)' },
      mandatory: false,
    });
    expect(rowView({ ...VIEW.active[0]!, mark: 'mandatory' }, { fmt: FMT, currentYear: 2026, active: true, person: null }).mandatory).toBe(true);
    const ended = rowView(VIEW.ended[0]!, { fmt: FMT, currentYear: 2026, active: false, person: null });
    expect(ended).toMatchObject({ caption: 'Спорт', icon: 'lucide:dumbbell', operation: '', when: 'последний 4 июля', person: null });
    // No rate: the account's own currency.
    expect(rowView(payment({ uah: null, currency: 826, amount: 1_500 }), { fmt: FMT, currentYear: 2026, active: true, person: null }).amount).toBe(formatMoney(1_500, 826));
  });
});

let current: RecurringOverview = VIEW;
const getRecurringOverview = vi.fn(async (_q: RecurringOverviewQuery) => current);
const setRecurringMark = vi.fn(async (_q: RecurringMarkQuery) => undefined);
vi.mock('@/shared/api', () => ({
  balanceApi: {
    getRecurringOverview: (...a: unknown[]) => getRecurringOverview(...(a as [RecurringOverviewQuery])),
    setRecurringMark: (...a: unknown[]) => setRecurringMark(...(a as [RecurringMarkQuery])),
  },
}));

const PEOPLE_VIEW: PeopleView = {
  people: [
    { id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] },
    { id: 2, label: 'Аня', labelFromBank: false, labelPending: false, color: 'orange', connections: [] },
  ],
  secureStorage: true,
};

describe('regular payments screen mounted', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getRecurringOverview.mockClear();
    setRecurringMark.mockReset();
    current = VIEW;
    document.body.innerHTML = '';
    localStorage.clear();
  });

  async function mountScreen() {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { useParticipantStore } = await import('@/entities/participant');
    useParticipantStore().view = PEOPLE_VIEW;
    const { RecurringFeature } = await import('@/features/recurring-payments');
    const w = mount(RecurringFeature, { global: { plugins: [i18n] }, attachTo: document.body });
    await flushPromises();
    return w;
  }

  it('the family: asks without a person; the total, the active rows with their person, the stopped ones apart', async () => {
    const w = await mountScreen();
    expect(getRecurringOverview.mock.calls[0]?.[0]).toEqual({});
    for (const s of ['Регулярные платежи', uah(59_900), 'в месяц', 'Codehub', 'Связь и цифровые сервисы · Аня', 'Прекратились', 'Gym Fictional']) {
      expect(w.text()).toContain(s);
    }
    const lists = w.findAll('ul');
    expect(lists).toHaveLength(2);
    expect(lists[0]!.findAll('li')).toHaveLength(2);
    expect(lists[1]!.findAll('li')).toHaveLength(1);
  });

  it('a person: asks for them, no person in the rows', async () => {
    const { useParticipantStore } = await import('@/entities/participant');
    const w = await mountScreen();
    useParticipantStore().select(2);
    await flushPromises();
    expect(getRecurringOverview.mock.calls.at(-1)?.[0]).toEqual({ participantId: 2 });
    expect(w.text()).not.toContain('· Аня');
  });

  it('nothing found: the empty line instead of a list', async () => {
    current = { ...VIEW, active: [], ended: [], hidden: [], monthly: 0 };
    const w = await mountScreen();
    expect(w.text()).toContain('За последние 13 месяцев регулярных платежей не найдено.');
    expect(w.findAll('ul')).toHaveLength(0);
  });

  it('the row menu marks a payment mandatory, then the screen reloads and shows the mark and the mandatory part', async () => {
    const w = await mountScreen();
    document.body.querySelector<HTMLElement>('[aria-label="Действия: Codehub"]')!.click();
    await flushPromises();
    current = { ...VIEW, active: [{ ...VIEW.active[0]!, mark: 'mandatory' }, VIEW.active[1]!], mandatory: 40_000 };
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Обязательный платёж')!.click();
    await flushPromises();
    expect(setRecurringMark).toHaveBeenCalledWith({ key: 'a', mark: 'mandatory' });
    expect(getRecurringOverview).toHaveBeenCalledTimes(2);
    expect(w.text()).toContain(`из них обязательные ${uah(40_000)}`);
    expect(w.findAll('li')[0]!.text()).toContain('обязательный');
    w.unmount();
  });

  it('«Not a regular payment» hides it; the hidden list restores it', async () => {
    current = { ...VIEW, hidden: [payment({ key: 'h', name: 'Bean Bar', mark: 'hidden' })] };
    const w = await mountScreen();
    expect(w.text()).toContain('Скрытые (1)');
    const restore = w.findAll('button').find((b) => b.text() === 'Вернуть')!;
    await restore.trigger('click');
    await flushPromises();
    expect(setRecurringMark).toHaveBeenCalledWith({ key: 'h', mark: null });

    document.body.querySelector<HTMLElement>('[aria-label="Действия: Streamio"]')!.click();
    await flushPromises();
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Не регулярный платёж')!.click();
    await flushPromises();
    expect(setRecurringMark).toHaveBeenLastCalledWith({ key: 'b', mark: 'hidden' });
    w.unmount();
  });

  it('a failed mark says so and does not reload', async () => {
    setRecurringMark.mockRejectedValueOnce(new Error('boom'));
    const w = await mountScreen();
    document.body.querySelector<HTMLElement>('[aria-label="Действия: Codehub"]')!.click();
    await flushPromises();
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Не регулярный платёж')!.click();
    await flushPromises();
    expect(w.text()).toContain('Не удалось сохранить отметку.');
    expect(getRecurringOverview).toHaveBeenCalledTimes(1);
    w.unmount();
  });
});
