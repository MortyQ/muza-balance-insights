// userData/lock.json: the PIN hash, the switches and the wrong-PIN counter (a restart does not reset it).
// Missing = the lock is off. Unreadable or not matching the schema = broken: the app stays locked.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { KDF, KEY_LEN, SALT_LEN } from './pin.ts';

export const LOCK_FILE = 'lock.json';

/** Base64 that decodes to exactly `len` bytes — a hash or salt of the wrong size must never parse as valid. */
function base64Of(len: number) {
  return z
    .string()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/)
    .refine((s) => Buffer.from(s, 'base64').length === len, `must decode to ${len} bytes`);
}

const LockFileSchema = z.strictObject({
  version: z.literal(1),
  kdf: z.strictObject({
    name: z.literal('scrypt'),
    // Pinned to the values pin.ts actually uses: any other N/r/p either isn't a valid scrypt cost
    // (N must be a power of two) or blows past scrypt's memory limit (128·N·r bytes).
    N: z.literal(KDF.N),
    r: z.literal(KDF.r),
    p: z.literal(KDF.p),
    salt: base64Of(SALT_LEN),
  }),
  hash: base64Of(KEY_LEN),
  touchId: z.boolean(),
  triggers: z.strictObject({ startup: z.boolean(), idle: z.boolean(), screenLock: z.boolean(), sleep: z.boolean() }),
  failedAttempts: z.number().int().min(0),
  nextAttemptAt: z.number().int().positive().nullable(),
});
export type LockFile = z.infer<typeof LockFileSchema>;
export type LockRead = { kind: 'none' } | { kind: 'ok'; file: LockFile } | { kind: 'broken' };

export function readLock(dir: string): LockRead {
  let text: string;
  try {
    text = fs.readFileSync(path.join(dir, LOCK_FILE), 'utf8');
  } catch (err) {
    return err instanceof Error && 'code' in err && err.code === 'ENOENT' ? { kind: 'none' } : { kind: 'broken' };
  }
  try {
    const parsed = LockFileSchema.safeParse(JSON.parse(text));
    return parsed.success ? { kind: 'ok', file: parsed.data } : { kind: 'broken' };
  } catch {
    return { kind: 'broken' };
  }
}

// Callers (LockService) serialize every write through one chain — this function is not safe to call
// concurrently for the same dir, and does not protect against that itself.
export async function writeLock(dir: string, file: LockFile): Promise<void> {
  const target = path.join(dir, LOCK_FILE);
  const tmp = `${target}.tmp`;
  const text = JSON.stringify(LockFileSchema.parse(file));
  try {
    const handle = await fs.promises.open(tmp, 'w', 0o600);
    try {
      await handle.writeFile(text);
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (err) {
    await fs.promises.rm(tmp, { force: true });
    throw err;
  }
  await fs.promises.rename(tmp, target);
}

export async function removeLock(dir: string): Promise<void> {
  await fs.promises.rm(path.join(dir, LOCK_FILE), { force: true });
}
