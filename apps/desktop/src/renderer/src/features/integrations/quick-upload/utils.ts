import type { PersonView, ProviderId } from '@contract/api.ts';
import { bankOf } from '@/entities/bank';
import type { ConnectionOption } from './types.ts';

/** The provider's connections of every person: file ones (written to) and token ones (only checked against). */
export function connectionsFor(people: ReadonlyArray<PersonView>, provider: ProviderId): { files: ConnectionOption[]; tokens: ConnectionOption[] } {
  const all = people.flatMap((p) =>
    p.connections.filter((c) => c.provider === provider).map((connection) => ({ connection, label: `${bankOf(provider).name} · ${p.label}` })),
  );
  return { files: all.filter((o) => o.connection.method === 'file'), tokens: all.filter((o) => o.connection.method === 'token') };
}
