// Messages between main and the data process (src/data/process.ts), which runs every database read and write behind
// the renderer's IPC. A call names one method of DATA_METHODS: no message carries SQL or names an arbitrary function.
// The data process checks each call's arguments against DATA_ARG_SCHEMAS before anything runs; main checks each reply
// against the call it answers. Errors come back as a code and the error's name, never its message.
// The database key appears in exactly one message: `open`, main → data process (null for a plain database).
import { z } from 'zod';
import { PROVIDER_IDS, type ProviderId, type ParsedStatement } from '@mono/core/providers/types';
import type { StatementBlock, StatementComparison, StatementTarget } from '@mono/core/ingest/statement-import';
import type { ReserveInput } from './allowance.ts';
import { DB_KEY_RE } from './db-open.ts';
import { ARG_SCHEMAS, STATEMENT_ACCOUNTS_MAX, accountId, cardType, id, participant } from './ipc-args.ts';
import type {
  AllowanceOverview,
  AllowanceQuery,
  AnalyticsOverview,
  AnalyticsQuery,
  CategoryOverview,
  CategoryOverviewQuery,
  ColorChangeResult,
  ColorKey,
  ConnectionAccountView,
  ConnectionMethod,
  ConnectionView,
  DataStatus,
  IncomeOverview,
  IncomeOverviewQuery,
  MonthOverview,
  MonthOverviewQuery,
  NowOverview,
  NowOverviewQuery,
  ParticipantChoice,
  PersonView,
  RatesView,
  RecurringMarkQuery,
  RecurringOverview,
  RecurringOverviewQuery,
  SpendingOverview,
  SpendingOverviewQuery,
} from './api.ts';

/** A person as the database knows them: main adds each connection's bank name and token status (PersonView). */
export type PersonRow = Omit<PersonView, 'connections'> & { connections: Array<Omit<ConnectionView, 'bank' | 'token'>> };

/** A statement's write; the kept statement's expiry and the running import are main's refusals. */
export type StatementWriteResult = { written: true; added: number } | { written: false; reason: StatementBlock };

/** Every method: its arguments and its result. */
export type DataMethods = {
  monthOverview: { args: [MonthOverviewQuery]; result: MonthOverview };
  spendingOverview: { args: [SpendingOverviewQuery]; result: SpendingOverview };
  nowOverview: { args: [NowOverviewQuery]; result: NowOverview };
  categoryOverview: { args: [CategoryOverviewQuery]; result: CategoryOverview };
  incomeOverview: { args: [IncomeOverviewQuery]; result: IncomeOverview };
  recurringOverview: { args: [RecurringOverviewQuery]; result: RecurringOverview };
  allowanceOverview: { args: [AllowanceQuery]; result: AllowanceOverview };
  analyticsOverview: { args: [AnalyticsQuery]; result: AnalyticsOverview };
  setRecurringMark: { args: [RecurringMarkQuery]; result: void };
  addReserve: { args: [ReserveInput]; result: void };
  updateReserve: { args: [number, ReserveInput]; result: void };
  deleteReserve: { args: [number]; result: void };
  status: { args: []; result: DataStatus };
  lastSyncSec: { args: []; result: number | null };
  /** The import's connections: token ones only. */
  tokenConnections: { args: []; result: Array<{ connectionId: number; provider: ProviderId }> };
  /** The only Monobank connection (created with «Я» if there is none): the owner of an older version's token.bin. */
  legacyConnection: { args: []; result: number };
  people: { args: []; result: PersonRow[] };
  renameParticipant: { args: [number, string]; result: void };
  restoreBankName: { args: [number]; result: void };
  setParticipantColor: { args: [number, ColorKey]; result: ColorChangeResult };
  connections: { args: []; result: Array<{ id: number; provider: ProviderId; method: ConnectionMethod }> };
  /** The participant (new or chosen) and the connection; a participant created for it goes again if the connection fails. */
  createConnection: { args: [ParticipantChoice, ProviderId, ConnectionMethod]; result: { connectionId: number; participantId: number } };
  deleteConnection: { args: [number]; result: void };
  connectionAccounts: { args: [number]; result: ConnectionAccountView[] };
  setAccountEnabled: { args: [string, boolean]; result: void };
  compareStatement: { args: [number, ParsedStatement[], Array<StatementTarget | null>]; result: StatementComparison[] };
  commitStatement: { args: [number, ParsedStatement[], StatementTarget[]]; result: StatementWriteResult };
};

