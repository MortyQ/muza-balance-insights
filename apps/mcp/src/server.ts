// MCP stdio server for Claude Desktop. stdout is the protocol channel: logs go to stderr only.
// Read-only tools work without a token; sync_recent reads MONO_TOKEN on first use.
import { refreshAnalysisCopy } from './analysis/refresh.ts';
import { getToken, loadConfig } from './config.ts';
import { openDb } from './db.ts';
import { log } from './log.ts';
import { runStdioServer } from './mcp/run.ts';
import { ensureDefaultConnection } from '@mono/core/connections';
import { createMonoClient, type MonoClient } from '@mono/core/providers/monobank/client';
import { systemClock } from './clock.ts';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = await openDb(config.dbUrl);
  // The .env token is the database's one Monobank connection.
  const connectionId = await ensureDefaultConnection(db, 'monobank', Math.floor(systemClock.nowMs() / 1000));
  let api: MonoClient | null = null;
  await runStdioServer(db, {
    clock: systemClock,
    // 'fail': a tool call never waits for the Monobank rate limit.
    getApi: () => (api ??= createMonoClient({ token: getToken(), db, fetch, clock: systemClock, rateLimitMode: 'fail', connectionId })),
    refreshCopy: refreshAnalysisCopy,
  });
}

main().catch((err: unknown) => {
  log.error(`monobank-mcp не запустился: ${err instanceof Error ? err.message : 'неизвестная ошибка'}`);
  process.exitCode = 1;
});
