// The argument schemas of every IPC method (src/shared/channels.ts): main checks each call against them
// (src/main/ipc.ts), and the data process checks its calls with the same pieces (src/shared/data-protocol.ts).
import { z } from 'zod';
import { PROVIDER_IDS } from '@mono/core/providers/types';
import { RESERVE_AMOUNT_MAX, RESERVE_CURRENCIES, RESERVE_NAME_MAX } from './allowance.ts';
import type { Method } from './channels.ts';
import { CATEGORY_IDS } from './categories.ts';
import { COLOR_KEYS } from './colors.ts';
import { LOCALES } from './locale.ts';
import { PIN_RE } from './lock.ts';
import { ANALYTICS_MAX_MONTHS, monthSpan } from './analytics.ts';
import { isIsoDate } from './import-range.ts';
import { THEME_PREFS } from './theme.ts';
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const id = z.number().int().positive();
// A reserve of «Available per day»: core (reserves.ts) checks the same again.
const reserve = z.strictObject({
  name: z.string().refine((v) => v.trim().length > 0 && [...v.trim()].length <= RESERVE_NAME_MAX),
  currency: z.union(RESERVE_CURRENCIES.map((c) => z.literal(c))),
  amount: z.number().int().min(0).max(RESERVE_AMOUNT_MAX),
  until: z.string().refine(isIsoDate).nullable(),
  participantId: id.nullable(),
});
const isoDate = z.string().refine(isIsoDate);
// The days themselves (a Monday, not after today) are main's check: DataService.categoryOverview / incomeOverview → periodBounds.
const detailPeriod = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('day'), date: isoDate }),
  z.strictObject({ kind: z.literal('week'), from: isoDate }),
  z.strictObject({ kind: z.literal('month'), month }),
]);
// The credential's own shape is checked in main per provider (src/net/providers.ts); here only its outer bounds.
const token = z.string().min(20).max(200).regex(/^\S+$/);
export const label = z.string().min(1).max(80);
// A bank's account id: opaque, no whitespace, bounded.
export const accountId = z.string().min(1).max(100).regex(/^\S+$/);
export const color = z.enum(COLOR_KEYS);
const pin = z.string().regex(PIN_RE);
export const participant = z.union([
  z.strictObject({ id }),
  z.strictObject({ label, color: color.optional() }),
  z.strictObject({ fromBank: z.literal(true), color: color.optional() }),
]);
const triggers = z.strictObject({ startup: z.boolean(), idle: z.boolean(), screenLock: z.boolean(), sleep: z.boolean() });
// A statement kept in main (statements.ts): a random UUID.
const statementId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
// The bank's card type for a new card from a file (Monobank: black, white …); main stores it as the API would.
export const cardType = z.string().regex(/^[A-Za-z]{1,20}$/);
const statementTarget = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('account'), accountId }),
  z.strictObject({ kind: z.literal('new'), type: cardType.nullable() }),
]);
/** Accounts one statement file may hold; main refuses a file with more (`over-limits`). */
export const STATEMENT_ACCOUNTS_MAX = 50;
/** At most this many files in one upload of the upload sheet. */
export const UPLOAD_FILES_MAX = 12;
const autoSync = z.strictObject({
  enabled: z.boolean(),
  triggers: z.strictObject({ launch: z.boolean(), wake: z.boolean(), interval: z.boolean() }),
});

/** Argument tuples. z.tuple without a rest element rejects extra arguments. */
export const ARG_SCHEMAS = {
  listPeople: z.tuple([]),
  addConnection: z.tuple([
    z.union([
      z.strictObject({ participant, provider: z.enum(PROVIDER_IDS), method: z.literal('token').optional(), token, remember: z.boolean() }),
      // A file connection carries no token.
      z.strictObject({ participant, provider: z.enum(PROVIDER_IDS), method: z.literal('file') }),
    ]),
  ]),
  renameParticipant: z.tuple([id, label]),
  restoreBankName: z.tuple([id]),
  setParticipantColor: z.tuple([id, color]),
  setConnectionToken: z.tuple([id, token, z.boolean()]),
  removeConnection: z.tuple([id]),
  listConnectionAccounts: z.tuple([id]),
  setAccountEnabled: z.tuple([accountId, z.boolean()]),
  openStatement: z.tuple([id]),
  openAnyStatement: z.tuple([]),
  // The path of a file dropped on the window, from the preload (webUtils.getPathForFile): the renderer's API takes a File.
  openDroppedStatement: z.tuple([z.string().min(1).max(4096)]),
  assignStatement: z.tuple([statementId, id]),
  compareStatement: z.tuple([statementId, z.array(statementTarget.nullable()).min(1).max(STATEMENT_ACCOUNTS_MAX)]),
  commitStatement: z.tuple([statementId, z.array(statementTarget).min(1).max(STATEMENT_ACCOUNTS_MAX)]),
  openUpload: z.union([z.tuple([]), z.tuple([id])]),
  // The dropped files' paths, from the preload; past UPLOAD_FILES_MAX the service says too-many.
  openDroppedUpload: z.tuple([z.array(z.string().min(1).max(4096)).min(1).max(64)]),
  commitUpload: z.tuple([statementId, z.array(z.array(id.nullable()).max(STATEMENT_ACCOUNTS_MAX)).min(1).max(UPLOAD_FILES_MAX)]),
  // A real YYYY-MM-DD date; the importer also checks it is within the range the screen offers (isImportFrom).
  startImport: z.tuple([z.string().refine(isIsoDate)]),
  cancelImport: z.tuple([]),
  getMonthOverview: z.tuple([z.strictObject({ month, participantId: id.optional() })]),
  getSpendingOverview: z.tuple([z.strictObject({ month, scope: z.enum(['personal', 'business']), participantId: id.optional() })]),
  getNowOverview: z.tuple([z.strictObject({ participantId: id.optional() })]),
  getCategoryOverview: z.tuple([
    z.strictObject({ period: detailPeriod, category: z.enum(CATEGORY_IDS), scope: z.enum(['personal', 'business']), participantId: id.optional() }),
  ]),
  getIncomeOverview: z.tuple([z.strictObject({ period: detailPeriod, participantId: id.optional() })]),
  getRecurringOverview: z.tuple([z.strictObject({ participantId: id.optional() })]),
  getAllowanceOverview: z.tuple([z.strictObject({ participantId: id.optional() })]),
  addReserve: z.tuple([reserve]),
  updateReserve: z.tuple([id, reserve]),
  deleteReserve: z.tuple([id]),
  setRecurringMark: z.tuple([z.strictObject({ key: z.string().min(1).max(200), mark: z.enum(['mandatory', 'hidden']).nullable() })]),
  // Whole months, from ≤ to, at most ANALYTICS_MAX_MONTHS; main also refuses a range that ends after this month.
  getAnalyticsOverview: z.tuple([
    z
      .strictObject({ from: month, to: month, participantId: id.optional() })
      .refine((q) => q.from <= q.to && monthSpan(q.from, q.to) <= ANALYTICS_MAX_MONTHS),
  ]),
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
