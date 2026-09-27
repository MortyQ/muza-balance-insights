// «Начать заново»: the database cannot be opened (its key is gone or unreadable, or the file is damaged), so it is
// replaced by a new, empty one. After a system confirmation: the tokens that still decrypt are kept in memory, every
// token file, the job, the key and the database go, the database is decided again (a new key), and each kept token
// becomes a new connection whose person is named by the bank at the first import. Names the user typed, overrides and
// settings lived in the database and are gone. The app lock is not touched. Never a second way to «Удалить все данные»:
// with a ready database it refuses before asking anything.
import fs from 'node:fs';
import path from 'node:path';
import type { ProviderId } from '@mono/core/providers/types';
import type { StartOverResult } from '../../shared/db-state.ts';
import { DESKTOP_PROVIDERS } from '../../net/providers.ts';
import { JOB_FILE } from '../importer.ts';
import type { DbState } from './access.ts';

export type StartOverDeps = {
  access: { isReady(): boolean; reset(): Promise<DbState> };
  /** System dialog; true = confirmed. */
  confirm: () => Promise<boolean>;
  tokens: { saved(): Promise<number[]>; get(connectionId: number): Promise<string | null>; clearAll(): Promise<void> };
  importer: { stop(): Promise<void> };
  data: { close(): Promise<void> };
  integrations: {
    addConnection(input: { participant: { fromBank: true }; provider: ProviderId; token: string; remember: boolean }): Promise<{ added: boolean }>;
  };
  userDataDir: string;
  /** Counts and error names only. */
  log: (msg: string) => void;
};

/** The one provider whose credential shape the token has; none or several → the token is not kept. */
function providerOf(token: string): ProviderId | null {
  const ids = (Object.keys(DESKTOP_PROVIDERS) as ProviderId[]).filter((p) => DESKTOP_PROVIDERS[p].credential.test(token));
  return ids.length === 1 ? ids[0]! : null;
}

export async function startOver(d: StartOverDeps): Promise<StartOverResult> {
  if (d.access.isReady()) return { done: false, reason: 'not-needed' };
  if (!(await d.confirm())) return { done: false, reason: 'cancelled' };
  await d.importer.stop();
  await d.data.close();

  const kept: Array<{ provider: ProviderId; token: string }> = [];
  for (const id of await d.tokens.saved()) {
    const token = await d.tokens.get(id).catch(() => null);
    const provider = token === null ? null : providerOf(token);
    if (token !== null && provider !== null && !kept.some((k) => k.token === token)) kept.push({ provider, token });
  }

  await d.tokens.clearAll();
  await fs.promises.rm(path.join(d.userDataDir, JOB_FILE), { force: true });
  const state = await d.access.reset();
  if (state.kind !== 'ready') {
    d.log(`start over: state=${state.kind}, tokens not restored`);
    return { done: true, restoredConnections: 0 };
  }

  let restored = 0;
  for (const k of kept) {
    try {
      if ((await d.integrations.addConnection({ participant: { fromBank: true }, provider: k.provider, token: k.token, remember: true })).added) restored++;
    } catch (err) {
      d.log(`start over: connection not restored: ${err instanceof Error ? err.name : 'error'}`);
    }
  }
  d.log(`start over: done, restored=${restored} of ${kept.length}`);
  return { done: true, restoredConnections: restored };
}
