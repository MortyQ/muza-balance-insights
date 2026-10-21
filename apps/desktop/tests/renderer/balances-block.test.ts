// @vitest-environment happy-dom
// The balance block mounted (features/balances, BalancesFeature): layout of the stack and the month panel. The data
// composable is replaced by fixed slides; the participant store is a fake, the month store is the real one.
// Fictional fixtures only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { computed, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

vi.mock('@/shared/api', () => ({ balanceApi: {} }));
vi.mock('@/entities/participant', async () => {
  const { reactive } = await import('vue');
  const store = reactive({ selectedId: null as number | null, people: [] });
  return { useParticipantStore: () => store, colorVar: (c: string | null) => (c === null ? 'var(--border-strong)' : `var(--series-${c})`) };
});

const flow = { currency: 980, income: 100_00, spending: 50_00, color: 'var(--series-blue)' };
const slide = (key: string, title: string) => ({
  key, title, caption: 'C', amount: '100 ₴', approx: '', others: '', actual: '', bottom: 'B', net: 1, netText: '+1 ₴', accents: ['var(--series-blue)'], dim: false, flow,
});
const SLIDES = [slide('family', 'Семья'), slide('p1', 'Аня'), slide('p2', 'Борис'), slide('p3', 'Вика'), slide('p4', 'Гена')];

vi.mock('@/features/balances/composables/useMonthOverview.ts', () => ({
  useMonthOverview: () => ({
    state: ref({ status: 'success', data: {} }),
    view: computed(() => ({ month: '2026-09', coverage: { from: '2026-09-01', to: '2026-09-30' }, total: { accounts: 4 } })),
    slides: computed(() => SLIDES),
    isFamily: computed(() => true),
    legend: computed(() => []),
    monthName: computed(() => 'Сентябрь'),
  }),
}));

let w: VueWrapper | null = null;
beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  w?.unmount();
  w = null;
});

async function mountBlock(): Promise<VueWrapper> {
  const { i18n } = await import('@/shared/lib/i18n.ts');
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/planning', '/income'].map((path) => ({ path, name: path === '/' ? 'home' : path.slice(1), component: { render: () => null } })),
  });
  await router.push('/');
  const { BalancesFeature } = await import('@/features/balances');
  w = mount(BalancesFeature, { global: { plugins: [i18n, router] }, attachTo: document.body });
  await flushPromises();
  return w;
}

describe('balance block layout', () => {
  it('the month panel sits beside the stack from 44rem of block width and under it below, never at a fixed width over the stack', async () => {
    const b = await mountBlock();
    const panel = b.get('[data-test="panel"]');
    expect(panel.element.parentElement?.classList.contains('@container')).toBe(true);
    expect(panel.classes()).toEqual(expect.arrayContaining(['@[44rem]:absolute', '@[44rem]:left-[430px]', '@[44rem]:right-0']));
    expect(panel.classes()).not.toContain('absolute');
    expect(b.html()).not.toContain('w-[340px] [transition');
    expect(b.html()).toContain('@[44rem]:max-w-[340px]');
  });

  it('opening the row folds the panel away (no empty space under the row) and makes it inert', async () => {
    const b = await mountBlock();
    const panel = b.get('[data-test="panel"]');
    expect(panel.classes()).toContain('grid-rows-[1fr]');
    expect(panel.attributes('inert')).toBeUndefined();
    await b.get('button[aria-expanded]').trigger('click');
    expect(panel.classes()).toContain('grid-rows-[0fr]');
    expect(panel.attributes('inert')).toBeDefined();
  });
});
