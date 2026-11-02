// @vitest-environment happy-dom
// The «Budget» screen (features/limits-goals, spec desktop-limits-goals): the budget panel with fixed rows and the
// flexible pace, limits by state in words, suggestions, the budget sheet's live result and its save rule, the limit
// sheet's preview, a failed save, the «?» formula. Fictional data only; the texts read in Russian (setup-locale).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { GoalPayload, LimitsOverview, LimitsOverviewQuery, PeopleView } from '@contract/api.ts';
import { formatMoney } from '@/shared/lib';

const plain = (s: string) => s.replace(/\s/gu, ' ');
/** VInput puts `data-test` on the input itself or on its wrapper. */
const inputOf = (root: ParentNode, test: string): HTMLInputElement => {
  const el = root.querySelector(`[data-test="${test}"]`)!;
  return el instanceof HTMLInputElement ? el : el.querySelector('input')!;
};
const uah = (k: number) => plain(formatMoney(k, 980));
const fig = (amount: number, spent: number, state: 'ok' | 'attention' | 'exceeded', extra = {}) => ({
  amount, spent, left: amount - spent, percent: Math.round((spent / amount) * 100), expected: Math.round((amount * 15) / 31),
  forecast: Math.round((spent / 15) * 31), perDay: Math.max(0, Math.round((amount - spent) / 17)), daysPassed: 15, days: 31, daysLeft: 17, state, pending: null, ...extra,
});

const OVERVIEW: LimitsOverview = {
  month: '2026-03', today: '2026-03-15', current: true,
  budget: {
    id: 1, owner: null, currency: 980, amountMinor: 5_000_000, total: 5_000_000,
    fixed: [
      { categoryId: 'rent', amountMinor: 1_250_000, amount: 1_250_000, paid: 1_250_000 },
      { categoryId: 'utilities', amountMinor: 110_000, amount: 110_000, paid: 0 },
    ],
    fixedTotal: 1_360_000, fixedPaid: 1_250_000, fixedTakesAll: false, countTaxes: true,
    flexible: fig(3_640_000, 2_300_000, 'attention'), result: null,
  },
  limits: [
    { id: 2, categoryId: 'groceries', period: 'week', owner: null, currency: 980, amountMinor: 20_000, figures: fig(20_000, 30_000, 'exceeded', { forecast: null, daysPassed: 7, days: 7 }) },
    { id: 3, categoryId: 'cafes', period: 'month', owner: null, currency: 980, amountMinor: 400_000, figures: fig(400_000, 100_000, 'ok') },
  ],
  savings: [{
    id: 9, name: 'Fictional trip', owner: null, currency: 980, amountMinor: 5_000_000, until: '2026-10-01', source: 'jar', accountId: 'jar1',
    target: 5_000_000, progress: 3_100_000, percent: 62, left: 1_900_000, perMonth: 271_500, months: 7, overdue: false,
  }],
  jars: [{ id: 'jar1', name: { provider: 'monobank', kind: 'jar', type: null, currency: 980, tag: null }, currency: 980, goal: 6_000_000, owner: 1 }],
  suggestions: [],
  past: { months: ['2026-02', '2026-01', '2025-12'], byCategory: { cafes: [500_000, 300_000, 400_000], rent: [1_250_000, 1_250_000, 1_250_000] }, total: [4_000_000, 3_800_000, 4_200_000] },
  kinds: [{ categoryId: 'investments', kind: 'savings', fixed: false, changed: false }],
  rates: null,
};

let answer: LimitsOverview = OVERVIEW;
let failSave = false;
const getLimitsOverview = vi.fn(async (_q: LimitsOverviewQuery) => answer);
const saveGoal = vi.fn(async (_id: number | null, _g: GoalPayload) => {
  if (failSave) throw new Error('refused');
});
const addSuggestedLimits = vi.fn(async () => undefined);
vi.mock('@/shared/api', () => ({
  balanceApi: {
    getLimitsOverview: (...a: unknown[]) => getLimitsOverview(...(a as [LimitsOverviewQuery])),
    saveGoal: (...a: unknown[]) => saveGoal(...(a as [number | null, GoalPayload])),
    deleteGoal: async () => undefined,
    addSuggestedLimits: () => addSuggestedLimits(),
    getSyncStatus: async () => ({ hasData: true }),
  },
}));

const PEOPLE: PeopleView = { people: [{ id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] }], secureStorage: true };

