// Opening the database with its key, as main (src/main/db/) and the data process (src/data/process.ts) both need it.

/** The database key as main keeps it (src/main/db/key-vault.ts): 32 random bytes in lowercase hex. */
export const DB_KEY_RE = /^[0-9a-f]{64}$/;

const NOT_A_DB = /SQLITE_NOTADB|file is not a database/i;

/** The key does not open the file (a wrong key, a key for a plain file, or no key for an encrypted one). */
export const notADatabase = (err: unknown): boolean =>
  err instanceof Error && (NOT_A_DB.test(err.message) || (err as { code?: unknown }).code === 'SQLITE_NOTADB');