export type DataMethod = keyof DataMethods;
export type DataArgs<M extends DataMethod> = DataMethods[M]['args'];
export type DataResult<M extends DataMethod> = DataMethods[M]['result'];

const none = z.tuple([]);

// A row of a read statement file (core NormalizedTx without its id): only the fields the readers fill.
const statementRow = z.strictObject({
  time: z.number().int(),
  amount: z.number().int(),
  currencyCode: z.number().int(),
  hold: z.boolean(),
  mcc: z.number().int().optional(),
  bankCategory: z.string().optional(),
  description: z.string().optional(),
  originalMcc: z.number().int().optional(),
  operationAmount: z.number().int().optional(),
  commissionRate: z.number().optional(),
  cashbackAmount: z.number().int().optional(),
  balance: z.number().int().optional(),
  comment: z.string().optional(),
  receiptId: z.string().optional(),
  counterEdrpou: z.string().optional(),
  counterIban: z.string().optional(),
  counterName: z.string().optional(),
  raw: z.string(),
});
const parsedStatement = z.strictObject({
  kind: z.literal('card'),
  currencyCode: z.number().int(),
  account: z.strictObject({
    iban: z.string().max(34).nullable(),
    cards: z.array(z.string().max(32)).max(16),
    type: z.string().max(40).nullable(),
  }),
  rows: z.array(statementRow).min(1),
  closingBalance: z.number().int().nullable(),
}) satisfies z.ZodType<ParsedStatement>;
// Every account of one file, in the file's order.
const statements = z.array(parsedStatement).min(1).max(STATEMENT_ACCOUNTS_MAX);
// A new card's id is main's (StatementsService: `file-` + a random UUID).
const statementTarget = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('account'), accountId }),
  z.strictObject({ kind: z.literal('new'), id: z.string().regex(/^file-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/), type: cardType.nullable() }),
]);

/** Argument tuples, the IPC's own where the method is one. z.tuple without a rest element rejects extra arguments. */
export const DATA_ARG_SCHEMAS = {
  monthOverview: ARG_SCHEMAS.getMonthOverview,
  spendingOverview: ARG_SCHEMAS.getSpendingOverview,
  nowOverview: ARG_SCHEMAS.getNowOverview,
  categoryOverview: ARG_SCHEMAS.getCategoryOverview,
  incomeOverview: ARG_SCHEMAS.getIncomeOverview,
  recurringOverview: ARG_SCHEMAS.getRecurringOverview,
  allowanceOverview: ARG_SCHEMAS.getAllowanceOverview,
  analyticsOverview: ARG_SCHEMAS.getAnalyticsOverview,
  setRecurringMark: ARG_SCHEMAS.setRecurringMark,
  addReserve: ARG_SCHEMAS.addReserve,
  updateReserve: ARG_SCHEMAS.updateReserve,
  deleteReserve: ARG_SCHEMAS.deleteReserve,
  status: none,
  lastSyncSec: none,
  tokenConnections: none,
  legacyConnection: none,
  people: none,
  renameParticipant: ARG_SCHEMAS.renameParticipant,
  restoreBankName: ARG_SCHEMAS.restoreBankName,
  setParticipantColor: ARG_SCHEMAS.setParticipantColor,
  connections: none,
  createConnection: z.tuple([participant, z.enum(PROVIDER_IDS), z.enum(['token', 'file'])]),
  deleteConnection: z.tuple([id]),
  connectionAccounts: ARG_SCHEMAS.listConnectionAccounts,
  setAccountEnabled: ARG_SCHEMAS.setAccountEnabled,
  compareStatement: z
    .tuple([id, statements, z.array(statementTarget.nullable()).max(STATEMENT_ACCOUNTS_MAX)])
    .refine(([, s, t]) => s.length === t.length, 'One target per statement'),
  commitStatement: z
    .tuple([id, statements, z.array(statementTarget).max(STATEMENT_ACCOUNTS_MAX)])
    .refine(([, s, t]) => s.length === t.length, 'One target per statement'),
} as const satisfies Record<DataMethod, z.ZodType<unknown[]>>;

