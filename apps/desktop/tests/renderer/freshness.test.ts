// @vitest-environment happy-dom
// The data status by bank (spec desktop-data-freshness): which connection is behind, the header's mark, and the list's
// actions. balanceApi is a fake; invented data only. Typechecked with the renderer (tsconfig.web.json).
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionView, PersonView } from '@contract/api.ts';

const api = vi.hoisted(() => ({
  startImport: vi.fn(async (_from: string) => ({ started: true as const })),
  openUpload: vi.fn(async (_connectionId?: number) => ({ opened: false as const, reason: 'cancelled' as const })),
}));
vi.mock('@/shared/api', () => ({ balanceApi: api }));
const push = vi.hoisted(() => vi.fn());
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

const { behindMark, freshnessGroups, freshnessRows, uploadFrom } = await import('@/widgets/global-filters/utils.ts');
const { default: FreshnessList } = await import('@/widgets/global-filters/components/FreshnessList.vue');

const conn = (id: number, bank: string, method: 'token' | 'file', coveredTo: string | null): ConnectionView => ({
  id, provider: bank === 'Monobank' ? 'monobank' : 'privatbank', method, bank, accounts: 1, enabledAccounts: 1, coveredFrom: null, coveredTo, lastSyncAt: null, token: null,
});
const person = (label: string, connections: ConnectionView[], id = 1): PersonView => ({ id, label, labelFromBank: false, labelPending: false, color: null, connections });

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('freshnessRows and behindMark', () => {
  it('a connection more than a day behind the live data is behind; a day or less is not', () => {
    const rows = freshnessRows(
      [person('Вигадана Особа', [conn(1, 'Monobank', 'token', '2026-10-25'), conn(2, 'PrivatBank', 'file', '2026-09-21'), conn(3, 'Monobank', 'token', '2026-10-24')])],
      '2026-10-25 11:00',
    );
    expect(rows.map((r) => [r.connectionId, r.behind])).toEqual([[1, false], [2, true], [3, false]]);
    expect(behindMark(rows)).toBe('PrivatBank: до 21.09');
  });

  it('several behind: their number; none: no mark', () => {
    const rows = freshnessRows([person('Вигадана Особа', [conn(1, 'PrivatBank', 'file', '2026-09-21'), conn(2, 'PrivatBank', 'file', '2026-08-01')])], '2026-10-25 11:00');
    expect(behindMark(rows)).toBe('Отстают банки: 2');
    expect(behindMark(freshnessRows([person('Вигадана Особа', [conn(1, 'Monobank', 'token', '2026-10-25')])], '2026-10-25 11:00'))).toBe('');
  });
});

describe('freshnessGroups and uploadFrom', () => {
  it('rows by person in their order; the next statement starts the day after the data ends', () => {
    const rows = freshnessRows(
      [person('Вигадана Особа', [conn(1, 'Monobank', 'token', '2026-10-25'), conn(2, 'PrivatBank', 'file', '2026-09-21')]), person('Інша Особа', [conn(3, 'Monobank', 'token', null)], 2)],
      '2026-10-25 11:00',
    );
    expect(freshnessGroups(rows).map((g) => [g.person, g.rows.map((r) => r.connectionId)])).toEqual([
      ['Вигадана Особа', [1, 2]],
      ['Інша Особа', [3]],
    ]);
    expect(uploadFrom(rows[1]!)).toBe('2026-09-22');
    expect(uploadFrom(rows[2]!)).toBeNull();
  });
});

describe('FreshnessList', () => {
  it('a file connection uploads from the day after its data; a token one refreshes from its date', async () => {
    const rows = freshnessRows(
      [person('Вигадана Особа', [conn(1, 'Monobank', 'token', '2026-10-20'), conn(2, 'PrivatBank', 'file', '2026-09-21')])],
      '2026-10-25 11:00',
    );
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const w = mount(FreshnessList, { props: { rows, today: '2026-10-25' }, global: { plugins: [i18n] }, attachTo: document.body });
    await w.find('button').trigger('click');
    await flushPromises();
    const list = document.querySelector('[data-test="freshness-list"]')!;
    expect(list.querySelector('[data-test="freshness-person-1"]')?.textContent).toContain('Вигадана Особа');
    const buttons = [...list.querySelectorAll('button')];
    buttons.find((b) => b.textContent?.includes('Обновить'))!.click();
    buttons.find((b) => b.textContent?.includes('Загрузить с 22.09'))!.click();
    await flushPromises();
    expect(api.startImport).toHaveBeenCalledWith('2026-10-20');
    expect(api.openUpload).toHaveBeenCalledWith(2);
    w.unmount();
  });
});

describe('FreshnessList: add bank', () => {
  it('lists the banks of the registry with their ways; a file bank opens the sheet', async () => {
    const rows = freshnessRows([person('Вигадана Особа', [conn(1, 'Monobank', 'token', '2026-10-25')])], '2026-10-25 11:00');
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const w = mount(FreshnessList, { props: { rows, today: '2026-10-25' }, global: { plugins: [i18n] }, attachTo: document.body });
    await w.find('button').trigger('click');
    await flushPromises();
    const list = document.querySelector('[data-test="freshness-list"]')!;
    [...list.querySelectorAll('button')].find((b) => b.textContent?.includes('Добавить банк'))!.click();
    await flushPromises();
    const banks = [...document.querySelectorAll('[data-test="freshness-banks"] button')];
    const texts = banks.map((b) => b.textContent ?? '');
    expect(texts.find((x) => x.includes('PrivatBank'))).toContain('файл');
    expect(texts.find((x) => x.includes('Monobank'))).toContain('токен · файл');
    banks.find((b) => b.textContent?.includes('PrivatBank'))!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    expect(api.openUpload).toHaveBeenCalledWith();
    w.unmount();
  });
});
