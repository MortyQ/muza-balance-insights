// The stack ⇄ row state of the balance block, run inside an effect scope (no component). The participant store is a
// fake with a writable selectedId; the month store is the real one.
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
const { useMonthStore } = await import('@/entities/period');
const { useParticipantStore } = await import('@/entities/participant');

let scope: EffectScope;
beforeEach(() => {
  setActivePinia(createPinia());
  fake.selectedId = null;
  scope = effectScope();
});
afterEach(() => scope.stop());

function setup(n: number) {
  const count = ref(n);
  const stack = scope.run(() => useCardStack(count))!;
  return { count, stack };
}

describe('useCardStack', () => {
  it('toggle opens and closes, always from the start of the row, with the stagger', () => {
    const { stack } = setup(5);
    stack.toggle();
    expect(stack.open.value).toBe(true);
    stack.next();
    expect(stack.paging.value).toBe(true);
    stack.toggle();
    expect([stack.open.value, stack.offset.value, stack.paging.value]).toEqual([false, 0, false]);
    stack.close();
    expect(stack.open.value).toBe(false);
  });

  it('next / prev stay inside [0, n − 2] and mark paging', () => {
    const { stack } = setup(4);
    stack.toggle();
    stack.prev();
    expect(stack.offset.value).toBe(0);
    expect(stack.paging.value).toBe(true);
    stack.next();
    stack.next();
    stack.next();
    expect(stack.offset.value).toBe(2);
    stack.prev();
    expect(stack.offset.value).toBe(1);
  });

  it('two cards or fewer: no paging at all', () => {
    const { stack } = setup(2);
    stack.toggle();
    stack.next();
    expect(stack.offset.value).toBe(0);
  });

  it('a new month or a new person pages back to the start without the stagger', async () => {
    const { stack } = setup(6);
    stack.toggle();
    stack.next();
    stack.next();
    useMonthStore().set('2020-01', null);
    await nextTick();
    expect([stack.offset.value, stack.paging.value, stack.open.value]).toEqual([0, true, true]);

    stack.next();
    (useParticipantStore() as { selectedId: number | null }).selectedId = 7;
    await nextTick();
    expect(stack.offset.value).toBe(0);
  });

  it('fewer cards pull the offset back in range', async () => {
    const { count, stack } = setup(6);
    stack.toggle();
    for (let i = 0; i < 4; i++) stack.next();
    expect(stack.offset.value).toBe(4);
    count.value = 3;
    await nextTick();
    expect(stack.offset.value).toBe(1);
    count.value = 10;
    await nextTick();
    expect(stack.offset.value).toBe(1);
  });

  it('the «Все счета» note shows until the stack is toggled', () => {
    const { stack } = setup(3);
    stack.showStub();
    expect(stack.stubShown.value).toBe(true);
    stack.toggle();
    expect(stack.stubShown.value).toBe(false);
  });
});
