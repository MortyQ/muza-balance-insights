// @vitest-environment happy-dom
// The balance block mounted (features/balances, BalancesFeature): layout of the stack, the month panel and the month pace. The data
// composable is replaced by fixed slides; the participant store is a fake, the month store is the real one.
// Fictional fixtures only.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { computed, nextTick, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

vi.mock('@/shared/api', () => ({ balanceApi: {} }));
vi.mock('@/entities/participant', async () => {
  const { reactive } = await import('vue');
  const store = reactive({ selectedId: null as number | null, people: [] });
  return { useParticipantStore: () => store, colorVar: (c: string | null) => (c === null ? 'var(--border-strong)' : `var(--series-${c})`) };
});

const flow = { currency: 980, income: 100_00, spending: 50_00, color: 'var(--series-blue)' };
const slide = (key: string, title: string) => ({
  key,
  kind: 'summary' as const,
  card: {
    title, caption: 'C', count: 'B', amount: '100 ₴', fx: [], negative: false, own: null, reserved: null, people: null, freeShare: null,
    net: { label: 'L', amount: '+1 ₴', value: 1 }, accents: ['var(--series-blue)'], dim: false,
  },
  flow,
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

vi.mock('@/features/balances/composables/useMonthPace.ts', async () => {
  const { moneyFormat } = await import('@/entities/currency-display');
  return {
    useMonthPace: () => ({
      view: computed(() => ({ days: ['1', '2'], spent: [10_00, 30_00], usual: [8_00, 16_00], last: 1, running: false, spentTotal: 30_00, usualByNow: 16_00, perDay: null })),
      fmt: computed(() => moneyFormat(null, { main: 980, also: { uah: false, usd: false, eur: false } })),
    }),
  };
});
vi.mock('@/shared/ui/components/charts/VChart.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return { default: defineComponent({ props: { option: Object }, setup: () => () => h('div') }) };
});

let w: VueWrapper | null = null;
beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  w?.unmount();
  w = null;
});

// The first import of the feature graph is cold: under a full parallel run it alone can outlast a test's 5 s.
beforeAll(async () => {
  await import('@/shared/lib/i18n.ts');
  await import('@/features/balances');
}, 30_000);

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

describe('balance tiles', () => {
  it('three tiles straight into the page grid: «Balance», «Month pace», «Month»; «Balance» spans two columns of two; 5 · 4 · 3 of twelve', async () => {
    const b = await mountBlock();
    const root = b.element as HTMLElement;
    expect(root.classList.contains('contents')).toBe(true);
    const tiles = [...root.children].map((c) => c.getAttribute('data-test'));
    expect(tiles).toEqual(['balance-tile', 'pace', 'panel']);
    // Under 65rem a row each; 65–79rem «Balance» | «Month» over «Month pace»; from 79rem one row of 5·4·3.
    expect(b.get('[data-test="balance-tile"]').classes()).toEqual(
      expect.arrayContaining(['@[47rem]:col-span-2', '@[65rem]:col-span-1', '@[65rem]:row-start-1', '@[79rem]:col-span-5', '@[79rem]:row-start-auto']),
    );
    expect(b.get('[data-test="pace"]').classes()).toEqual(
      expect.arrayContaining(['@[47rem]:col-span-2', '@[65rem]:row-start-2', '@[79rem]:col-span-4', '@[79rem]:row-start-auto']),
    );
    // Alone in its row the tile takes no height from a neighbour: the chart keeps its own minimum.
    expect(b.get('[data-test="pace"] [role="img"]').classes()).toContain('min-h-44');
    expect(b.get('[data-test="panel"]').classes()).toEqual(
      expect.arrayContaining(['@[47rem]:col-span-2', '@[65rem]:col-span-1', '@[65rem]:row-start-1', '@[79rem]:col-span-3', '@[79rem]:row-start-auto']),
    );
    // The chart's tile may shrink with the grid (a grid item keeps its content's width otherwise).
    expect(b.get('[data-test="pace"]').classes()).toContain('min-w-0');
  });

  it('opening the row widens «Balance» to the whole row and hides the other two, kept mounted and inert', async () => {
    const b = await mountBlock();
    const pace = b.get('[data-test="pace"]');
    const panel = b.get('[data-test="panel"]');
    expect(pace.isVisible()).toBe(true);
    expect(panel.attributes('inert')).toBeUndefined();
    await b.get('button[aria-expanded]').trigger('click');
    expect(b.get('[data-test="balance-tile"]').classes()).toContain('col-span-full');
    for (const tile of [pace, panel]) {
      expect(tile.element.isConnected).toBe(true);
      expect(tile.isVisible()).toBe(false);
      expect(tile.attributes('inert')).toBeDefined();
    }
  });

  it('«Month»: the title, then the month\'s result under the bars, in green above zero', async () => {
    const b = await mountBlock();
    const panel = b.get('[data-test="panel"]');
    expect(panel.find('h3').text()).toBe('Месяц');
    const result = panel.get('[data-test="month-result"]');
    expect(result.text()).toContain('Итог месяца');
    expect(result.text()).toContain('+50 ₴');
    expect(result.find('.text-success').exists()).toBe(true);
  });

  it('under the stack: the front card\'s free amount', async () => {
    const b = await mountBlock();
    expect(b.get('[data-test="free-line"]').text()).toContain('100 ₴');
  });
});

