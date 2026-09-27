// Electron main. Order matters: identity, sandbox and the app:// scheme privileges are set before `ready`.
import { app, BrowserWindow, dialog, ipcMain, Menu, powerSaveBlocker, protocol, safeStorage, session, utilityProcess } from 'electron';
import { fileURLToPath } from 'node:url';
import workerPath from '../worker/import.ts?modulePath';
import { DB_STATE_CHANNEL, LOCK_CHANNEL, OPEN_SETTINGS_CHANNEL, PROGRESS_CHANNEL, UPDATE_CHANNEL } from '../shared/channels.ts';
import { importActive } from '../shared/progress.ts';
import { APP_ENTRY, APP_SCHEME, APP_SCHEME_PRIVILEGES, createAppProtocolHandler } from './app-protocol.ts';
import { PROD_CSP, devCsp, localDevOrigin } from './csp.ts';
import { openLibsql } from '@mono/db-libsql';
import { DataService } from './data.ts';
import { denyAllPermissions, guardWebContents, restrictRendererSession } from './hardening.ts';
import { configureIdentity, restrictUserData } from './identity.ts';
import { Importer } from './importer.ts';
import { aboutPanelOptions, aboutText, menuTemplate } from './menu.ts';
import { isTrustedSender, registerIpc } from './ipc.ts';
import { startLockTriggers, touchId } from './lock/electron.ts';
import { gatedPush } from './lock/gate.ts';
import { LockService } from './lock/service.ts';
import { PeopleService } from './people.ts';
import { DbAccess } from './db/access.ts';
import { encryptDatabase } from './db/encrypt.ts';
import { startOver } from './db/start-over.ts';
import { DbKeyVault } from './db/key-vault.ts';
import { SecureStore } from './secure-store.ts';
import { runDbSmoke } from './smoke.ts';
import { TokenVault } from './token.ts';
import { createUpdater, scheduleChecks } from './update/electron.ts';
import { windowOptions } from './window.ts';
import { deleteAllData } from './wipe.ts';

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
// Created in whenReady; until then (and if it failed) the app counts as locked: pushes fail closed.
let lock: LockService | null = null;
// Likewise the database: until it is decided (and if that failed) only the lock and database views are pushed.
let dbAccess: DbAccess | null = null;
const push = gatedPush(
  () => lock?.isLocked() ?? true,
  () => dbAccess?.isReady() ?? false,
  (ch, payload) => win?.webContents.send(ch, payload),
);

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
          push(OPEN_SETTINGS_CHANNEL);
        },
        lockNow: () => lock?.lock('manual'),
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
  await restrictUserData(userData).catch((err: unknown) =>
    process.stderr.write(`[identity] userData mode not set: ${err instanceof Error ? err.name : 'error'}\n`),
  );
  const secureStore = new SecureStore({ safeStorage, platform: process.platform });
  const vault = new TokenVault({ safeStorage, platform: process.platform, userDataDir: userData, store: secureStore });
  // Before anything opens the database (and before the window: a Keychain prompt never lands on the lock screen's
  // Touch ID prompt). Decides encrypted / plain / key unavailable; never deletes a database.
  // «Начать заново» pushes once, at its end: a push from its reset would send the renderer home before the connections
  // are back (home would then pick the connect screen).
  let dbStateQuiet = false;
  const access = new DbAccess({
    userDataDir: userData,
    keys: new DbKeyVault({ store: secureStore, userDataDir: userData, platform: process.platform }),
    store: secureStore,
    openDb: (url, opts) => openLibsql(url, opts),
    // An existing plain database (before 0.1.4) is encrypted here, once; a failure keeps it plain until next launch.
    encrypt: (file, key) =>
      encryptDatabase({ file, key, openDb: (url, opts) => openLibsql(url, opts), platform: process.platform, log: (msg) => process.stderr.write(`[db] ${msg}\n`) }),
    onChange: () => void (dbStateQuiet || push(DB_STATE_CHANNEL, access.view(process.platform))),
    log: (msg) => process.stderr.write(`[db] ${msg}\n`),
  });
  dbAccess = access;
  await access.init().catch((err: unknown) => process.stderr.write(`[db] init failed: ${err instanceof Error ? err.name : 'error'}\n`));
  const data = new DataService({ open: () => access.open(), nowSec: () => Math.floor(Date.now() / 1000) });
  // The token of the app before several connections → the token of its Monobank connection (file moved, not decrypted).
  if (access.isReady() && vault.hasLegacy()) {
    try {
      process.stderr.write(`[token] legacy token: ${await vault.migrateLegacy(await data.legacyConnection())}\n`);
    } catch (err) {
      process.stderr.write(`[token] legacy token not moved: ${err instanceof Error ? err.name : 'error'}\n`);
    }
  }
  const importer = new Importer({
    // A fresh worker per job; empty env: it inherits nothing from ours. stdout/stderr visible only in dev.
    fork: () => utilityProcess.fork(workerPath, [], { serviceName: 'balance-import', env: {}, stdio: app.isPackaged ? 'ignore' : 'inherit' }),
    connections: () => data.connections(),
    tokens: vault,
    powerSaveBlocker,
    userDataDir: userData,
    db: () => access.forWorker(),
    nowSec: () => Math.floor(Date.now() / 1000),
    // Locked: no progress, only the lock view (its importRunning flag) for the lock screen.
    send: (p) => void (push(PROGRESS_CHANNEL, p) || (lock && push(LOCK_CHANNEL, lock.view()))),
    log: (msg) => process.stderr.write(`[import] ${msg}\n`),
  });
  app.on('before-quit', () => importer.shutdown());
  const updater = createUpdater({
    userDataDir: userData,
    importRunning: () => importer.running,
    send: (v) => void push(UPDATE_CHANNEL, v),
    log: (msg) => process.stderr.write(`[update] ${msg}\n`),
  });
  lock = new LockService({
    userDataDir: userData,
    touchId,
    // Not importer.running: that stays true between a worker's final message and its exit event, and scheduleRestart
    // emits `retry` before the restart timer is set — importActive reads the phase itself, so neither window shows
    // «Идёт импорт» after the import is actually over.
    importRunning: () => importActive(importer.lastProgress),
    now: () => Date.now(),
    // Whatever the renderer has shown leaves its memory with the page.
    onLocked: () => win?.webContents.reload(),
    onChange: (v) => {
      push(LOCK_CHANNEL, v);
      if (v.locked) return;
      push(DB_STATE_CHANNEL, access.view(process.platform));
      push(PROGRESS_CHANNEL, importer.lastProgress);
      push(UPDATE_CHANNEL, updater.view());
    },
    log: (msg) => process.stderr.write(`[lock] ${msg}\n`),
  });
  const appLock = lock;
  const stopLockTriggers = startLockTriggers(appLock);
  app.on('will-quit', () => stopLockTriggers());
  const confirmDelete = async () => {
    const opts = {
      type: 'warning' as const,
      buttons: ['Удалить всё', 'Отмена'],
      defaultId: 1,
      cancelId: 1,
      message: 'Удалить все данные?',
      detail: 'Будут удалены загруженные операции, сохранённые токены и незавершённый импорт. Отменить это нельзя.',
    };
    const r = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
    return r.response === 0;
  };
  const confirmStartOver = async () => {
    const opts = {
      type: 'warning' as const,
      buttons: ['Начать заново', 'Отмена'],
      defaultId: 1,
      cancelId: 1,
      message: 'Начать заново?',
      detail:
        'Загруженные операции, люди и их имена, оверрайды и настройки будут удалены. Сохранённые токены останутся, если их ' +
        'удастся прочитать, — операции загрузятся из банка заново. Отменить это нельзя.',
    };
    const r = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
    return r.response === 0;
  };
  const people = new PeopleService({
    db: () => data.database(),
    tokens: vault,
    importRunning: () => importer.running,
    confirmRemove: async () => {
      const opts = {
        type: 'warning' as const,
        buttons: ['Удалить подключение', 'Отмена'],
        defaultId: 1,
        cancelId: 1,
        message: 'Удалить подключение?',
        detail: 'Будут удалены его токен, счета и операции в этом приложении. В банке ничего не изменится. Отменить это нельзя.',
      };
      const r = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
      return r.response === 0;
    },
    nowSec: () => Math.floor(Date.now() / 1000),
  });
  // None of these handlers ever returns the token; data handlers return categories, amounts and «black/UAH» labels only.
  registerIpc(ipcMain, {
    listPeople: () => people.list(),
    addConnection: (input) => people.addConnection(input),
    renameParticipant: (id, label) => people.rename(id, label),
    setConnectionToken: (id, token, remember) => people.setToken(id, token, remember),
    removeConnection: (id) => people.remove(id),
    startImport: (depth) => importer.start(depth),
    cancelImport: async () => importer.cancel(),
    spendingSummary: (q) => data.spending(q),
    getBalances: (...q) => data.balances(q[0]),
    getSyncStatus: () => data.status(),
    deleteAllData: async () => {
      const r = await deleteAllData({ confirm: confirmDelete, tokens: vault, importer, data, userDataDir: userData, log: (m) => process.stderr.write(`[data] ${m}\n`) });
      if (r.deleted) {
        await appLock.reset().catch(() => process.stderr.write('[lock] reset after wipe failed\n'));
        await access.afterWipe().catch(() => process.stderr.write('[db] state after wipe failed\n'));
      }
      return r;
    },
    getUpdate: async () => updater.view(),
    checkForUpdates: () => updater.check(true),
    downloadUpdate: () => updater.download(),
    installUpdate: async () => updater.install(),
    setUpdateChecks: (enabled) => updater.setChecks(enabled),
    getLockState: async () => appLock.view(),
    unlockWithPin: (pin) => appLock.unlockWithPin(pin),
    unlockWithTouchId: () => appLock.unlockWithTouchId(),
    lockNow: async () => appLock.lock('manual'),
    enableLock: async (pin) => (await appLock.enable(pin), appLock.view()),
    changePin: (current, next) => appLock.changePin(current, next),
    disableLock: (auth) => appLock.disable(auth),
    setLockTriggers: async (t) => (await appLock.setTriggers(t), appLock.view()),
    setTouchId: async (enabled) => (await appLock.setTouchId(enabled), appLock.view()),
    getDbState: async () => access.view(process.platform),
    // A retry in this process would not help (the cipher state is cached): a new process asks the keychain again.
    relaunchApp: async () => {
      if (access.isReady()) throw new Error('database is ready');
      app.relaunch();
      app.quit();
    },
    startOver: async () => {
      dbStateQuiet = true;
      try {
        return await startOver({
          access,
          confirm: confirmStartOver,
          tokens: vault,
          importer,
          data,
          people,
          userDataDir: userData,
          log: (m) => process.stderr.write(`[db] ${m}\n`),
        });
      } finally {
        dbStateQuiet = false;
        push(DB_STATE_CHANNEL, access.view(process.platform));
      }
    },
    quitApp: async () => app.quit(),
  }, {
    trusted: (event) => isTrustedSender(event, win, devOrigin),
    locked: () => appLock.isLocked(),
    dbReady: () => access.isReady(),
    onError: (method, err) => process.stderr.write(`[ipc] ${method}: ${err instanceof Error ? err.name : 'error'}\n`),
  });

  if (!app.isPackaged) {
    const st = access.state();
    const smoke = access.isReady()
      ? await runDbSmoke(() => access.open(), st.kind === 'ready' && st.encrypted, Math.floor(Date.now() / 1000))
      : ({ ok: false, error: st.kind } as const);
    process.stdout.write(`[smoke] ${JSON.stringify({ app: identity.name, ok: smoke.ok, encrypted: smoke.ok && smoke.encrypted, devOrigin })}\n`);
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
    push(LOCK_CHANNEL, appLock.view());
    push(DB_STATE_CHANNEL, access.view(process.platform));
    push(PROGRESS_CHANNEL, importer.lastProgress);
    push(UPDATE_CHANNEL, updater.view());
    if (!resumeChecked) {
      resumeChecked = true;
      // Not while the database is unavailable: the import would only fail on it.
      if (access.isReady()) void importer.resumeOnLaunch();
      scheduleChecks(updater);
    }
  });
  // A lock/reload racing the first load aborts it (ERR_ABORTED) — not a real failure, just logged.
  const load = devOrigin ? win.loadURL(`${devOrigin}/`) : win.loadURL(APP_ENTRY);
  await load.catch((err) => process.stderr.write(`[window] initial load did not finish: ${err instanceof Error ? err.name : 'error'}\n`));
}).catch((err) => process.stderr.write(`[main] startup failed: ${err instanceof Error ? err.name : 'error'}\n`));
