// @vitest-environment happy-dom
// The layouts (app/layouts): the shell comes from the route's meta.layout, the app navigation sidebar of the default
// one from the routes' meta.nav, and a change inside one layout keeps the shell. The filters widget is a stub (it reads main's data).
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';

vi.mock('@/widgets/global-filters', () => ({ GlobalFilters: defineComponent(() => () => h('header', { 'data-test': 'filters' })) }));
vi.mock('@/features/integrations', () => ({ QuickUploadFeature: defineComponent(() => () => h('div', { 'data-test': 'quick-upload' })) }));

const { default: MasterLayout } = await import('@/app/layouts/MasterLayout.vue');
const { layoutOf, navGroups, navItems } = await import('@/app/layouts/utils.ts');
const { routes } = await import('@/app/router/routes.ts');
const { i18n } = await import('@/shared/lib');

const page = (name: string) => defineComponent(() => () => h('main', { 'data-page': name }, name));
let homeSetups = 0;
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

  it('the app: «General» (home), «Analytics», «Regular payments», «Planning», in the default layout; the other screens are on their own', () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    expect(navGroups(router.getRoutes())).toEqual([
      {
        items: [
          { label: 'home.nav.general', icon: 'lucide:layout-dashboard', id: 'home' },
          { label: 'home.nav.analytics', icon: 'lucide:chart-column', id: 'analytics' },
          { label: 'home.nav.recurring', icon: 'lucide:repeat', id: 'recurring' },
          { label: 'home.nav.planning', icon: 'lucide:calculator', id: 'planning' },
        ],
      },
    ]);
    const layouts = Object.fromEntries(router.getRoutes().map((r) => [r.name, layoutOf(r)]));
    expect(layouts).toMatchObject({ home: 'default', analytics: 'default', recurring: 'default', planning: 'default', category: 'default', connect: 'empty', settings: 'empty', 'db-recovery': 'empty', lock: 'empty' });
    // The global filters offer whole months on analytics, no period on regular payments and planning, one month elsewhere.
    expect(router.getRoutes().filter((r) => r.meta.periodFilter === 'range').map((r) => r.name)).toEqual(['analytics']);
    expect(router.getRoutes().filter((r) => r.meta.periodFilter === 'none').map((r) => r.name)).toEqual(['recurring', 'planning']);
  });
});

describe('navItems', () => {
  it('the side menu as sidebar entries: translated, opening their route, standing for the screens that name them as parent', () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    const items = navItems(router.getRoutes(), (key) => `t:${key}`);
    expect(items.map((i) => i.id)).toEqual(['home', 'analytics', 'recurring', 'planning']);
    expect(items[0]).toMatchObject({ label: 't:home.nav.general', icon: 'lucide:layout-dashboard', to: { name: 'home' } });
    expect(items[0]?.activeFor).toEqual(expect.arrayContaining(['category', 'income']));
    expect(items[1]?.activeFor).toEqual([]);
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

  const entries = (w: Awaited<ReturnType<typeof mountAt>>['w']) => w.findAll('aside.sidebar .sidebar-nav .sidebar-item');
  const entry = (w: Awaited<ReturnType<typeof mountAt>>['w'], href: string) => w.get(`aside.sidebar .sidebar-nav a[href="${href}"]`);

  it('the default layout: the sidebar from the routes with the open one current, the title, the filters, the screen', async () => {
    const { w } = await mountAt('/');
    expect(w.find('[data-test="filters"]').exists()).toBe(true);
    expect(entries(w).map((e) => e.attributes('href'))).toEqual(['/', '/second']);
    expect(entry(w, '/').attributes('aria-current')).toBe('page');
    expect(entry(w, '/second').attributes('aria-current')).toBeUndefined();
    expect(w.get('[data-test="screen-title"]').text()).toBe(i18n.global.t('home.nav.general'));
    expect(w.get('aside.sidebar .v-sidebar-footer a').attributes('href')).toBe('/settings');
    // No shared panel: the header (with the filters) and the scroll area sit on the window's background next to the sidebar.
    expect(w.find('[data-test="layout-panel"]').exists()).toBe(false);
    const main = w.get('[data-test="layout-main"]');
    expect(main.classes()).not.toContain('bg-surface');
    expect(main.get('[data-test="layout-header"]').find('[data-test="filters"]').exists()).toBe(true);
    expect(main.find('[data-test="layout-scroll"]').exists()).toBe(true);
    expect(main.find('aside.sidebar').exists()).toBe(false);
    expect(w.find('[data-page="home"]').exists()).toBe(true);
    w.unmount();
  });

  it('the header shows its hairline only while the content is scrolled under it', async () => {
    const { w } = await mountAt('/');
    const header = () => w.get('[data-test="layout-header"]');
    expect(header().classes()).toContain('border-transparent');
    const area = w.get('[data-test="layout-scroll"]').element as HTMLElement;
    area.scrollTop = 120;
    area.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(header().classes()).toContain('border-border-subtle');
    area.scrollTop = 0;
    area.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(header().classes()).toContain('border-transparent');
    w.unmount();
  });

  it('a screen without its own item keeps its parent current and titled (the category screen → «General»)', async () => {
    const { w } = await mountAt('/sub');
    expect(w.find('[data-page="sub"]').exists()).toBe(true);
    expect(entry(w, '/').attributes('aria-current')).toBe('page');
    expect(w.get('[data-test="screen-title"]').text()).toBe(i18n.global.t('home.nav.general'));
    w.unmount();
  });

  it('a menu pick opens its route inside the same shell', async () => {
    const { w, router } = await mountAt('/');
    const filters = w.find('[data-test="filters"]').element;
    await entry(w, '/second').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('second');
    expect(w.find('[data-test="filters"]').element).toBe(filters);
    expect(entry(w, '/second').attributes('aria-current')).toBe('page');
    w.unmount();
  });

  it('no screen is kept alive: back from another screen, home is set up anew', async () => {
    const { w, router } = await mountAt('/');
    const before = homeSetups;
    await router.push('/sub');
    await flushPromises();
    expect(w.find('[data-page="sub"]').exists()).toBe(true);
    await router.push('/');
    await flushPromises();
    expect(w.find('[data-page="home"]').exists()).toBe(true);
    expect(homeSetups).toBe(before + 1);
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

  it('a medium window shows icons only without changing the stored choice; the choice is kept under app.sidebar', async () => {
    const listeners: Array<(e: { matches: boolean }) => void> = [];
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('63.99rem'),
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
      removeEventListener: () => {},
    }));
    const { w } = await mountAt('/');
    expect(w.get('aside.sidebar').classes()).toContain('sidebar--collapsed');
    expect(localStorage.getItem('app.sidebar:collapsed')).toBe('false');
    listeners.forEach((fn) => fn({ matches: false }));
    await flushPromises();
    expect(w.get('aside.sidebar').classes()).not.toContain('sidebar--collapsed');
    w.unmount();
    vi.unstubAllGlobals();
  });

  it('the empty layout: the screen alone', async () => {
    const { w } = await mountAt('/settings');
    expect(w.find('[data-test="filters"]').exists()).toBe(false);
    expect(w.find('aside.sidebar').exists()).toBe(false);
    expect(w.find('nav').exists()).toBe(false);
    expect(w.find('[data-page="settings"]').exists()).toBe(true);
    w.unmount();
  });
});
