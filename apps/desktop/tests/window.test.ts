import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TITLE_BAR_HEIGHT } from '../src/shared/titlebar.ts';
import { titleBarOverlay, windowOptions } from '../src/main/window.ts';

const base = { preloadPath: '/x/preload/index.cjs', title: 'Balance Insights', platform: 'darwin', dark: false } as const;

describe('BrowserWindow options (Checklist #2–4, #6, #8–10)', () => {
  const prod = windowOptions({ ...base, isPackaged: true });
  const dev = windowOptions({ ...base, isPackaged: false, title: 'Balance Insights Dev' });

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

  it('webPreferences do not depend on the platform or the theme', () => {
    for (const platform of ['win32', 'linux', 'darwin'] as const) {
      expect(windowOptions({ ...base, isPackaged: true, platform, dark: true }).webPreferences).toEqual(prod.webPreferences);
    }
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

  it('main: webContents.send only inside the gatedPush callback, and registerIpc carries the lock and database gates', () => {
    const code = fs.readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code.match(/webContents\.send\(/g)).toHaveLength(1);
    expect(code).toMatch(/gatedPush\([\s\S]*?\(ch, payload\) => win\?\.webContents\.send\(ch, payload\)/);
    expect(code).toMatch(/registerIpc\([\s\S]*?locked:\s*\(\)\s*=>\s*appLock\.isLocked\(\)/);
    expect(code).toMatch(/registerIpc\([\s\S]*?dbReady:\s*\(\)\s*=>\s*access\.isReady\(\)/);
    expect(code).toMatch(/gatedPush\(\s*\(\) => lock\?\.isLocked\(\) \?\? true,\s*\(\) => dbAccess\?\.isReady\(\) \?\? false,/);
  });
});

// sRGB hex of an oklch() token, to compare the native window buttons' colours with theme.css.
function oklchHex(token: string): string {
  const m = /oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/.exec(token);
  if (!m) throw new Error(`not an oklch colour: ${token}`);
  const [L, C, H] = [Number(m[1]) / 100, Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const channel = (x: number) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${rgb.map(channel).join('')}`;
}

function themeToken(theme: 'light' | 'dark', name: string): string {
  const css = fs.readFileSync(new URL('../src/renderer/src/app/styles/theme.css', import.meta.url), 'utf8');
  const block = new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1] ?? '';
  const value = new RegExp(`--${name}:\\s*([^;]+);`).exec(block)?.[1];
  if (!value) throw new Error(`--${name} not found in the ${theme} theme`);
  return value;
}

describe('own title bar instead of the system frame', () => {
  const opts = (platform: NodeJS.Platform, dark = false) => windowOptions({ ...base, isPackaged: true, platform, dark });

  it('Windows: hidden title bar, native buttons drawn over our strip', () => {
    const o = opts('win32');
    expect(o.titleBarStyle).toBe('hidden');
    expect(o).toMatchObject({ titleBarOverlay: titleBarOverlay(false) });
    expect('autoHideMenuBar' in o).toBe(false);
  });

  it('Linux: the same, and the menu bar never shows (the menu and its shortcuts stay)', () => {
    const o = opts('linux');
    expect(o.titleBarStyle).toBe('hidden');
    expect(o).toMatchObject({ titleBarOverlay: titleBarOverlay(false), autoHideMenuBar: true });
  });

  it('macOS: hidden title bar, traffic lights centred in the strip, no overlay', () => {
    const o = opts('darwin');
    expect(o.titleBarStyle).toBe('hidden');
    expect(o).toMatchObject({ trafficLightPosition: { x: 14, y: (TITLE_BAR_HEIGHT - 12) / 2 } });
    expect('titleBarOverlay' in o).toBe(false);
  });

  it('the overlay starts in the current theme and is as tall as the strip', () => {
    expect(opts('win32', true)).toMatchObject({ titleBarOverlay: titleBarOverlay(true) });
    expect(titleBarOverlay(false).height).toBe(TITLE_BAR_HEIGHT);
    expect(titleBarOverlay(true).height).toBe(TITLE_BAR_HEIGHT);
  });

  it.each(['light', 'dark'] as const)('%s: overlay colours are theme.css --background / --foreground', (theme) => {
    const o = titleBarOverlay(theme === 'dark');
    expect(o.color).toBe(oklchHex(themeToken(theme, 'background')));
    expect(o.symbolColor).toBe(oklchHex(themeToken(theme, 'foreground')));
  });

  it('renderer strip: drags the window, the settings button does not; room for the native buttons on the right', () => {
    const vue = fs.readFileSync(new URL('../src/renderer/src/widgets/app-header/AppHeader.vue', import.meta.url), 'utf8');
    expect(vue).toContain('[-webkit-app-region:drag]');
    expect(vue).toMatch(/<button[^>]*:aria-label="\$t\('header\.settings'\)"[^>]*\[-webkit-app-region:no-drag\]/s);
    // Window-controls-overlay area, with a fallback for three 46px Windows buttons.
    expect(vue).toContain('env(titlebar-area-width,calc(100vw_-_138px))');
    expect(vue).toContain('TITLE_BAR_HEIGHT');
  });

  it('main repaints the native buttons when the system theme changes (not on macOS)', () => {
    const code = fs.readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8');
    expect(code).toMatch(/nativeTheme\.on\('updated'/);
    expect(code).toMatch(/setTitleBarOverlay\(titleBarOverlay\(nativeTheme\.shouldUseDarkColors\)\)/);
    expect(code).toMatch(/platform:\s*process\.platform,\s*dark:\s*nativeTheme\.shouldUseDarkColors/);
    expect(code).toMatch(/new BrowserWindow\(windowOptions\(\{[^}]*\.\.\.frame \}\)\)/);
  });

  it('the saved theme is applied before the window exists: frame colours and the first paint already match it', () => {
    const code = fs.readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8');
    const applied = code.indexOf('nativeTheme.themeSource = readPrefs(userData).theme');
    expect(applied).toBeGreaterThan(-1);
    expect(applied).toBeLessThan(code.indexOf('const frame = {'));
  });
});
