import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ICONS_OPTIONS } from '../electron.vite.config.ts';

const rendererSrc = fileURLToPath(new URL('../src/renderer/src', import.meta.url));
const uiDir = path.join(rendererSrc, 'shared/ui');
const read = (f: string) => fs.readFileSync(f, 'utf8');

function filesUnder(dir: string, ext: RegExp): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => ext.test(f))
    .map((f) => path.join(dir, f));
}

const registrySrc = read(path.join(uiDir, 'components/base/icons.ts'));
const registryKeys = new Set([...registrySrc.matchAll(/^\s*"(lucide:[a-z0-9-]+)":/gm)].map((m) => m[1] ?? ''));

describe('ui components copied from muzakit', () => {
  it('icons: build-time only — autoInstall off, the registry imports nothing but ~icons/lucide/*', () => {
    expect(ICONS_OPTIONS).toEqual({ compiler: 'vue3', autoInstall: false });
    const imports = [...registrySrc.matchAll(/^import\s.+\sfrom\s+"([^"]+)";$/gm)].map((m) => m[1] ?? '');
    for (const i of imports.filter((i) => i !== 'vue')) expect(i).toMatch(/^~icons\/lucide\/[a-z0-9-]+$/);
  });

  it('icons: one import per key, each a canonical icon of the local @iconify-json/lucide set (not an alias)', () => {
    const set = JSON.parse(read(fileURLToPath(new URL('../node_modules/@iconify-json/lucide/icons.json', import.meta.url)))) as {
      icons: Record<string, unknown>;
    };
    const pairs = [...registrySrc.matchAll(/^\s*"lucide:[a-z0-9-]+":\s*(\w+),$/gm)].map((m) => m[1] ?? '');
    expect(pairs.length).toBe(registryKeys.size);
    const imports = new Map([...registrySrc.matchAll(/^import (\w+) from "~icons\/lucide\/([a-z0-9-]+)";$/gm)].map((m) => [m[1] ?? '', m[2] ?? '']));
    expect(new Set(pairs)).toEqual(new Set(imports.keys()));
    for (const name of imports.values()) expect(set.icons[name], name).toBeDefined();
  });

  it('icons: every "lucide:*" name used in renderer code is in the registry', () => {
    const used = new Set<string>();
    for (const f of filesUnder(rendererSrc, /\.(vue|ts)$/)) {
      if (f.endsWith(path.join('base', 'icons.ts'))) continue;
      for (const m of read(f).matchAll(/["'](lucide:[a-z0-9-]+)["']/g)) used.add(m[1] ?? '');
    }
    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((n) => !registryKeys.has(n))).toEqual([]);
  });

  it('no dependency that muzakit pulled in and this app does not ship', () => {
    for (const f of filesUnder(uiDir, /\.(vue|ts|scss|css)$/)) {
      expect(read(f), f).not.toMatch(/from\s+["'](vue-router|@vueuse\/[^"']+|@iconify\/vue|@muzakit\/[^"']+)["']/);
    }
  });

  it('every copied file carries the provenance header (icons.ts and index.ts are ours)', () => {
    for (const f of filesUnder(uiDir, /\.(vue|ts|scss|css)$/)) {
      const own = ['icons.ts', 'index.ts'].includes(path.basename(f));
      expect((read(f).split('\n', 1)[0] ?? '').includes('copied from muzakit'), f).toBe(!own);
    }
  });
});
