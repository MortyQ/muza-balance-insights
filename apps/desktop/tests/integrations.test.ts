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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'integrations-'));
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

  it('a new token for a connection; an unknown connection is refused', async () => {
    const { integrations, vault } = service();
    const r = await integrations.addConnection({ participant: { fromBank: true }, provider: 'monobank', token: TOKEN, remember: false });
    if (!r.added) throw new Error('not added');
    expect(await integrations.setToken(r.connectionId, TOKEN_B, true)).toEqual({ stored: 'secure' });
    expect(await vault.get(r.connectionId)).toBe(TOKEN_B);
    await expect(integrations.setToken(999, TOKEN, true)).rejects.toBeInstanceOf(TokenError);
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

  it('accounts of a connection: cards first, the label parts only — never the IBAN or the full card number', async () => {
    const { integrations } = service();
    const r = await integrations.addConnection({ participant: { label: 'Вигаданий Я' }, provider: 'monobank', token: TOKEN, remember: true });
    if (!r.added) throw new Error('not added');
    await insertAccountRow(db, { id: 'jar-1', connection_id: r.connectionId, kind: 'jar', currency_code: 980, balance: 0, title: 'CANARY-JAR Мрія', iban: 'UA00CANARY0001', updated_at: 0 });
    await insertAccountRow(db, {
      id: 'card-1', connection_id: r.connectionId, kind: 'card', type: 'black', currency_code: 980, balance: 0,
      iban: 'UA00CANARY0000', masked_pan: JSON.stringify(['444411******1234']), updated_at: 0,
    });
    const list = await integrations.listConnectionAccounts(r.connectionId);
    expect(list).toEqual([
      { id: 'card-1', kind: 'card', type: 'black', currencyCode: 980, maskedPanTail: '1234', jarTitle: null, enabled: true, auto: true },
      { id: 'jar-1', kind: 'jar', type: null, currencyCode: 980, maskedPanTail: null, jarTitle: 'CANARY-JAR Мрія', enabled: false, auto: true },
    ]);
    const text = JSON.stringify(list);
    for (const secret of ['UA00CANARY', '444411', TOKEN]) expect(text).not.toContain(secret);
    await expect(integrations.listConnectionAccounts(999)).rejects.toThrow();
  });

  it('switching an account: saved and read back; refused while an import runs; an unknown account is an error', async () => {
    const { integrations } = service();
    const r = await integrations.addConnection({ participant: { label: 'Вигаданий Я' }, provider: 'monobank', token: TOKEN, remember: true });
    if (!r.added) throw new Error('not added');
    await insertAccountRow(db, { id: 'card-1', connection_id: r.connectionId, kind: 'card', currency_code: 980, balance: 0, updated_at: 0 });

    expect(await integrations.setAccountEnabled('card-1', false)).toEqual({ changed: true });
    expect(await integrations.listConnectionAccounts(r.connectionId)).toMatchObject([{ id: 'card-1', enabled: false, auto: false }]);
    expect(await integrations.setAccountEnabled('card-1', true)).toEqual({ changed: true });
    expect(await integrations.listConnectionAccounts(r.connectionId)).toMatchObject([{ id: 'card-1', enabled: true, auto: false }]);

    const busy = service({ running: true });
    expect(await busy.integrations.setAccountEnabled('card-1', false)).toEqual({ changed: false, reason: 'import-running' });
    expect(await integrations.listConnectionAccounts(r.connectionId)).toMatchObject([{ id: 'card-1', enabled: true }]);

    await expect(integrations.setAccountEnabled('no-such', false)).rejects.toThrow();
  });

  it('through IPC: no reply or error of the people and connection methods contains a token — even when safeStorage throws with it', async () => {
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
