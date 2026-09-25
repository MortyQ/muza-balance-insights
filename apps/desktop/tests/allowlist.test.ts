// Network only to api.monobank.ua — one list, one wrapper, and nothing in the app fetches around it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALLOWED_HOSTS, NetworkPolicyError, allowlistedFetch, assertAllowedUrl, type InnerFetch } from '../src/net/allowlist.ts';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

describe('allowlist', () => {
  it('exactly one host', () => {
    expect(ALLOWED_HOSTS).toEqual(['api.monobank.ua']);
  });

  it.each([
    'https://api.monobank.ua/personal/client-info',
    'https://api.monobank.ua/personal/statement/abc/1700000000/1700003600',
    'HTTPS://API.MONOBANK.UA/personal/client-info', // normalized by URL
    'https://api.monobank.ua:443/x', // URL drops the default port: same origin
  ])('allows %s', (url) => {
    expect(() => assertAllowedUrl(url)).not.toThrow();
  });

  it.each([
    'http://api.monobank.ua/personal/client-info',
    'https://api.monobank.ua:8443/personal/client-info',
    'https://user:pw@api.monobank.ua/x',
    'https://api.monobank.ua.evil.example/x',
    'https://evil.example/api.monobank.ua',
    'https://api.monobank.ua./x',
    'https://monobank.ua/x',
    'https://1.2.3.4/x',
    'https://[::1]/x',
    'wss://api.monobank.ua/x',
    'file:///etc/passwd',
    'not a url',
  ])('refuses %s', (url) => {
    expect(() => assertAllowedUrl(url)).toThrow(NetworkPolicyError);
  });

  it('refusal names the host, never the path (ids live there)', () => {
    const err = (() => {
      try {
        assertAllowedUrl('https://evil.example/personal/statement/SECRET-ACCOUNT/1/2');
      } catch (e) {
        return e as Error;
      }
    })();
    expect(err?.message).toContain('evil.example');
    expect(err?.message).not.toContain('SECRET-ACCOUNT');
  });
});

describe('allowlistedFetch', () => {
  it('passes allowed requests with redirect: "error"; refused ones never reach the network', async () => {
    const calls: Array<[string, unknown]> = [];
    const inner: InnerFetch = async (url, init) => {
      calls.push([url, init]);
      return { status: 200, ok: true, headers: { get: () => null }, text: async () => '{}' };
    };
    const f = allowlistedFetch(inner);
    await f('https://api.monobank.ua/personal/client-info', { headers: { 'X-Token': 't' } });
    await expect(f('https://evil.example/x', { headers: { 'X-Token': 't' } })).rejects.toBeInstanceOf(NetworkPolicyError);
    await expect(f('http://api.monobank.ua/x', { headers: {} })).rejects.toBeInstanceOf(NetworkPolicyError);
    expect(calls).toEqual([['https://api.monobank.ua/personal/client-info', { headers: { 'X-Token': 't' }, redirect: 'error' }]]);
  });

  it('the caller cannot switch redirects back on', async () => {
    let seen: unknown;
    const f = allowlistedFetch(async (_u, init) => {
      seen = init.redirect;
      return { status: 200, ok: true, headers: { get: () => null }, text: async () => '' };
    });
    await f('https://api.monobank.ua/x', { headers: {}, redirect: 'follow' } as any);
    expect(seen).toBe('error');
  });
});

describe('nothing in the app goes around the allowlist', () => {
  function listTs(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return listTs(p);
      return /\.(ts|vue)$/.test(p) ? [p] : [];
    });
  }

  it('no fetch / net.fetch / net.request / http(s) / WebSocket outside src/net/allowlist.ts (net.fetch only as allowlistedFetch(net.fetch))', () => {
    const files = listTs(SRC);
    expect(files.length).toBeGreaterThan(10);
    const pattern = /(?<![.\w])fetch\s*\(|\bnet\.(fetch|request)\b|from ['"](node:)?https?['"]|require\(['"](node:)?https?['"]\)|new WebSocket\b|XMLHttpRequest|navigator\.sendBeacon/;
    const offenders = files
      .filter((f) => !f.endsWith(path.join('net', 'allowlist.ts')))
      .filter((f) => pattern.test(fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/allowlistedFetch\(net\.fetch\)/g, '')))
      .map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it('control: the scan catches a decoy', () => {
    const pattern = /(?<![.\w])fetch\s*\(|\bnet\.(fetch|request)\b/;
    expect(pattern.test("await fetch('https://x')")).toBe(true);
    expect(pattern.test('net.request({ url })')).toBe(true);
    expect(pattern.test('opts.fetch(url, init)')).toBe(false);
  });
});
