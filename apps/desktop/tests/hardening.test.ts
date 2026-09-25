import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { denyAllPermissions, guardWebContents, isAllowedRendererUrl, restrictRendererSession, urlWhere, type SessionLike } from '../src/main/hardening.ts';

function fakeSession() {
  const h: Record<string, (...a: any[]) => any> = {};
  const s: SessionLike = {
    setPermissionRequestHandler: (fn) => void (h.request = fn),
    setPermissionCheckHandler: (fn) => void (h.check = fn),
    setDevicePermissionHandler: (fn) => void (h.device = fn),
    webRequest: {
      onBeforeRequest: (fn) => void (h.before = fn),
      onHeadersReceived: (fn) => void (h.headers = fn),
    },
  };
  return { s, h };
}

describe('permissions (Checklist #5)', () => {
  it.each(['media', 'geolocation', 'notifications', 'clipboard-read', 'hid', 'serial', 'usb', 'openExternal', 'fullscreen', 'unknown-new-permission'])(
    'denies %s — request, check and device handlers',
    (perm) => {
      const { s, h } = fakeSession();
      denyAllPermissions(s);
      let granted: boolean | undefined;
      h.request!({}, perm, (v: boolean) => (granted = v));
      expect(granted).toBe(false);
      expect(h.check!({}, perm, 'app://renderer', {})).toBe(false);
      expect(h.device!({ deviceType: perm })).toBe(false);
    },
  );
});

describe('renderer network (Checklist #1, behind CSP connect-src none)', () => {
  it.each([
    ['app://renderer/index.html', null, true],
    ['app://renderer/assets/x.js', null, true],
    ['https://api.monobank.ua/personal/client-info', null, false],
    ['https://example.com/', null, false],
    ['http://localhost:5174/src/main.ts', null, false], // no dev server in prod
    ['file:///etc/passwd', null, false],
    ['app://other/index.html', null, false],
    ['devtools://devtools/bundled/x', null, false],
    ['http://localhost:5174/src/main.ts', 'http://localhost:5174', true],
    ['ws://localhost:5174/', 'http://localhost:5174', true],
    ['devtools://devtools/bundled/x', 'http://localhost:5174', true],
    ['http://localhost:5175/x', 'http://localhost:5174', false],
    ['http://localhost:51740/x', 'http://localhost:5174', false],
    ['https://example.com/', 'http://localhost:5174', false],
  ] as const)('%s (dev %s) → %s', (url, dev, allowed) => {
    expect(isAllowedRendererUrl(url, dev)).toBe(allowed);
  });

  it('onBeforeRequest cancels disallowed requests; dev CSP header replaces the server one only for the dev origin', () => {
    const { s, h } = fakeSession();
    restrictRendererSession(s, { devOrigin: 'http://localhost:5174', devCsp: 'DEV-CSP' });
    let r: any;
    h.before!({ url: 'https://api.monobank.ua/x' }, (v: any) => (r = v));
    expect(r).toEqual({ cancel: true });
    h.before!({ url: 'http://localhost:5174/' }, (v: any) => (r = v));
    expect(r).toEqual({ cancel: false });

    h.headers!({ url: 'http://localhost:5174/index.html', responseHeaders: { 'content-security-policy': ['x'], a: ['1'] } }, (v: any) => (r = v));
    expect(r).toEqual({ responseHeaders: { a: ['1'], 'Content-Security-Policy': ['DEV-CSP'] } });
    h.headers!({ url: 'app://renderer/index.html', responseHeaders: {} }, (v: any) => (r = v));
    expect(r).toEqual({});
  });

  it('prod: no dev origin → only app:// passes, headers untouched', () => {
    const { s, h } = fakeSession();
    restrictRendererSession(s, { devOrigin: null, devCsp: null });
    let r: any;
    h.before!({ url: 'http://localhost:5174/' }, (v: any) => (r = v));
    expect(r).toEqual({ cancel: true });
    h.headers!({ url: 'http://localhost:5174/', responseHeaders: {} }, (v: any) => (r = v));
    expect(r).toEqual({});
  });
});

describe('navigation, windows, webview (Checklist #11–14)', () => {
  function fakeWc() {
    const em = new EventEmitter();
    let openHandler: ((d: unknown) => unknown) | undefined;
    const wc = Object.assign(em, { setWindowOpenHandler: (h: (d: unknown) => unknown) => void (openHandler = h) });
    return { wc, open: (d: unknown) => openHandler?.(d) };
  }
  const event = () => {
    let prevented = false;
    return { e: { preventDefault: () => void (prevented = true) }, prevented: () => prevented };
  };

  it.each(['will-navigate', 'will-redirect', 'will-attach-webview'])('%s is prevented', (name) => {
    const { wc } = fakeWc();
    guardWebContents(wc as any);
    const ev = event();
    wc.emit(name, ev.e, 'https://example.com/');
    expect(ev.prevented()).toBe(true);
  });

  it('window.open / target=_blank → deny', () => {
    const { wc, open } = fakeWc();
    guardWebContents(wc as any);
    expect(open({ url: 'https://example.com/' })).toEqual({ action: 'deny' });
    expect(open({ url: 'app://renderer/index.html' })).toEqual({ action: 'deny' });
  });

  it('dev diagnostics: prevented navigation / window.open and blocked requests are reported without query or fragment', () => {
    const { wc, open } = fakeWc();
    const seen: string[] = [];
    guardWebContents(wc as any, (m) => seen.push(m));
    wc.emit('will-navigate', event().e, 'https://example.com/path?token=SECRET#frag');
    open({ url: 'https://example.com/x?q=SECRET' });
    expect(seen).toEqual(['will-navigate https://example.com/path', 'window-open https://example.com/x']);

    const { s, h } = fakeSession();
    const blocked: string[] = [];
    restrictRendererSession(s, { devOrigin: null, devCsp: null, onBlocked: (w) => blocked.push(w) });
    h.before!({ url: 'https://api.monobank.ua/personal/statement/a/1/2?x=SECRET' }, () => undefined);
    h.before!({ url: 'app://renderer/index.html' }, () => undefined);
    expect(blocked).toEqual(['https://api.monobank.ua/personal/statement/a/1/2']);
    expect(urlWhere('not a url')).toBe('(invalid url)');
  });

  it('main applies the guard to every webContents (web-contents-created), not to one window', () => {
    const code = fs.readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8');
    expect(code).toMatch(/app\.on\('web-contents-created',\s*\(_event, wc\) => \{[\s\S]*?guardWebContents\(wc, devLog\);\s*\}\);/);
    // Diagnostics exist only in an unpackaged app.
    expect(code).toMatch(/const devLog = app\.isPackaged \? undefined :/);
    expect(code).toMatch(/denyAllPermissions\(s\)/);
    expect(code).toMatch(/restrictRendererSession\(s,/);
  });
});
