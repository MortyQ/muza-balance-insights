// IPC in main (Security Checklist #17, #20): only the methods of src/shared/channels.ts, each with a zod schema for
// its arguments, each call checked for its sender first. No generic channel ("run SQL", "fetch", "invoke anything").
import { z } from 'zod';
import { APP_ORIGIN } from './app-protocol.ts';
import { METHODS, channel, type Method } from '../shared/channels.ts';
import { PROVIDER_IDS } from '@mono/core/providers/types';
import { COLOR_KEYS } from '../shared/colors.ts';
import { LOCALES } from '../shared/locale.ts';
import { PIN_RE } from '../shared/lock.ts';
import { IMPORT_DEPTHS } from '../shared/progress.ts';
import { THEME_PREFS } from '../shared/theme.ts';

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const id = z.number().int().positive();
// The credential's own shape is checked in main per provider (src/net/providers.ts); here only its outer bounds.
const token = z.string().min(20).max(200).regex(/^\S+$/);
const label = z.string().min(1).max(80);
// A bank's account id: opaque, no whitespace, bounded.
const accountId = z.string().min(1).max(100).regex(/^\S+$/);
const color = z.enum(COLOR_KEYS);
const pin = z.string().regex(PIN_RE);
const triggers = z.strictObject({ startup: z.boolean(), idle: z.boolean(), screenLock: z.boolean(), sleep: z.boolean() });
const autoSync = z.strictObject({
  enabled: z.boolean(),
  triggers: z.strictObject({ launch: z.boolean(), wake: z.boolean(), interval: z.boolean() }),
});

/** Argument tuples. z.tuple without a rest element rejects extra arguments. */
export const ARG_SCHEMAS = {
  listPeople: z.tuple([]),
  addConnection: z.tuple([
    z.strictObject({
      participant: z.union([
        z.strictObject({ id }),
        z.strictObject({ label, color: color.optional() }),
        z.strictObject({ fromBank: z.literal(true), color: color.optional() }),
      ]),
      provider: z.enum(PROVIDER_IDS),
      token,
      remember: z.boolean(),
    }),
  ]),
  renameParticipant: z.tuple([id, label]),
  restoreBankName: z.tuple([id]),
  setParticipantColor: z.tuple([id, color]),
  setConnectionToken: z.tuple([id, token, z.boolean()]),
  removeConnection: z.tuple([id]),
  listConnectionAccounts: z.tuple([id]),
  setAccountEnabled: z.tuple([accountId, z.boolean()]),
  // Exactly the depths the screen offers: one list, so the two can't drift apart.
  startImport: z.tuple([z.literal(IMPORT_DEPTHS)]),
  cancelImport: z.tuple([]),
  getMonthOverview: z.tuple([z.strictObject({ month, participantId: id.optional() })]),
  getSpendingOverview: z.tuple([z.strictObject({ month, scope: z.enum(['personal', 'business']), participantId: id.optional() })]),
  getSyncStatus: z.tuple([]),
  deleteAllData: z.tuple([]),
  getUpdate: z.tuple([]),
  checkForUpdates: z.tuple([]),
  downloadUpdate: z.tuple([]),
  installUpdate: z.tuple([]),
  setUpdateChecks: z.tuple([z.boolean()]),
  getLockState: z.tuple([]),
  unlockWithPin: z.tuple([pin]),
  unlockWithTouchId: z.tuple([]),
  lockNow: z.tuple([]),
  enableLock: z.tuple([pin]),
  changePin: z.tuple([pin, pin]),
  disableLock: z.tuple([z.union([z.strictObject({ pin }), z.strictObject({ touchId: z.literal(true) })])]),
  setLockTriggers: z.tuple([triggers]),
  setTouchId: z.tuple([z.boolean()]),
  getAutoSync: z.tuple([]),
  setAutoSync: z.tuple([autoSync]),
  getTrustedServices: z.tuple([]),
  getTheme: z.tuple([]),
  setTheme: z.tuple([z.enum(THEME_PREFS)]),
  getLocale: z.tuple([]),
  setLocale: z.tuple([z.enum(LOCALES)]),
  getDbState: z.tuple([]),
  relaunchApp: z.tuple([]),
  startOver: z.tuple([]),
  quitApp: z.tuple([]),
} as const satisfies Record<Method, z.ZodType<unknown[]>>;

