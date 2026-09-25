import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../electron.vite.config.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const rendererSrc = path.join(root, 'src/renderer/src');

function filesUnder(dir: string, ext: RegExp): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => ext.test(f))
    .map((f) => path.join(dir, f));
}

describe('Renderer styles (Tailwind, fonts) stay inside the prod CSP', () => {
  it('the renderer build never inlines assets as data: URIs (CSP allows fonts only from self)', () => {
    const renderer = (config as { renderer?: { build?: { assetsInlineLimit?: unknown } } }).renderer;
    expect(renderer?.build?.assetsInlineLimit).toBe(0);
  });

  it('Tailwind scans only the renderer sources, not out/ or node_modules', () => {
    const theme = fs.readFileSync(path.join(rendererSrc, 'styles/theme.css'), 'utf8');
    expect(theme).toMatch(/@import "tailwindcss" source\(none\);/);
    expect([...theme.matchAll(/@source "([^"]+)"/g)].map((m) => m[1])).toEqual(['../']);
  });

  it('no remote URL or data: URI in renderer styles and components', () => {
    for (const file of filesUnder(rendererSrc, /\.(css|vue)$/)) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/url\(\s*['"]?(https?:|\/\/|data:)/i);
      expect(text, file).not.toMatch(/@import\s+(url\()?['"]?(https?:|\/\/)/i);
    }
  });

  it('the font is bundled from local files, with Cyrillic and the hryvnia sign', () => {
    const main = fs.readFileSync(path.join(rendererSrc, 'main.ts'), 'utf8');
    expect(main).toContain("import '@fontsource-variable/manrope/wght.css';");
    const css = fs.readFileSync(path.join(root, 'node_modules/@fontsource-variable/manrope/wght.css'), 'utf8');
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u).toMatch(/^\.\/files\/[\w-]+\.woff2$/);
    const ranges = [...css.matchAll(/unicode-range:\s*([^;]+);/g)].map((m) => m[1]).join(',');
    expect(ranges).toContain('U+0400-045F'); // Russian / Ukrainian
    expect(ranges).toContain('U+0490-0491'); // Ґ ґ
    expect(ranges).toContain('U+20B4'); // ₴
  });
});
