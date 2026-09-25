import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROD_CSP, devCsp, localDevOrigin } from '../src/main/csp.ts';
import { cspMetaPlugin } from '../electron.vite.config.ts';

describe('CSP (Checklist #7)', () => {
  it('prod: exactly the spec policy (+ directives default-src does not cover)', () => {
    expect(PROD_CSP).toBe(
      "default-src 'self'; script-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(PROD_CSP).not.toMatch(/unsafe|localhost|ws:|http/);
  });

  it('dev: only the HMR socket and inline styles are added — no eval, no remote host', () => {
    const csp = devCsp('http://localhost:5174');
    expect(csp).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:5174; " +
        "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(csp).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline/);
  });

  it.each([
    ['http://localhost:5174/', 'http://localhost:5174'],
    ['http://127.0.0.1:5173', 'http://127.0.0.1:5173'],
    ['https://localhost:5174/', null],
    ['http://evil.example:5174/', null],
    ['http://localhost/', null],
    ['http://user:pw@localhost:5174/', null],
    ['file:///tmp/index.html', null],
    ['not a url', null],
    [undefined, null],
  ])('dev server URL %j → %j', (url, origin) => {
    expect(localDevOrigin(url)).toBe(origin);
  });

  it('the build puts the prod CSP into <meta>; the dev server does not get it (apply: build)', () => {
    const plugin = cspMetaPlugin(PROD_CSP);
    expect(plugin.apply).toBe('build');
    const html = fs.readFileSync(new URL('../src/renderer/index.html', import.meta.url), 'utf8');
    const out = (plugin.transformIndexHtml as (h: string) => string)(html);
    expect(out).toContain(`<meta http-equiv="Content-Security-Policy" content="${PROD_CSP}" />`);
  });

  it('index.html has no inline script and no inline event handlers (CSP would block them anyway)', () => {
    const html = fs.readFileSync(new URL('../src/renderer/index.html', import.meta.url), 'utf8');
    for (const tag of html.match(/<script\b[^>]*>[\s\S]*?<\/script>/g) ?? []) {
      expect(tag).toMatch(/\ssrc="/);
      expect(tag.replace(/<script\b[^>]*>|<\/script>/g, '').trim()).toBe('');
    }
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });
});
