// Electron main. Order matters: identity, sandbox and the app:// scheme privileges are set before `ready`.
import { app, BrowserWindow, dialog, ipcMain, Menu, powerSaveBlocker, protocol, safeStorage, session, utilityProcess } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import workerPath from '../worker/import.ts?modulePath';
import { OPEN_SETTINGS_CHANNEL, PROGRESS_CHANNEL, UPDATE_CHANNEL } from '../shared/channels.ts';
import { APP_ENTRY, APP_SCHEME, APP_SCHEME_PRIVILEGES, createAppProtocolHandler } from './app-protocol.ts';
import { PROD_CSP, devCsp, localDevOrigin } from './csp.ts';
import { openLibsql } from '@mono/db-libsql';
import { DataService } from './data.ts';
import { denyAllPermissions, guardWebContents, restrictRendererSession } from './hardening.ts';
import { configureIdentity } from './identity.ts';
import { Importer } from './importer.ts';
import { aboutPanelOptions, aboutText, menuTemplate } from './menu.ts';
import { isTrustedSender, registerIpc } from './ipc.ts';
import { runDbSmoke } from './smoke.ts';
import { TokenStore } from './token.ts';
import { createUpdater, scheduleChecks } from './update/electron.ts';
import { windowOptions } from './window.ts';
import { DB_FILE, deleteAllData } from './wipe.ts';

// Before anything touches userData.
const identity = configureIdentity(app);
// #4: every renderer sandboxed, whatever a window's options say.
app.enableSandbox();
// #18: our own scheme instead of file://; must be registered before ready.
protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: APP_SCHEME_PRIVILEGES }]);
// One instance: two windows would mean two imports into one database.
if (!app.requestSingleInstanceLock()) app.quit();

const rendererDir = fileURLToPath(new URL('../renderer/', import.meta.url));
const preloadPath = fileURLToPath(new URL('../preload/index.cjs', import.meta.url));
// Dev server only in an unpackaged app, and only on localhost.
const devOrigin = app.isPackaged ? null : localDevOrigin(process.env.ELECTRON_RENDERER_URL);

let win: BrowserWindow | null = null;

/** Dev-only diagnostics (stdout of `pnpm dev`): what the guards blocked. URLs without query/fragment; no data. */
const devLog = app.isPackaged ? undefined : (msg: string) => process.stdout.write(`[guard] ${msg}\n`);

// #13, #14, webview: applied to every webContents the app ever creates.
app.on('web-contents-created', (_event, wc) => {
  devLog?.(`webContents created: type=${wc.getType()}`);
  guardWebContents(wc, devLog);
});
app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});
app.on('window-all-closed', () => app.quit());

