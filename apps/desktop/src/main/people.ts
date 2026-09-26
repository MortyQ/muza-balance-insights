// «Люди и подключения» in main: participants and connections (core participants.ts) together with their tokens
// (TokenVault). Replies carry a participant's label and numbers only — never a token or the bank's holder id.
import type { Db } from '@mono/core/db';
import {
  addConnection,
  addParticipant,
  deleteConnection,
  listConnections,
  listParticipants,
  renameParticipant,
} from '@mono/core/participants';
import type { ProviderId } from '@mono/core/providers/types';
import { DESKTOP_PROVIDERS } from '../net/providers.ts';
import type {
  AddConnectionInput,
  AddConnectionResult,
  PeopleView,
  ProviderKey,
  RemoveConnectionResult,
  TokenStatus,
} from '../shared/api.ts';
import { TokenError } from './token.ts';

// The renderer's provider key is exactly the core's provider id.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const PROVIDER_KEYS_MATCH: Same<ProviderKey, ProviderId> = true;
void PROVIDER_KEYS_MATCH;

export type PeopleDeps = {
  db: () => Promise<Db>;
  tokens: {
    status(connectionId: number): Promise<TokenStatus>;
    set(connectionId: number, provider: ProviderId, token: string, remember: boolean): Promise<{ stored: 'secure' | 'memory' }>;
    get(connectionId: number): Promise<string | null>;
    clear(connectionId: number): Promise<void>;
    secureStorageAvailable(): Promise<boolean>;
  };
  importRunning: () => boolean;
  /** System dialog before a connection and its data are deleted; true = confirmed. */
  confirmRemove: () => Promise<boolean>;
  nowSec: () => number;
};

export class PeopleService {
  constructor(private readonly d: PeopleDeps) {}

  async list(): Promise<PeopleView> {
    const db = await this.d.db();
    const [participants, connections] = [await listParticipants(db), await listConnections(db)];
    const people = [];
    for (const p of participants) {
      const own = [];
      for (const c of connections.filter((x) => x.participantId === p.id)) {
        own.push({
          id: c.id,
          provider: c.provider,
          bank: DESKTOP_PROVIDERS[c.provider].bank,
          accounts: c.accounts,
          coveredFrom: c.coveredFrom,
          coveredTo: c.coveredTo,
          lastSyncAt: c.lastSyncAt,
          token: await this.d.tokens.status(c.id),
        });
      }
      people.push({ id: p.id, label: p.label, labelFromBank: p.labelSource === 'bank', connections: own });
    }
    return { people, secureStorage: await this.d.tokens.secureStorageAvailable() };
  }

  /**
   * The token's shape is checked before anything is written; the very same token as an existing connection is refused.
   * If keeping the token fails, the new connection (and a participant created for it) is removed again.
   */
  async addConnection(input: AddConnectionInput): Promise<AddConnectionResult> {
    const { bank, credential } = DESKTOP_PROVIDERS[input.provider];
    if (!credential.test(input.token)) throw new TokenError(`Токен не похож на токен ${bank}`);
    const db = await this.d.db();
    for (const c of await listConnections(db)) {
      if (c.provider === input.provider && (await this.d.tokens.get(c.id)) === input.token) return { added: false, reason: 'duplicate' };
    }
    const now = this.d.nowSec();
    const participantId = 'id' in input.participant ? input.participant.id : await addParticipant(db, input.participant, now);
    let connectionId: number;
    try {
      connectionId = await addConnection(db, participantId, input.provider, now);
    } catch (err) {
      if (!('id' in input.participant)) await db.execute({ sql: 'DELETE FROM participants WHERE id = ?', args: [participantId] });
      throw err;
    }
    try {
      const { stored } = await this.d.tokens.set(connectionId, input.provider, input.token, input.remember);
      return { added: true, connectionId, participantId, stored };
    } catch (err) {
      await this.d.tokens.clear(connectionId);
      await deleteConnection(db, connectionId);
      throw err;
    }
  }

  async rename(id: number, label: string): Promise<void> {
    await renameParticipant(await this.d.db(), id, label);
  }

  async setToken(connectionId: number, token: string, remember: boolean): Promise<{ stored: 'secure' | 'memory' }> {
    const c = (await listConnections(await this.d.db())).find((x) => x.id === connectionId);
    if (!c) throw new TokenError('Такого подключения нет');
    return this.d.tokens.set(connectionId, c.provider, token, remember);
  }

  /** Refused while an import runs (it writes these accounts). The token goes first, then the data. */
  async remove(connectionId: number): Promise<RemoveConnectionResult> {
    if (this.d.importRunning()) return { removed: false, reason: 'import-running' };
    if (!(await this.d.confirmRemove())) return { removed: false, reason: 'cancelled' };
    if (this.d.importRunning()) return { removed: false, reason: 'import-running' };
    await this.d.tokens.clear(connectionId);
    await deleteConnection(await this.d.db(), connectionId);
    return { removed: true };
  }
}
