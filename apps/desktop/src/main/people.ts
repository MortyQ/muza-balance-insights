// «Люди» in main: the people and their connections from the data process, with each token's status (TokenVault).
// Replies carry a participant's label and numbers only — never a token or the bank's holder id.
// Adding, re-keying and removing connections is IntegrationsService's (integrations.ts).
import { DESKTOP_PROVIDERS } from '../net/providers.ts';
import type { ColorChangeResult, ColorKey, PeopleView, TokenStatus } from '../shared/api.ts';
import type { DataApi } from './data-api.ts';

export type PeopleDeps = {
  data: Pick<DataApi, 'people' | 'renameParticipant' | 'restoreBankName' | 'setParticipantColor'>;
  tokens: {
    status(connectionId: number): Promise<TokenStatus>;
    secureStorageAvailable(): Promise<boolean>;
  };
};

export class PeopleService {
  constructor(private readonly d: PeopleDeps) {}

  async list(): Promise<PeopleView> {
    const people = [];
    for (const p of await this.d.data.people()) {
      const connections = [];
      for (const c of p.connections) {
        connections.push({ ...c, bank: DESKTOP_PROVIDERS[c.provider].bank, token: c.method === 'token' ? await this.d.tokens.status(c.id) : null });
      }
      people.push({ ...p, connections });
    }
    return { people, secureStorage: await this.d.tokens.secureStorageAvailable() };
  }

  rename(id: number, label: string): Promise<void> {
    return this.d.data.renameParticipant(id, label);
  }

  restoreBankName(id: number): Promise<void> {
    return this.d.data.restoreBankName(id);
  }

  /** A taken colour is an answer, not an error. */
  setParticipantColor(id: number, color: ColorKey): Promise<ColorChangeResult> {
    return this.d.data.setParticipantColor(id, color);
  }
}
