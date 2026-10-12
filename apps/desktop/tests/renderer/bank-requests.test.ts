// @vitest-environment happy-dom
// Every data block follows the bank chosen in the global filters: its request carries the provider, it reloads when the
// bank changes, and what it resets for another person it resets for another bank. Typechecked with the renderer.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, ref } from 'vue';
import type { ConnectionView, PeopleView, PersonView, ProviderKey } from '@contract/api.ts';

const CHANNELS = ['getMonthOverview', 'getSpendingOverview', 'getNowOverview', 'getCategoryOverview', 'getIncomeOverview', 'getAnalyticsOverview'] as const;
type Channel = (typeof CHANNELS)[number];
// The answers never arrive: only the requests matter here.
const calls = Object.fromEntries(CHANNELS.map((c) => [c, vi.fn((_q: Record<string, unknown>) => new Promise<never>(() => undefined))])) as Record<
  Channel,
  ReturnType<typeof vi.fn<(q: Record<string, unknown>) => Promise<never>>>
>;
vi.mock('@/shared/api', () => ({ balanceApi: Object.fromEntries(CHANNELS.map((c) => [c, (q: Record<string, unknown>) => calls[c](q)])) }));

const TESTBANK = 'testbank' as ProviderKey;
const connection = (id: number, provider: ProviderKey): ConnectionView => ({
  id, provider, bank: 'Bank', accounts: 1, enabledAccounts: 1, coveredFrom: null, coveredTo: null, lastSyncAt: null,
  token: { present: true, stored: 'secure', secureStorage: true, needsReentry: false },
});
const person = (id: number, connections: ConnectionView[]): PersonView => ({ id, label: `Person ${id}`, labelFromBank: false, labelPending: false, color: null, connections });
const ONE_BANK: PeopleView = { people: [person(1, [connection(1, 'monobank')]), person(2, [connection(2, 'monobank')])], secureStorage: true };
const TWO_BANKS: PeopleView = { people: [person(1, [connection(1, 'monobank'), connection(2, TESTBANK)]), person(2, [connection(3, 'monobank')])], secureStorage: true };

/** Runs a composable inside a component (stores, watchers and their cleanup work as on a screen). */
async function host<T>(view: PeopleView, use: () => T | Promise<T>): Promise<{ result: T; participant: Awaited<ReturnType<typeof participantStore>> }> {
  setActivePinia(createPinia());
  const participant = await participantStore();
  participant.view = view;
  let result!: T;
  const pending: Array<Promise<void>> = [];
  mount(
    defineComponent({
      setup() {
        const r = use();
        if (r instanceof Promise) pending.push(r.then((v) => void (result = v)));
        else result = r;
        return () => null;
      },
    }),
  );
  await Promise.all(pending);
  await flushPromises();
  return { result, participant };
}
async function participantStore() {
  return (await import('@/entities/participant')).useParticipantStore();
}

const REQUESTS: Array<[Channel, () => Promise<() => unknown>]> = [
  ['getMonthOverview', async () => (await import('@/features/balances/composables/useMonthOverview.ts')).useMonthOverview],
  ['getSpendingOverview', async () => (await import('@/features/spending-summary/composables/useSpending.ts')).useSpending],
  ['getNowOverview', async () => (await import('@/features/now-strip/composables/useNowStrip.ts')).useNowStrip],
  [
    'getCategoryOverview',
    async () => {
      const { useCategoryDetail } = await import('@/features/category-detail/composables/useCategoryDetail.ts');
      return () => useCategoryDetail('groceries', 'personal');
    },
  ],
  ['getIncomeOverview', async () => (await import('@/features/income-detail/composables/useIncomeDetail.ts')).useIncomeDetail],
  ['getAnalyticsOverview', async () => (await import('@/features/analytics-overview/composables/useAnalytics.ts')).useAnalytics],
];

beforeEach(() => {
  localStorage.clear();
  for (const c of CHANNELS) calls[c].mockClear();
});

describe('the data requests follow the chosen bank', () => {
  it.each(REQUESTS)('%s: no provider until a bank is chosen, then the chosen one, then none again', async (channel, load) => {
    const use = await load();
    const { participant } = await host(TWO_BANKS, use);
    expect(calls[channel]).toHaveBeenCalledTimes(1);
    expect('provider' in calls[channel].mock.lastCall![0]).toBe(false);

    participant.selectProvider(TESTBANK);
    await flushPromises();
    expect(calls[channel]).toHaveBeenCalledTimes(2);
    expect(calls[channel].mock.lastCall![0]).toMatchObject({ provider: TESTBANK });

    participant.selectProvider(null);
    await flushPromises();
    expect(calls[channel]).toHaveBeenCalledTimes(3);
    expect('provider' in calls[channel].mock.lastCall![0]).toBe(false);
  });

  it.each(REQUESTS)('%s: one bank — the request never names it', async (channel, load) => {
    const use = await load();
    const { participant } = await host(ONE_BANK, use);
    participant.selectProvider('monobank');
    await flushPromises();
    expect(calls[channel]).toHaveBeenCalledTimes(1);
    expect('provider' in calls[channel].mock.lastCall![0]).toBe(false);
  });

  it('the bank goes with the person, not instead of them', async () => {
    const { useNowStrip } = await import('@/features/now-strip/composables/useNowStrip.ts');
    const { participant } = await host(TWO_BANKS, useNowStrip);
    participant.select(1);
    participant.selectProvider(TESTBANK);
    await flushPromises();
    expect(calls.getNowOverview.mock.lastCall![0]).toEqual({ participantId: 1, provider: TESTBANK });
  });
});

describe('another bank is another view: the blocks start over as for another person', () => {
  it('the card stack goes back to its first card', async () => {
    const { useCardStack } = await import('@/features/balances/composables/useCardStack.ts');
    const { result: stack, participant } = await host(TWO_BANKS, () => useCardStack(ref(9)));
    stack.toggle();
    stack.next();
    expect(stack.offset.value).toBeGreaterThan(0);
    participant.selectProvider(TESTBANK);
    await flushPromises();
    expect(stack.offset.value).toBe(0);
  });

  it('the spending block drops its own pick', async () => {
    const { useSpending } = await import('@/features/spending-summary/composables/useSpending.ts');
    const { result: spending, participant } = await host(TWO_BANKS, useSpending);
    spending.pick.value = 2;
    participant.selectProvider(TESTBANK);
    await flushPromises();
    expect(spending.pick.value).toBeNull();
  });

  it('the category list drops its search and merchant filter', async () => {
    const { useCategoryDetail } = await import('@/features/category-detail/composables/useCategoryDetail.ts');
    const { useCategoryView } = await import('@/features/category-detail/composables/useCategoryView.ts');
    const { result: view, participant } = await host(TWO_BANKS, () => useCategoryView(useCategoryDetail('groceries', 'personal'), ref('personal')));
    view.query.value = 'x';
    view.merchant.value = 'Shop';
    participant.selectProvider(TESTBANK);
    await flushPromises();
    expect([view.query.value, view.merchant.value]).toEqual(['', null]);
  });

  it('the income list drops its search and sender filter', async () => {
    const { useIncomeDetail } = await import('@/features/income-detail/composables/useIncomeDetail.ts');
    const { useIncomeView } = await import('@/features/income-detail/composables/useIncomeView.ts');
    const { result: view, participant } = await host(TWO_BANKS, () => useIncomeView(useIncomeDetail()));
    view.query.value = 'x';
    participant.selectProvider(TESTBANK);
    await flushPromises();
    expect(view.query.value).toBe('');
  });
});
