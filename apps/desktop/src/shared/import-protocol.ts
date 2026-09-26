// Messages between main and the import worker (utilityProcess). Validated with zod on both sides.
// Tokens appear in exactly one message: `start`, main → worker (one per connection). Nothing the worker sends back can
// hold them: progress is typed data, errors are fixed texts or already-redacted bank messages; connections appear by
// their numeric id only, never by a participant's name.
import { z } from 'zod';
import { PROVIDER_IDS } from '@mono/core/providers/types';
import { DESKTOP_PROVIDERS } from '../net/providers.ts';

export const MAX_CONNECTIONS = 10;

const connectionId = z.number().int().positive();

export const StartConnection = z
  .strictObject({ connectionId, provider: z.enum(PROVIDER_IDS), token: z.string() })
  .refine((c) => DESKTOP_PROVIDERS[c.provider].credential.test(c.token), { message: 'not a credential' });

export const StartMessage = z.strictObject({
  type: z.literal('start'),
  dbPath: z.string().min(1),
  connections: z
    .array(StartConnection)
    .min(1)
    .max(MAX_CONNECTIONS)
    .refine((cs) => new Set(cs.map((c) => c.connectionId)).size === cs.length, { message: 'duplicate connection' }),
  sinceSec: z.number().int().positive(),
});
export const CancelMessage = z.strictObject({ type: z.literal('cancel') });
export const ToWorker = z.discriminatedUnion('type', [StartMessage, CancelMessage]);
export type ToWorker = z.infer<typeof ToWorker>;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().nonnegative();

export const WorkerProgress = z.discriminatedUnion('phase', [
  z.strictObject({ phase: z.literal('accounts') }),
  z.strictObject({
    phase: z.literal('windows'),
    account: z.string().max(40),
    from: date,
    to: date,
    round: count,
    index: count,
    total: count,
    windowsDone: count,
    windowsTotal: count,
    transactions: count,
    etaSec: count,
    waitingSec: count.nullable(),
  }),
  z.strictObject({
    phase: z.literal('retry'),
    // 'crash' is main's own: a worker never reports its own crash.
    reason: z.enum(['network', 'server', 'rate-limit']),
    attempt: count.positive(),
    inSec: count,
  }),
  z.strictObject({ phase: z.literal('rederive') }),
]);

/** auth = the bank rejected the credential; connection = the credential is of another holder / already connected. */
export const ErrorKind = z.enum(['cancelled', 'auth', 'connection', 'rate-limit', 'network', 'format', 'other']);
export type ErrorKind = z.infer<typeof ErrorKind>;

export const FromWorker = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('progress'), progress: WorkerProgress }),
  z.strictObject({
    type: z.literal('done'),
    windowsTotal: count,
    transactions: count,
    /** Connections that stopped on their own error while the others finished. */
    failed: z.array(z.strictObject({ connectionId, kind: ErrorKind, message: z.string().max(300) })).max(MAX_CONNECTIONS),
  }),
  z.strictObject({ type: z.literal('error'), kind: ErrorKind, message: z.string().max(300) }),
  /** Service lines for the main log (dev stdout): names and counts only. */
  z.strictObject({ type: z.literal('log'), message: z.string().max(300) }),
]);
export type FromWorker = z.infer<typeof FromWorker>;
