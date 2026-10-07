// @vitest-environment happy-dom
// The avatar copied from muzakit (shared/ui), with our changes: a person's colour and one letter.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { VAvatar } from '@/shared/ui';

describe('VAvatar', () => {
  it('a colour: the person\'s background instead of the name\'s tone, one upper-cased letter, a custom size', () => {
    const w = mount(VAvatar, { props: { name: 'ольга', color: 'var(--series-blue)', size: 'lg', customSize: 28 } });
    expect(w.element.tagName).toBe('SPAN');
    expect(w.classes()).toEqual(expect.arrayContaining(['v-avatar', 'v-avatar--lg', 'v-avatar--color']));
    expect(w.classes().some((c) => c.startsWith('v-avatar--tone-'))).toBe(false);
    expect(w.attributes('style')).toContain('--v-avatar-color: var(--series-blue)');
    expect(w.attributes('style')).toContain('--v-avatar-size: 28px');
    expect(w.text()).toBe('О');
  });

  it('no colour: muzakit\'s tone by the name; no name: «?»', () => {
    expect(mount(VAvatar, { props: { name: 'Ivan Petrenko' } }).classes().some((c) => c.startsWith('v-avatar--tone-'))).toBe(true);
    expect(mount(VAvatar, { props: { name: 'Ivan Petrenko' } }).text()).toBe('I');
    const empty = mount(VAvatar);
    expect(empty.classes()).toContain('v-avatar--empty');
    expect(empty.text()).toBe('?');
  });
});
