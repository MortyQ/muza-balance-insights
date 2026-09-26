// «Люди и подключения» in main on a real database and TokenVault (fake safeStorage): what the renderer gets, and
// that a token or the bank's holder id never comes back. Fictional names only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@mono/core/db';
import { BANK_LABEL_PLACEHOLDER } from '@mono/core/participants';
import { insertAccountRow, memoryDb } from '@mono/core/test-helpers';
import { registerIpc, type IpcEventLike } from '../src/main/ipc.ts';
import { PeopleService } from '../src/main/people.ts';
import { TokenError, TokenVault, type SafeStorageLike } from '../src/main/token.ts';

const TOKEN = 'uCANARY-people-token-0123456789abc';
const TOKEN_B = 'uCANARY-people-token-B-987654321xyz';

let dir: string;
let db: Db;
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'people-'));
  db = await memoryDb();
});
afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function safeStorage(failEncrypt = false): SafeStorageLike {
  return {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (s) => {
      if (failEncrypt) throw new Error(`encrypt failed for ${s}`);
      return Buffer.from([...s].reverse().join(''));
    },
    decryptStringAsync: async (b) => ({ result: [...b.toString()].reverse().join(''), shouldReEncrypt: false }),
  };
}

function service(opts: { running?: boolean; confirm?: boolean; failEncrypt?: boolean } = {}) {
  const vault = new TokenVault({ safeStorage: safeStorage(opts.failEncrypt), platform: 'darwin', userDataDir: dir });
  const asked: string[] = [];
  const people = new PeopleService({
    db: async () => db,
    tokens: vault,
    importRunning: () => opts.running ?? false,
    confirmRemove: async () => (asked.push('confirm'), opts.confirm ?? true),
    nowSec: () => 1_000,
  });
  return { people, vault, asked };
}

const count = async (table: string) => Number((await db.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0]?.n);

