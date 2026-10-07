// @vitest-environment happy-dom
// The sync status next to the home filters (widgets/global-filters): the pure view model for every import phase, the
// mounted header, the people filter's per-person marks and VSegmentedControl's `alert`. Fictional names; balanceApi is
// never called. Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { ConnectionView, DataStatus, PersonView } from '@contract/api.ts';
import type { ImportProgress } from '@contract/progress.ts';

vi.mock('@/shared/api', () => ({ balanceApi: {} }));

const { syncStatusView, failedConnections } = await import('@/widgets/global-filters/utils.ts');
const { GlobalFilters } = await import('@/widgets/global-filters');
const { filterOptions, useParticipantStore } = await import('@/entities/participant');
const { useImportProgressStore } = await import('@/entities/import-progress');
const { useSyncStatusStore } = await import('@/entities/sync-status');
const { i18n, syncedWhen } = await import('@/shared/lib');
const { VSegmentedControl } = await import('@/shared/ui');

// 2026-10-03 12:00 Kyiv (UTC+3).
const NOW = Date.parse('2026-10-03T09:00:00Z');
const labelOf = (id: number) => (id === 7 ? 'Вигадана · Monobank' : 'Я · Monobank');
const data = { line: 'Данные до 03.10, 11:40', lastSyncAt: '2026-10-03 11:45' };
const windows = (done: number, total: number, auto?: true): ImportProgress => ({
  phase: 'windows', account: null, from: '2026-09-01', to: '2026-10-01', round: 1, index: 1, total: 3,
  windowsDone: done, windowsTotal: total, transactions: 10, etaSec: 120, waitingSec: null, ...(auto ? { auto } : {}),
});

describe('syncStatusView', () => {
  it('idle: what the data covers; when it was last updated only on hover (today → the time)', () => {
    const v = syncStatusView({ phase: 'idle' }, data, NOW, labelOf);
    expect(v).toEqual({ icon: null, text: 'Данные до 03.10, 11:40', percent: '', note: '', tooltip: 'Обновлено в 11:45' });
  });

  it('an earlier sync shows its date on hover; no last sync → no tooltip', () => {
    expect(syncStatusView({ phase: 'idle' }, { ...data, lastSyncAt: '2026-10-01 08:05' }, NOW, labelOf).tooltip).toBe('Обновлено 01.10, 08:05');
    expect(syncStatusView({ phase: 'idle' }, { ...data, lastSyncAt: null }, NOW, labelOf)).toMatchObject({ text: 'Данные до 03.10, 11:40', tooltip: '' });
    expect(syncStatusView({ phase: 'idle' }, { line: '', lastSyncAt: null }, NOW, labelOf)).toMatchObject({ text: '', tooltip: '' });
  });

  it.each<ImportProgress>([{ phase: 'starting', resumed: false }, { phase: 'accounts' }, { phase: 'rederive' }])(
    'a user import, $phase: spinner and «Синхронизация…», no percent yet',
    (p) => {
      const v = syncStatusView(p, data, NOW, labelOf);
      expect([v.icon, v.text, v.percent]).toEqual(['spinner', 'Синхронизация…', '']);
      expect(v.tooltip).not.toBe('');
    },
  );

  it('a user import, windows: the percent of windows apart from the announced text', () => {
    const v = syncStatusView(windows(3, 8), data, NOW, labelOf);
    expect([v.icon, v.text, v.percent]).toEqual(['spinner', 'Синхронизация…', '37%']);
    expect(v.tooltip).toContain('загружено окон 3 из 8');
    // The announced text does not change from tick to tick.
    expect(syncStatusView(windows(4, 8), data, NOW, labelOf).text).toBe(v.text);
    expect(syncStatusView(windows(0, 0), data, NOW, labelOf).percent).toBe('');
  });

  it('«Auto-sync» is quiet: «Обновляю данные…», no percent; how far it got only on hover', () => {
    const v = syncStatusView(windows(3, 8, true), data, NOW, labelOf);
    expect(v).toMatchObject({ icon: 'spinner', text: 'Обновляю данные…', percent: '', note: '' });
    expect(v.tooltip).toContain('загружено окон 3 из 8');
    expect(syncStatusView({ phase: 'accounts', auto: true }, data, NOW, labelOf).text).toBe('Обновляю данные…');
  });

  it('retry: the time of the next attempt, the reason in the tooltip (manual and auto alike)', () => {
    const p: ImportProgress = { phase: 'retry', reason: 'network', attempt: 2, inSec: 15 * 60 };
    const at = new Date(NOW + 15 * 60 * 1000).toLocaleTimeString(i18n.global.locale.value, { hour: '2-digit', minute: '2-digit' });
    const v = syncStatusView(p, data, NOW, labelOf);
    expect([v.icon, v.text, v.percent]).toEqual(['spinner', `Повтор в ${at}`, '']);
    expect(v.tooltip).toContain('Нет связи с Monobank');
    expect(syncStatusView({ ...p, auto: true }, data, NOW, labelOf).text).toBe(`Повтор в ${at}`);
  });

  it('done: back to the data line; failed connections → a warning with who and why', () => {
    expect(syncStatusView({ phase: 'done', windowsTotal: 4, transactions: 9, failed: [] }, data, NOW, labelOf)).toEqual(syncStatusView({ phase: 'idle' }, data, NOW, labelOf));
    const v = syncStatusView({ phase: 'done', windowsTotal: 4, transactions: 9, failed: [{ connectionId: 7, error: 'auth' }] }, data, NOW, labelOf);
    expect([v.icon, v.text]).toEqual(['warning', 'Данные до 03.10, 11:40']);
    expect(v.note).toBe('Не загружено — Вигадана · Monobank: Monobank не принял токен. Проверь токен и введи его заново.');
    expect(v.tooltip).toBe(v.note);
  });

  it('error: a warning with the error text; cancelled and needs-token: the data line', () => {
    const v = syncStatusView({ phase: 'error', error: 'network' }, data, NOW, labelOf);
    expect(v.icon).toBe('warning');
    expect(v.note).toContain('Нет связи с Monobank');
    expect(syncStatusView({ phase: 'cancelled' }, data, NOW, labelOf).icon).toBeNull();
    expect(syncStatusView({ phase: 'needs-token', connectionIds: [1] }, data, NOW, labelOf).icon).toBeNull();
  });

  it('failedConnections: only after an import, connection → why', () => {
    expect(failedConnections({ phase: 'done', windowsTotal: 1, transactions: 0, failed: [{ connectionId: 7, error: 'no-token' }] })).toEqual({
      7: 'Токен не сохранён — введи его заново, чтобы импортировать это подключение.',
    });
    expect(failedConnections({ phase: 'error', error: 'auth' })).toEqual({});
  });

  it('syncedWhen: today → the time, another day → the date', () => {
    expect(syncedWhen('2026-10-03 11:45', new Date(NOW))).toBe('в 11:45');
    expect(syncedWhen('2026-10-02 23:10', new Date(NOW))).toBe('02.10, 23:10');
  });
});

