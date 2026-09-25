// Renderer layers (FSD): app → pages → widgets → features → entities → shared, imports only downwards, a slice is
// reached only through its index.ts, calls to main only through api/ segments. Rules: tests/helpers/architecture.ts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importsOf, violations } from './helpers/architecture.ts';

const root = fileURLToPath(new URL('../src/renderer/src', import.meta.url));

function tree(): Map<string, string> {
  const files = new Map<string, string>();
  for (const f of fs.readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    const abs = path.join(root, f);
    if (fs.statSync(abs).isFile() && /\.(ts|vue)$/.test(f)) files.set(f.split(path.sep).join('/'), fs.readFileSync(abs, 'utf8'));
  }
  return files;
}

const ok = (extra: Record<string, string> = {}) =>
  new Map<string, string>(
    Object.entries({
      'shared/lib/index.ts': "export { a } from './a.ts';\n",
      'shared/lib/a.ts': 'export const a = 1;\n',
      'shared/api/index.ts': "export { balanceApi } from './balance.ts';\n",
      'shared/api/balance.ts': 'export const balanceApi = (window as any).balance;\n',
      'entities/token/index.ts': "export { t } from './t.ts';\n",
      'entities/token/t.ts': "import { a } from '@/shared/lib';\nexport const t = a;\n",
      'entities/bank/index.ts': "export { b } from './b.ts';\n",
      'entities/bank/b.ts': 'export const b = 1;\n',
      'features/f/index.ts': "export { f } from './api/f.ts';\n",
      'features/f/api/f.ts': "import { balanceApi } from '@/shared/api';\nimport { t } from '@/entities/token';\nexport const f = [balanceApi, t];\n",
      ...extra,
    }),
  );

describe('renderer architecture', () => {
  it('the real renderer tree follows the layer rules', () => {
    const files = tree();
    expect(files.size).toBeGreaterThan(30);
    expect(violations(files)).toEqual([]);
  });

  it('the checker passes a correct tree', () => {
    expect(violations(ok())).toEqual([]);
  });

  it.each([
    ['upwards (entities → features)', { 'entities/token/u.ts': "import { f } from '@/features/f';\n" }, 'must not import the higher layer'],
    ['sideways (entity → entity)', { 'entities/token/u.ts': "import { b } from '@/entities/bank';\n" }, 'must not import each other'],
    ['deep import', { 'features/f/u.ts': "import { t } from '@/entities/token/t.ts';\n" }, 'deep import'],
    ['relative out of the slice', { 'features/f/u.ts': "import { b } from '../../entities/bank/b.ts';\n" }, 'leaves its slice'],
    ['a file outside the layers', { 'helpers.ts': 'export const x = 1;\n' }, 'not inside a slice'],
    ['a package that is not allowed', { 'features/f/u.ts': "import { ipcRenderer } from 'electron';\n" }, 'package not allowed'],
    ['node inside the renderer', { 'shared/lib/b.ts': "import fs from 'node:fs';\n" }, 'package not allowed'],
    ['main called outside api/', { 'features/f/u.ts': "import { balanceApi } from '@/shared/api';\n" }, 'through an api/ segment'],
    ['window.balance outside the bridge', { 'features/f/u.ts': 'const api = window.balance;\n' }, 'reads window.balance'],
    ['a store outside store/', { 'entities/token/u.ts': "import { defineStore } from 'pinia';\nexport const s = defineStore('s', () => ({}));\n" }, 'outside a store/ segment'],
    ['logic in a public API', { 'entities/bank/index.ts': "export { b } from './b.ts';\nexport const extra = 2;\n" }, 'only re-exports'],
    ['a slice without index.ts', { 'entities/lonely/x.ts': 'export const x = 1;\n', 'features/f/u.ts': "import { x } from '@/entities/lonely';\n" }, 'no index.ts'],
    ['a dynamic import upwards', { 'shared/lib/b.ts': "const p = () => import('@/pages/home');\n" }, 'must not import the higher layer'],
  ])('fails on %s', (_name, extra, message) => {
    expect(violations(ok(extra)).join('\n')).toContain(message);
  });

  it('import extraction sees static, type, side-effect, re-export and dynamic imports', () => {
    const text = [
      "import { a } from 'x1';",
      "import type { B } from 'x2';",
      "import 'x3';",
      "export { c } from 'x4';",
      "const p = () => import('x5');",
      '// copied from muzakit (a comment, not an import)',
    ].join('\n');
    expect(importsOf(text).sort()).toEqual(['x1', 'x2', 'x3', 'x4', 'x5']);
  });
});
