// A failed open closes its client: otherwise the file stays open, and on Windows locked for a later delete.
import { describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ execute: vi.fn(), close: vi.fn() }));
vi.mock('@libsql/client', () => ({ createClient: () => client }));

const { openLibsql } = await import('../src/index.ts');

describe('openLibsql when the first statement fails', () => {
  it('closes the client and rethrows', async () => {
    client.execute.mockRejectedValueOnce(new Error('SQLITE_NOTADB'));
    await expect(openLibsql(':memory:', { encryptionKey: 'k' })).rejects.toThrow('SQLITE_NOTADB');
    expect(client.close).toHaveBeenCalledTimes(1);
  });

  it('a successful open does not close it', async () => {
    client.execute.mockResolvedValue({ rows: [], rowsAffected: 0 });
    client.close.mockClear();
    await openLibsql(':memory:');
    expect(client.close).not.toHaveBeenCalled();
  });
});
