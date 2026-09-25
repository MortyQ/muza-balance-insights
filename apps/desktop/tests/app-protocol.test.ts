import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_ENTRY, APP_ORIGIN, APP_SCHEME_PRIVILEGES, createAppProtocolHandler, resolveAppFile } from '../src/main/app-protocol.ts';
import { PROD_CSP } from '../src/main/csp.ts';

let root: string;
let dir: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'app-proto-'));
  dir = path.join(root, 'renderer');
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>x</title>');
  fs.writeFileSync(path.join(dir, 'assets', 'app.js'), 'export {}');
  fs.writeFileSync(path.join(root, 'secret.txt'), 'CANARY_OUTSIDE');
  fs.symlinkSync(path.join(root, 'secret.txt'), path.join(dir, 'assets', 'link.js'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('app:// (Checklist #18)', () => {
  it('origin and privileges', () => {
    expect(APP_ORIGIN).toBe('app://renderer');
    expect(APP_ENTRY).toBe('app://renderer/index.html');
    expect(APP_SCHEME_PRIVILEGES).toEqual({ standard: true, secure: true, supportFetchAPI: true });
  });

  it('serves files inside the renderer folder', () => {
    expect(resolveAppFile(dir, 'app://renderer/index.html')).toBe(fs.realpathSync(path.join(dir, 'index.html')));
    expect(resolveAppFile(dir, 'app://renderer/')).toBe(fs.realpathSync(path.join(dir, 'index.html')));
    expect(resolveAppFile(dir, 'app://renderer/assets/app.js?v=1#x')).toBe(fs.realpathSync(path.join(dir, 'assets', 'app.js')));
  });

  it.each([
    ['app://renderer/../secret.txt'],
    ['app://renderer/%2e%2e/secret.txt'],
    ['app://renderer/assets/%2e%2e%2f..%2fsecret.txt'],
    ['app://renderer/..%2fsecret.txt'],
    ['app://renderer/assets\\..\\..\\secret.txt'],
    ['app://renderer/assets/%5c..%5c..%5csecret.txt'],
    ['app://renderer/%00index.html'],
    ['app://renderer/assets/link.js'], // symlink pointing outside
    ['app://renderer/assets'], // a directory
    ['app://renderer/missing.js'],
    ['app://other/index.html'],
    ['app://user:pw@renderer/index.html'],
    ['file:///etc/passwd'],
    ['https://renderer/index.html'],
    ['app://renderer/%E0%A4%A'], // malformed escape
  ])('refuses %s', (url) => {
    expect(resolveAppFile(dir, url)).toBeNull();
  });

  it('handler: 200 with CSP + nosniff; 404 outside; 405 for non-GET; the outside canary never leaves', async () => {
    const handle = createAppProtocolHandler(dir, PROD_CSP);
    const ok = await handle(new Request('app://renderer/index.html'));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(ok.headers.get('content-security-policy')).toBe(PROD_CSP);
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff');

    const js = await handle(new Request('app://renderer/assets/app.js'));
    expect(js.headers.get('content-type')).toBe('text/javascript; charset=utf-8');

    for (const url of ['app://renderer/../secret.txt', 'app://renderer/assets/link.js']) {
      const r = await handle(new Request(url));
      expect(r.status).toBe(404);
      expect(await r.text()).not.toContain('CANARY_OUTSIDE');
      expect(r.headers.get('content-security-policy')).toBe(PROD_CSP);
    }
    const post = await handle(new Request('app://renderer/index.html', { method: 'POST', body: 'x' }));
    expect(post.status).toBe(405);
  });
});
