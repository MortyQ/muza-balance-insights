// pnpm --filter @mono/mcp recategorize — run after changing rules or category_overrides. Refreshes the analysis copy.
// Runs outside the OS sandbox (sandbox.excludedCommands): no .env, no token, aggregates-only output —
// see src/rederive.ts and tests/recategorize-safety.test.ts.
import fs from 'node:fs';
import { openDb } from '../db.ts';
import { log } from '../log.ts';
import { resolveDbPath } from '../paths.ts';
import { rederiveAll } from '../rederive.ts';

async function main(): Promise<void> {
  // MONO_DB_PATH only from the real environment: .env is never read here.
  const dbPath = resolveDbPath(process.env.MONO_DB_PATH);
  // openDb would silently create an empty database; a wrong path must fail instead.
  if (!fs.existsSync(dbPath)) {
    throw new Error('База не найдена. recategorize не читает .env: если MONO_DB_PATH задан только там, передай его через окружение.');
  }
  const db = await openDb(`file:${dbPath}`);
  try {
    log.info('Размечаю внутренние переводы, возвраты и категории…');
    const { report, exportError } = await rederiveAll(db);
    for (const line of report) log.plain(line);
    if (exportError !== null) {
      log.error(`Пересчёт сохранён, но обезличенная копия не обновлена: ${exportError}`);
      process.exitCode = 1;
    }
  } finally {
    db.close();
  }
}

main().catch((err: unknown) => {
  log.error(err instanceof Error ? err.message : 'Неизвестная ошибка');
  process.exitCode = 1;
});
