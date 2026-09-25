// pnpm --filter @mono/mcp accounts — refreshes cards and jars from /personal/client-info (same shared rate limiter)
// and lists them. Deliberately prints no IBAN, card numbers or maskedPan. Output goes to stderr.
import { getToken, loadConfig } from '../config.ts';
import { openDb } from '../db.ts';
import { formatDuration } from '@mono/core/format';
import { log } from '../log.ts';
import { createMonoClient } from '@mono/core/providers/monobank/client';
import { systemClock } from '../clock.ts';
import { syncAccounts } from '@mono/core/sync';
import { renderAccountsTable } from './accountsTable.ts';

async function main(): Promise<void> {
  const db = await openDb(loadConfig().dbUrl);
  try {
    const api = createMonoClient({
      token: getToken(),
      db,
      fetch,
      clock: systemClock,
      rateLimitMode: 'wait',
      onWait: (ms) => log.info(`жду ${formatDuration(ms / 1000)} (лимит Monobank: 1 запрос в минуту)`),
    });
    await syncAccounts({ db, api, clock: systemClock });
    for (const line of await renderAccountsTable(db)) log.plain(line);
  } finally {
    db.close();
  }
}

main().catch((err: unknown) => {
  log.error(err instanceof Error ? err.message : 'Неизвестная ошибка');
  process.exitCode = 1;
});
