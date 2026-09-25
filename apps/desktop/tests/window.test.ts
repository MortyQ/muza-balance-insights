import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { windowOptions } from '../src/main/window.ts';

describe('BrowserWindow options (Checklist #2–4, #6, #8–10)', () => {
  const prod = windowOptions({ preloadPath: '/x/preload/index.cjs', isPackaged: true, title: 'Balance Insights' });
  const dev = windowOptions({ preloadPath: '/x/preload/index.cjs', isPackaged: false, title: 'Balance Insights Dev' });

  it('exact webPreferences in prod', () => {
    expect(prod.webPreferences).toEqual({
      preload: '/x/preload/index.cjs',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: false,
      devTools: false,
    });
  });

  it('dev differs only by DevTools', () => {
    expect({ ...dev.webPreferences, devTools: false }).toEqual(prod.webPreferences);
    expect(dev.webPreferences.devTools).toBe(true);
  });

  it('no enableBlinkFeatures / no risky keys at all', () => {
    for (const k of ['enableBlinkFeatures', 'enableRemoteModule', 'additionalArguments', 'disableBlinkFeatures']) {
      expect(Object.keys(prod.webPreferences)).not.toContain(k);
    }
  });

  it('main: app.enableSandbox() and the scheme registration run at top level, before app.whenReady()', () => {
    const code = fs.readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const ready = code.indexOf('app.whenReady()');
    for (const call of ['configureIdentity(app)', 'app.enableSandbox()', 'protocol.registerSchemesAsPrivileged(', 'app.requestSingleInstanceLock()']) {
      const at = code.indexOf(call);
      expect(at, call).toBeGreaterThan(-1);
      expect(at, call).toBeLessThan(ready);
    }
    // The window is created only from windowOptions; no second BrowserWindow with ad-hoc options.
    expect(code.match(/new BrowserWindow\(/g)).toHaveLength(1);
    expect(code).toMatch(/new BrowserWindow\(windowOptions\(/);
    // Remote content is never loaded: only the dev origin (localhost-checked) or app://.
    expect(code.match(/loadURL\(/g)).toHaveLength(2);
    expect(code).not.toMatch(/loadFile\(/);
  });
});
