// @vitest-environment happy-dom
// The history download in settings, «Connections» (features/import-statement): quick picks and «From date», the date
// main gets; home's notices that link there (no data at all, a month before the data). balanceApi is a fake.
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { DataStatus } from '@contract/api.ts';

const api = vi.hoisted(() => ({
  startImport: vi.fn(async (_from: string) => ({ started: true as const })),
  listPeople: vi.fn(async () => ({
    people: [
      {
        id: 1, label: 'Я', labelFromBank: false, labelPending: false, color: null,
        connections: [{
          id: 1, provider: 'monobank', bank: 'Monobank', accounts: 1, enabledAccounts: 1, coveredFrom: null, coveredTo: null, lastSyncAt: null,
          token: { present: true, stored: 'secure', secureStorage: true, needsReentry: false },
        }],
      },
    ],
    secureStorage: true,
  })),
}));
vi.mock('@/shared/api', () => ({ balanceApi: { startImport: api.startImport, cancelImport: vi.fn(), listPeople: api.listPeople } }));

const { presetOf } = await import('@/features/import-statement/utils.ts');
const { default: ImportFeature } = await import('@/features/import-statement/ImportFeature.vue');
const { emptyMonth } = await import('@/widgets/home-notices/utils.ts');
const { HomeNotices } = await import('@/widgets/home-notices');
const { importLink, importRequest } = await import('@/shared/config');
const { useParticipantStore } = await import('@/entities/participant');
const { useSyncStatusStore } = await import('@/entities/sync-status');
const { useImportProgressStore } = await import('@/entities/import-progress');
const { useMonthStore } = await import('@/entities/period');
const { i18n } = await import('@/shared/lib');

const NOW = new Date('2026-10-05T12:00:00+03:00');
let pinia: Pinia;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  pinia = createPinia();
  setActivePinia(pinia);
  api.startImport.mockClear();
});
afterEach(() => void vi.useRealTimers());

describe('presetOf', () => {
  it('the quick pick a date stands for, else 0', () => {
    expect(presetOf('2026-07-05', '2026-10-05')).toBe(3);
    expect(presetOf('2023-10-05', '2026-10-05')).toBe(36);
    expect(presetOf('2026-07-04', '2026-10-05')).toBe(0);
  });
});

describe('emptyMonth', () => {
  it('a month before the data: from its first day, or from the floor for the oldest month', () => {
    expect(emptyMonth('2026-03', '2026-06-10', '2026-10-05')).toEqual({ from: '2026-03-01', dataFrom: '2026-06-10' });
    expect(emptyMonth('2023-10', '2026-06-10', '2026-10-05')).toEqual({ from: '2023-10-05', dataFrom: '2026-06-10' });
  });
  it('the first data month (even partly), later months, nothing known → null', () => {
    expect(emptyMonth('2026-06', '2026-06-10', '2026-10-05')).toBeNull();
    expect(emptyMonth('2026-09', '2026-06-10', '2026-10-05')).toBeNull();
    expect(emptyMonth('2026-03', null, '2026-10-05')).toBeNull();
  });
});

describe('importLink / importRequest', () => {
  it('«Connections», focused on the download, with the date when given; the page reads it back', () => {
    expect(importLink()).toEqual({ name: 'settings', query: { section: 'connections', focus: 'import' } });
    expect(importLink('2026-03-01').query).toEqual({ section: 'connections', focus: 'import', from: '2026-03-01' });
    expect(importRequest(importLink('2026-03-01').query)).toEqual({ focus: true, from: '2026-03-01' });
    expect(importRequest({ section: 'connections', from: ['x'] })).toEqual({ focus: false, from: null });
  });
});

describe('ImportFeature', () => {
  async function mountFeature(props: Record<string, unknown> = {}) {
    await useParticipantStore().refresh();
    const w = mount(ImportFeature, { props, global: { plugins: [pinia, i18n] }, attachTo: document.body });
    await flushPromises();
    return w;
  }
  const download = (w: Awaited<ReturnType<typeof mountFeature>>) => w.findAll('button').find((b) => b.text() === 'Загрузить')!;

  it('opens on 3 months; a quick pick moves the start; «Загрузить» sends that date', async () => {
    const w = await mountFeature();
    expect(w.text()).toContain('Monobank');
    expect(w.text()).toContain('с 05.07.2026 по сегодня');
    await w.findAll('button').find((b) => b.text() === '12 мес.')!.trigger('click');
    expect(w.text()).toContain('с 05.10.2025 по сегодня');
    await download(w).trigger('click');
    expect(api.startImport).toHaveBeenCalledWith('2025-10-05');
    w.unmount();
  });

  it('a date asked for by the link is taken; one out of range is ignored', async () => {
    const w = await mountFeature({ requestedFrom: '2026-03-01' });
    expect(w.text()).toContain('с 01.03.2026 по сегодня');
    w.unmount();
    const v = await mountFeature({ requestedFrom: '2020-01-01' });
    expect(v.text()).toContain('с 05.07.2026 по сегодня');
    v.unmount();
  });

  it('focus: the section takes the focus on open', async () => {
    const w = await mountFeature({ focus: true });
    expect(document.activeElement).toBe(w.element);
    w.unmount();
  });
});

describe('HomeNotices: no data', () => {
  const status = (o: Partial<DataStatus>): DataStatus => ({ hasData: true, dataUntil: '2026-10-05 10:00', dataFrom: '2026-06-10', lastSyncAt: null, ...o });

  async function mountNotices(s: DataStatus | null) {
    useSyncStatusStore().status = s;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: ['home', 'settings'].map((name) => ({ name, path: `/${name}`, component: defineComponent(() => () => h('div')) })),
    });
    await router.push('/home');
    const w = mount(HomeNotices, { global: { plugins: [pinia, i18n, router] } });
    await flushPromises();
    return { w, router };
  }

  it('nothing imported: «Данных пока нет» → «Загрузить историю» opens the download', async () => {
    const { w, router } = await mountNotices(status({ hasData: false, dataFrom: null, dataUntil: null }));
    expect(w.text()).toContain('Данных пока нет');
    await w.findAll('button').find((b) => b.text() === 'Загрузить историю')!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ section: 'connections', focus: 'import' });
  });

  it('while the user’s import runs: no call to download, a line that it is on its way; unknown status: nothing', async () => {
    useImportProgressStore().set({ phase: 'accounts' });
    const { w } = await mountNotices(status({ hasData: false, dataFrom: null, dataUntil: null }));
    expect(w.text()).toContain('Загружаю историю');
    expect(w.text()).not.toContain('Загрузить историю');
    useImportProgressStore().set({ phase: 'idle' });
    const empty = await mountNotices(null);
    expect(empty.w.text()).not.toContain('Данных пока нет');
  });

  it('a month before the data: says from when there is data; «Загрузить» opens the download from that month', async () => {
    useMonthStore().set('2026-03', null);
    const { w, router } = await mountNotices(status({}));
    expect(w.text()).toContain('Март 2026: данных ещё нет — история загружена с 10.06.2026.');
    await w.findAll('button').find((b) => b.text() === 'Загрузить')!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ section: 'connections', focus: 'import', from: '2026-03-01' });
  });

  it('a month with data: no notice', async () => {
    useMonthStore().set('2026-06', null);
    const { w } = await mountNotices(status({}));
    expect(w.text()).not.toContain('данных ещё нет');
  });
});
