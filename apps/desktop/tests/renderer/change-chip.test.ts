// @vitest-environment happy-dom
// The change chip (shared/ui) and the change rule (shared/lib) both the spending block and the now strip use.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { change } from '@/shared/lib';
import { VChangeChip } from '@/shared/ui';

describe('change', () => {
  it('more / less with the percent and the amount; under 3% → same; a base of 0 → new; no base → null', () => {
    expect(change(110, 100)).toEqual({ kind: 'up', diff: 10, pct: 10 });
    expect(change(80, 100)).toEqual({ kind: 'down', diff: 20, pct: 20 });
    expect(change(102, 100)).toEqual({ kind: 'same', diff: 2, pct: 2 });
    expect(change(50, 0)).toEqual({ kind: 'new', diff: 50, pct: 0 });
    expect(change(0, 0)).toEqual({ kind: 'same', diff: 0, pct: 0 });
    expect(change(50, null)).toBeNull();
  });
});

describe('VChangeChip', () => {
  it('tone and size as modifiers, the arrow icon, the screen-reader direction, the title', () => {
    const w = mount(VChangeChip, { props: { chip: { text: '+9%', tone: 'up', arrow: 'up', sr: 'more than in August', title: 'In August — 100 ₴' }, size: 'sm' } });
    expect(w.classes()).toEqual(expect.arrayContaining(['v-change-chip', 'v-change-chip--up', 'v-change-chip--sm']));
    expect(w.find('svg').exists()).toBe(true);
    expect(w.find('.v-change-chip__sr').text()).toBe('more than in August');
    expect(w.attributes('title')).toBe('In August — 100 ₴');
    expect(w.text()).toContain('+9%');
  });

  it('neutral: no arrow, no screen-reader text, md by default', () => {
    const w = mount(VChangeChip, { props: { chip: { text: 'as in August', tone: 'neutral', arrow: null, sr: '' } } });
    expect(w.classes()).toEqual(expect.arrayContaining(['v-change-chip--neutral', 'v-change-chip--md']));
    expect(w.find('svg').exists()).toBe(false);
    expect(w.find('.v-change-chip__sr').exists()).toBe(false);
    expect(w.attributes('title')).toBeUndefined();
  });
});