describe('free line', () => {
  it('money above the reserves: the free part as the bar — the family card too', async () => {
    const { freeLineOf } = await import('@/features/balances/utils.ts');
    const total = slide('family', 'Семья');
    expect(freeLineOf({ ...total, card: { ...total.card, reserved: '40 ₴' }, split: { own: 100_00, reserved: 40_00 } })).toEqual({
      free: '100 ₴', negative: false, reserved: '40 ₴', share: 60, short: false,
    });
  });

  it('reserves above the money: short, the bar is the part the money covers; money below zero covers nothing', async () => {
    const { freeLineOf } = await import('@/features/balances/utils.ts');
    const total = slide('family', 'Семья');
    const short = { ...total, card: { ...total.card, amount: '−20 ₴', negative: true, reserved: '80 ₴' } };
    expect(freeLineOf({ ...short, split: { own: 60_00, reserved: 80_00 } })).toEqual({ free: '−20 ₴', negative: true, reserved: '80 ₴', share: 75, short: true });
    expect(freeLineOf({ ...short, split: { own: -10_00, reserved: 80_00 } })?.share).toBe(0);
  });

  it('no reserve: no bar; an account: its own funds; a dim card: nothing', async () => {
    const { freeLineOf } = await import('@/features/balances/utils.ts');
    const total = slide('family', 'Семья');
    expect(freeLineOf(total)).toEqual({ free: '100 ₴', negative: false, reserved: null, share: null, short: false });
    expect(freeLineOf({ ...total, card: { ...total.card, dim: true } })).toBeNull();
    expect(freeLineOf(null)).toBeNull();
  });
});

/** The open row's element with a scroll position that happy-dom can hold, and scrollTo / pointer capture stubbed. */
function rowOf(b: VueWrapper, { endOnScroll = true } = {}) {
  const el = b.get('[data-test="row"]').element as HTMLElement;
  let left = 0;
  Object.defineProperty(el, 'scrollLeft', { configurable: true, get: () => left, set: (v: number) => (left = v) });
  const scrollTo = vi.fn((o: ScrollToOptions) => {
    left = o.left ?? left;
    if (endOnScroll) el.dispatchEvent(new Event('scrollend'));
  });
  el.scrollTo = scrollTo as unknown as typeof el.scrollTo;
  el.setPointerCapture = vi.fn();
  el.hasPointerCapture = vi.fn(() => true);
  el.releasePointerCapture = vi.fn();
  return { el, scrollTo, setLeft: (v: number) => (left = v) };
}
const pointer = (type: string, clientX: number, pointerType = 'mouse') =>
  new PointerEvent(type, { pointerType, clientX, button: 0, pointerId: 1, bubbles: true, cancelable: true });
const expanded = (b: VueWrapper) => b.get('button[aria-expanded]').attributes('aria-expanded');

