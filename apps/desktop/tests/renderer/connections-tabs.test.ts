// @vitest-environment happy-dom
// «Connections» in settings is three tabs — the banks, auto-sync, the history download — one shown at a time; the tab is
// in the address, and the link to the history download opens its tab. The features are stubs here: only what the
// widget shows where. Also the connection row: the token's state stands next to the bank's name.
// Typechecked with the renderer (tsconfig.web.json).
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import type { ConnectionView } from '@contract/api.ts';
import type { ConnectionsTab } from '@/shared/config';

const stub = (name: string) => defineComponent({ name, props: { focus: Boolean, requestedFrom: String }, setup: () => () => h('div', { 'data-test': name }) });

// Module → its exports as stubs named by `data-test` (the export's name unless given).
const stubs = vi.hoisted(() => async (exports: Record<string, string>) => {
  const { defineComponent: define, h: el } = await import('vue');
  return Object.fromEntries(
    Object.entries(exports).map(([key, name]) => [key, define({ name, props: { focus: Boolean, requestedFrom: String }, setup: () => () => el('div', { 'data-test': name }) })]),
  );
});
vi.mock('@/features/integrations', () => stubs({ ConnectionsFeature: 'banks' }));
vi.mock('@/features/bank-refresh', () => stubs({ BankRefreshFeature: 'refresh' }));
vi.mock('@/features/import-statement', () => stubs({ ImportFeature: 'history' }));
// Every settings card the widget maps; only auto-sync is looked at.
vi.mock('@/features/settings', () =>
  stubs({
    AutoSyncSettingsFeature: 'auto-sync',
    ...Object.fromEntries(
      ['AppLockSettingsFeature', 'DbEncryptionFeature', 'DeleteDataFeature', 'LanguageSelectFeature', 'NetworkInfoFeature', 'PeopleFeature', 'StorageInfoFeature', 'ThemeSwitchFeature', 'UpdateSettingsFeature'].map((c) => [c, c]),
    ),
  }),
);

describe('the tab in the address', () => {
  it('connectionsTab: a known tab; none, unknown or repeated → the banks', async () => {
    const { CONNECTION_TABS, connectionsTab } = await import('@/shared/config');
    expect(CONNECTION_TABS).toEqual(['banks', 'auto-sync', 'history']);
    expect(CONNECTION_TABS.map((t) => connectionsTab(t))).toEqual(['banks', 'auto-sync', 'history']);
    expect([connectionsTab(undefined), connectionsTab('nope'), connectionsTab(['history'])]).toEqual(['banks', 'banks', 'banks']);
  });

  it('the link to the history download opens its tab', async () => {
    const { connectionsTab, importLink } = await import('@/shared/config');
    expect(connectionsTab(importLink('2026-03-01').query.tab)).toBe('history');
  });
});

describe('the tabs of «Connections»', () => {
  async function widget(props: { tab?: ConnectionsTab; importFrom?: string; focusImport?: boolean }) {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { SettingsWidget } = await import('@/widgets/settings');
    const w = mount(SettingsWidget, { props: { section: 'connections', ...props }, global: { plugins: [i18n] } });
    await flushPromises();
    const shown = () => ['banks', 'auto-sync', 'history'].filter((t) => w.find(`[data-test="${t}"]`).exists());
    const tabs = () => w.findAll('.v-segmented-control button');
    return { w, shown, tabs };
  }

  it('the banks by default; each tab shows its own block and nothing else', async () => {
    expect((await widget({})).shown()).toEqual(['banks']);
    expect((await widget({ tab: 'auto-sync' })).shown()).toEqual(['auto-sync']);
    expect((await widget({ tab: 'history' })).shown()).toEqual(['history']);
  });

  it('three named tabs, the open one pressed', async () => {
    const { tabs } = await widget({ tab: 'history' });
    expect(tabs().map((b) => b.text())).toEqual(['Банки', 'Автосинхронизация', 'История']);
    expect(tabs().map((b) => b.attributes('aria-pressed'))).toEqual(['false', 'false', 'true']);
  });

  it('a click asks for the tab: the page puts it into the address', async () => {
    const { w, tabs } = await widget({});
    await tabs()[2]?.trigger('click');
    expect(w.emitted('selectTab')).toEqual([['history']]);
  });

  it('the history download gets the link’s date and focus', async () => {
    const { w } = await widget({ tab: 'history', importFrom: '2026-03-01', focusImport: true });
    expect(w.findComponent({ name: 'history' }).props()).toMatchObject({ requestedFrom: '2026-03-01', focus: true });
  });
});

describe('a connection row', () => {
  it('the token’s state stands next to the bank’s name, not among the buttons', async () => {
    setActivePinia(createPinia());
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { default: ConnectionRow } = await import('@/features/integrations/shared/components/ConnectionRow.vue');
    const { tokenBadge } = await import('@/entities/participant');
    const connection: ConnectionView = {
      id: 1, provider: 'monobank', bank: 'Monobank', accounts: 5, enabledAccounts: 5, coveredFrom: null, coveredTo: null, lastSyncAt: null,
      token: { present: true, stored: 'secure', secureStorage: true, needsReentry: false },
    };
    const w = mount(ConnectionRow, {
      props: { connection, secureStorage: true, tokenField: stub('token-field'), accounts: undefined, cardTypes: {}, importRunning: false, savingAccount: null },
      global: { plugins: [i18n] },
    });
    const name = w.findAll('span').find((s) => s.text() === 'Monobank');
    expect(name?.element.parentElement?.textContent).toContain(tokenBadge(connection.token).text);
    expect(name?.element.parentElement?.querySelector('button')).toBeNull();
  });
});
