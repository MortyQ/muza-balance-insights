// Messages between main and the import worker (utilityProcess). Validated with zod on both sides.
// The token appears in exactly one message: `start`, main → worker. Nothing the worker sends back can hold it:
// progress is typed data, errors are fixed texts or already-redacted Monobank messages.
import { z } from 'zod';

export const StartMessage = z.strictObject({
  type: z.literal('start'),
  dbPath: z.string().min(1),
  token: z.string().regex(/^\S{20,200}$/),
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

export const ErrorKind = z.enum(['cancelled', 'auth', 'rate-limit', 'network', 'format', 'other']);
export type ErrorKind = z.infer<typeof ErrorKind>;

export const FromWorker = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('progress'), progress: WorkerProgress }),
  z.strictObject({ type: z.literal('done'), windowsTotal: count, transactions: count }),
  z.strictObject({ type: z.literal('error'), kind: ErrorKind, message: z.string().max(300) }),
  /** Service lines for the main log (dev stdout): names and counts only. */
  z.strictObject({ type: z.literal('log'), message: z.string().max(300) }),
]);
export type FromWorker = z.infer<typeof FromWorker>;
