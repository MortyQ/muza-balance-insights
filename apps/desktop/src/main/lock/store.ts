// userData/lock.json: the PIN hash, the switches and the wrong-PIN counter (a restart does not reset it).
// Missing = the lock is off. Unreadable or not matching the schema = broken: the app stays locked.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const LOCK_FILE = 'lock.json';

const base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/);
const LockFileSchema = z.strictObject({
  version: z.literal(1),
  kdf: z.strictObject({
    name: z.literal('scrypt'),
    N: z.number().int().min(16384).max(1_048_576),
    r: z.number().int().min(1).max(32),
    p: z.number().int().min(1).max(16),
    salt: base64,
  }),
  hash: base64,
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

export async function writeLock(dir: string, file: LockFile): Promise<void> {
  const target = path.join(dir, LOCK_FILE);
  await fs.promises.writeFile(`${target}.tmp`, JSON.stringify(LockFileSchema.parse(file)), { mode: 0o600 });
  await fs.promises.rename(`${target}.tmp`, target);
}

export async function removeLock(dir: string): Promise<void> {
  await fs.promises.rm(path.join(dir, LOCK_FILE), { force: true });
}
