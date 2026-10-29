// @vitest-environment happy-dom
// The bank filter (spec desktop-bank-filter): which banks it offers, all by default, never none, remembered on this
// computer; the data reads get the banks only while some bank is off; one control with a panel of switches. balanceApi is a fake; fictional names.
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionView, PeopleView, PersonView, ProviderId } from '@contract/api.ts';

const api = vi.hoisted(() => ({ people: null as PeopleView | null }));
vi.mock('@/shared/api', () => ({ balanceApi: { listPeople: vi.fn(async () => api.people) } }));

const { offeredBanks, shownBanks, useParticipantStore } = await import('@/entities/participant');
const { default: BankFilter } = await import('@/widgets/global-filters/components/BankFilter.vue');
const { bankFilterText } = await import('@/widgets/global-filters/utils.ts');
const { i18n } = await import('@/shared/lib/i18n.ts');
const filter = () => mount(BankFilter, { global: { plugins: [i18n] }, attachTo: document.body });
const trigger = () => document.body.querySelector<HTMLButtonElement>('[aria-label^="Банки:"]');
async function open() {
  trigger()!.click();
  await flushPromises();
}
const rows = () => Array.from(document.body.querySelectorAll('[role="group"][aria-label="Банки"] label:not(.v-switch)')).map((l) => l.textContent?.trim());
const switches = () => Array.from(document.body.querySelectorAll<HTMLInputElement>('input[role="switch"]'));

let seq = 0;
const conn = (provider: ProviderId, o: Partial<ConnectionView> = {}): ConnectionView => ({
  id: ++seq, provider, method: 'file', bank: provider, accounts: 1, enabledAccounts: 1, coveredFrom: '2026-01-01', coveredTo: '2026-03-01',
  lastSyncAt: null, token: null, ...o,
});
const person = (id: number, connections: ConnectionView[]): PersonView => ({ id, label: `Fictional ${id}`, labelFromBank: false, labelPending: false, color: null, connections });
const THREE = (): PeopleView => ({ people: [person(1, [conn('abank'), conn('monobank')]), person(2, [conn('privatbank')])], secureStorage: true });

async function store(people: PeopleView = THREE()) {
  api.people = people;
  const s = useParticipantStore();
  await s.refresh();
  return s;
}

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

describe('offered and shown banks', () => {
  it('imported banks with an enabled account, in the registry\'s order, whoever owns them', () => {
    expect(offeredBanks(THREE().people.flatMap((p) => p.connections))).toEqual(['monobank', 'privatbank', 'abank']);
    expect(offeredBanks([conn('monobank'), conn('abank', { enabledAccounts: 0 }), conn('privatbank', { coveredFrom: null })])).toEqual(['monobank']);
  });

  it('the remembered choice still offered, else every offered bank', () => {
    expect(shownBanks(null, ['monobank', 'abank'])).toEqual(['monobank', 'abank']);
    expect(shownBanks(['abank', 'gone'], ['monobank', 'abank'])).toEqual(['abank']);
    expect(shownBanks(['gone'], ['monobank', 'abank'])).toEqual(['monobank', 'abank']);
  });
});

describe('the bank choice in the participant store', () => {
  it('first start: every bank on, the reads get no banks', async () => {
    const s = await store();
    expect(s.banks).toEqual(['monobank', 'privatbank', 'abank']);
    expect(s.shown).toEqual(s.banks);
    expect(s.selectedProviders).toBeUndefined();
  });

  it('a subset goes to the reads in the registry\'s order and is remembered', async () => {
    const s = await store();
    s.selectBanks(['abank', 'monobank']);
    expect(s.selectedProviders).toEqual(['monobank', 'abank']);
    expect(JSON.parse(localStorage.getItem('balance.banks')!)).toEqual(['monobank', 'abank']);

    setActivePinia(createPinia());
    expect((await store()).selectedProviders).toEqual(['monobank', 'abank']);
  });

  it('never none: an empty choice or unknown banks change nothing', async () => {
    const s = await store();
    s.selectBanks(['privatbank']);
    s.selectBanks([]);
    s.selectBanks(['otherbank' as ProviderId]);
    expect(s.selectedProviders).toEqual(['privatbank']);
  });

  it('a remembered bank that disappears: every offered bank on', async () => {
    localStorage.setItem('balance.banks', JSON.stringify(['abank']));
    const s = await store({ people: [person(1, [conn('monobank'), conn('privatbank')])], secureStorage: true });
    expect([s.shown, s.selectedProviders]).toEqual([['monobank', 'privatbank'], undefined]);
  });

  it('storage that holds nonsense counts as never chosen', async () => {
    localStorage.setItem('balance.banks', '{"x":1}');
    expect((await store()).selectedProviders).toBeUndefined();
  });

  it('one bank: nothing to filter', async () => {
    localStorage.setItem('balance.banks', JSON.stringify(['monobank']));
    const s = await store({ people: [person(1, [conn('monobank')])], secureStorage: true });
    expect([s.banks, s.selectedProviders]).toEqual([['monobank'], undefined]);
  });
});

describe('bankFilterText', () => {
  it('«All banks» while every offered bank is on, else how many of them', () => {
    expect(bankFilterText(3, 3)).toBe('Все банки');
    expect(bankFilterText(2, 4)).toBe('2 из 4');
    expect(bankFilterText(1, 2)).toBe('1 из 2');
  });
});

describe('BankFilter', () => {
  it('one control named by its text, with the marks of the banks on; a switch per offered bank, all on', async () => {
    await store();
    const w = filter();
    expect(trigger()!.getAttribute('aria-label')).toBe('Банки: Все банки');
    expect(trigger()!.textContent).toContain('Все банки');
    expect(trigger()!.querySelector('.v-popover__lead > span')!.children).toHaveLength(3);
    await open();
    expect(rows()).toEqual(['Monobank', 'PrivatBank', 'A-Bank']);
    expect(switches().map((b) => b.checked)).toEqual([true, true, true]);
    w.unmount();
  });

  it('turning a bank off narrows the reads and says how many are on', async () => {
    const s = await store();
    const w = filter();
    await open();
    switches()[1]!.click();
    await flushPromises();
    expect(s.selectedProviders).toEqual(['monobank', 'abank']);
    expect(trigger()!.getAttribute('aria-label')).toBe('Банки: 2 из 3');
    w.unmount();
  });

  it('the switch is labelled by the bank\'s name', async () => {
    await store();
    const w = filter();
    await open();
    const box = switches()[2]!;
    expect(document.body.querySelector(`label[for="${box.id}"]:not(.v-switch)`)?.textContent?.trim()).toBe('A-Bank');
    w.unmount();
  });

  it('the last bank on cannot turn off and says why', async () => {
    const s = await store();
    s.selectBanks(['abank']);
    const w = filter();
    await open();
    const abank = switches()[2]!;
    expect(abank.disabled).toBe(true);
    expect(document.getElementById(abank.getAttribute('aria-describedby')!)?.textContent).toBe('Хотя бы один банк остаётся включённым');
    expect(switches()[0]!.getAttribute('aria-describedby')).toBeNull();
    w.unmount();
  });

  it('hidden with one bank', async () => {
    await store({ people: [person(1, [conn('monobank')])], secureStorage: true });
    const w = filter();
    expect(trigger()).toBeNull();
    w.unmount();
  });
});
