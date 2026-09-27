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

  it('every copied file carries the provenance header (icons.ts, index.ts, table/ and VSelect/VDatepicker/VMonthPicker are ours)', () => {
    // VSelect, VDatepicker and VMonthPicker are built fresh on reka-ui, not copied from muzakit (see ui/README.md) —
    // their header says so instead of "copied from muzakit".
    const ownFiles = new Set([
      'icons.ts',
      'index.ts',
      'VSelect.vue',
      'vselect.scss',
      'VDatepicker.vue',
      'vdatepicker.scss',
      'calendarDate.ts',
      'VMonthPicker.vue',
      'vmonthpicker.scss',
      'calendarMonth.ts',
    ]);
    for (const f of filesUnder(uiDir, /\.(vue|ts|scss|css)$/)) {
      const own = ownFiles.has(path.basename(f)) || path.relative(uiDir, f).startsWith(`table${path.sep}`);
      expect((read(f).split('\n', 1)[0] ?? '').includes('copied from muzakit'), f).toBe(!own);
    }
  });

  it('VSwitch shows keyboard focus on its track (the real input is visually hidden)', () => {
    const scss = read(path.join(uiDir, 'styles/components/inputs/vswitch.scss'));
    expect(scss).toMatch(/\.v-switch__input:focus-visible\s*\+\s*\.v-switch__track\s*\{[^}]*outline:/);
  });

  it('tokens: every --ui-* used in ui styles is defined; every raw var tokens.css wraps exists in the theme, dark included', () => {
    const tokens = read(path.join(uiDir, 'styles/tokens.css'));
    const defined = new Set([...tokens.matchAll(/^\s*(--ui-[\w-]+)\s*:/gm)].map((m) => m[1] ?? ''));
    const used = new Set<string>();
    for (const f of filesUnder(uiDir, /\.(vue|scss|css)$/)) for (const m of read(f).matchAll(/var\(\s*(--ui-[\w-]+)/g)) used.add(m[1] ?? '');
    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((t) => !defined.has(t))).toEqual([]);

    const stylesDir = path.join(rendererSrc, 'app/styles');
    const theme = read(path.join(stylesDir, 'theme.css'));
    const themeVars = new Set(
      [...(theme + read(path.join(stylesDir, 'main.css'))).matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1] ?? ''),
    );
    const wrapped = [...tokens.matchAll(/^\s*--ui-[\w-]+\s*:\s*var\(\s*(--[\w-]+)/gm)].map((m) => m[1] ?? '').filter((v) => !v.startsWith('--ui-'));
    expect(wrapped.length).toBeGreaterThan(0);
    expect(wrapped.filter((v) => !themeVars.has(v))).toEqual([]);

    const block = (selector: string) => {
      const start = theme.indexOf(`${selector} {`);
      expect(start, selector).toBeGreaterThan(-1);
      const body = theme.slice(start, theme.indexOf('\n}', start));
      return new Set([...body.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1] ?? ''));
    };
    const light = block(':root,\n:root[data-theme="light"]');
    const dark = block(':root[data-theme="dark"]');
    expect([...light].filter((v) => !dark.has(v))).toEqual([]);
  });

  it('popovers: each reka-ui *Content panel is our own element (as-child), so the scoped styles reach it', () => {
    // PopperContent has inheritAttrs: false and puts `class` on an inner element that is not its root, so that element
    // never gets the component's scope attribute: a scoped rule on it matches nothing and the panel is see-through.
    const tags: string[] = [];
    for (const f of filesUnder(uiDir, /\.vue$/)) {
      for (const m of read(f).matchAll(/<((?:Select|Popover|DatePicker|DateRangePicker|Tooltip|DropdownMenu|Combobox)Content)\b([^>]*)>/g)) {
        tags.push(m[1] ?? '');
        expect(m[2], `${path.basename(f)} <${m[1]}>`).toMatch(/\bas-child\b/);
        expect(m[2], `${path.basename(f)} <${m[1]}>`).not.toMatch(/\bclass=/);
      }
    }
    expect(tags.length).toBeGreaterThanOrEqual(4);
  });

  it('shadows: fields rest on the button\'s shadow; the three popover panels share one elevation', () => {
    const scss = (name: string) => read(path.join(uiDir, `styles/components/${name}.scss`));
    const rule = (src: string, selector: string) => {
      const m = src.match(new RegExp(`^${selector.replace(/[.]/g, '\\.')} \\{([\\s\\S]*?)^\\}`, 'm'));
      expect(m, selector).not.toBeNull();
      return m?.[1] ?? '';
    };
    const decl = (body: string, prop: string) => body.match(new RegExp(`^  ${prop}:\\s*([^;]+);`, 'm'))?.[1];

    const resting = decl(rule(scss('base/vbutton'), '.v-button'), 'box-shadow');
    expect(resting).toBe('var(--ui-shadow-xs)');
    for (const [file, selector] of [
      ['inputs/vselect', '.v-select__trigger'],
      ['inputs/vdatepicker', '.v-datepicker__field-row'],
      ['inputs/vmonthpicker', '.v-month-picker__trigger'],
      ['inputs/vinput', '.v-input-container'],
    ] as const) {
      expect(decl(rule(scss(file), selector), 'box-shadow'), selector).toBe(resting);
    }

    const panels = [
      rule(scss('inputs/vselect'), '.v-select__content'),
      rule(scss('inputs/vdatepicker'), '.v-datepicker__calendar'),
      rule(scss('inputs/vmonthpicker'), '.v-month-picker__content'),
    ];
    for (const prop of ['background-color', 'border', 'border-radius', 'box-shadow']) {
      const values = panels.map((p) => decl(p, prop));
      expect(values[0], prop).toBeDefined();
      expect(new Set(values).size, prop).toBe(1);
    }
  });

  it('every exported component has a row in ui/README.md', () => {
    const readme = read(path.join(uiDir, 'README.md'));
    const exported = [...read(path.join(uiDir, 'index.ts')).matchAll(/export \{ default as (V\w+)/g)].map((m) => m[1] ?? '');
    expect(exported).toContain('VSwitch');
    for (const name of exported) expect(readme, name).toMatch(new RegExp(`\`[\\w/]*${name}\``));
  });
});