export type Args<M extends Method> = z.infer<(typeof ARG_SCHEMAS)[M]>;
export type Handlers = { [M in Method]: (...args: Args<M>) => Promise<unknown> };

/** Messages the renderer gets on refusal: fixed text, never the input, a stack or internals. Never shown: the renderer
 *  words a failure itself (`common.failed`). */
export const FORBIDDEN = 'Forbidden';
export const INVALID_ARGS = 'Invalid arguments';
export const FAILED = 'Operation failed';
export const LOCKED = 'App is locked';
export const DB_UNAVAILABLE = 'Database unavailable';

/**
 * What a locked app answers: its own state, the two ways in, «Забыли PIN?» → «Удалить все данные», and the interface
 * language (only uk | en | ru, from preferences.json, no data) so the lock screen speaks it.
 */
export const ALLOWED_WHEN_LOCKED = ['getLockState', 'unlockWithPin', 'unlockWithTouchId', 'deleteAllData', 'getLocale'] as const satisfies ReadonlyArray<Method>;
const allowedWhenLocked: ReadonlySet<Method> = new Set(ALLOWED_WHEN_LOCKED);

/** What an open app answers while its database is not ready: the recovery screen's buttons and the lock. */
export const ALLOWED_WHEN_DB_UNAVAILABLE = [
  ...ALLOWED_WHEN_LOCKED,
  'lockNow',
  'getDbState',
  'relaunchApp',
  'startOver',
  'quitApp',
] as const satisfies ReadonlyArray<Method>;
const allowedWhenDbUnavailable: ReadonlySet<Method> = new Set(ALLOWED_WHEN_DB_UNAVAILABLE);

export type IpcEventLike = {
  sender: unknown;
  senderFrame: { url: string; parent: unknown } | null;
};

/** Origin of a frame URL, including custom schemes (URL.origin is "null" for them). */
export function frameOrigin(url: string): string | null {
  try {
    const u = new URL(url);
    return u.host ? `${u.protocol}//${u.host}` : null;
  } catch {
    return null;
  }
}

/** The sender must be the main frame of our window, showing our own content. */
export function isTrustedSender(event: IpcEventLike, win: { webContents: unknown } | null, devOrigin: string | null): boolean {
  const frame = event.senderFrame;
  if (!win || event.sender !== win.webContents || !frame || frame.parent !== null) return false;
  const origin = frameOrigin(frame.url);
  return origin === APP_ORIGIN || (devOrigin !== null && origin === devOrigin);
}

export type IpcMainLike = { handle(channel: string, listener: (event: IpcEventLike, ...args: unknown[]) => Promise<unknown>): void };

/**
 * Registers handlers for the given methods; returns the registered channels.
 * Order per call: sender → lock → database → arguments → handler. A gate whose check throws refuses (fails closed). Handler errors reach the renderer as a fixed message;
 * details go to `onError` (main log), never to the renderer.
 */
export function registerIpc(
  ipcMain: IpcMainLike,
  handlers: Partial<Handlers>,
  opts: {
    trusted: (event: IpcEventLike) => boolean;
    locked: () => boolean;
    dbReady: () => boolean;
    onError?: (method: Method, err: unknown) => void;
  },
): string[] {
  const registered: string[] = [];
  for (const method of METHODS) {
    const handler = handlers[method] as ((...args: unknown[]) => Promise<unknown>) | undefined;
    if (!handler) continue;
    ipcMain.handle(channel(method), async (event, ...args) => {
      if (!opts.trusted(event)) throw new Error(FORBIDDEN);
      let isLocked: boolean;
      try {
        isLocked = opts.locked();
      } catch (err) {
        opts.onError?.(method, err);
        throw new Error(LOCKED);
      }
      if (isLocked && !allowedWhenLocked.has(method)) throw new Error(LOCKED);
      if (!allowedWhenDbUnavailable.has(method)) {
        let ready: boolean;
        try {
          ready = opts.dbReady();
        } catch (err) {
          opts.onError?.(method, err);
          throw new Error(DB_UNAVAILABLE);
        }
        if (!ready) throw new Error(DB_UNAVAILABLE);
      }
      const parsed = ARG_SCHEMAS[method].safeParse(args);
      if (!parsed.success) throw new Error(INVALID_ARGS);
      try {
        return await handler(...(parsed.data as unknown[]));
      } catch (err) {
        opts.onError?.(method, err);
        throw new Error(FAILED);
      }
    });
    registered.push(channel(method));
  }
  return registered;
}
