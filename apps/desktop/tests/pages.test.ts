// Pages swap inside App's <Transition mode="out-in">: it animates one element. A comment or a second node at the root of a
// page is a second root in dev (Vue keeps comments there), the leave never ends and the next screen never shows.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pagesDir = fileURLToPath(new URL('../src/renderer/src/pages', import.meta.url));
const pages = readdirSync(pagesDir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('Page.vue'));

describe('pages have a single root element', () => {
  it('finds the pages', () => expect(pages.length).toBeGreaterThan(0));
  it.each(pages)('%s', (file) => {
    const src = readFileSync(path.join(pagesDir, file), 'utf8');
    const template = /<template>([\s\S]*)<\/template>\s*$/.exec(src)?.[1] ?? '';
    // The first thing in the template is an element, and it closes at the very end.
    expect(template.trimStart()).toMatch(/^<[a-zA-Z]/);
    const tag = /^<([a-zA-Z][\w-]*)/.exec(template.trimStart())?.[1];
    expect(template.trimEnd()).toMatch(new RegExp(`</${tag}>$`));
  });
});
