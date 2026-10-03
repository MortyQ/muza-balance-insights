// @vitest-environment happy-dom
// The spending block mounted. Fictional fixtures only.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { PeopleView, SpendingOverview, SpendingOverviewQuery } from '@contract/api.ts';
import CategoryRing from '@/features/spending-summary/components/CategoryRing.vue';
import PeopleList from '@/features/spending-summary/components/PeopleList.vue';
import { formatMoney } from '@/shared/lib';

// reka-ui's popover positioning reaches for ResizeObserver, which happy-dom does not provide.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;

const part = (participantId: number, net: number, purchases: number, prev: { net: number; purchases: number } | null) => ({ participantId, net, purchases, prev });

// Person 3 spent nothing this month (and something last month).
const VIEW: SpendingOverview = {
  month: '2026-09',
  period: { from: '2026-09-01', to: '2026-09-30', days: 30, incomplete: false, dataUntil: '2026-10-01', coveredDays: 30, pendingHolds: 0 },
  compare: { from: '2026-08-01', to: '2026-08-31', partial: false },
  total: { net: 50_000, purchases: 10, prev: { net: 45_000, purchases: 9 } },
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
  total: { net: 0, purchases: 0, prev: VIEW.total.prev },
  people: VIEW.people.map((p) => ({ ...p, net: 0, purchases: 0 })),
  categories: VIEW.categories.map((c) => ({ ...c, net: 0, purchases: 0, people: c.people.map((p) => ({ ...p, net: 0, purchases: 0 })) })),
};

let current: SpendingOverview = VIEW;
const getSpendingOverview = vi.fn(async (_q: SpendingOverviewQuery) => current);
vi.mock('@/shared/api', () => ({ balanceApi: { getSpendingOverview: (...a: unknown[]) => getSpendingOverview(...(a as [SpendingOverviewQuery])) } }));

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
  localStorage.clear();
});

async function mountBlock(attachTo?: Element) {
  const { i18n } = await import('@/shared/lib/i18n.ts');
  const { useParticipantStore } = await import('@/entities/participant');
  useParticipantStore().view = PEOPLE;
  const { SpendingFeature } = await import('@/features/spending-summary');
  const w = mount(SpendingFeature, { global: { plugins: [i18n] }, ...(attachTo ? { attachTo } : {}) });
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

  it('pending bank operations: a warning-toned note with a spinning icon', async () => {
    current = { ...VIEW, period: { ...VIEW.period, pendingHolds: 2 } };
    const w = await mountBlock();
    const note = w.findAll('p').find((p) => p.text().includes('Операций в обработке банком'));
    expect(note?.classes()).toContain('text-warning');
    expect(note?.find('svg').exists()).toBe(true);
    expect(note?.find('svg').attributes('aria-hidden')).toBe('true');
  });
});

describe('spending block: the family view', () => {
  it('requests the whole family, lists people, a pick changes the amounts, and a category expands and folds', async () => {
    const w = await mountBlock();

    expect(getSpendingOverview.mock.calls[0]?.[0]).toMatchObject({ month: expect.any(String), scope: 'personal' });
    for (const name of ['Вся семья', 'Сергей', 'Аня', 'Оля']) expect(person(w, name)?.exists()).toBe(true);

    await person(w, 'Сергей')!.trigger('click');
    const ring = w.findComponent(CategoryRing).text();
    expect(ring).toContain('Сергей');
    expect(ring).toContain(formatMoney(30_000, 980));

    const row = category(w)[0]!;
    expect(row.attributes('aria-expanded')).toBe('false');
    await row.trigger('click');
    expect(row.attributes('aria-expanded')).toBe('true');
    const panelId = row.attributes('aria-controls')!;
    const panel = w.find(`#${panelId}`);
    expect(panel.exists()).toBe(true);
    for (const name of ['Сергей', 'Аня', 'Оля']) expect(panel.text()).toContain(name);

    await row.trigger('click');
    expect(row.attributes('aria-expanded')).toBe('false');
    expect(w.find(`#${panelId}`).exists()).toBe(false);
  });
});

describe('spending block: one person picked in the global filter', () => {
  it('requests that person, hides the people list and the category expansion, and shows their family share', async () => {
    // The server already scopes the overview to the requested participant; only `total` and `familyTotal` matter here.
    current = { ...VIEW, total: { ...VIEW.total, net: 20_000, purchases: 4 }, familyTotal: 50_000 };
    const w = await mountBlock();
    const { useParticipantStore } = await import('@/entities/participant');
    useParticipantStore().select(2);
    await flushPromises();

    expect(getSpendingOverview.mock.calls.at(-1)?.[0]).toMatchObject({ participantId: 2 });
    expect(w.findComponent(PeopleList).exists()).toBe(false);
    expect(person(w, 'Вся семья')).toBeUndefined();
    expect(category(w)).toHaveLength(0);
    expect(w.text()).toContain('40% трат семьи');
    expect(w.text()).toContain(formatMoney(50_000, 980));
  });
});

