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
    expect(BANKS.map((b) => b.id)).toEqual(['monobank', 'fictional']);
    expect(bankOf('fictional')).toEqual({ id: 'fictional', name: 'Вигаданий Банк', ways: ['file'], monogram: 'В', monogramClass: 'bg-surface-sunken text-foreground-muted' });
    expect(defaultCardTypeOf('fictional')).toBeNull();
    expect(cardTypeName('fictional', 'gold')).toBe('Карта');
  });

  it('has no forms of its own: the generic file steps and access note', () => {
    expect(formsOf('fictional')).toBeNull();
    expect(fileStepsOf('fictional')).toBe(GENERIC_FILE_STEPS);
    expect(accessNoteOf(FICTIONAL)).toBe(FILE_ACCESS_NOTE);
    expect(GENERIC_FILE_STEPS.map((k) => t(k)).join(' ')).not.toMatch(/Monobank/);
  });

  it('the picker offers both banks and the disabled «Other banks» tile', async () => {
    const { default: BankPicker } = await import('@/features/integrations/shared/components/BankPicker.vue');
    const w = await mountIt(BankPicker);
    const tiles = w.findAll('button');
    expect(tiles.map((b) => b.attributes('disabled') !== undefined)).toEqual([false, false, true]);
    expect(tiles[1]?.text()).toContain('Вигаданий Банк');
    expect(tiles[1]?.text()).toContain('Файлы выписок из банка');
    await tiles[1]?.trigger('click');
    expect(w.emitted('select')?.[0]?.[0]).toMatchObject({ id: 'fictional' });
    w.unmount();
  });

  it('«Add connection» asks for the bank, then adds it by file without a token or a choice of way', async () => {
    const { default: ConnectionsFeature } = await import('@/features/integrations/ConnectionsFeature.vue');
    const w = await mountIt(ConnectionsFeature);
    await flushPromises();
    await w.findAll('button').find((b) => b.text() === 'Добавить подключение')?.trigger('click');
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
