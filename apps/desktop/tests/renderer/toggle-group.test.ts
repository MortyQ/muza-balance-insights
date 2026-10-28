// @vitest-environment happy-dom
// The toggle group (shared/ui): several values on at once, toggle buttons in a named group; `required` keeps the last
// one on and says why.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { VToggleGroup } from '@/shared/ui';

const OPTIONS = [
  { label: 'Alpha', value: 'a' },
  { label: 'Beta', value: 'b' },
  { label: 'Gamma', value: 'c' },
];

const pressed = (w: ReturnType<typeof mount>) => w.findAll('button').map((b) => b.attributes('aria-pressed'));
const emitted = (w: ReturnType<typeof mount>) => (w.emitted('update:modelValue') ?? []).map((e) => e[0]);

describe('VToggleGroup', () => {
  it('a named group of toggle buttons with their pressed state', () => {
    const w = mount(VToggleGroup, { props: { modelValue: ['a', 'c'], options: OPTIONS, groupLabel: 'Fictional choices' } });
    expect(w.attributes('role')).toBe('group');
    expect(w.attributes('aria-label')).toBe('Fictional choices');
    expect(w.findAll('button').map((b) => [b.text(), b.attributes('type')])).toEqual([['Alpha', 'button'], ['Beta', 'button'], ['Gamma', 'button']]);
    expect(pressed(w)).toEqual(['true', 'false', 'true']);
  });

  it('toggling keeps the options\' order, whatever the order of presses', async () => {
    const w = mount(VToggleGroup, { props: { modelValue: ['c'], options: OPTIONS, groupLabel: 'x' } });
    await w.findAll('button')[0]!.trigger('click');
    expect(emitted(w)).toEqual([['a', 'c']]);
    await w.setProps({ modelValue: ['a', 'c'] });
    await w.findAll('button')[2]!.trigger('click');
    expect(emitted(w).at(-1)).toEqual(['a']);
  });

  it('Space and Enter press a focused button (native buttons)', async () => {
    const w = mount(VToggleGroup, { props: { modelValue: ['a'], options: OPTIONS, groupLabel: 'x' }, attachTo: document.body });
    const beta = w.findAll('button')[1]!;
    (beta.element as HTMLButtonElement).focus();
    expect(document.activeElement).toBe(beta.element);
    // happy-dom does not turn a key into a click: a native <button> does, so a click stands for Space and Enter.
    await beta.trigger('click');
    expect(emitted(w)).toEqual([['a', 'b']]);
    w.unmount();
  });

  it('required: the last value stays on, its hint is read by screen readers', async () => {
    const w = mount(VToggleGroup, { props: { modelValue: ['b'], options: OPTIONS, groupLabel: 'x', required: true, lockedHint: 'At least one stays on' } });
    const beta = w.findAll('button')[1]!;
    expect(beta.attributes('aria-disabled')).toBe('true');
    expect(beta.text()).toContain('At least one stays on');
    await beta.trigger('click');
    expect(w.emitted('update:modelValue')).toBeUndefined();
    // Another value on: the last one is free to go again.
    await w.setProps({ modelValue: ['a', 'b'] });
    expect(w.findAll('button')[1]!.attributes('aria-disabled')).toBeUndefined();
    await w.findAll('button')[1]!.trigger('click');
    expect(emitted(w)).toEqual([['a']]);
  });

  it('without required the last value can turn off', async () => {
    const w = mount(VToggleGroup, { props: { modelValue: ['b'], options: OPTIONS, groupLabel: 'x' } });
    await w.findAll('button')[1]!.trigger('click');
    expect(emitted(w)).toEqual([[]]);
  });

  it('the label slot fills a cell', () => {
    const w = mount(VToggleGroup, {
      props: { modelValue: ['a'], options: OPTIONS, groupLabel: 'x' },
      slots: { label: `<template #label="{ option, on }"><i>{{ option.label }}{{ on ? '+' : '-' }}</i></template>` },
    });
    expect(w.findAll('i').map((i) => i.text())).toEqual(['Alpha+', 'Beta-', 'Gamma-']);
  });
});