app.whenReady().then(async () => {
  // Our own menu instead of Electron's default (no DevTools / reload in prod, no Help links to the outside).
  const about = { name: identity.name, version: app.getVersion() };
  app.setAboutPanelOptions(aboutPanelOptions(about));
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate({
        name: identity.name,
        platform: process.platform,
        isPackaged: app.isPackaged,
        showAbout: () => void dialog.showMessageBox({ type: 'info', buttons: ['OK'], ...aboutText(about) }),
        openSettings: () => {
          if (!win) return;
          if (win.isMinimized()) win.restore();
          win.focus();
          win.webContents.send(OPEN_SETTINGS_CHANNEL);
        },
      }),
    ),
  );
  const s = session.defaultSession;
  denyAllPermissions(s);
  restrictRendererSession(s, {
    devOrigin,
    devCsp: devOrigin ? devCsp(devOrigin) : null,
    ...(devLog ? { onBlocked: (where: string) => devLog(`blocked request ${where}`) } : {}),
  });
  protocol.handle(APP_SCHEME, createAppProtocolHandler(rendererDir, PROD_CSP));
  const userData = app.getPath('userData');
  const tokens = new TokenStore({ safeStorage, platform: process.platform, userDataDir: userData });
  const importer = new Importer({
    // A fresh worker per job; empty env: it inherits nothing from ours. stdout/stderr visible only in dev.
    fork: () => utilityProcess.fork(workerPath, [], { serviceName: 'balance-import', env: {}, stdio: app.isPackaged ? 'ignore' : 'inherit' }),
    tokens,
    powerSaveBlocker,
    userDataDir: userData,
    dbPath: path.join(userData, DB_FILE),
    nowSec: () => Math.floor(Date.now() / 1000),
    send: (p) => win?.webContents.send(PROGRESS_CHANNEL, p),
    log: (msg) => process.stderr.write(`[import] ${msg}\n`),
  });
  app.on('before-quit', () => importer.shutdown());
  const updater = createUpdater({
    userDataDir: userData,
    importRunning: () => importer.running,
    send: (v) => win?.webContents.send(UPDATE_CHANNEL, v),
    log: (msg) => process.stderr.write(`[update] ${msg}\n`),
  });
  const data = new DataService({ open: () => openLibsql(`file:${path.join(userData, DB_FILE)}`), nowSec: () => Math.floor(Date.now() / 1000) });
  const confirmDelete = async () => {
    const opts = {
      type: 'warning' as const,
      buttons: ['Удалить всё', 'Отмена'],
      defaultId: 1,
      cancelId: 1,
      message: 'Удалить все данные?',
      detail: 'Будут удалены загруженные операции, сохранённый токен и незавершённый импорт. Отменить это нельзя.',
    };
    const r = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
    return r.response === 0;
  };
  // None of these handlers ever returns the token; data handlers return categories, amounts and «black/UAH» labels only.
  registerIpc(ipcMain, {
    setToken: (token, remember) => tokens.set(token, remember),
    clearToken: () => tokens.clear(),
    hasToken: () => tokens.status(),
    startImport: (depth) => importer.start(depth),
    cancelImport: async () => importer.cancel(),
    spendingSummary: (q) => data.spending(q),
    getBalances: () => data.balances(),
    getSyncStatus: () => data.status(),
    deleteAllData: () =>
      deleteAllData({ confirm: confirmDelete, tokens, importer, data, userDataDir: userData, log: (m) => process.stderr.write(`[data] ${m}\n`) }),
    getUpdate: async () => updater.view(),
    checkForUpdates: () => updater.check(true),
    downloadUpdate: () => updater.download(),
    installUpdate: async () => updater.install(),
    setUpdateChecks: (enabled) => updater.setChecks(enabled),
  }, {
    trusted: (event) => isTrustedSender(event, win, devOrigin),
    onError: (method, err) => process.stderr.write(`[ipc] ${method}: ${err instanceof Error ? err.name : 'error'}\n`),
  });

  if (!app.isPackaged) {
    const smoke = await runDbSmoke(app.getPath('userData'), Math.floor(Date.now() / 1000));
    process.stdout.write(`[smoke] ${JSON.stringify({ app: identity.name, ok: smoke.ok, devOrigin })}\n`);
  }

  win = new BrowserWindow(windowOptions({ preloadPath, isPackaged: app.isPackaged, title: identity.name }));
  win.once('ready-to-show', () => win?.show());
  if (devLog) {
    win.webContents.on('devtools-opened', () => devLog('devtools opened'));
    win.webContents.on('devtools-closed', () => devLog('devtools closed'));
  }
  win.on('closed', () => {
    win = null;
  });
  // A (re)loaded renderer gets the current import state; the first load also resumes an unfinished import.
  let resumeChecked = false;
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send(PROGRESS_CHANNEL, importer.lastProgress);
    win?.webContents.send(UPDATE_CHANNEL, updater.view());
    if (!resumeChecked) {
      resumeChecked = true;
      void importer.resumeOnLaunch();
      scheduleChecks(updater);
    }
  });
  if (devOrigin) await win.loadURL(`${devOrigin}/`);
  else await win.loadURL(APP_ENTRY);
});