describe('the open row', () => {
  it('is a snapping scroller without a scroll bar; folded, it only clips', async () => {
    const b = await mountBlock();
    const row = b.get('[data-test="row"]');
    expect(row.classes()).toContain('overflow-clip');
    expect(row.classes()).not.toContain('snap-x');
    await b.get('button[aria-expanded]').trigger('click');
    expect(row.classes()).toEqual(expect.arrayContaining(['overflow-x-auto', 'snap-x', 'snap-mandatory', '[scrollbar-width:none]']));
    // At the start: only the right edge fades.
    expect(row.attributes('style')).toContain('--fade-l: 0px');
    expect(row.attributes('style')).toContain('--fade-r: 32px');
  });

  it('every card takes focus while open, and a focused card is scrolled into view', async () => {
    const b = await mountBlock();
    const cards = () => b.findAll('[data-test="row"] button');
    expect(cards().filter((c) => c.attributes('tabindex') !== '-1')).toHaveLength(1);
    await cards()[0]!.trigger('click');
    expect(cards().every((c) => c.attributes('tabindex') !== '-1')).toBe(true);
    const into = vi.fn();
    (cards()[3]!.element as HTMLElement).scrollIntoView = into;
    await cards()[3]!.trigger('focusin');
    expect(into).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' });
  });

  it('a mouse drag scrolls the row with snapping off, and the click after it does not fold the row', async () => {
    const b = await mountBlock();
    await b.get('button[aria-expanded]').trigger('click');
    const { el } = rowOf(b);
    const card = b.findAll('[data-test="row"] button')[1]!.element;
    card.dispatchEvent(pointer('pointerdown', 300));
    card.dispatchEvent(pointer('pointermove', 298));
    expect(el.scrollLeft).toBe(0);
    card.dispatchEvent(pointer('pointermove', 200));
    await nextTick();
    expect(el.scrollLeft).toBe(100);
    expect(b.get('[data-test="row"]').classes()).toContain('snap-none');
    card.dispatchEvent(pointer('pointerup', 200));
    await nextTick();
    expect(b.get('[data-test="row"]').classes()).toContain('snap-x');
    (card as HTMLElement).click();
    await flushPromises();
    expect(expanded(b)).toBe('true');
  });

  it('touch is left to native scrolling, and a plain click still folds the row', async () => {
    const b = await mountBlock();
    await b.get('button[aria-expanded]').trigger('click');
    const { el } = rowOf(b);
    const card = b.findAll('[data-test="row"] button')[0]!.element as HTMLElement;
    card.dispatchEvent(pointer('pointerdown', 300, 'touch'));
    card.dispatchEvent(pointer('pointermove', 100, 'touch'));
    expect(el.scrollLeft).toBe(0);
    card.click();
    await flushPromises();
    expect(expanded(b)).toBe('false');
  });

  it('dots: one per card, named, the cards in view marked, hidden while folded; a dot scrolls to its card', async () => {
    const b = await mountBlock();
    const dots = () => b.findAll('[data-test="row-dot"]');
    expect(dots()).toHaveLength(5);
    expect(dots()[0]!.element.parentElement?.getAttribute('aria-hidden')).toBe('true');
    await b.get('button[aria-expanded]').trigger('click');
    const { scrollTo } = rowOf(b);
    expect(dots()[0]!.element.parentElement?.getAttribute('aria-hidden')).toBe('false');
    expect(dots()[0]!.attributes('aria-label')).toBe('Карта 1 из 5: Семья');
    expect(dots()[0]!.attributes('aria-current')).toBe('true');
    expect(dots()[1]!.attributes('aria-current')).toBeUndefined();
    await dots()[3]!.trigger('click');
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 3 * 416 }));
  });

  it('folding a scrolled row goes back to its start first, then stacks; focus returns to the front card', async () => {
    const b = await mountBlock();
    await b.get('button[aria-expanded]').trigger('click');
    const { el, scrollTo, setLeft } = rowOf(b, { endOnScroll: false });
    setLeft(832);
    const cards = b.findAll('[data-test="row"] button');
    (cards[2]!.element as HTMLElement).focus();
    await b.get('[data-test="row"]').trigger('keydown', { key: 'Escape' });
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 0 }));
    await flushPromises();
    expect(expanded(b)).toBe('true');
    el.dispatchEvent(new Event('scrollend'));
    await flushPromises();
    expect(expanded(b)).toBe('false');
    expect(document.activeElement).toBe(cards[0]!.element);
  });
});
