// @vitest-environment happy-dom
// «Connections» in settings: the section's own bank filter narrows the list, and «Refresh» next to it refreshes what is
// shown — the chosen bank or all. A second bank exists only in these fixtures, as a cast. balanceApi is a fake.
// Typechecked with the renderer (tsconfig.web.json).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import type { ConnectionView, PeopleView, PersonView, ProviderKey } from '@contract/api.ts';
import type { StartImportResult } from '@contract/progress.ts';

let view: PeopleView = { people: [], secureStorage: true };
const refreshNow = vi.fn(async (_q: { provider?: ProviderKey }): Promise<StartImportResult> => ({ started: true }));
vi.mock('@/shared/api', () => ({
  balanceApi: { listPeople: async () => view, refreshNow: (q: { provider?: ProviderKey }) => refreshNow(q) },
}));

const TESTBANK = 'testbank' as ProviderKey;
const connection = (id: number, provider: ProviderKey, present = true): ConnectionView => ({
  id, provider, bank: 'Bank', accounts: 1, enabledAccounts: 1, coveredFrom: null, coveredTo: null, lastSyncAt: '2026-03-10 09:00',
  token: { present, stored: present ? 'secure' : null, secureStorage: true, needsReentry: false },
});
const person = (id: number, connections: ConnectionView[]): PersonView => ({ id, label: `Person ${id}`, labelFromBank: false, labelPending: false, color: null, connections });
const ONE_BANK: PeopleView = { people: [person(1, [connection(1, 'monobank')])], secureStorage: true };
const TWO_BANKS: PeopleView = {
  people: [person(1, [connection(1, 'monobank'), connection(2, TESTBANK)]), person(2, [connection(3, 'monobank')])],
  secureStorage: true,
};

// The section as the settings widget composes it: «Refresh» in the toolbar's slot, for the bank chosen in the section.
async function section(people: PeopleView) {
  view = people;
  setActivePinia(createPinia());
  const { i18n } = await import('@/shared/lib/i18n.ts');
  const { useParticipantStore } = await import('@/entities/participant');
  const { useImportProgressStore } = await import('@/entities/import-progress');
  const { ConnectionsFeature } = await import('@/features/integrations');
  const { BankRefreshFeature } = await import('@/features/bank-refresh');
  const { VSelect } = await import('@/shared/ui');
  const { default: ConnectionRow } = await import('@/features/integrations/shared/components/ConnectionRow.vue');
  useParticipantStore().view = people;
  const host = defineComponent(() => () =>
    h(ConnectionsFeature, null, { toolbar: ({ provider }: { provider: ProviderKey | null }) => h(BankRefreshFeature, { provider }) }),
  );
  const w = mount(host, { global: { plugins: [i18n] } });
  await flushPromises();
  return {
    w,
    importProgress: useImportProgressStore(),
    select: () => w.findComponent(VSelect),
    rows: () => w.findAllComponents(ConnectionRow).length,
    people: () => w.findAll('h3').map((x) => x.text()),
    button: () => w.get('[data-test="refresh-button"]'),
    status: () => w.get('[data-test="refresh-status"]').text(),
    async pick(bank: string) {
      w.findComponent(VSelect).vm.$emit('update:modelValue', bank);
      await flushPromises();
    },
  };
}

beforeEach(() => refreshNow.mockClear());

describe('one bank', () => {
  it('no bank filter, «Refresh» is there and asks for every bank', async () => {
    const s = await section(ONE_BANK);
    expect(s.select().exists()).toBe(false);
    expect(s.button().text()).toBe('Обновить');
    expect(s.status()).toContain('10.03');
    await s.button().trigger('click');
    expect(refreshNow).toHaveBeenCalledExactlyOnceWith({});
  });

  it('no connections: no toolbar at all', async () => {
    const s = await section({ people: [], secureStorage: true });
    expect(s.w.find('[data-test="connections-toolbar"]').exists()).toBe(false);
  });
});

