// ECharts in the bundle: what shared/ui sets up (components/charts/echarts.ts), built the way Vite builds the renderer,
// must never build code from strings or write a style attribute — the prod CSP has neither 'unsafe-eval' nor
// 'unsafe-inline' styles. Style properties (element.style) are not attributes and stay allowed.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { build, type Rollup } from 'vite';

const ENTRY = path.resolve(import.meta.dirname, '../src/renderer/src/shared/ui/components/charts/echarts.ts');

describe('ECharts in the bundle', () => {
  it('the registered parts only: no new Function, no eval, no style attribute', async () => {
    const out = (await build({
      configFile: false,
      logLevel: 'silent',
      build: { write: false, minify: true, lib: { entry: ENTRY, formats: ['es'], fileName: 'echarts' } },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[];
    const code = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output).map((c) => ('code' in c ? c.code : '')).join('\n');
    expect(code.length).toBeGreaterThan(100_000);
    expect(code).not.toMatch(/new Function\b|\beval\s*\(/);
    expect(code).not.toMatch(/setAttribute\(\s*["']style["']/);
  }, 60_000);
});