describe('PeopleService', () => {
  it('adds a person with a typed name, one named by the bank, and a second connection for an existing one', async () => {
    const { people } = service();
    const a = await people.addConnection({ participant: { label: 'Вигаданий Я' }, provider: 'monobank', token: TOKEN, remember: true });
    expect(a).toMatchObject({ added: true, stored: 'secure' });
    const b = await people.addConnection({ participant: { fromBank: true }, provider: 'monobank', token: TOKEN_B, remember: false });
    if (!a.added || !b.added) throw new Error('not added');
    const c = await people.addConnection({ participant: { id: a.participantId }, provider: 'monobank', token: `${TOKEN}-2`, remember: true });
    expect(c).toMatchObject({ added: true, participantId: a.participantId });

    const view = await people.list();
    expect(view.secureStorage).toBe(true);
    expect(view.people.map((p) => [p.label, p.labelFromBank, p.connections.map((x) => [x.bank, x.token.stored])])).toEqual([
      ['Вигаданий Я', false, [['Monobank', 'secure'], ['Monobank', 'secure']]],
      [BANK_LABEL_PLACEHOLDER, true, [['Monobank', 'memory']]],
    ]);
    await db.execute(`UPDATE connections SET external_client_id = 'secret-holder-id' WHERE id = 1`);
    const text = JSON.stringify(await people.list());
    for (const secret of [TOKEN, TOKEN_B, 'CANARY', 'secret-holder-id']) expect(text).not.toContain(secret);
  });

  it('nothing is written for a malformed token, an unknown participant, or the very same token again', async () => {
    const { people } = service();
    await expect(people.addConnection({ participant: { label: 'Хтось' }, provider: 'monobank', token: 'bad token with spaces 123', remember: true })).rejects.toBeInstanceOf(TokenError);
    await expect(people.addConnection({ participant: { id: 42 }, provider: 'monobank', token: TOKEN, remember: true })).rejects.toThrow();
    expect([await count('participants'), await count('connections')]).toEqual([0, 0]);

    await people.addConnection({ participant: { label: 'Вигаданий Я' }, provider: 'monobank', token: TOKEN, remember: true });
    expect(await people.addConnection({ participant: { label: 'Друга' }, provider: 'monobank', token: TOKEN, remember: true })).toEqual({ added: false, reason: 'duplicate' });
    expect([await count('participants'), await count('connections')]).toEqual([1, 1]);
  });

  it('the token cannot be kept → the new connection and its new participant are removed again', async () => {
    const { people } = service({ failEncrypt: true });
    await expect(people.addConnection({ participant: { fromBank: true }, provider: 'monobank', token: TOKEN, remember: true })).rejects.toThrow();
    expect([await count('participants'), await count('connections')]).toEqual([0, 0]);
    expect(fs.existsSync(path.join(dir, 'tokens'))).toBe(false);
  });

  it('rename: the user\'s name, and the bank no longer changes it; a new token for a connection', async () => {
    const { people, vault } = service();
    const r = await people.addConnection({ participant: { fromBank: true }, provider: 'monobank', token: TOKEN, remember: false });
    if (!r.added) throw new Error('not added');
    await people.rename(r.participantId, 'Мама');
    expect((await people.list()).people[0]).toMatchObject({ label: 'Мама', labelFromBank: false });
    expect(await people.setToken(r.connectionId, TOKEN_B, true)).toEqual({ stored: 'secure' });
    expect(await vault.get(r.connectionId)).toBe(TOKEN_B);
    await expect(people.setToken(999, TOKEN, true)).rejects.toBeInstanceOf(TokenError);
  });

  it('remove: refused while an import runs (no dialog), cancelled in the dialog, otherwise token and data go', async () => {
    const add = async (p: PeopleService) => {
      const r = await p.addConnection({ participant: { label: 'Вигадана Вона' }, provider: 'monobank', token: TOKEN, remember: true });
      if (!r.added) throw new Error('not added');
      await insertAccountRow(db, { id: 'her-card', connection_id: r.connectionId, kind: 'card', currency_code: 980, balance: 0, updated_at: 0 });
      return r.connectionId;
    };
    const busy = service({ running: true });
    const id = await add(busy.people);
    expect(await busy.people.remove(id)).toEqual({ removed: false, reason: 'import-running' });
    expect(busy.asked).toEqual([]);

    const no = service({ confirm: false });
    expect(await no.people.remove(id)).toEqual({ removed: false, reason: 'cancelled' });
    expect(await count('accounts')).toBe(1);

    const yes = service();
    expect(await yes.people.remove(id)).toEqual({ removed: true });
    expect([await count('accounts'), await count('connections'), await count('participants')]).toEqual([0, 0, 0]);
    expect(await yes.vault.saved()).toEqual([]);
  });

  it('through IPC: no reply or error of the people methods contains a token — even when safeStorage throws with it', async () => {
    const handlers = new Map<string, (e: IpcEventLike, ...a: unknown[]) => Promise<unknown>>();
    const logs: string[] = [];
    const wire = (people: PeopleService) =>
      registerIpc(
        { handle: (ch, fn) => void handlers.set(ch, fn) },
        {
          listPeople: () => people.list(),
          addConnection: (i) => people.addConnection(i),
          setConnectionToken: (id, t, r) => people.setToken(id, t, r),
          removeConnection: (id) => people.remove(id),
        },
        { trusted: () => true, onError: (m, err) => logs.push(`[ipc] ${m}: ${err instanceof Error ? err.name : 'error'}`) },
      );
    const ev = { sender: {}, senderFrame: { url: 'app://renderer/', parent: null } };
    const outputs: unknown[] = [];
    const call = async (ch: string, ...a: unknown[]) => outputs.push(await handlers.get(ch)!(ev, ...a).catch((e: Error) => ({ error: e.message })));

    wire(service().people);
    await call('balance:addConnection', { participant: { label: 'Вигаданий Я' }, provider: 'monobank', token: TOKEN, remember: true });
    await call('balance:addConnection', { participant: { label: 'Вигаданий Я' }, provider: 'monobank', token: TOKEN, remember: true });
    await call('balance:setConnectionToken', 1, TOKEN_B, false);
    await call('balance:setConnectionToken', 99, TOKEN_B, false);
    await call('balance:listPeople');
    wire(service({ failEncrypt: true }).people);
    await call('balance:addConnection', { participant: { fromBank: true }, provider: 'monobank', token: `${TOKEN}-x`, remember: true });
    await call('balance:removeConnection', 1);

    const text = JSON.stringify(outputs) + logs.join('\n');
    expect(text).not.toContain('CANARY');
    expect(outputs).toContainEqual({ added: false, reason: 'duplicate' });
    expect(outputs).toContainEqual({ removed: true });
    expect(logs).toEqual(['[ipc] setConnectionToken: TokenError', '[ipc] addConnection: Error']);
  });
});