describe('several banks', () => {
  it('all banks by default: every connection, «Refresh all»', async () => {
    const s = await section(TWO_BANKS);
    expect(s.select().exists()).toBe(true);
    expect([s.rows(), s.people()]).toEqual([3, ['Person 1', 'Person 2']]);
    expect(s.w.find('[data-test="connections-shown"]').exists()).toBe(false);
    expect(s.button().text()).toBe('Обновить все');
    await s.button().trigger('click');
    expect(refreshNow).toHaveBeenCalledExactlyOnceWith({});
  });

  it('a chosen bank: its connections only, a person without one is left out, «Refresh» names and asks for the bank', async () => {
    const s = await section(TWO_BANKS);
    await s.pick(TESTBANK);
    expect([s.rows(), s.people()]).toEqual([1, ['Person 1']]);
    expect(s.w.get('[data-test="connections-shown"]').text()).toContain('Показано подключений: 1 из 3.');
    // An unknown provider shows under the default bank's name (bankOf).
    expect(s.button().text()).toBe('Обновить Monobank');
    await s.button().trigger('click');
    expect(refreshNow).toHaveBeenCalledExactlyOnceWith({ provider: TESTBANK });
  });

  it('«Show all» goes back to every bank', async () => {
    const s = await section(TWO_BANKS);
    await s.pick(TESTBANK);
    await s.w.get('[data-test="connections-shown"] button').trigger('click');
    expect(s.rows()).toBe(3);
    expect(s.button().text()).toBe('Обновить все');
  });

  it('a value that is no connected bank shows every bank', async () => {
    const s = await section(TWO_BANKS);
    await s.pick('nobank');
    expect(s.rows()).toBe(3);
  });
});

describe('when «Refresh» is off', () => {
  it('an import runs: the button and the bank filter are off, the line says so', async () => {
    const s = await section(TWO_BANKS);
    s.importProgress.set({ phase: 'accounts' });
    await flushPromises();
    expect(s.button().attributes('disabled')).toBeDefined();
    expect(s.select().props('disabled')).toBe(true);
    expect(s.status()).toBe('Уже идёт импорт.');
    await s.button().trigger('click');
    expect(refreshNow).not.toHaveBeenCalled();
    s.importProgress.set({ phase: 'idle' });
    await flushPromises();
    expect(s.button().attributes('disabled')).toBeUndefined();
  });

  it('the chosen bank has no saved token: off, with the reason, before any click', async () => {
    const people: PeopleView = { people: [person(1, [connection(1, 'monobank'), connection(2, TESTBANK, false)])], secureStorage: true };
    const s = await section(people);
    expect(s.button().attributes('disabled')).toBeUndefined();
    await s.pick(TESTBANK);
    expect(s.button().attributes('disabled')).toBeDefined();
    expect(s.status()).toBe('Нет сохранённого токена для этого банка.');
  });

  it('a refusal from main is worded under the row', async () => {
    const s = await section(ONE_BANK);
    refreshNow.mockResolvedValueOnce({ started: false, reason: 'db-unavailable' });
    await s.button().trigger('click');
    await flushPromises();
    expect(s.w.text()).toContain('База сейчас недоступна.');
  });
});

describe('the helpers', () => {
  it('hasTokenFor: any connection of the bank with a token', async () => {
    const { hasTokenFor } = await import('@/features/bank-refresh/utils.ts');
    const list = [connection(1, 'monobank'), connection(2, TESTBANK, false)];
    expect([hasTokenFor(list, null), hasTokenFor(list, 'monobank'), hasTokenFor(list, TESTBANK), hasTokenFor([], null)]).toEqual([true, true, false, false]);
  });

  it('refreshStatus: «Auto-sync» in progress reads as updating, not as a refusal', async () => {
    const { refreshStatus } = await import('@/features/bank-refresh/utils.ts');
    const { t } = await import('@/shared/lib');
    expect(refreshStatus({ running: true, auto: true, hasToken: true, line: 'x' })).toEqual({ text: t('home.import.autoRunning'), warning: false });
    expect(refreshStatus({ running: false, auto: false, hasToken: true, line: 'x' })).toEqual({ text: 'x', warning: false });
  });

  it('peopleOfBank keeps the people and their order, never the stored lists', async () => {
    const { peopleOfBank } = await import('@/features/integrations/utils.ts');
    expect(peopleOfBank(TWO_BANKS.people, null)).toEqual(TWO_BANKS.people);
    expect(peopleOfBank(TWO_BANKS.people, 'monobank').map((p) => [p.id, p.connections.map((c) => c.id)])).toEqual([[1, [1]], [2, [3]]]);
    expect(TWO_BANKS.people[0]?.connections.length).toBe(2);
  });
});
