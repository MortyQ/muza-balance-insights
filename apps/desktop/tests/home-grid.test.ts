// Home's tile grid (spec desktop-home-tiles): the page owns the columns, the features put their tiles straight into it
// in the page's order, and a feature that renders tiles has one `contents` root (a second root would drop the classes
// the page passes, and a comment before it is a second root).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(new URL(`../src/renderer/src/${f}`, import.meta.url), 'utf8');
const template = (src: string) => src.slice(src.indexOf('<template>') + '<template>'.length).trimStart();

describe('home tile grid', () => {
  const page = read('pages/home/HomePage.vue');

  it('one column, two from 47rem, twelve from 79rem of the grid\'s own width', () => {
    const grid = /<div [^>]*data-test="home-grid"[^>]*>/.exec(page)?.[0] ?? '';
    expect(grid).toContain('grid-cols-1');
    expect(grid).toContain('@[47rem]:grid-cols-2');
    expect(grid).toContain('@[79rem]:grid-cols-12');
    expect(page).toMatch(/class="@container">\s*<div [^>]*data-test="home-grid"/);
  });

  it('the blocks in order: balances, «Now», spending, regular payments', () => {
    const order = ['<BalancesFeature', '<NowStripFeature', '<SpendingFeature', '<RecurringTeaserFeature'].map((t) => page.indexOf(t));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('the balances feature renders its tiles through one `contents` root', () => {
    expect(template(read('features/balances/BalancesFeature.vue'))).toMatch(/^<div class="contents"/);
  });
});
