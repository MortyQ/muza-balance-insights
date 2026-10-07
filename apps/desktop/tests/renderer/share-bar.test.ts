// @vitest-environment happy-dom
// The share bar (shared/ui): one fill or coloured segments, an optional mark; always beside its value as text.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { VShareBar } from '@/shared/ui';

describe('VShareBar', () => {
  it('one fill: its colour, the width clamped to 0–100, md with the track, hidden from screen readers', () => {
    const w = mount(VShareBar, { props: { value: 140, color: 'var(--cat)' } });
    expect(w.classes()).toEqual(expect.arrayContaining(['v-share-bar', 'v-share-bar--md', 'v-share-bar--track']));
    expect(w.attributes('aria-hidden')).toBe('true');
    expect(w.find('.v-share-bar__fill').attributes('style')).toContain('--v-share-bar-width: 100%');
    const parts = w.findAll('.v-share-bar__part');
    expect(parts).toHaveLength(1);
    expect(parts[0]!.attributes('style')).toContain('--v-share-bar-color: var(--cat)');
    expect(w.find('.v-share-bar__mark').exists()).toBe(false);
    expect(mount(VShareBar, { props: { value: -5 } }).find('.v-share-bar__fill').attributes('style')).toContain('--v-share-bar-width: 0%');
  });

  it('segments with their weights, colours and titles; the mark with its title; no track, xs', () => {
    const w = mount(VShareBar, {
      props: {
        value: 60,
        segments: [{ value: 3, color: 'red', title: 'Olya' }, { value: 1, color: 'blue', title: 'Ivan' }],
        mark: 45,
        markTitle: 'In August',
        size: 'xs',
        track: false,
      },
    });
    expect(w.classes()).toContain('v-share-bar--xs');
    expect(w.classes()).not.toContain('v-share-bar--track');
    const parts = w.findAll('.v-share-bar__part');
    expect(parts.map((p) => p.attributes('title'))).toEqual(['Olya', 'Ivan']);
    expect(parts[0]!.attributes('style')).toContain('--v-share-bar-grow: 3');
    expect(parts[1]!.attributes('style')).toContain('--v-share-bar-color: blue');
    const mark = w.find('.v-share-bar__mark');
    expect(mark.attributes('style')).toContain('--v-share-bar-mark: 45%');
    expect(mark.attributes('title')).toBe('In August');
  });
});
