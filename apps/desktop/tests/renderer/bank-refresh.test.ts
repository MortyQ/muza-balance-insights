// @vitest-environment happy-dom
// «Refresh» next to the sync status: one bank or all, the last refresh of the selection, refusals worded on the spot.
// A second bank exists only in these fixtures, as a cast. Typechecked with the renderer (tsconfig.web.json).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent } from 'vue';
import type { ConnectionView, PeopleView, PersonView, ProviderKey } from '@contract/api.ts';
import type { StartImportResult } from '@contract/progress.ts';

let answer: StartImportResult | Error = { started: true };
const refreshNow = vi.fn(async (_q: { provider?: ProviderKey }) => {
  if (answer instanceof Error) throw answer;
  return answer;
});
vi.mock('@/shared/api', () => ({ balanceApi: { refreshNow: (q: { provider?: ProviderKey }) => refreshNow(q) } }));

const TESTBANK = 'testbank' as ProviderKey;
const connection = (id: number, provider: ProviderKey, lastSyncAt: string | null): ConnectionView => ({
  id, provider, bank: 'Bank', accounts: 1, enabledAccounts: 1, coveredFrom: null, coveredTo: null, lastSyncAt,
  token: { present: true, stored: 'secure', secureStorage: true, needsReentry: false },
});
const person = (id: number, connections: ConnectionView[]): PersonView => ({ id, label: `Person ${id}`, labelFromBank: false, labelPending: false, color: null, connections });
const CONNECTIONS = [connection(1, 'monobank', '2026-03-10 12:00'), connection(2, TESTBANK, '2026-03-10 09:00'), connection(3, 'monobank', '2026-03-10 10:00')];
const TWO_BANKS: PeopleView = { people: [person(1, CONNECTIONS.slice(0, 2)), person(2, CONNECTIONS.slice(2))], secureStorage: true };
const ONE_BANK: PeopleView = { people: [person(1, [CONNECTIONS[0]!])], secureStorage: true };

async function setup(view: PeopleView) {
  setActivePinia(createPinia());
  const { useParticipantStore } = await import('@/entities/participant');
  const { useImportProgressStore } = await import('@/entities/import-progress');
  useParticipantStore().view = view;
  return { importProgress: useImportProgressStore() };
}

async function useHosted() {
  const { useRefresh } = await import('@/widgets/global-filters/composables/useRefresh.ts');
  let r!: ReturnType<typeof useRefresh>;
  mount(defineComponent({ setup: () => ((r = useRefresh()), () => null) }));
  return r;
}

beforeEach(() => {
  answer = { started: true };
  refreshNow.mockClear();
});

describe('lastRefreshOf', () => {
  it('the oldest refresh among the bank\'s connections: «refreshed» never overstates', async () => {
    const { lastRefreshOf } = await import('@/widgets/global-filters/utils.ts');
    expect(lastRefreshOf(CONNECTIONS, 'monobank')).toBe('2026-03-10 10:00');
    expect(lastRefreshOf(CONNECTIONS, TESTBANK)).toBe('2026-03-10 09:00');
    expect(lastRefreshOf(CONNECTIONS, null)).toBe('2026-03-10 09:00');
  });

  it('null when one of them was never refreshed, or there is none', async () => {
    const { lastRefreshOf } = await import('@/widgets/global-filters/utils.ts');
    expect(lastRefreshOf([...CONNECTIONS, connection(4, 'monobank', null)], 'monobank')).toBeNull();
    expect(lastRefreshOf([...CONNECTIONS, connection(4, 'monobank', null)], TESTBANK)).toBe('2026-03-10 09:00');
    expect(lastRefreshOf([], null)).toBeNull();
    expect(lastRefreshOf(CONNECTIONS.slice(0, 1), TESTBANK)).toBeNull();
  });
});

describe('useRefresh', () => {
  it('all banks by default: asks main for every bank', async () => {
    await setup(TWO_BANKS);
    const r = await useHosted();
    expect(r.bank.value).toBe('all');
    await r.refresh();
    expect(refreshNow).toHaveBeenCalledExactlyOnceWith({});
    expect(r.error.value).toBe('');
  });

  it('a selected bank: asks for it, and the line is its last refresh', async () => {
    await setup(TWO_BANKS);
    const r = await useHosted();
    expect(r.line.value).toContain('10.03');
    r.bank.value = TESTBANK;
    await r.refresh();
    expect(refreshNow).toHaveBeenCalledExactlyOnceWith({ provider: TESTBANK });
  });

  it('a value that is no connected bank means all banks', async () => {
    await setup(TWO_BANKS);
    const r = await useHosted();
    r.bank.value = 'nobank';
    await r.refresh();
    expect(refreshNow).toHaveBeenCalledExactlyOnceWith({});
  });

  it.each([
    ['running', 'Уже идёт импорт.'],
    ['no-token', 'Нет сохранённого токена для этого банка.'],
    ['db-unavailable', 'База сейчас недоступна.'],
  ] as const)('a refusal (%s) is worded', async (reason, text) => {
    await setup(TWO_BANKS);
    const r = await useHosted();
    answer = { started: false, reason };
    await r.refresh();
    expect(r.error.value).toBe(text);
    answer = { started: true };
    await r.refresh();
    expect(r.error.value).toBe('');
  });

  it('a failed call is an error, not a silent nothing', async () => {
    await setup(TWO_BANKS);
    const r = await useHosted();
    answer = new Error('ipc');
    await r.refresh();
    expect(r.error.value).not.toBe('');
  });

  it('busy while an import runs: nothing is asked', async () => {
    const { importProgress } = await setup(TWO_BANKS);
    const r = await useHosted();
    importProgress.set({ phase: 'accounts' });
    expect(r.busy.value).toBe(true);
    await r.refresh();
    expect(refreshNow).not.toHaveBeenCalled();
    importProgress.set({ phase: 'idle' });
    expect(r.busy.value).toBe(false);
  });

  it('never refreshed: the line says so', async () => {
    await setup({ people: [person(1, [connection(1, 'monobank', null), connection(2, TESTBANK, null)])], secureStorage: true });
    expect((await useHosted()).line.value).toBe('Ещё не обновлялось');
  });
});

describe('the refresh button', () => {
  const mounted = async () => {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { default: RefreshPopover } = await import('@/widgets/global-filters/components/RefreshPopover.vue');
    const w = mount(RefreshPopover, { global: { plugins: [i18n] } });
    await flushPromises();
    return w;
  };

  it('absent with one bank, present with two', async () => {
    await setup(ONE_BANK);
    expect((await mounted()).find('[data-test="refresh-trigger"]').exists()).toBe(false);
    await setup(TWO_BANKS);
    expect((await mounted()).find('[data-test="refresh-trigger"]').exists()).toBe(true);
  });
});
