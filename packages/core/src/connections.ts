// Participants (who) and connections (a bank + a credential). An account belongs to exactly one connection; the
// connection says which provider's rules and client apply to it.
import { firstFreeColor } from './colors.ts';
import type { Db } from './db.ts';
import { PROVIDER_IDS, type ProviderId } from './providers/types.ts';

/** How a connection gets its data: the bank's API with a credential, or statement files the user uploads. */
export const CONNECTION_METHODS = ['token', 'file'] as const;
export type ConnectionMethod = (typeof CONNECTION_METHODS)[number];

export const DEFAULT_PARTICIPANT_LABEL = 'Я';
/** Longest participant label, typed or from the bank. */
export const PARTICIPANT_LABEL_MAX = 80;

export class ConnectionError extends Error {
  override name = 'ConnectionError';
}

export function parseProviderId(value: unknown): ProviderId {
  const v = String(value);
  if ((PROVIDER_IDS as readonly string[]).includes(v)) return v as ProviderId;
  throw new ConnectionError(`Неизвестный провайдер в базе: «${v.slice(0, 40)}»`);
}

export function parseConnectionMethod(value: unknown): ConnectionMethod {
  const v = String(value);
  if ((CONNECTION_METHODS as readonly string[]).includes(v)) return v as ConnectionMethod;
  throw new ConnectionError(`Неизвестный способ подключения: «${v.slice(0, 40)}»`);
}

/**
 * The token connection of `provider` while there is only one per provider (apps/mcp with its .env token, the desktop
 * app until several connections are supported): the existing one, or a new one for the first participant (created as
 * «Я» if there is none). Two token connections of the provider → an error: the caller must pick one. File connections
 * are never picked: a token must not land on one.
 */
export async function ensureDefaultConnection(db: Db, provider: ProviderId, nowSec: number): Promise<number> {
  const existing = await db.execute({
    sql: `SELECT id FROM connections WHERE provider = ? AND method = 'token' ORDER BY id`,
    args: [provider],
  });
  if (existing.rows.length > 1) throw new ConnectionError(`Подключений ${provider} несколько — нужно выбрать одно`);
  if (existing.rows[0]) return Number(existing.rows[0].id);

  const first = await db.execute('SELECT id FROM participants ORDER BY sort, id LIMIT 1');
  let participantId = first.rows[0] ? Number(first.rows[0].id) : null;
  if (participantId === null) {
    const p = await db.execute({
      sql: 'INSERT INTO participants (label, color, sort, created_at) VALUES (?, ?, 0, ?) RETURNING id',
      args: [DEFAULT_PARTICIPANT_LABEL, await firstFreeColor(db, 'participants'), nowSec],
    });
    participantId = Number(p.rows[0]?.id);
  }
  const c = await db.execute({
    // No colour: only people have one.
    sql: 'INSERT INTO connections (participant_id, provider, created_at) VALUES (?, ?, ?) RETURNING id',
    args: [participantId, provider, nowSec],
  });
  return Number(c.rows[0]?.id);
}

/** Provider of every account, by account id (the rules of its connection). */
export async function accountProviders(db: Db): Promise<ReadonlyMap<string, ProviderId>> {
  const rs = await db.execute('SELECT a.id, c.provider FROM accounts a JOIN connections c ON c.id = a.connection_id');
  return new Map(rs.rows.map((r) => [String(r.id), parseProviderId(r.provider)]));
}

/** The provider of one account from accountProviders(); an account without one is a broken database, not a default. */
export function providerOf(providers: ReadonlyMap<string, ProviderId>, accountId: string): ProviderId {
  const p = providers.get(accountId);
  if (p === undefined) throw new ConnectionError(`Счёт ${accountId} без подключения`);
  return p;
}