export const DATA_METHODS = Object.keys(DATA_ARG_SCHEMAS) as DataMethod[];

/** The methods that convert by today's rates: main sends the rates ahead of them whenever they changed. */
export const RATED_METHODS = [
  'monthOverview',
  'spendingOverview',
  'nowOverview',
  'categoryOverview',
  'incomeOverview',
  'recurringOverview',
  'allowanceOverview',
  'analyticsOverview',
] as const satisfies ReadonlyArray<DataMethod>;

/** `connection`: an unknown connection or account (core ConnectionError); `invalid`: arguments refused; `failed`: anything else. */
export const DATA_ERRORS = ['connection', 'invalid', 'failed'] as const;
export type DataErrorCode = (typeof DATA_ERRORS)[number];

const callId = z.number().int().nonnegative();
const errorName = z.string().max(80);

export const OpenMessage = z.strictObject({ type: z.literal('open'), dbPath: z.string().min(1), dbKey: z.string().regex(DB_KEY_RE).nullable() });
/** Today's rates (main's RatesService), ahead of a rated call whenever they changed; the overviews use the last ones. */
export const RatesMessage = z.strictObject({
  type: z.literal('rates'),
  rates: z
    .strictObject({
      list: z.array(z.strictObject({ currency: z.number().int(), rate: z.number().positive() })),
      fetchedAt: z.number().int(),
      saved: z.boolean(),
    })
    .nullable(),
}) satisfies z.ZodType<{ type: 'rates'; rates: RatesView | null }>;
export const CallMessage = z.strictObject({ type: z.literal('call'), id: callId, method: z.enum(DATA_METHODS as [DataMethod, ...DataMethod[]]), args: z.array(z.unknown()) });
export const CloseMessage = z.strictObject({ type: z.literal('close') });
export const ToData = z.discriminatedUnion('type', [OpenMessage, RatesMessage, CallMessage, CloseMessage]);
export type ToData = z.infer<typeof ToData>;
export type CallMessage = z.infer<typeof CallMessage>;

export const ReadyMessage = z.strictObject({ type: z.literal('ready') });
/** `unreadable`: the key does not open the file (SQLITE_NOTADB); `failed`: anything else. */
export const OpenFailedMessage = z.strictObject({ type: z.literal('open-failed'), kind: z.enum(['unreadable', 'failed']), name: errorName });
export const ResultMessage = z.strictObject({ type: z.literal('result'), id: callId, value: z.unknown() });
export const FailureMessage = z.strictObject({ type: z.literal('failure'), id: callId, code: z.enum(DATA_ERRORS), name: errorName });
export const FromData = z.discriminatedUnion('type', [ReadyMessage, OpenFailedMessage, ResultMessage, FailureMessage]);
export type FromData = z.infer<typeof FromData>;
export type DataReply = z.infer<typeof ResultMessage> | z.infer<typeof FailureMessage>;
/** How main reaches the data process: one call, its reply. */
export type DataCall = (method: DataMethod, args: unknown[]) => Promise<DataReply>;

/** A failed call, as main sees it: the code and the original error's name (for the log), no message from the data process. */
export class DataCallError extends Error {
  constructor(
    readonly code: DataErrorCode,
    name: string,
    message: string = name,
  ) {
    super(message);
    this.name = name;
  }
}
