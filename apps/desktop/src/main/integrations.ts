// «Подключения» in main: a participant's bank connections (core participants.ts) together with their tokens
// (TokenVault) — add, a new token, its accounts on / off, remove. Replies carry numbers only — never a token or the bank's holder id.
// The list of people with their connections is PeopleService's (people.ts); this service does not use it.
import { listConnectionAccounts, setAccountEnabled } from '@mono/core/accounts';
import { ConnectionError, type ConnectionMethod } from '@mono/core/connections';
import type { Db } from '@mono/core/db';
import { addConnection, addParticipant, deleteConnection, listConnections } from '@mono/core/participants';
import type { ProviderId } from '@mono/core/providers/types';
import { DESKTOP_PROVIDERS } from '../net/providers.ts';
import type {
  AddConnectionInput,
  AddConnectionResult,
  ConnectionAccountView,
  ParticipantChoice,
  ProviderKey,
  RemoveConnectionResult,
  SetAccountEnabledResult,
} from '../shared/api.ts';
import { TokenError } from './token.ts';

// The renderer's provider key is exactly the core's provider id.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const PROVIDER_KEYS_MATCH: Same<ProviderKey, ProviderId> = true;
void PROVIDER_KEYS_MATCH;

export type IntegrationsDeps = {
  db: () => Promise<Db>;
  tokens: {
    set(connectionId: number, provider: ProviderId, token: string, remember: boolean): Promise<{ stored: 'secure' | 'memory' }>;
    get(connectionId: number): Promise<string | null>;
    clear(connectionId: number): Promise<void>;
  };
  importRunning: () => boolean;
  /** System dialog before a connection and its data are deleted; true = confirmed. */
  confirmRemove: () => Promise<boolean>;
  nowSec: () => number;
};

export class IntegrationsService {
  constructor(private readonly d: IntegrationsDeps) {}

  /**
   * The token's shape is checked before anything is written; the very same token as an existing connection is refused.
   * If keeping the token fails, the new connection (and a participant created for it) is removed again. A file
   * connection has no token: it is only the connection, filled by statement uploads (statements.ts).
   */
  async addConnection(input: AddConnectionInput): Promise<AddConnectionResult> {
    const db = await this.d.db();
    if (input.method === 'file') {
      const { connectionId, participantId } = await this.create(db, input.participant, input.provider, 'file');
      return { added: true, connectionId, participantId, stored: null };
    }
    const { bank, credential } = DESKTOP_PROVIDERS[input.provider];
    if (!credential.test(input.token)) throw new TokenError(`Not a ${bank} token`);
    for (const c of await listConnections(db)) {
      if (c.provider === input.provider && (await this.d.tokens.get(c.id)) === input.token) return { added: false, reason: 'duplicate' };
    }
    const { connectionId, participantId } = await this.create(db, input.participant, input.provider, 'token');
    try {
      const { stored } = await this.d.tokens.set(connectionId, input.provider, input.token, input.remember);
      return { added: true, connectionId, participantId, stored };
    } catch (err) {
      await this.d.tokens.clear(connectionId);
      await deleteConnection(db, connectionId);
      throw err;
    }
  }

  /** The participant (new or chosen) and the connection; a participant created here goes again if the connection fails. */
  private async create(db: Db, participant: ParticipantChoice, provider: ProviderId, method: ConnectionMethod): Promise<{ connectionId: number; participantId: number }> {
    const now = this.d.nowSec();
    const participantId = 'id' in participant ? participant.id : await addParticipant(db, participant, now);
    try {
      return { connectionId: await addConnection(db, participantId, provider, now, method), participantId };
    } catch (err) {
      if (!('id' in participant)) await db.execute({ sql: 'DELETE FROM participants WHERE id = ?', args: [participantId] });
      throw err;
    }
  }

  async setToken(connectionId: number, token: string, remember: boolean): Promise<{ stored: 'secure' | 'memory' }> {
    const c = (await listConnections(await this.d.db())).find((x) => x.id === connectionId);
    if (!c) throw new TokenError('No such connection');
    if (c.method !== 'token') throw new TokenError('A file connection has no token');
    return this.d.tokens.set(connectionId, c.provider, token, remember);
  }

  /** Field by field: nothing of an account beyond the label parts reaches the renderer. */
  async listConnectionAccounts(connectionId: number): Promise<ConnectionAccountView[]> {
    const db = await this.d.db();
    if (!(await listConnections(db)).some((c) => c.id === connectionId)) throw new ConnectionError('No such connection');
    return (await listConnectionAccounts(db, connectionId)).map((a) => ({
      id: a.id,
      kind: a.kind,
      type: a.type,
      currencyCode: a.currencyCode,
      maskedPanTail: a.maskedPanTail,
      jarTitle: a.jarTitle,
      enabled: a.enabled,
      auto: a.auto,
    }));
  }

  /** Refused while an import runs (its plan was made from the old choice). Unknown account → ConnectionError. */
  async setAccountEnabled(accountId: string, enabled: boolean): Promise<SetAccountEnabledResult> {
    if (this.d.importRunning()) return { changed: false, reason: 'import-running' };
    await setAccountEnabled(await this.d.db(), accountId, enabled);
    return { changed: true };
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
