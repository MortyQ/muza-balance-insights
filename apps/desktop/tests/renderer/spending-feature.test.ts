// @vitest-environment happy-dom
// The spending block mounted. Fictional fixtures only.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { PeopleView, SpendingOverview } from '@contract/api.ts';

const part = (participantId: number, net: number, purchases: number, prev: { net: number; purchases: number } | null) => ({ participantId, net, purchases, prev });

// Person 3 spent nothing this month (and something last month).
const VIEW: SpendingOverview = {
  month: '2026-09',
  period: { from: '2026-09-01', to: '2026-09-30', days: 30, incomplete: false, dataUntil: '2026-10-01', coveredDays: 30, pendingHolds: 0 },
  compare: { from: '2026-08-01', to: '2026-08-31', partial: false },
  total: { net: 50_000, purchases: 10, netPerDay: 1_667, prev: { net: 45_000, purchases: 9 } },
  people: [part(1, 30_000, 6, { net: 25_000, purchases: 5 }), part(2, 20_000, 4, { net: 15_000, purchases: 3 }), part(3, 0, 0, { net: 5_000, purchases: 1 })],
  categories: [
    {
      category: 'продукты', categoryId: 'groceries', net: 50_000, purchases: 10, prev: { net: 45_000, purchases: 9 },
      people: [part(1, 30_000, 6, { net: 25_000, purchases: 5 }), part(2, 20_000, 4, { net: 15_000, purchases: 3 }), part(3, 0, 0, { net: 5_000, purchases: 1 })],
    },
  ],
  fx: [{ currency: 840, rate: 41, prevRate: 40, nearest: false }, { currency: 978, rate: null, prevRate: null, nearest: false }],
  leftOut: [],
  familyTotal: null,
};

const getSpendingOverview = vi.fn(async () => VIEW);
vi.mock('@/shared/api', () => ({ balanceApi: { getSpendingOverview: (...a: unknown[]) => getSpendingOverview(...(a as [])) } }));

const PEOPLE: PeopleView = {
  people: [
    { id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] },
    { id: 2, label: 'Аня', labelFromBank: false, labelPending: false, color: 'orange', connections: [] },
    { id: 3, label: 'Оля', labelFromBank: false, labelPending: false, color: 'green', connections: [] },
  ],
  secureStorage: true,
};

beforeEach(() => {
  setActivePinia(createPinia());
  getSpendingOverview.mockClear();
});

async function mountBlock() {
  const { i18n } = await import('@/shared/lib/i18n.ts');
  const { useParticipantStore } = await import('@/entities/participant');
  useParticipantStore().view = PEOPLE;
  const { SpendingFeature } = await import('@/features/spending-summary');
  const w = mount(SpendingFeature, { global: { plugins: [i18n] } });
  await flushPromises();
  return w;
}

const category = (w: Awaited<ReturnType<typeof mountBlock>>) => w.findAll('button[aria-expanded]').filter((b) => b.text().includes('Продукты'));
const person = (w: Awaited<ReturnType<typeof mountBlock>>, name: string) => w.findAll('button[aria-pressed]').find((b) => b.text().includes(name))!;

describe('spending block: a pick with no spending', () => {
  it('keeps the people list and the ring; the categories column says so; another pick and «Вся семья» still work', async () => {
    const w = await mountBlock();
    await person(w, 'Оля').trigger('click');

    for (const name of ['Вся семья', 'Сергей', 'Аня', 'Оля']) expect(person(w, name).exists()).toBe(true);
    expect(person(w, 'Оля').attributes('aria-pressed')).toBe('true');
    expect(w.text()).toContain('У Оля в этом месяце нет трат');
    expect(category(w)).toHaveLength(0);
    expect(w.text()).not.toContain('Трат за этот месяц нет');

    await person(w, 'Аня').trigger('click');
    expect(person(w, 'Аня').attributes('aria-pressed')).toBe('true');
    expect(category(w)).toHaveLength(1);

    await person(w, 'Оля').trigger('click');
    await person(w, 'Вся семья').trigger('click');
    expect(person(w, 'Вся семья').attributes('aria-pressed')).toBe('true');
    expect(w.text()).not.toContain('нет трат');
    expect(category(w)).toHaveLength(1);
  });
});
