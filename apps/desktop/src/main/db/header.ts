// What the database file on disk is, by its first 16 bytes only — never opened here.
import fs from 'node:fs';

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'latin1');

/** `missing`: no file or 0 bytes (SQLite treats an empty file as an empty database). `other`: encrypted, or garbage. */
export type DbFileKind = 'missing' | 'plain' | 'other';

export async function dbFileKind(file: string): Promise<DbFileKind> {
  let handle: fs.promises.FileHandle;
  try {
    handle = await fs.promises.open(file, 'r');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw err;
  }
  try {
    const head = Buffer.alloc(16);
    const { bytesRead } = await handle.read(head, 0, 16, 0);
    if (bytesRead === 0) return 'missing';
    return bytesRead === 16 && head.equals(SQLITE_HEADER) ? 'plain' : 'other';
  } finally {
    await handle.close();
  }
}
