// @vitest-environment happy-dom
// The data status by bank (spec desktop-data-freshness): which connection is behind, the header's mark, and the list's
// actions. balanceApi is a fake; invented data only. Typechecked with the renderer (tsconfig.web.json).
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionView, PersonView } from '@contract/api.ts';

const api = vi.hoisted(() => ({
  startImport: vi.fn(async (_from: string) => ({ started: true as const })),
  openAnyStatement: vi.fn(async () => ({ opened: false as const, reason: 'cancelled' as const })),
}));
vi.mock('@/shared/api', () => ({ balanceApi: api }));

const { behindMark, freshnessRows } = await import('@/widgets/global-filters/utils.ts');
const { default: FreshnessList } = await import('@/widgets/global-filters/components/FreshnessList.vue');

const conn = (id: number, bank: string, method: 'token' | 'file', coveredTo: string | null): ConnectionView => ({
  id, provider: bank === 'Monobank' ? 'monobank' : 'privatbank', method, bank, accounts: 1, enabledAccounts: 1, coveredFrom: null, coveredTo, lastSyncAt: null, token: null,
});
const person = (label: string, connections: ConnectionView[]): PersonView => ({ id: 1, label, labelFromBank: false, labelPending: false, color: null, connections });

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

describe('FreshnessList', () => {
  it('a file connection uploads a statement; a token one behind refreshes from its date', async () => {
    const rows = freshnessRows(
      [person('Вигадана Особа', [conn(1, 'Monobank', 'token', '2026-10-20'), conn(2, 'PrivatBank', 'file', '2026-09-21')])],
      '2026-10-25 11:00',
    );
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const w = mount(FreshnessList, { props: { rows, today: '2026-10-25' }, global: { plugins: [i18n] }, attachTo: document.body });
    await w.find('button').trigger('click');
    await flushPromises();
    const list = document.querySelector('[data-test="freshness-list"]')!;
    expect(list.textContent).toContain('PrivatBank · Вигадана Особа');
    const buttons = [...list.querySelectorAll('button')];
    buttons.find((b) => b.textContent?.includes('Обновить'))!.click();
    buttons.find((b) => b.textContent?.includes('Загрузить выписку'))!.click();
    await flushPromises();
    expect(api.startImport).toHaveBeenCalledWith('2026-10-20');
    expect(api.openAnyStatement).toHaveBeenCalled();
    w.unmount();
  });
});
