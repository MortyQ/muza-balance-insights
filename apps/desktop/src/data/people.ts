// People in the data process: participants and their connections as the database knows them (core participants.ts),
// renames and colours. Main adds each connection's bank name and token status (src/main/people.ts).
import { ColorTakenError, type ColorKey as CoreColorKey } from '@mono/core/people/colors';
import type { Db } from '@mono/core/storage/db';
import { BANK_LABEL_PLACEHOLDER, listConnections, listParticipants, setParticipantColor } from '@mono/core/people/participants';
import { systemTimeZone } from '../shared/dates.ts';
import type { ColorChangeResult, ColorKey } from '../shared/api.ts';
import type { PersonRow } from '../shared/data-protocol.ts';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const COLOR_KEYS_MATCH: Same<ColorKey, CoreColorKey> = true;
void COLOR_KEYS_MATCH;

/** The core's stand-in label until the bank sends the holder's name. */
export function labelPending(p: { label: string; labelSource: 'bank' | 'user' }): boolean {
  return p.labelSource === 'bank' && p.label === BANK_LABEL_PLACEHOLDER;
}

export async function peopleRows(db: Db): Promise<PersonRow[]> {
  const [participants, connections] = [await listParticipants(db), await listConnections(db, systemTimeZone())];
  return participants.map((p) => ({
    id: p.id,
    label: p.label,
    labelFromBank: p.labelSource === 'bank',
    labelPending: labelPending(p),
    color: p.color,
    connections: connections
      .filter((c) => c.participantId === p.id)
      .map((c) => ({
        id: c.id,
        provider: c.provider,
        method: c.method,
        accounts: c.accounts,
        enabledAccounts: c.enabledAccounts,
        coveredFrom: c.coveredFrom,
        coveredTo: c.coveredTo,
        lastSyncAt: c.lastSyncAt,
      })),
  }));
}

/** A colour change for a participant: a taken colour is an answer, not an error. */
export async function participantColor(db: Db, id: number, color: ColorKey): Promise<ColorChangeResult> {
  try {
    await setParticipantColor(db, id, color);
    return { changed: true };
  } catch (err) {
    if (err instanceof ColorTakenError) return { changed: false, reason: 'taken' };
    throw err;
  }
}