const conn = (id: number, lastSyncAt: string | null): ConnectionView => ({
  id, provider: 'monobank', bank: 'Monobank', accounts: 1, enabledAccounts: 1, coveredFrom: null, coveredTo: null, lastSyncAt,
  token: { present: true, stored: 'secure', secureStorage: true, needsReentry: false },
});
const person = (id: number, label: string, connections: ConnectionView[]): PersonView => ({ id, label, labelFromBank: false, labelPending: false, color: null, connections });

describe('filterOptions with sync hints', () => {
  it('a person: the latest sync of their connections, their failed connections, a warning; names are escaped', () => {
    const people = [person(1, 'Я', [conn(1, '2026-10-02 09:00'), conn(2, '2026-10-03 11:45')]), person(2, '<b>Вигадана</b>', [conn(7, null)])];
    const label = (id: number) => (id === 7 ? '<b>Вигадана</b> · Monobank' : 'Я · Monobank');
    const [family, me, other] = filterOptions(people, { failed: { 7: 'Monobank не принял токен.' }, now: new Date(NOW), labelOf: label });
    expect(family).not.toHaveProperty('alert');
    expect(me).toMatchObject({ tooltip: 'Обновлено в 11:45' });
    expect(me).not.toHaveProperty('alert');
    expect(other).toMatchObject({ alert: 'не обновлено', tooltip: '&lt;b&gt;Вигадана&lt;/b&gt; · Monobank: Monobank не принял токен.' });
  });
});

describe('VSegmentedControl alert', () => {
  it('a warning dot after the label and its text for screen readers only', () => {
    const w = mount(VSegmentedControl, {
      props: { modelValue: 1, options: [{ label: 'Я', value: 1 }, { label: 'Вигадана', value: 2, alert: 'не обновлено' }] },
      global: { plugins: [i18n] },
    });
    const items = w.findAll('.v-sc__item');
    expect(items[0]?.find('.v-sc__alert').exists()).toBe(false);
    expect(items[1]?.find('.v-sc__alert').attributes('aria-hidden')).toBe('true');
    expect(items[1]?.find('.v-sc__sr-only').text()).toBe('не обновлено');
    expect(items[1]?.text()).toBe('Вигаданане обновлено');
  });
});

