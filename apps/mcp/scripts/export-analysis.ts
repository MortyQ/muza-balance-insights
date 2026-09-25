// Builds analysis/analysis.sqlite from the real database: pnpm --filter @mono/mcp export:analysis
// Run by the user only — it reads data/. Also runs automatically after sync.
import { loadConfig } from '../src/config.ts';
import { openDb } from '../src/db.ts';
import { refreshAnalysisCopy } from '../src/analysis/refresh.ts';
import { log } from '../src/log.ts';

async function main(): Promise<void> {
  const db = await openDb(loadConfig().dbUrl);
  try {
    await refreshAnalysisCopy(db);
  } finally {
    db.close();
  }
}

main().catch((err: unknown) => {
  log.error(`Экспорт не удался: ${err instanceof Error ? err.message : 'неизвестная ошибка'}`);
  process.exitCode = 1;
});
