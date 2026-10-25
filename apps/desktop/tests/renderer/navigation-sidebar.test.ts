// @vitest-environment happy-dom
// The navigation sidebar copied from muzakit (shared/ui/components/navigation-sidebar): the current entry, a screen
// standing for an entry (activeFor), the folded state with names kept for screen readers, the width's forced icons
// without touching the stored choice, and the arrow keys.
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

const { NavigationSidebar, createSidebar } = await import('@/shared/ui');

const page = (name: string) => defineComponent(() => () => h('main', name));
const ITEMS = [
  { id: 'a', label: 'Alpha', icon: 'lucide:layout-dashboard', to: { name: 'a' }, activeFor: ['sub'] },
  { id: 'b', label: 'Beta', icon: 'lucide:chart-column', to: { name: 'b' } },
  { id: 'c', label: 'Gamma', icon: 'lucide:calculator', to: { name: 'c' } },
];

async function mountAt(path: string, forced = ref(false)) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['a', 'b', 'c', 'sub'].map((n) => ({ path: `/${n}`, name: n, component: page(n) })),
  });
  await router.push(path);
  const sidebar = createSidebar({ items: ITEMS, storageKey: 'test.sidebar', forceCollapsed: forced });
  const w = mount(NavigationSidebar, { props: { sidebar }, global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return { w, router, sidebar, forced };
}

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('NavigationSidebar', () => {
  it('marks the open route as the current page, and only it', async () => {
    const { w } = await mountAt('/b');
    const current = w.findAll('aside.sidebar [aria-current="page"]');
    expect(current.map((e) => e.attributes('aria-label'))).toEqual(['Beta']);
    w.unmount();
  });

  it('a screen without its own entry marks the entry it stands for', async () => {
    const { w } = await mountAt('/sub');
    expect(w.find('aside.sidebar [aria-current="page"]').attributes('aria-label')).toBe('Alpha');
    w.unmount();
  });

  it('folded: icons keep their names; the choice is stored and read back', async () => {
    const { w, sidebar } = await mountAt('/a');
    sidebar.toggleCollapse();
    await flushPromises();
    expect(w.find('aside.sidebar').classes()).toContain('sidebar--collapsed');
    expect(w.findAll('aside.sidebar .sidebar-item').map((e) => e.attributes('aria-label'))).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(w.findAll('aside.sidebar .sidebar-item__label')).toHaveLength(0);
    expect(createSidebar({ items: [], storageKey: 'test.sidebar' }).isCollapsed.value).toBe(true);
    w.unmount();
  });

  it('forced icons fold the sidebar and hide the toggle, the stored choice stays unfolded', async () => {
    const forced = ref(false);
    const { w, sidebar } = await mountAt('/a', forced);
    expect(w.find('.sidebar-header__toggle').exists()).toBe(true);
    forced.value = true;
    await flushPromises();
    expect(w.find('aside.sidebar').classes()).toContain('sidebar--collapsed');
    expect(w.find('.sidebar-header__toggle').exists()).toBe(false);
    expect(sidebar.isCollapsed.value).toBe(false);
    expect(localStorage.getItem('test.sidebar:collapsed')).toBe('false');
    w.unmount();
  });

  it('arrow keys move focus to the next entry and open it, wrapping at the ends', async () => {
    const { w, router } = await mountAt('/a');
    const entries = w.findAll<HTMLElement>('aside.sidebar .sidebar-item');
    entries[0]?.element.focus();
    await w.find('aside.sidebar nav').trigger('keydown', { key: 'ArrowDown' });
    await flushPromises();
    expect(document.activeElement).toBe(entries[1]?.element);
    expect(router.currentRoute.value.name).toBe('b');
    await w.find('aside.sidebar nav').trigger('keydown', { key: 'ArrowUp' });
    await w.find('aside.sidebar nav').trigger('keydown', { key: 'ArrowUp' });
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('c');
    w.unmount();
  });

  it('brand: logo and name unfolded; folded, the logo alone unfolds the sidebar; forced icons keep a plain logo', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'a', component: page('a') }] });
    await router.push('/');
    const forced = ref(false);
    const sidebar = createSidebar({ items: ITEMS.slice(0, 1), storageKey: 'test.sidebar', brandName: 'Brand', logoUrl: 'logo.svg', forceCollapsed: forced });
    const w = mount(NavigationSidebar, { props: { sidebar }, global: { plugins: [router] } });
    await flushPromises();
    expect(w.get('aside.sidebar .sidebar-header__name').text()).toBe('Brand');
    expect(w.get('aside.sidebar .sidebar-header__brand img').attributes('src')).toBe('logo.svg');
    sidebar.toggleCollapse();
    await flushPromises();
    expect(w.find('aside.sidebar .sidebar-header__name').exists()).toBe(false);
    const logo = w.get('aside.sidebar button.sidebar-header__toggle');
    expect(logo.find('img').attributes('src')).toBe('logo.svg');
    await logo.trigger('click');
    expect(sidebar.isCollapsed.value).toBe(false);
    forced.value = true;
    await flushPromises();
    expect(w.find('aside.sidebar button.sidebar-header__toggle').exists()).toBe(false);
    expect(w.get('aside.sidebar .sidebar-header__logo img').attributes('alt')).toBe('Brand');
    w.unmount();
  });

  it('texts come from the labels option', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'a', component: page('a') }] });
    await router.push('/');
    const sidebar = createSidebar({
      items: ITEMS.slice(0, 1),
      storageKey: 'test.sidebar',
      labels: () => ({ nav: 'Меню', collapse: 'Згорнути', expand: 'Розгорнути', closeMenu: 'Закрити' }),
    });
    const w = mount(NavigationSidebar, { props: { sidebar }, global: { plugins: [router] } });
    await flushPromises();
    expect(w.find('aside.sidebar').attributes('aria-label')).toBe('Меню');
    expect(w.find('.sidebar-header__toggle').attributes('aria-label')).toBe('Згорнути');
    w.unmount();
  });
});