describe('GlobalFilters', () => {
  let pinia: Pinia;
  const status: DataStatus = { hasData: true, dataUntil: '2026-10-03 11:40', dataFrom: '2026-01-01', lastSyncAt: '2026-10-03 11:45' };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    pinia = createPinia();
    setActivePinia(pinia);
    useSyncStatusStore().status = status;
    useParticipantStore().view = { secureStorage: true, people: [person(1, 'Я', [conn(1, '2026-10-03 11:45')]), person(2, 'Вигадана', [conn(7, '2026-10-01 08:00')])] };
  });
  afterEach(() => vi.useRealTimers());

  const screen = defineComponent({ render: () => null });
  let router: Router;
  beforeEach(async () => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: screen },
        { path: '/analytics', name: 'analytics', component: screen, meta: { periodFilter: 'range' } },
        { path: '/recurring', name: 'recurring', component: screen, meta: { periodFilter: 'none' } },
      ],
    });
    await router.push('/');
  });
  const mountFilters = () => mount(GlobalFilters, { global: { plugins: [pinia, i18n, router] }, attachTo: document.body });

  it('analytics: the period button instead of the month, before the currency', async () => {
    await router.push('/analytics');
    const w = mountFilters();
    expect(w.find('[aria-label^="Месяц"]').exists()).toBe(false);
    const triggers = w.findAll('button[aria-label]').map((b) => b.attributes('aria-label'));
    const at = triggers.findIndex((l) => l?.startsWith('Период:'));
    expect(at).toBeGreaterThanOrEqual(0);
    expect(triggers[at + 1]).toMatch(/^Валюты:/);
    w.unmount();
  });

  it('regular payments: no period at all, the currency button stays', async () => {
    await router.push('/recurring');
    const w = mountFilters();
    const triggers = w.findAll('button[aria-label]').map((b) => b.attributes('aria-label'));
    expect(triggers.some((l) => l?.startsWith('Месяц') || l?.startsWith('Период:'))).toBe(false);
    expect(triggers.some((l) => l?.startsWith('Валюты:'))).toBe(true);
    w.unmount();
  });

  it('the currency button sits right after the month filter', () => {
    const w = mountFilters();
    const month = w.find('[aria-label^="Месяц"]');
    const currency = w.find('[aria-label^="Валюты:"]');
    expect(month.exists()).toBe(true);
    expect(currency.exists()).toBe(true);
    expect(month.element.compareDocumentPosition(currency.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const triggers = w.findAll('button[aria-label]').map((b) => b.attributes('aria-label'));
    const at = triggers.findIndex((l) => l?.startsWith('Месяц'));
    expect(triggers[at + 1]).toMatch(/^Валюты:/);
    w.unmount();
  });

  it('idle: the data line alone (the last sync is in its tooltip)', () => {
    const w = mountFilters();
    const s = w.find('[role="status"]');
    expect(s.attributes('aria-live')).toBe('polite');
    expect(s.text()).toBe('Данные до 03.10, 11:40');
    w.unmount();
  });

  it('a running import: spinner, «Синхронизация…» and the percent outside the announcement; no aria-busy (it would hold the announcement back)', async () => {
    const w = mountFilters();
    useImportProgressStore().set(windows(1, 4));
    await nextTick();
    const s = w.find('[role="status"]');
    expect(s.text()).toBe('Синхронизация…25%');
    expect(s.find('[aria-hidden="true"]:not(svg)').text()).toBe('25%');
    expect(s.find('svg').classes()).toContain('motion-reduce:animate-none');
    expect(w.find('header').attributes('aria-busy')).toBeUndefined();
    w.unmount();
  });

  it('done with a failed connection: a warning in the status and a dot on that person', async () => {
    const w = mountFilters();
    useImportProgressStore().set({ phase: 'done', windowsTotal: 2, transactions: 3, failed: [{ connectionId: 7, error: 'auth' }] });
    await nextTick();
    const s = w.find('[role="status"]');
    expect(s.find('svg.text-warning').exists()).toBe(true);
    expect(s.find('.sr-only').text()).toContain('Вигадана · Monobank: Monobank не принял токен');
    // Not the hidden copy that measures the buttons' width (inert).
    const items = w.findAll('.v-sc__item').filter((i) => !i.element.closest('[inert]'));
    expect(items.map((i) => i.find('.v-sc__alert').exists())).toEqual([false, false, true]);
    expect(items[2]?.text()).toContain('не обновлено');
    w.unmount();
  });
});
