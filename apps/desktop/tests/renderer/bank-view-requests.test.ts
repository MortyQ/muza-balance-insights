// @vitest-environment happy-dom
// Every data screen follows the bank filter (spec desktop-bank-filter): with every bank on it asks exactly as before
// (no `providers`), a subset goes with the request, a change of banks reloads, and a people refresh that keeps the same
// banks does not. balanceApi is a fake that records the queries; fictional data.
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, isProxy } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionView, PeopleView, ProviderId } from '@contract/api.ts';

const calls = vi.hoisted(() => new Map<string, unknown[]>());
vi.mock('@/shared/api', () => ({
  balanceApi: new Proxy(
    {},
    {
      get: (_t, method: string) => async (q: unknown) => {
        calls.set(method, [...(calls.get(method) ?? []), q]);
        // Just enough of every answer for the screens' eager computeds.
        return method === 'getAllowanceOverview'
          ? { perDay: null, rates: null, reserves: [] }
          : { rates: null, people: [], accounts: [], categories: [], buckets: [], income: [], spending: [], active: [], ended: [], hidden: [] };
      },
    },
  ),
}));

const { useParticipantStore } = await import('@/entities/participant');
const { i18n } = await import('@/shared/lib/i18n.ts');

const conn = (id: number, provider: ProviderId): ConnectionView => ({
  id, provider, method: 'file', bank: provider, accounts: 1, enabledAccounts: 1, coveredFrom: '2026-01-01', coveredTo: '2026-03-01', lastSyncAt: null, token: null,
});
const PEOPLE = (): PeopleView => ({
  people: [{ id: 1, label: 'Fictional', labelFromBank: false, labelPending: false, color: null, connections: [conn(1, 'monobank'), conn(2, 'privatbank')] }],
  secureStorage: true,
});

const SCREENS: Array<[string, string, () => Promise<() => unknown>]> = [
  ['balances', 'getMonthOverview', async () => (await import('@/features/balances/composables/useMonthOverview.ts')).useMonthOverview],
  ['month pace', 'getAnalyticsOverview', async () => (await import('@/features/balances/composables/useMonthPace.ts')).useMonthPace],
  ['«Now»', 'getNowOverview', async () => (await import('@/features/now-strip/composables/useNowStrip.ts')).useNowStrip],
  ['spending', 'getSpendingOverview', async () => (await import('@/features/spending-summary/composables/useSpending.ts')).useSpending],
  ['analytics', 'getAnalyticsOverview', async () => (await import('@/features/analytics-overview/composables/useAnalytics.ts')).useAnalytics],
  [
    'category',
    'getCategoryOverview',
    async () => {
      const { useCategoryDetail } = await import('@/features/category-detail/composables/useCategoryDetail.ts');
      return () => useCategoryDetail('groceries', 'personal', { kind: 'month', month: '2026-03' });
    },
  ],
  [
    'income',
    'getIncomeOverview',
    async () => {
      const { useIncomeDetail } = await import('@/features/income-detail/composables/useIncomeDetail.ts');
      return () => useIncomeDetail({ kind: 'month', month: '2026-03' });
    },
  ],
  ['regular payments', 'getRecurringOverview', async () => (await import('@/features/recurring-payments/composables/useRecurring.ts')).useRecurring],
  ['the regular payments teaser', 'getRecurringOverview', async () => (await import('@/features/recurring-payments/composables/useRecurringTeaser.ts')).useRecurringTeaser],
  ['planning', 'getAllowanceOverview', async () => (await import('@/features/daily-allowance/composables/useAllowance.ts')).useAllowance],
];

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  calls.clear();
});

describe('data screens and the bank filter', () => {
  it.each(SCREENS)('%s: every bank — no providers; a subset — sent; a change reloads; the same banks after a refresh do not', async (_name, method, load) => {
    const use = await load();
    const participant = useParticipantStore();
    participant.view = PEOPLE();
    const w = mount(defineComponent({ setup: () => (use(), () => h('div')) }), { global: { plugins: [i18n] } });
    await flushPromises();
    const asked = () => (calls.get(method) ?? []) as Array<Record<string, unknown>>;
    expect(asked().length).toBeGreaterThan(0);
    expect(asked().every((q) => !('providers' in q))).toBe(true);

    participant.selectBanks(['privatbank']);
    await flushPromises();
    expect(asked().at(-1)).toMatchObject({ providers: ['privatbank'] });
    // A plain array, not a store proxy: it has to cross IPC.
    expect(isProxy(asked().at(-1)!.providers)).toBe(false);

    const n = asked().length;
    participant.view = PEOPLE();
    await flushPromises();
    expect(asked().length).toBe(n);

    participant.selectBanks(['monobank', 'privatbank']);
    await flushPromises();
    expect(asked().length).toBe(n + 1);
    expect('providers' in asked().at(-1)!).toBe(false);
    w.unmount();
  });
});
