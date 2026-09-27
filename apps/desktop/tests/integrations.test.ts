// «Подключения» in main on a real database and TokenVault (fake safeStorage): adding, the token, removing — what the
// renderer gets, and that a token or the bank's holder id never comes back. Fictional names only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@mono/core/db';
import { BANK_LABEL_PLACEHOLDER } from '@mono/core/participants';
import { insertAccountRow, memoryDb } from '@mono/core/test-helpers';
import type { IntegrationsService } from '../src/main/integrations.ts';
import { registerIpc, type IpcEventLike } from '../src/main/ipc.ts';
import { TokenError } from '../src/main/token.ts';
import { TOKEN, TOKEN_B, services } from './helpers/people.ts';

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

const service = (opts: Parameters<typeof services>[2] = {}) => services(db, dir, opts);

const count = async (table: string) => Number((await db.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0]?.n);

describe('IntegrationsService', () => {
  it('adds a person with a typed name, one named by the bank, and a second connection for an existing one', async () => {
    const { people, integrations } = service();
    const a = await integrations.addConnection({ participant: { label: 'Вигаданий Я' }, provider: 'monobank', token: TOKEN, remember: true });
    expect(a).toMatchObject({ added: true, stored: 'secure' });
    const b = await integrations.addConnection({ participant: { fromBank: true }, provider: 'monobank', token: TOKEN_B, remember: false });
    if (!a.added || !b.added) throw new Error('not added');
    const c = await integrations.addConnection({ participant: { id: a.participantId }, provider: 'monobank', token: `${TOKEN}-2`, remember: true });
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
    const { integrations } = service();
    await expect(integrations.addConnection({ participant: { label: 'Хтось' }, provider: 'monobank', token: 'bad token with spaces 123', remember: true })).rejects.toBeInstanceOf(TokenError);
    await expect(integrations.addConnection({ participant: { id: 42 }, provider: 'monobank', token: TOKEN, remember: true })).rejects.toThrow();
    expect([await count('participants'), await count('connections')]).toEqual([0, 0]);

    await integrations.addConnection({ participant: { label: 'Вигаданий Я' }, provider: 'monobank', token: TOKEN, remember: true });
    expect(await integrations.addConnection({ participant: { label: 'Друга' }, provider: 'monobank', token: TOKEN, remember: true })).toEqual({ added: false, reason: 'duplicate' });
    expect([await count('participants'), await count('connections')]).toEqual([1, 1]);
  });

  it('the token cannot be kept → the new connection and its new participant are removed again', async () => {
    const { integrations } = service({ failEncrypt: true });
    await expect(integrations.addConnection({ participant: { fromBank: true }, provider: 'monobank', token: TOKEN, remember: true })).rejects.toThrow();
    expect([await count('participants'), await count('connections')]).toEqual([0, 0]);
    expect(fs.existsSync(path.join(dir, 'tokens'))).toBe(false);
  });

  it('remove: refused while an import runs (no dialog), cancelled in the dialog, otherwise token and data go', async () => {
    const add = async (p: IntegrationsService) => {
      const r = await p.addConnection({ participant: { label: 'Вигадана Вона' }, provider: 'monobank', token: TOKEN, remember: true });
      if (!r.added) throw new Error('not added');
      await insertAccountRow(db, { id: 'her-card', connection_id: r.connectionId, kind: 'card', currency_code: 980, balance: 0, updated_at: 0 });
      return r.connectionId;
    };
    const busy = service({ running: true });
    const id = await add(busy.integrations);
    expect(await busy.integrations.remove(id)).toEqual({ removed: false, reason: 'import-running' });
    expect(busy.asked).toEqual([]);

    const no = service({ confirm: false });
    expect(await no.integrations.remove(id)).toEqual({ removed: false, reason: 'cancelled' });
    expect(await count('accounts')).toBe(1);

    const yes = service();
    expect(await yes.integrations.remove(id)).toEqual({ removed: true });
    expect([await count('accounts'), await count('connections'), await count('participants')]).toEqual([0, 0, 0]);
    expect(await yes.vault.saved()).toEqual([]);
  });

  it('through IPC: no reply or error of the people methods contains a token — even when safeStorage throws with it', async () => {
    const handlers = new Map<string, (e: IpcEventLike, ...a: unknown[]) => Promise<unknown>>();
    const logs: string[] = [];
    const wire = ({ people, integrations }: ReturnType<typeof service>) =>
      registerIpc(
        { handle: (ch, fn) => void handlers.set(ch, fn) },
        {
          listPeople: () => people.list(),
          addConnection: (i) => integrations.addConnection(i),
          setConnectionToken: (id, t, r) => integrations.setToken(id, t, r),
          removeConnection: (id) => integrations.remove(id),
        },
        { trusted: () => true, dbReady: () => true, locked: () => false, onError: (m, err) => logs.push(`[ipc] ${m}: ${err instanceof Error ? err.name : 'error'}`) },
      );
    const ev = { sender: {}, senderFrame: { url: 'app://renderer/', parent: null } };
    const outputs: unknown[] = [];
    const call = async (ch: string, ...a: unknown[]) => outputs.push(await handlers.get(ch)!(ev, ...a).catch((e: Error) => ({ error: e.message })));

    wire(service());
    await call('balance:addConnection', { participant: { label: 'Вигаданий Я' }, provider: 'monobank', token: TOKEN, remember: true });
    await call('balance:addConnection', { participant: { label: 'Вигаданий Я' }, provider: 'monobank', token: TOKEN, remember: true });
    await call('balance:setConnectionToken', 1, TOKEN_B, false);
    await call('balance:setConnectionToken', 99, TOKEN_B, false);
    await call('balance:listPeople');
    wire(service({ failEncrypt: true }));
    await call('balance:addConnection', { participant: { fromBank: true }, provider: 'monobank', token: `${TOKEN}-x`, remember: true });
    await call('balance:removeConnection', 1);

    const text = JSON.stringify(outputs) + logs.join('\n');
    expect(text).not.toContain('CANARY');
    expect(outputs).toContainEqual({ added: false, reason: 'duplicate' });
    expect(outputs).toContainEqual({ removed: true });
    expect(logs).toEqual(['[ipc] setConnectionToken: TokenError', '[ipc] addConnection: Error']);
  });
});
