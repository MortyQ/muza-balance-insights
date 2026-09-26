// IPC in main (Security Checklist #17, #20): only the methods of src/shared/channels.ts, each with a zod schema for
// its arguments, each call checked for its sender first. No generic channel ("run SQL", "fetch", "invoke anything").
import { z } from 'zod';
import { APP_ORIGIN } from './app-protocol.ts';
import { METHODS, channel, type Method } from '../shared/channels.ts';
import { PROVIDER_IDS } from '@mono/core/providers/types';
import { PIN_RE } from '../shared/lock.ts';
import { IMPORT_DEPTHS } from '../shared/progress.ts';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.number().int().positive();
// The credential's own shape is checked in main per provider (src/net/providers.ts); here only its outer bounds.
const token = z.string().min(20).max(200).regex(/^\S+$/);
const label = z.string().min(1).max(80);
const pin = z.string().regex(PIN_RE);
const triggers = z.strictObject({ startup: z.boolean(), idle: z.boolean(), screenLock: z.boolean(), sleep: z.boolean() });

/** Argument tuples. z.tuple without a rest element rejects extra arguments. */
export const ARG_SCHEMAS = {
  listPeople: z.tuple([]),
  addConnection: z.tuple([
    z.strictObject({
      participant: z.union([z.strictObject({ id }), z.strictObject({ label }), z.strictObject({ fromBank: z.literal(true) })]),
      provider: z.enum(PROVIDER_IDS),
      token,
      remember: z.boolean(),
    }),
  ]),
  renameParticipant: z.tuple([id, label]),
  setConnectionToken: z.tuple([id, token, z.boolean()]),
  removeConnection: z.tuple([id]),
  // Exactly the depths the screen offers: one list, so the two can't drift apart.
  startImport: z.tuple([z.literal(IMPORT_DEPTHS)]),
  cancelImport: z.tuple([]),
  spendingSummary: z.tuple([
    z.strictObject({ from: isoDate, to: isoDate, scope: z.enum(['personal', 'business']).optional(), participantId: id.optional() }),
  ]),
  getBalances: z.union([z.tuple([]), z.tuple([z.strictObject({ participantId: id.optional() })])]),
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
} as const satisfies Record<Method, z.ZodType<unknown[]>>;

export type Args<M extends Method> = z.infer<(typeof ARG_SCHEMAS)[M]>;
export type Handlers = { [M in Method]: (...args: Args<M>) => Promise<unknown> };

/** Messages the renderer gets on refusal: fixed text, never the input, a stack or internals. */
export const FORBIDDEN = 'Запрещено';
export const INVALID_ARGS = 'Недопустимые аргументы';
export const FAILED = 'Не удалось выполнить операцию';
export const LOCKED = 'Приложение заблокировано';

/** What a locked app answers: its own state, the two ways in, and «Забыли PIN?» → «Удалить все данные». */
export const ALLOWED_WHEN_LOCKED = ['getLockState', 'unlockWithPin', 'unlockWithTouchId', 'deleteAllData'] as const satisfies ReadonlyArray<Method>;
const allowedWhenLocked: ReadonlySet<Method> = new Set(ALLOWED_WHEN_LOCKED);

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
 * Order per call: sender → lock → arguments → handler. Handler errors reach the renderer as a fixed message;
 * details go to `onError` (main log), never to the renderer.
 */
export function registerIpc(
  ipcMain: IpcMainLike,
  handlers: Partial<Handlers>,
  opts: { trusted: (event: IpcEventLike) => boolean; locked: () => boolean; onError?: (method: Method, err: unknown) => void },
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
