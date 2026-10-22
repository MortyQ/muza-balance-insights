// «Подключения» in main: a participant's bank connections (in the data process) together with their tokens
// (TokenVault) — add, a new token, its accounts on / off, remove. Replies carry numbers only — never a token or the bank's holder id.
// The list of people with their connections is PeopleService's (people.ts); this service does not use it.
import type { ProviderId } from '@mono/core/providers/types';
import { credentialFits, infoOf } from '@mono/core/providers/info';
import type {
  AddConnectionInput,
  AddConnectionResult,
  ConnectionAccountView,
  RemoveConnectionResult,
  SetAccountEnabledResult,
} from '../shared/api.ts';
import type { DataApi } from './data-api.ts';
import { TokenError } from './token.ts';

export type IntegrationsDeps = {
  data: Pick<DataApi, 'connections' | 'createConnection' | 'deleteConnection' | 'connectionAccounts' | 'setAccountEnabled'>;
  tokens: {
    set(connectionId: number, provider: ProviderId, token: string, remember: boolean): Promise<{ stored: 'secure' | 'memory' }>;
    get(connectionId: number): Promise<string | null>;
    clear(connectionId: number): Promise<void>;
  };
  importRunning: () => boolean;
  /** System dialog before a connection and its data are deleted; true = confirmed. */
  confirmRemove: () => Promise<boolean>;
};

export class IntegrationsService {
  constructor(private readonly d: IntegrationsDeps) {}

  /**
   * The token's shape is checked before anything is written; the very same token as an existing connection is refused.
   * If keeping the token fails, the new connection (and a participant created for it) is removed again. A file
   * connection has no token: it is only the connection, filled by statement uploads (statements.ts).
   */
  async addConnection(input: AddConnectionInput): Promise<AddConnectionResult> {
    const data = this.d.data;
    if (input.method === 'file') {
      const { connectionId, participantId } = await data.createConnection(input.participant, input.provider, 'file');
      return { added: true, connectionId, participantId, stored: null };
    }
    if (!credentialFits(input.provider, input.token)) throw new TokenError(`Not a ${infoOf(input.provider).name} token`);
    for (const c of await data.connections()) {
      if (c.provider === input.provider && (await this.d.tokens.get(c.id)) === input.token) return { added: false, reason: 'duplicate' };
    }
    const { connectionId, participantId } = await data.createConnection(input.participant, input.provider, 'token');
    try {
      const { stored } = await this.d.tokens.set(connectionId, input.provider, input.token, input.remember);
      return { added: true, connectionId, participantId, stored };
    } catch (err) {
      await this.d.tokens.clear(connectionId);
      await data.deleteConnection(connectionId);
      throw err;
    }
  }

  async setToken(connectionId: number, token: string, remember: boolean): Promise<{ stored: 'secure' | 'memory' }> {
    const c = (await this.d.data.connections()).find((x) => x.id === connectionId);
    if (!c) throw new TokenError('No such connection');
    if (c.method !== 'token') throw new TokenError('A file connection has no token');
    return this.d.tokens.set(connectionId, c.provider, token, remember);
  }

  /** Field by field (in the data process): nothing of an account beyond the label parts reaches the renderer. */
  listConnectionAccounts(connectionId: number): Promise<ConnectionAccountView[]> {
    return this.d.data.connectionAccounts(connectionId);
  }

  /** Refused while an import runs (its plan was made from the old choice). Unknown account → an error. */
  async setAccountEnabled(accountId: string, enabled: boolean): Promise<SetAccountEnabledResult> {
    if (this.d.importRunning()) return { changed: false, reason: 'import-running' };
    await this.d.data.setAccountEnabled(accountId, enabled);
    return { changed: true };
  }

  /** Refused while an import runs (it writes these accounts). The token goes first, then the data. */
  async remove(connectionId: number): Promise<RemoveConnectionResult> {
    if (this.d.importRunning()) return { removed: false, reason: 'import-running' };
    if (!(await this.d.confirmRemove())) return { removed: false, reason: 'cancelled' };
    if (this.d.importRunning()) return { removed: false, reason: 'import-running' };
    await this.d.tokens.clear(connectionId);
    await this.d.data.deleteConnection(connectionId);
    return { removed: true };
  }
}
