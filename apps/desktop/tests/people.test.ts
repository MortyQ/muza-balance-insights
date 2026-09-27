// «Люди» in main on a real database and TokenVault (fake safeStorage): names, the bank's name and colours of people
// (connections are added through IntegrationsService — tests/integrations.test.ts). Fictional names only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@mono/core/db';
import { memoryDb } from '@mono/core/test-helpers';
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

describe('PeopleService', () => {
  it('rename: the user\'s name, and the bank no longer changes it; a new token for a connection', async () => {
    const { people, integrations, vault } = service();
    const r = await integrations.addConnection({ participant: { fromBank: true }, provider: 'monobank', token: TOKEN, remember: false });
    if (!r.added) throw new Error('not added');
    await people.rename(r.participantId, 'Мама');
    expect((await people.list()).people[0]).toMatchObject({ label: 'Мама', labelFromBank: false });
    expect(await integrations.setToken(r.connectionId, TOKEN_B, true)).toEqual({ stored: 'secure' });
    expect(await vault.get(r.connectionId)).toBe(TOKEN_B);
    await expect(integrations.setToken(999, TOKEN, true)).rejects.toBeInstanceOf(TokenError);
  });

  it('colours: the first free by default, or the one chosen; changing to a taken one → taken, nothing changes', async () => {
    const { people, integrations } = service();
    const a = await integrations.addConnection({ participant: { label: 'Вигаданий Я' }, provider: 'monobank', token: TOKEN, remember: true });
    const b = await integrations.addConnection({ participant: { fromBank: true, color: 'violet' }, provider: 'monobank', token: TOKEN_B, remember: true, color: 'red' });
    if (!a.added || !b.added) throw new Error('not added');
    let view = await people.list();
    expect(view.people.map((p) => [p.color, p.connections.map((c) => c.color)])).toEqual([['blue', ['blue']], ['violet', ['red']]]);

    expect(await people.setParticipantColor(a.participantId, 'violet')).toEqual({ changed: false, reason: 'taken' });
    expect(await integrations.setConnectionColor(a.connectionId, 'red')).toEqual({ changed: false, reason: 'taken' });
    expect(await people.setParticipantColor(a.participantId, 'green')).toEqual({ changed: true });
    expect(await integrations.setConnectionColor(a.connectionId, 'aqua')).toEqual({ changed: true });
    view = await people.list();
    expect(view.people.map((p) => [p.color, p.connections.map((c) => c.color)])).toEqual([['green', ['aqua']], ['violet', ['red']]]);
    await expect(people.setParticipantColor(999, 'yellow')).rejects.toThrow();
  });

  it('«взять имя из банка» after a rename: the bank names the person again', async () => {
    const { people, integrations } = service();
    const r = await integrations.addConnection({ participant: { label: 'Своя' }, provider: 'monobank', token: TOKEN, remember: true });
    if (!r.added) throw new Error('not added');
    await db.execute({ sql: 'UPDATE connections SET holder_name = ? WHERE id = ?', args: ['Вигадана Банківська', r.connectionId] });
    await people.restoreBankName(r.participantId);
    expect((await people.list()).people[0]).toMatchObject({ label: 'Вигадана Банківська', labelFromBank: true });
  });
});
