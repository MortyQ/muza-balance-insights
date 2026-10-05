// Pages and layouts swap inside <Transition mode="out-in"> (app/layouts): it animates one element. A comment or a second
// node at the root of a page or a layout is a second root in dev (Vue keeps comments there), the leave never ends and the
// next screen never shows.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('../src/renderer/src', import.meta.url));
const find = (dir: string, suffix: string) =>
  readdirSync(path.join(srcDir, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith(suffix))
    .map((f) => path.join(dir, f));
const pages = find('pages', 'Page.vue');
// MasterLayout is not inside a <Transition>: it may start with a comment.
const layouts = find('app/layouts', 'Layout.vue').filter((f) => !f.endsWith('MasterLayout.vue'));

describe('pages and layouts have a single root element', () => {
  it('finds the pages and the layouts', () => {
    expect(pages.length).toBeGreaterThan(0);
    expect(layouts.length).toBeGreaterThan(0);
  });
  it.each([...pages, ...layouts])('%s', (file) => {
    const src = readFileSync(path.join(srcDir, file), 'utf8');
    const template = /<template>([\s\S]*)<\/template>\s*$/.exec(src)?.[1] ?? '';
    // The first thing in the template is an element, and it closes at the very end.
    expect(template.trimStart()).toMatch(/^<[a-zA-Z]/);
    const tag = /^<([a-zA-Z][\w-]*)/.exec(template.trimStart())?.[1];
    expect(template.trimEnd()).toMatch(new RegExp(`</${tag}>$`));
  });
});
