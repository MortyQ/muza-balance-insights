// PeopleService and IntegrationsService on one database and one TokenVault (fake safeStorage), as main wires them:
// their database halves run in a DataHost over the same database, reached through the data API as main reaches it.
import type { Db } from '@mono/core/storage/db';
import { DataHost } from '../../src/data/host.ts';
import { dataApi, type DataApi } from '../../src/main/data-api.ts';
import { IntegrationsService } from '../../src/main/integrations.ts';
import { PeopleService } from '../../src/main/people.ts';
import { TokenVault, type SafeStorageLike } from '../../src/main/token.ts';

export const TOKEN = 'uCANARY-people-token-0123456789abc';
export const TOKEN_B = 'uCANARY-people-token-B-987654321xyz';

function safeStorage(failEncrypt = false): SafeStorageLike {
  return {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (s) => {
      if (failEncrypt) throw new Error(`encrypt failed for ${s}`);
      return Buffer.from([...s].reverse().join(''));
    },
    decryptStringAsync: async (b) => ({ result: [...b.toString()].reverse().join(''), shouldReEncrypt: false }),
  };
}

/** The data API over a host on `db`, in this process (no clone of the messages: same answers, same errors). */
export function localData(db: Db, nowSec = 1_000): DataApi {
  const host = new DataHost({ open: async () => db, release: async () => undefined, nowSec: () => nowSec, rates: async () => null });
  let id = 0;
  return dataApi((method, args) => host.handle({ type: 'call', id: id++, method, args }));
}

export function services(db: Db, dir: string, opts: { running?: boolean; confirm?: boolean; failEncrypt?: boolean } = {}) {
  const vault = new TokenVault({ safeStorage: safeStorage(opts.failEncrypt), platform: 'darwin', userDataDir: dir });
  const asked: string[] = [];
  const data = localData(db);
  const people = new PeopleService({ data, tokens: vault });
  const integrations = new IntegrationsService({
    data,
    tokens: vault,
    importRunning: () => opts.running ?? false,
    confirmRemove: async () => (asked.push('confirm'), opts.confirm ?? true),
  });
  return { people, integrations, vault, asked };
}