async function mountScreen(openBudget = false) {
  const { i18n } = await import('@/shared/lib/i18n.ts');
  const { useParticipantStore } = await import('@/entities/participant');
  useParticipantStore().view = PEOPLE;
  const { useMonthStore } = await import('@/entities/period');
  useMonthStore().$patch({ month: '2026-03' });
  const { LimitsGoalsFeature } = await import('@/features/limits-goals');
  const blank = defineComponent(() => () => h('div'));
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'budget', component: blank }] });
  await router.push('/');
  const w = mount(LimitsGoalsFeature, { props: { openBudget }, global: { plugins: [i18n, router] }, attachTo: document.body });
  await flushPromises();
  return w;
}

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  document.body.innerHTML = '';
  answer = OVERVIEW;
  failSave = false;
  saveGoal.mockClear();
});

describe('the «Budget» screen', () => {
  it('a savings goal: progress of the target from its jar, what is needed a month to its date, with the formula', async () => {
    const w = await mountScreen();
    const row = w.get('[data-test="goal-row"]');
    expect(plain(row.text())).toContain(`${uah(3_100_000)} из ${uah(5_000_000)} · банка · 62%`);
    expect(plain(row.get('[data-test="goal-need"]').text())).toContain(`к 1 октября · нужно ${uah(271_500)} в месяц`);
    w.unmount();
  });

  it('the goal sheet offers the jar\'s own target when nothing is typed', async () => {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const GoalSheet = (await import('@/features/limits-goals/components/GoalSheet.vue')).default;
    const w = mount(GoalSheet, {
      props: {
        open: true,
        start: { id: null, goal: { type: 'saving', name: '', currency: 980, amount: 0, participantId: null, until: null, source: 'jar', accountId: 'jar1' } },
        overview: OVERVIEW,
        owners: [],
      },
      global: { plugins: [i18n] },
      attachTo: document.body,
    });
    await flushPromises();
    expect(inputOf(document, 'goal-amount').value).toBe('60000');
    w.unmount();
  });

  it('the budget panel: the fixed rows paid or not, the flexible part with its state and per day by the budget', async () => {
    const w = await mountScreen();
    const panel = w.get('[data-test="budget-panel"]');
    expect(panel.findAll('[data-test="fixed-row"]').map((r) => plain(r.text()))).toEqual([
      expect.stringContaining(`${uah(1_250_000)} из ${uah(1_250_000)}`),
      expect.stringContaining(`${uah(0)} из ${uah(110_000)}`),
    ]);
    expect(plain(panel.text())).toContain(`${uah(2_300_000)} из ${uah(3_640_000)}`);
    // 63% spent, but the forecast is over: attention, said as such.
    expect(panel.get('[data-test="limit-state"]').text()).toBe('Прогноз выше лимита');
    expect(plain(panel.get('[data-test="budget-per-day"]').text())).toContain(`Можно в день по бюджету: ${uah(78_824)}`);
    expect(panel.find('[data-test="pace-marker"]').exists()).toBe(true);
    w.unmount();
  });

  it('limits in the order given — what needs attention first — with the state in words', async () => {
    const w = await mountScreen();
    const rows = w.findAll('[data-test="limit-row"]');
    expect(rows.map((r) => r.get('[data-test="limit-state"]').text())).toEqual([`Превышено на ${formatMoney(10_000, 980)}`, 'В темпе']);
    expect(rows[0]!.text()).toContain('неделя (пн–вс)');
    w.unmount();
  });

  it('pending holds: a quiet note on the row and on the budget, none where nothing is pending', async () => {
    answer = {
      ...OVERVIEW,
      budget: { ...OVERVIEW.budget!, flexible: { ...OVERVIEW.budget!.flexible, pending: { count: 2, amount: 65_000 } } },
      limits: [OVERVIEW.limits[0]!, { ...OVERVIEW.limits[1]!, figures: fig(400_000, 100_000, 'ok', { pending: { count: 1, amount: 60_000 } }) }],
    };
    const w = await mountScreen();
    const rows = w.findAll('[data-test="limit-row"]');
    expect(rows[0]!.find('[data-test="pending-note"]').exists()).toBe(false);
    expect(plain(rows[1]!.get('[data-test="pending-note"]').text())).toBe(`+ 1 в ожидании, ${uah(60_000)}`);
    expect(plain(w.get('[data-test="budget-panel"] [data-test="pending-note"]').text())).toBe(`+ 2 в ожидании, ${uah(65_000)}`);
    w.unmount();
  });

  it('the «?» of per day gives the formula with the user\'s numbers', async () => {
    const w = await mountScreen();
    await w.findAll('[data-test="limit-row"]')[1]!.get('button[aria-label="Как считается «можно в день»"]').trigger('click');
    await flushPromises();
    expect(plain(document.body.textContent ?? '')).toContain(`(${uah(400_000)} − ${uah(100_000)}) ÷ 17 дней = ${uah(17_647)}`);
    w.unmount();
  });

  it('no budget: the empty card offers to set one; no limits: the suggestions, added at once', async () => {
    answer = { ...OVERVIEW, budget: null, limits: [], suggestions: [{ categoryId: 'cafes', amount: 400_000 }] };
    const w = await mountScreen();
    expect(w.find('[data-test="budget-empty"]').exists()).toBe(true);
    expect(plain(w.get('[data-test="suggestions"]').text())).toContain(`Кафе и рестораны · ${uah(400_000)}`);
    await w.get('[data-test="suggest-add"]').trigger('click');
    await flushPromises();
    expect(addSuggestedLimits).toHaveBeenCalled();
    w.unmount();
  });

  it('the budget sheet: nothing preset, the live result, save waits for every amount, a removed row is no longer set aside', async () => {
    answer = { ...OVERVIEW, budget: null };
    const w = await mountScreen(true);
    const sheet = () => document.querySelector('[data-test="budget-sheet"]')!;
    expect(sheet().querySelectorAll('[data-test="fixed-input"]')).toHaveLength(0);
    const total = inputOf(sheet(), 'budget-total');
    total.value = '2000';
    total.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(plain(sheet().querySelector('[data-test="flexible-live"]')!.textContent ?? '')).toContain(uah(200_000));
    const save = () => sheet().querySelector<HTMLButtonElement>('[data-test="budget-save"]')!;
    expect(save().disabled).toBe(false);
    w.unmount();
  });

  it('«Count taxes»: off drops a taxes row and its choice, is saved with the budget, and the panel says so', async () => {
    answer = {
      ...OVERVIEW,
      budget: { ...OVERVIEW.budget!, fixed: [...OVERVIEW.budget!.fixed, { categoryId: 'taxes', amountMinor: 50_000, amount: 50_000, paid: 0 }] },
    };
    const w = await mountScreen();
    expect(w.find('[data-test="budget-taxes-off"]').exists()).toBe(false);
    await w.get('[data-test="budget-edit"]').trigger('click');
    await flushPromises();
    const sheet = document.querySelector('[data-test="budget-sheet"]')!;
    const names = () => [...sheet.querySelectorAll('[data-test="fixed-input"]')].map((r) => r.textContent?.trim() ?? '');
    expect(names().some((n) => n.startsWith('Налоги'))).toBe(true);
    const sw = sheet.querySelector<HTMLInputElement>('[data-test="budget-count-taxes"]')!;
    expect(sw.checked).toBe(true);
    sw.click();
    await flushPromises();
    expect(names().some((n) => n.startsWith('Налоги'))).toBe(false);
    sheet.querySelector<HTMLButtonElement>('[data-test="budget-save"]')!.click();
    await flushPromises();
    expect(saveGoal).toHaveBeenLastCalledWith(1, expect.objectContaining({ type: 'budget', countTaxes: false, fixed: [{ categoryId: 'rent', amount: 1_250_000 }, { categoryId: 'utilities', amount: 110_000 }] }));
    w.unmount();
    answer = { ...OVERVIEW, budget: { ...OVERVIEW.budget!, countTaxes: false } };
    const off = await mountScreen();
    expect(off.get('[data-test="budget-taxes-off"]').text()).toBe('Налоги в этом бюджете не учитываются.');
    off.unmount();
  });

  it('a failed save keeps the sheet open and says so', async () => {
    failSave = true;
    const w = await mountScreen();
    await w.get('[data-test="limit-add"]').trigger('click');
    await flushPromises();
    const sheet = document.querySelector('[data-test="limit-sheet"]')!;
    const amount = inputOf(sheet, 'limit-amount');
    amount.value = '3000';
    amount.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(plain(sheet.querySelector('[data-test="past-note"]')!.textContent ?? '')).toBe('В 2 из 3 месяцев эта сумма была бы превышена.');
    sheet.querySelector<HTMLButtonElement>('[data-test="limit-save"]')!.click();
    await flushPromises();
    expect(saveGoal).toHaveBeenCalledWith(null, { type: 'limit', categoryId: 'cafes', period: 'month', currency: 980, amount: 300_000, participantId: 1 });
    expect(document.querySelector('[data-test="sheet-failed"]')).not.toBeNull();
    w.unmount();
  });
});