describe('spending block: the settings menu', () => {
  it('shows the switches and toggling «last month\'s mark» (on by default) persists in prefs', async () => {
    const w = await mountBlock(document.body);

    const trigger = document.body.querySelector<HTMLElement>('[aria-label="Настройки блока"]');
    expect(trigger).not.toBeNull();
    trigger!.click();
    await flushPromises();

    expect(document.body.textContent).toContain('Метка прошлого месяца');
    expect(document.body.textContent).toContain('Кто сколько потратил');

    const markRow = Array.from(document.body.querySelectorAll('div')).find(
      (d) => d.textContent?.includes('Метка прошлого месяца') && d.querySelectorAll('input[type="checkbox"]').length === 1,
    );
    const checkbox = markRow?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    expect(checkbox!.checked).toBe(true);

    checkbox!.click();
    await flushPromises();

    expect(checkbox!.checked).toBe(false);
    const stored = JSON.parse(localStorage.getItem('spending.view') ?? '{}') as { mark?: boolean };
    expect(stored.mark).toBe(false);

    w.unmount();
  });
});

describe('spending block: a month change', () => {
  it('resets the in-block pick back to the whole family', async () => {
    const w = await mountBlock();
    await person(w, 'Сергей')!.trigger('click');
    expect(person(w, 'Сергей')?.attributes('aria-pressed')).toBe('true');

    const { useMonthStore } = await import('@/entities/period');
    useMonthStore().set('2026-08', null);
    await flushPromises();

    expect(person(w, 'Вся семья')?.attributes('aria-pressed')).toBe('true');
  });
});

describe('spending block: the only person in the app', () => {
  it('the bars keep the category colour (split on), no people list, no «who spent how much» switch', async () => {
    // Main sends no parts for the only person; a view that still had one is guarded in the renderer as well.
    current = { ...VIEW, people: [VIEW.people[0]!], categories: VIEW.categories.map((c) => ({ ...c, people: [c.people[0]!] })) };
    const { useParticipantStore } = await import('@/entities/participant');
    const w = await mountBlock(document.body);
    useParticipantStore().view = { ...PEOPLE, people: [PEOPLE.people[0]!] };
    await flushPromises();

    expect(w.findComponent(PeopleList).exists()).toBe(false);
    expect(category(w)).toHaveLength(0);
    const segments = w.findAll('[title]').filter((e) => (e.attributes('style') ?? '').includes('--s:'));
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) expect(seg.attributes('style')).toContain('--s: var(--category-1)');

    document.body.querySelector<HTMLElement>('[aria-label="Настройки блока"]')!.click();
    await flushPromises();
    expect(document.body.textContent).not.toContain('Кто сколько потратил');
    w.unmount();
  });
});

describe('spending block: the compared period and screen readers', () => {
  it('names the period compared with under the ring; while partial — its days, also as the tooltip of «В августе»', async () => {
    const w = await mountBlock();
    expect(w.text()).toContain('Сравнение с: Август');

    current = { ...VIEW, compare: { from: '2026-08-01', to: '2026-08-02', partial: true } };
    const { useSyncStatusStore } = await import('@/entities/sync-status');
    useSyncStatusStore().version++;
    await flushPromises();
    expect(w.text()).toContain('Сравнение с: 1–2 августа');
    expect(w.find('[title="Сравнение с: 1–2 августа"]').text()).toContain('В августе');
  });

  it('no comparison: the no-data text, no compared line', async () => {
    current = { ...VIEW, compare: null, total: { ...VIEW.total, prev: null } };
    const w = await mountBlock();
    expect(w.text()).toContain('В августе нет данных для сравнения');
    expect(w.text()).not.toContain('Сравнение с');
  });

  it('change chips and operation differences carry the direction for screen readers', async () => {
    const w = await mountBlock();
    const row = category(w)[0]!;
    const sr = row.findAll('.sr-only, .v-change-chip__sr').map((e) => e.text());
    // the amount chip (+50 ₴ against 45 000 → up) and the operations difference (+1)
    expect(sr).toEqual(['больше, чем в августе', 'больше, чем в августе']);
    expect(row.text()).toContain(`+${formatMoney(5_000, 980)}`);
    expect(person(w, 'Сергей')!.find('.v-change-chip__sr').text()).toBe('больше, чем в августе');
  });

});

describe('spending block: currencies come from the home-wide choice', () => {
  it('publishes its month\'s rates to the currency store, converts by the shared choice, the gear has no currency switches', async () => {
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    const currency = useCurrencyDisplayStore();
    currency.set('usd', true);
    const w = await mountBlock(document.body);

    expect(currency.fx).toEqual(VIEW.fx);
    expect(w.findComponent(CategoryRing).text()).toContain(`≈ ${formatMoney(Math.round(50_000 / 41), 840)}`);

    document.body.querySelector<HTMLElement>('[aria-label="Настройки блока"]')!.click();
    await flushPromises();
    expect(document.body.textContent).toContain('Метка прошлого месяца');
    expect(document.body.textContent).not.toContain('Доллары $');
    expect(document.body.textContent).not.toContain('Итоги остаются в гривне');
    w.unmount();
  });
});
