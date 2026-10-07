// @vitest-environment happy-dom
// The layouts (app/layouts): the shell comes from the route's meta.layout, the side menu of the default one from the
// routes' meta.nav, and a change inside one layout keeps the shell. The filters widget is a stub (it reads main's data).
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';

vi.mock('@/widgets/global-filters', () => ({ GlobalFilters: defineComponent(() => () => h('header', { 'data-test': 'filters' })) }));

const { default: MasterLayout } = await import('@/app/layouts/MasterLayout.vue');
const { layoutOf, navGroups } = await import('@/app/layouts/utils.ts');
const { routes } = await import('@/app/router/routes.ts');
const { i18n } = await import('@/shared/lib');

const page = (name: string) => defineComponent(() => () => h('main', { 'data-page': name }, name));
let homeSetups = 0;
// Named as the real home page, so MasterLayout's KEPT_ALIVE matches it.
const homePage = defineComponent({
  name: 'HomePage',
  setup: () => {
    homeSetups += 1;
    return () => h('main', { 'data-page': 'home' }, 'home');
  },
});

describe('layoutOf', () => {
  it('meta.layout, else default', () => {
    expect(layoutOf({ meta: {} })).toBe('default');
    expect(layoutOf({ meta: { layout: 'empty' } })).toBe('empty');
  });
});

describe('navGroups', () => {
  it('the routes with meta.nav, by order, in one untitled group; none → no group', () => {
    const r = (name: string, order?: number) => ({
      name,
      meta: order === undefined ? {} : { nav: { label: 'home.nav.general' as const, icon: `i-${name}`, order } },
    });
    expect(navGroups([r('b', 2), r('x'), r('a', 1)])).toEqual([
      {
        items: [
          { label: 'home.nav.general', icon: 'i-a', id: 'a' },
          { label: 'home.nav.general', icon: 'i-b', id: 'b' },
        ],
      },
    ]);
    expect(navGroups([r('x')])).toEqual([]);
  });

  it('the app: «General» (home), «Analytics», «Regular payments», in the default layout; the other screens are on their own', () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    expect(navGroups(router.getRoutes())).toEqual([
      {
        items: [
          { label: 'home.nav.general', icon: 'lucide:layout-dashboard', id: 'home' },
          { label: 'home.nav.analytics', icon: 'lucide:chart-column', id: 'analytics' },
          { label: 'home.nav.recurring', icon: 'lucide:repeat', id: 'recurring' },
        ],
      },
    ]);
    const layouts = Object.fromEntries(router.getRoutes().map((r) => [r.name, layoutOf(r)]));
    expect(layouts).toMatchObject({ home: 'default', analytics: 'default', recurring: 'default', category: 'default', connect: 'empty', settings: 'empty', 'db-recovery': 'empty', lock: 'empty' });
    // The global filters offer whole months on analytics, no period on regular payments, one month elsewhere.
    expect(router.getRoutes().filter((r) => r.meta.periodFilter === 'range').map((r) => r.name)).toEqual(['analytics']);
    expect(router.getRoutes().filter((r) => r.meta.periodFilter === 'none').map((r) => r.name)).toEqual(['recurring']);
  });
});

describe('MasterLayout', () => {
  async function mountAt(path: string) {
    const test: RouteRecordRaw[] = [
      { path: '/', name: 'home', component: homePage, meta: { nav: { label: 'home.nav.general', icon: 'lucide:layout-dashboard', order: 0 } } },
      { path: '/second', name: 'second', component: page('second'), meta: { nav: { label: 'home.nav.label', icon: 'lucide:list', order: 1 } } },
      { path: '/settings', name: 'settings', component: page('settings'), meta: { layout: 'empty' } },
      { path: '/sub', name: 'category', component: page('sub'), meta: { navParent: 'home' } },
    ];
    const router = createRouter({ history: createMemoryHistory(), routes: test });
    await router.push(path);
    const w = mount(MasterLayout, { global: { plugins: [router, i18n] } });
    await flushPromises();
    return { w, router };
  }

  it('the default layout: filters, the menu from the routes with the open one current, the screen', async () => {
    const { w } = await mountAt('/');
    expect(w.find('[data-test="filters"]').exists()).toBe(true);
    const items = w.findAll('nav button');
    expect(items.map((b) => b.attributes('data-item'))).toEqual(['home', 'second']);
    expect(items[0]?.attributes('aria-current')).toBe('page');
    expect(w.find('[data-page="home"]').exists()).toBe(true);
    w.unmount();
  });

  it('a screen without its own item keeps its parent current (the category screen → «General»)', async () => {
    const { w } = await mountAt('/sub');
    expect(w.find('[data-page="sub"]').exists()).toBe(true);
    expect(w.find('nav button[data-item="home"]').attributes('aria-current')).toBe('page');
    w.unmount();
  });

  it('a menu pick opens its route inside the same shell', async () => {
    const { w, router } = await mountAt('/');
    const filters = w.find('[data-test="filters"]').element;
    await w.find('nav button[data-item="second"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('second');
    expect(w.find('[data-test="filters"]').element).toBe(filters);
    expect(w.find('nav button[data-item="second"]').attributes('aria-current')).toBe('page');
    w.unmount();
  });

  it('home stays alive while another screen of its layout is open: back from it, nothing is set up anew', async () => {
    const { w, router } = await mountAt('/');
    const before = homeSetups;
    await router.push('/sub');
    await flushPromises();
    expect(w.find('[data-page="sub"]').exists()).toBe(true);
    await router.push('/');
    await flushPromises();
    expect(w.find('[data-page="home"]').exists()).toBe(true);
    expect(homeSetups).toBe(before);
    w.unmount();
  });

  it('another screen starts at its top: the scroll area glides up; already at the top — left alone', async () => {
    const { w, router } = await mountAt('/');
    const area = w.get('[data-test="layout-scroll"]').element as HTMLElement;
    const scrollTo = vi.fn();
    area.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];
    area.scrollTop = 600;
    await router.push('/sub');
    await flushPromises();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    scrollTo.mockClear();
    area.scrollTop = 0;
    await router.push('/second');
    await flushPromises();
    expect(scrollTo).not.toHaveBeenCalled();
    w.unmount();
  });

  it('the real home page carries the name KEPT_ALIVE lists', async () => {
    const { HomePage } = await import('@/pages/home');
    expect((HomePage as { __name?: string }).__name).toBe('HomePage');
  });

  it('the empty layout: the screen alone', async () => {
    const { w } = await mountAt('/settings');
    expect(w.find('[data-test="filters"]').exists()).toBe(false);
    expect(w.find('nav').exists()).toBe(false);
    expect(w.find('[data-page="settings"]').exists()).toBe(true);
    w.unmount();
  });
});
