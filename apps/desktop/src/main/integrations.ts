// «Подключения» in main: a participant's bank connections (core participants.ts) together with their tokens
// (TokenVault) — add, a new token, colour, remove. Replies carry numbers only — never a token or the bank's holder id.
// The list of people with their connections is PeopleService's (people.ts); this service does not use it.
import type { Db } from '@mono/core/db';
import { addConnection, addParticipant, deleteConnection, listConnections, setConnectionColor } from '@mono/core/participants';
import type { ProviderId } from '@mono/core/providers/types';
import { DESKTOP_PROVIDERS } from '../net/providers.ts';
import type { AddConnectionInput, AddConnectionResult, ColorChangeResult, ColorKey, ProviderKey, RemoveConnectionResult } from '../shared/api.ts';
import { colorChange } from './people.ts';
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
      connectionId = await addConnection(db, participantId, input.provider, now, input.color);
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

  setConnectionColor(connectionId: number, color: ColorKey): Promise<ColorChangeResult> {
    return colorChange(async () => setConnectionColor(await this.d.db(), connectionId, color));
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
