// PeopleService and IntegrationsService on one database and one TokenVault (fake safeStorage), as main wires them.
import type { Db } from '@mono/core/db';
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

export function services(db: Db, dir: string, opts: { running?: boolean; confirm?: boolean; failEncrypt?: boolean } = {}) {
  const vault = new TokenVault({ safeStorage: safeStorage(opts.failEncrypt), platform: 'darwin', userDataDir: dir });
  const asked: string[] = [];
  const people = new PeopleService({ db: async () => db, tokens: vault });
  const integrations = new IntegrationsService({
    db: async () => db,
    tokens: vault,
    importRunning: () => opts.running ?? false,
    confirmRemove: async () => (asked.push('confirm'), opts.confirm ?? true),
    nowSec: () => 1_000,
  });
  return { people, integrations, vault, asked };
}
