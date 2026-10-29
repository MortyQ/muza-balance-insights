// @vitest-environment happy-dom
// Banks come from the registry: a fictional bank with statement files only, added to the registry here, is offered
// with the generic file flow and a neutral mark, and nothing outside the registry names it. balanceApi is a fake.
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Component } from 'vue';
import type { AddConnectionInput, ProviderId } from '@contract/api.ts';

vi.mock('@mono/core/providers/info', async (importOriginal) => {
  const real = await importOriginal<typeof import('@mono/core/providers/info')>();
  const fictional = {
    id: 'fictional',
    name: 'Вигаданий Банк',
    access: { token: null, file: true },
    ids: 'prefixed',
    cardTypes: [],
    defaultCardType: null,
  };
  const PROVIDERS: Record<string, unknown> = { ...real.PROVIDERS, fictional };
  return { ...real, PROVIDERS, infoOf: (provider: string) => PROVIDERS[provider] };
});

const api = vi.hoisted(() => ({
  listPeople: vi.fn(async () => ({ people: [], secureStorage: true })),
  getSyncStatus: vi.fn(async () => ({ hasData: true, dataUntil: null, dataFrom: null, lastSyncAt: null })),
  addConnection: vi.fn(async (_input: AddConnectionInput) => ({ added: true as const, connectionId: 7, participantId: 1, stored: null })),
}));
vi.mock('@/shared/api', () => ({ balanceApi: api }));

const { BANKS, bankOf, cardTypeName, defaultCardTypeOf } = await import('@/entities/bank');
const { accessNoteOf, fileStepsOf, formsOf } = await import('@/features/integrations/utils.ts');
const { FILE_ACCESS_NOTE, GENERIC_FILE_STEPS } = await import('@/features/integrations/statement-file/constants.ts');
const { t } = await import('@/shared/lib');
const { PROVIDER_IDS: REAL_IDS } = await import('@mono/core/providers/types');

// The test registry's extra id: ProviderId is the real registry's union, so it is cast once here.
const FICTIONAL = 'fictional' as ProviderId;

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

async function mountIt(component: Component, props: Record<string, unknown> = {}) {
  const { i18n } = await import('@/shared/lib/i18n.ts');
  return mount(component, { props, global: { plugins: [i18n] }, attachTo: document.body });
}

