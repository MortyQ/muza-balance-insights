// «Люди» in main: participants (core participants.ts) and, for the list, their connections with each token's status
// (TokenVault). Replies carry a participant's label and numbers only — never a token or the bank's holder id.
// Adding, re-keying and removing connections is IntegrationsService's (integrations.ts).
import { ColorTakenError, type ColorKey as CoreColorKey } from '@mono/core/colors';
import type { Db } from '@mono/core/db';
import { listConnections, listParticipants, renameParticipant, restoreBankLabel, setParticipantColor } from '@mono/core/participants';
import { DESKTOP_PROVIDERS } from '../net/providers.ts';
import type { ColorChangeResult, ColorKey, PeopleView, TokenStatus } from '../shared/api.ts';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const COLOR_KEYS_MATCH: Same<ColorKey, CoreColorKey> = true;
void COLOR_KEYS_MATCH;

export type PeopleDeps = {
  db: () => Promise<Db>;
  tokens: {
    status(connectionId: number): Promise<TokenStatus>;
    secureStorageAvailable(): Promise<boolean>;
  };
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
          color: c.color,
          accounts: c.accounts,
          coveredFrom: c.coveredFrom,
          coveredTo: c.coveredTo,
          lastSyncAt: c.lastSyncAt,
          token: await this.d.tokens.status(c.id),
        });
      }
      people.push({ id: p.id, label: p.label, labelFromBank: p.labelSource === 'bank', color: p.color, connections: own });
    }
    return { people, secureStorage: await this.d.tokens.secureStorageAvailable() };
  }

  async rename(id: number, label: string): Promise<void> {
    await renameParticipant(await this.d.db(), id, label);
  }

  async restoreBankName(id: number): Promise<void> {
    await restoreBankLabel(await this.d.db(), id);
  }

  setParticipantColor(id: number, color: ColorKey): Promise<ColorChangeResult> {
    return colorChange(async () => setParticipantColor(await this.d.db(), id, color));
  }
}

/** A colour change for a participant or a connection: a taken colour is an answer, not an error. */
export async function colorChange(set: () => Promise<void>): Promise<ColorChangeResult> {
  try {
    await set();
    return { changed: true };
  } catch (err) {
    if (err instanceof ColorTakenError) return { changed: false, reason: 'taken' };
    throw err;
  }
}
