// Connections in the data process: the list, creating one with its participant, and a connection's accounts for their
// toggles. Tokens are main's (src/main/integrations.ts): nothing here sees one.
import { listConnectionAccounts } from '@mono/core/people/accounts';
import { ConnectionError, type ConnectionMethod } from '@mono/core/people/connections';
import type { Db } from '@mono/core/storage/db';
import { addConnection, addParticipant, listConnections } from '@mono/core/people/participants';
import type { ProviderId } from '@mono/core/providers/types';
import type { ConnectionAccountView, ParticipantChoice } from '../shared/api.ts';

export async function connectionList(db: Db): Promise<Array<{ id: number; provider: ProviderId; method: ConnectionMethod }>> {
  return (await listConnections(db)).map((c) => ({ id: c.id, provider: c.provider, method: c.method }));
}

/** The participant (new or chosen) and the connection; a participant created here goes again if the connection fails. */
export async function createConnection(
  db: Db,
  participant: ParticipantChoice,
  provider: ProviderId,
  method: ConnectionMethod,
  now: number,
): Promise<{ connectionId: number; participantId: number }> {
  const participantId = 'id' in participant ? participant.id : await addParticipant(db, participant, now);
  try {
    return { connectionId: await addConnection(db, participantId, provider, now, method), participantId };
  } catch (err) {
    if (!('id' in participant)) await db.execute({ sql: 'DELETE FROM participants WHERE id = ?', args: [participantId] });
    throw err;
  }
}

/** Field by field: nothing of an account beyond the label parts reaches the renderer. Unknown connection → ConnectionError. */
export async function connectionAccounts(db: Db, connectionId: number): Promise<ConnectionAccountView[]> {
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
