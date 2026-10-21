// @vitest-environment happy-dom
// The stack ⇄ row state of the balance block and the open row's scrolling, run inside an effect scope (no component).
// The participant store is a fake with a writable selectedId; the month store is the real one. happy-dom has no layout:
// the row's scrollLeft / clientWidth / scrollTo are set by hand.
import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick, ref, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ selectedId: null as number | null }));
vi.mock('@/entities/participant', async () => {
  const { reactive } = await import('vue');
  const store = reactive(fake);
  return { useParticipantStore: () => store, colorVar: (c: string | null) => (c === null ? 'var(--border-strong)' : `var(--series-${c})`) };
});

const { useCardStack } = await import('@/features/balances/composables/useCardStack.ts');
const { useRowScroll } = await import('@/features/balances/composables/useRowScroll.ts');
const { useMonthStore } = await import('@/entities/period');
const { useParticipantStore } = await import('@/entities/participant');

let scope: EffectScope;
beforeEach(() => {
  setActivePinia(createPinia());
  fake.selectedId = null;
  scope = effectScope();
});
afterEach(() => scope.stop());

describe('useCardStack', () => {
  it('toggle opens and closes with the stagger; close on a folded stack does nothing', () => {
    const stack = scope.run(() => useCardStack())!;
    stack.toggle();
    expect([stack.open.value, stack.paging.value]).toEqual([true, false]);
    stack.toggle();
    expect(stack.open.value).toBe(false);
    stack.close();
    expect(stack.open.value).toBe(false);
  });

  it('a new month or a new person changes the cards in place and brings the row back to its start', async () => {
    const onReset = vi.fn();
    const stack = scope.run(() => useCardStack({ onReset }))!;
    stack.toggle();
    useMonthStore().set('2020-01', null);
    await nextTick();
    expect([stack.paging.value, stack.open.value]).toEqual([true, true]);
    expect(onReset).toHaveBeenCalledTimes(1);
    (useParticipantStore() as { selectedId: number | null }).selectedId = 7;
    await nextTick();
    expect(onReset).toHaveBeenCalledTimes(2);
  });

  it('the «Все счета» note shows until the stack is toggled', () => {
    const stack = scope.run(() => useCardStack())!;
    stack.showStub();
    expect(stack.stubShown.value).toBe(true);
    stack.toggle();
    expect(stack.stubShown.value).toBe(false);
  });
});

/** A row element with a settable scroll position and width; scrollTo moves it at once and ends the scroll. */
function fakeRow(width: number) {
  const el = document.createElement('div');
  let left = 0;
  Object.defineProperty(el, 'clientWidth', { get: () => width });
  Object.defineProperty(el, 'scrollLeft', { get: () => left, set: (v: number) => (left = v) });
  const scrollTo = vi.fn((o: ScrollToOptions) => {
    left = o.left ?? left;
    el.dispatchEvent(new Event('scroll'));
    el.dispatchEvent(new Event('scrollend'));
  });
  el.scrollTo = scrollTo as unknown as typeof el.scrollTo;
  return { el, scrollTo, setLeft: (v: number) => (left = v) };
}

describe('useRowScroll', () => {
  it('reads where the row stands; the arrows move by one card from the first in view, a dot to its card', async () => {
    const { el, scrollTo } = fakeRow(832);
    const count = ref(5);
    const s = scope.run(() => useRowScroll(el, count))!;
    await nextTick();
    expect(s.view.value).toMatchObject({ first: 0, last: 1, atStart: true, atEnd: false, fits: false });
    s.next();
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 416 }));
    await new Promise((r) => requestAnimationFrame(r));
    expect(s.view.value).toMatchObject({ first: 1, last: 2, atStart: false });
    s.prev();
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 0 }));
    s.goTo(4);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 1664 }));
    s.prev();
    s.goTo(-1);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 0 }));
  });

  it('fewer cards: the view follows the count', async () => {
    const { el } = fakeRow(832);
    const count = ref(5);
    const s = scope.run(() => useRowScroll(el, count))!;
    await nextTick();
    count.value = 2;
    await nextTick();
    expect(s.view.value).toMatchObject({ fits: true, atEnd: true });
  });

  it('toStart: resolves at once at the start; otherwise after the scroll ends, smooth unless asked for instant', async () => {
    const { el, scrollTo, setLeft } = fakeRow(832);
    const s = scope.run(() => useRowScroll(el, 5))!;
    await s.toStart();
    expect(scrollTo).not.toHaveBeenCalled();
    setLeft(832);
    await s.toStart();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
    expect(el.scrollLeft).toBe(0);
    setLeft(416);
    await s.toStart(true);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'instant' });
  });

  it('toStart: a scroll that never reports its end still resolves', async () => {
    const { el, setLeft } = fakeRow(832);
    el.scrollTo = vi.fn() as unknown as typeof el.scrollTo;
    const s = scope.run(() => useRowScroll(el, 5))!;
    setLeft(416);
    vi.useFakeTimers();
    const done = s.toStart();
    vi.advanceTimersByTime(500);
    await expect(done).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
