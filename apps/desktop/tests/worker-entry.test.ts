// The utilityProcess entry and its wiring in main, checked as source (it only runs inside Electron).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESKTOP_PROVIDERS } from '../src/net/providers.ts';
import { abortableClock } from '../src/worker/clock.ts';

const read = (p: string) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

describe('worker entry', () => {
  const code = read('../src/worker/import.ts');

  it("network only through the allowlist, scoped to each provider's services; the abortable clock; the shared importer", () => {
    // A provider's client reaches only its own services: a bank token can never reach another trusted service.
    expect(code).toMatch(/monobank: allowlistedFetch\(net\.fetch, \['monobank'\]\),/);
    expect(code).toMatch(/fetchFor: \(provider\) => FETCH\[provider\]/);
    // One scoped fetch per provider, nothing else.
    expect(code.match(/allowlistedFetch\(/g)).toHaveLength(Object.keys(DESKTOP_PROVIDERS).length);
    expect(code).toMatch(/clock: abortableClock/);
    expect(code).toMatch(/await runImport\(/);
  });

  it('validates what comes in (ToWorker) and what goes out (FromWorker.parse), one job per process', () => {
    expect(code).toMatch(/ToWorker\.safeParse\(event\.data\)/);
    expect(code).toMatch(/port\.postMessage\(FromWorker\.parse\(msg\)\)/);
    expect(code).toMatch(/if \(started\) return;/);
    // No exit right after the final postMessage (it could be lost): main closes the worker; this is only a fallback.
    expect(code).toMatch(/setTimeout\(\(\) => process\.exit\(0\), EXIT_FALLBACK_MS\)/);
    expect(code.match(/process\.exit\(/g)).toHaveLength(1);
  });

  it('main forks it with an empty env (nothing inherited) and never passes the token on the command line', () => {
    const main = read('../src/main/index.ts');
    expect(main).toMatch(/utilityProcess\.fork\(workerPath, \[\], \{ serviceName: 'balance-import', env: \{\}/);
    expect(main).not.toMatch(/fork\([^)]*token/i);
  });
});

describe('abortableClock', () => {
  it('sleeps, and an abort ends the sleep early with a rejection', async () => {
    const t0 = Date.now();
    await abortableClock.sleep(20);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(15);

    const c = new AbortController();
    const p = abortableClock.sleep(60_000, c.signal);
    setTimeout(() => c.abort(), 10);
    const t1 = Date.now();
    await expect(p).rejects.toThrow('aborted');
    expect(Date.now() - t1).toBeLessThan(5_000);

    await expect(abortableClock.sleep(10, c.signal)).rejects.toThrow('aborted'); // already aborted
  });
});