describe('a bank with statement files only, from its registry entry alone', () => {
  it('is in the bank list with its name, the file way only and a neutral mark', () => {
    // The real banks in the registry's order, then the test's own.
    expect(BANKS.map((b) => b.id)).toEqual([...REAL_IDS, 'fictional']);
    expect(bankOf('fictional')).toEqual({ id: 'fictional', name: 'Вигаданий Банк', ways: ['file'], monogram: 'В', monogramClass: 'bg-surface-sunken text-foreground-muted', color: 'var(--border-strong)' });
    expect(defaultCardTypeOf('fictional')).toBeNull();
    expect(cardTypeName('fictional', 'gold')).toBe('Карта');
  });

  it('every real bank has a theme colour of its own; an unknown one is grey', () => {
    const colors = REAL_IDS.map((id) => bankOf(id).color);
    expect(colors.every((c) => c.startsWith('var(--'))).toBe(true);
    expect(new Set(colors).size).toBe(colors.length);
    expect(bankOf('nobank').color).toBe('var(--border-strong)');
  });

  it('has no forms of its own: the generic file steps and access note', () => {
    expect(formsOf('fictional')).toBeNull();
    expect(fileStepsOf('fictional')).toBe(GENERIC_FILE_STEPS);
    expect(accessNoteOf(FICTIONAL)).toBe(FILE_ACCESS_NOTE);
    expect(GENERIC_FILE_STEPS.map((k) => t(k)).join(' ')).not.toMatch(/Monobank/);
  });

  it('the picker offers every bank and the disabled «Other banks» tile', async () => {
    const { default: BankPicker } = await import('@/features/integrations/shared/components/BankPicker.vue');
    const w = await mountIt(BankPicker);
    const tiles = w.findAll('button');
    expect(tiles.map((b) => b.attributes('disabled') !== undefined)).toEqual([...BANKS.map(() => false), true]);
    const tile = tiles[BANKS.length - 1];
    expect(tile?.text()).toContain('Вигаданий Банк');
    expect(tile?.text()).toContain('Файлы выписок из банка');
    await tile?.trigger('click');
    expect(w.emitted('select')?.[0]?.[0]).toMatchObject({ id: 'fictional' });
    w.unmount();
  });

  it('«Add person» asks for the bank, then adds it by file without a token or a choice of way', async () => {
    const { default: PeopleConnectionsFeature } = await import('@/features/integrations/PeopleConnectionsFeature.vue');
    const w = await mountIt(PeopleConnectionsFeature);
    await flushPromises();
    await w.findAll('button').find((b) => b.text() === 'Добавить человека')?.trigger('click');
    await flushPromises();
    await w.findAll('button').find((b) => b.text().includes('Вигаданий Банк'))?.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Новое подключение Вигаданий Банк');
    expect(w.text()).toContain('Другой банк');
    expect(w.text()).not.toContain('Как подключить');
    expect(w.find('input[type="password"]').exists()).toBe(false);
    await w.find('input[type="text"]').setValue('Вигадана');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(api.addConnection).toHaveBeenCalledWith({ participant: { label: 'Вигадана', color: expect.any(String) }, provider: 'fictional', method: 'file' });
    w.unmount();
  });
});

describe('«People and banks»', () => {
  const conn = (id: number, provider: ProviderId, method: 'token' | 'file') => ({
    id, provider, method, bank: bankOf(provider).name, accounts: 1, enabledAccounts: 1, coveredFrom: null, coveredTo: null, lastSyncAt: null,
    token: method === 'token' ? { present: true, stored: 'secure', secureStorage: true, needsReentry: false } : null,
  });
  const people = {
    people: [
      { id: 1, label: 'Вигадана', labelFromBank: false, labelPending: false, color: null, connections: [conn(3, FICTIONAL, 'file'), conn(1, 'monobank', 'token'), conn(2, FICTIONAL, 'file')] },
      { id: 2, label: 'Інша', labelFromBank: false, labelPending: false, color: null, connections: [conn(4, 'monobank', 'token')] },
    ],
    secureStorage: true,
  };

  it('connectionsByBank: banks in the registry order, one group per bank', async () => {
    const { connectionsByBank } = await import('@/features/integrations/utils.ts');
    const groups = connectionsByBank(people.people[0]!.connections);
    expect(groups.map((g) => [g.bank.id, g.connections.map((c) => c.id)])).toEqual([['monobank', [1]], ['fictional', [3, 2]]]);
  });

  it('a person shows their connections under bank headings; «Add connection» adds to that person without asking whose', async () => {
    api.listPeople.mockResolvedValue(people as never);
    const { default: PeopleConnectionsFeature } = await import('@/features/integrations/PeopleConnectionsFeature.vue');
    const w = await mountIt(PeopleConnectionsFeature);
    await flushPromises();
    expect(w.findAll('h4').map((h) => h.text())).toEqual(['Monobank', 'Вигаданий Банк', 'Monobank']);
    await w.findAll('button').filter((b) => b.text() === 'Добавить подключение')[1]?.trigger('click');
    await flushPromises();
    await w.findAll('button').find((b) => b.text().includes('Вигаданий Банк'))?.trigger('click');
    await flushPromises();
    expect(w.text()).not.toContain('Чьи это счета');
    expect(w.find('input[type="text"]').exists()).toBe(false);
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(api.addConnection).toHaveBeenCalledWith({ participant: { id: 2 }, provider: 'fictional', method: 'file' });
    w.unmount();
  });
});
