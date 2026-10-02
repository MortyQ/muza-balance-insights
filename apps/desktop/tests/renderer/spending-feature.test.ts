// @vitest-environment happy-dom
// The spending block mounted. Fictional fixtures only.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { PeopleView, SpendingOverview } from '@contract/api.ts';
import CategoryRing from '@/features/spending-summary/components/CategoryRing.vue';
import { formatMoney } from '@/shared/lib';

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

// The family view with nothing spent this month.
const EMPTY: SpendingOverview = {
  ...VIEW,
  total: { net: 0, purchases: 0, netPerDay: 0, prev: VIEW.total.prev },
  people: VIEW.people.map((p) => ({ ...p, net: 0, purchases: 0 })),
  categories: VIEW.categories.map((c) => ({ ...c, net: 0, purchases: 0, people: c.people.map((p) => ({ ...p, net: 0, purchases: 0 })) })),
};

let current: SpendingOverview = VIEW;
const getSpendingOverview = vi.fn(async () => current);
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
  current = VIEW;
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
const person = (w: Awaited<ReturnType<typeof mountBlock>>, name: string) => w.findAll('button[aria-pressed]').find((b) => b.text().includes(name));

describe('spending block: a pick with no spending', () => {
  it('keeps the people list and the ring; the categories column says so; another pick and «Вся семья» still work', async () => {
    const w = await mountBlock();
    await person(w, 'Оля')!.trigger('click');

    for (const name of ['Вся семья', 'Сергей', 'Аня', 'Оля']) expect(person(w, name)?.exists()).toBe(true);
    expect(person(w, 'Оля')?.attributes('aria-pressed')).toBe('true');
    expect(w.text()).toContain('Оля: в этом месяце трат нет');
    const ring = w.findComponent(CategoryRing).text();
    expect(ring).toContain('Оля');
    expect(ring).toContain(formatMoney(0, 980));
    expect(ring).toContain('на 100% меньше, чем в августе');
    expect(category(w)).toHaveLength(0);
    expect(w.text()).not.toContain('Трат за этот месяц нет');

    await person(w, 'Аня')!.trigger('click');
    expect(person(w, 'Аня')?.attributes('aria-pressed')).toBe('true');
    expect(category(w)).toHaveLength(1);

    await person(w, 'Оля')!.trigger('click');
    await person(w, 'Вся семья')!.trigger('click');
    expect(person(w, 'Вся семья')?.attributes('aria-pressed')).toBe('true');
    expect(w.text()).not.toContain('трат нет');
    expect(category(w)).toHaveLength(1);
  });
});

describe('spending block: edge cases', () => {
  it('a picked person removed while the block is open: the block falls back to the whole family', async () => {
    const w = await mountBlock();
    await person(w, 'Оля')!.trigger('click');
    const { useParticipantStore } = await import('@/entities/participant');
    useParticipantStore().view = { ...PEOPLE, people: PEOPLE.people.filter((p) => p.id !== 3) };
    await flushPromises();

    expect(person(w, 'Оля')).toBeUndefined();
    expect(person(w, 'Вся семья')?.attributes('aria-pressed')).toBe('true');
    expect(w.text()).not.toContain('трат нет');
    expect(w.findComponent(CategoryRing).text()).toContain('Вся семья');
    expect(category(w)).toHaveLength(1);
  });

  it('the family view itself is empty: the month\'s empty text, no people list', async () => {
    current = EMPTY;
    const w = await mountBlock();
    expect(w.text()).toContain('Трат за этот месяц нет.');
    expect(person(w, 'Вся семья')).toBeUndefined();
    expect(w.findComponent(CategoryRing).exists()).toBe(false);
  });
});
