// @vitest-environment happy-dom
// The bank (provider) choice: the participant store's part, the select in the global filters, the refresh popover.
// A second bank exists only in these fixtures, as a cast. Typechecked with the renderer (tsconfig.web.json).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { ConnectionView, PeopleView, PersonView, ProviderKey } from '@contract/api.ts';

vi.mock('@/shared/api', () => ({ balanceApi: {} }));

const TESTBANK = 'testbank' as ProviderKey;
const KEY = 'balance.provider';

const connection = (id: number, provider: ProviderKey, lastSyncAt: string | null = null): ConnectionView => ({
  id, provider, bank: provider === 'monobank' ? 'Monobank' : 'Test Bank', accounts: 1, enabledAccounts: 1, coveredFrom: null, coveredTo: null, lastSyncAt,
  token: { present: true, stored: 'secure', secureStorage: true, needsReentry: false },
});
const person = (id: number, connections: ConnectionView[]): PersonView => ({ id, label: `Person ${id}`, labelFromBank: false, labelPending: false, color: null, connections });
const people = (...list: PersonView[]): PeopleView => ({ people: list, secureStorage: true });

const ONE_BANK = people(person(1, [connection(1, 'monobank')]), person(2, [connection(2, 'monobank')]));
const TWO_BANKS = people(person(1, [connection(1, 'monobank'), connection(2, TESTBANK)]), person(2, [connection(3, 'monobank')]));

async function store(view: PeopleView) {
  setActivePinia(createPinia());
  const { useParticipantStore } = await import('@/entities/participant');
  const s = useParticipantStore();
  s.view = view;
  return s;
}

beforeEach(() => localStorage.clear());

describe('the chosen bank in the participant store', () => {
  it('one bank: nothing to choose', async () => {
    const s = await store(ONE_BANK);
    expect([s.providers, s.multipleBanks, s.selectedProvider]).toEqual([['monobank'], false, null]);
    s.selectProvider('monobank');
    expect(s.selectedProvider).toBeNull();
  });

  it('two banks: each bank once, in the order the connections come', async () => {
    const s = await store(TWO_BANKS);
    expect([s.providers, s.multipleBanks, s.selectedProvider]).toEqual([['monobank', TESTBANK], true, null]);
  });

  it('the choice is kept and remembered', async () => {
    const s = await store(TWO_BANKS);
    s.selectProvider(TESTBANK);
    expect(s.selectedProvider).toBe(TESTBANK);
    expect(localStorage.getItem(KEY)).toBe(TESTBANK);
    expect((await store(TWO_BANKS)).selectedProvider).toBe(TESTBANK);
  });

  it('a remembered bank that is gone reads as all banks', async () => {
    localStorage.setItem(KEY, TESTBANK);
    expect((await store(ONE_BANK)).selectedProvider).toBeNull();
    localStorage.setItem(KEY, 'nobank');
    expect((await store(TWO_BANKS)).selectedProvider).toBeNull();
  });

  it('null clears the choice', async () => {
    const s = await store(TWO_BANKS);
    s.selectProvider(TESTBANK);
    s.selectProvider(null);
    expect(s.selectedProvider).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('the bank and the person are chosen independently', async () => {
    const s = await store(TWO_BANKS);
    s.select(2);
    s.selectProvider(TESTBANK);
    expect([s.selectedId, s.selectedProvider]).toEqual([2, TESTBANK]);
  });
});

describe('the bank select in the global filters', () => {
  const mountFilter = async () => {
    const { mount } = await import('@vue/test-utils');
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { default: BankFilter } = await import('@/widgets/global-filters/components/BankFilter.vue');
    return mount(BankFilter, { global: { plugins: [i18n] } });
  };

  it('bankOptions: «All banks», then the connected banks by name', async () => {
    const { bankOptions } = await import('@/entities/bank');
    expect(bankOptions(['monobank'])).toEqual([
      { label: 'Все банки', value: 'all' },
      { label: 'Monobank', value: 'monobank' },
    ]);
  });

  it('absent with one bank, present with two', async () => {
    await store(ONE_BANK);
    expect((await mountFilter()).find('[data-test="bank-filter"]').exists()).toBe(false);
    await store(TWO_BANKS);
    expect((await mountFilter()).find('[data-test="bank-filter"]').exists()).toBe(true);
  });

  it('picking a bank selects it; «All banks» clears it', async () => {
    const s = await store(TWO_BANKS);
    const { VSelect } = await import('@/shared/ui');
    const select = (await mountFilter()).findComponent(VSelect);
    expect(select.props('modelValue')).toBe('all');
    await select.vm.$emit('update:modelValue', TESTBANK);
    expect(s.selectedProvider).toBe(TESTBANK);
    await select.vm.$emit('update:modelValue', 'all');
    expect(s.selectedProvider).toBeNull();
  });

  it('a value that is not a connected bank changes nothing', async () => {
    const s = await store(TWO_BANKS);
    const { VSelect } = await import('@/shared/ui');
    await (await mountFilter()).findComponent(VSelect).vm.$emit('update:modelValue', 'nobank');
    expect(s.selectedProvider).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
