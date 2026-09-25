// Full / resumable import: pnpm --filter @mono/mcp sync --since 2025-01-01 [--account <id>]
// Progress goes to stderr. Safe to Ctrl+C: every window is committed atomically, the next run continues.
import { parseArgs } from 'node:util';
import { refreshAnalysisCopy } from '../analysis/refresh.ts';
import { RATE_LIMIT_MS, getToken, loadConfig } from '../config.ts';
import { openDb } from '../db.ts';
import { accountLabels, formatDuration, kyivStartOfDay, toKyivDate } from '@mono/core/format';
import { log } from '../log.ts';
import { ensureDefaultConnection } from '@mono/core/connections';
import { createMonoClient } from '@mono/core/providers/monobank/client';
import { cliArgs } from '../args.ts';
import { systemClock } from '../clock.ts';
import {
  defaultAccountSelection,
  listAccountIds,
  planHistory,
  runPlan,
  syncAccounts,
  type SyncContext,
  type SyncEvent,
} from '@mono/core/sync';

const USAGE = 'Использование: pnpm --filter @mono/mcp sync [--since YYYY-MM-DD] [--account <id>]';

function describeEvent(e: SyncEvent, labels: Map<string, string>): string | null {
  const name = (id: string) => labels.get(id) ?? id;
  switch (e.type) {
    case 'accounts':
      return `Счета обновлены: ${e.cards} карт, ${e.jars} банок`;
    case 'plan':
      return e.windows === 0 ? `${name(e.accountId)}: нечего синкать` : `${name(e.accountId)}: окон к загрузке — ${e.windows}`;
    case 'window-start':
      return `${name(e.accountId)} [${e.index}/${e.total}] окно ${toKyivDate(e.window.from)} … ${toKyivDate(e.window.to)}`;
    case 'page':
      return e.page > 1 || e.received >= 500 ? `  страница ${e.page}: получено ${e.received}` : `  получено ${e.received}`;
    case 'window-done': {
      const r = e.result;
      const extra = [
        r.cancelledHolds ? `отменённых холдов: ${r.cancelledHolds}` : '',
        r.missingNonHolds ? `пропавших не-холдов: ${r.missingNonHolds} (см. WARN)` : '',
      ].filter(Boolean);
      return `  сохранено ${r.upserted}${extra.length ? `, ${extra.join(', ')}` : ''}`;
    }
    case 'rate-limited':
      return `  Monobank вернул 429, жду ${formatDuration(e.waitMs / 1000)} (попытка ${e.attempt})`;
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: cliArgs(),
    options: { since: { type: 'string' }, account: { type: 'string', multiple: true }, help: { type: 'boolean' } },
    allowPositionals: false,
  });
  if (values.help) {
    log.info(USAGE);
    return;
  }
  const sinceSec = values.since !== undefined ? kyivStartOfDay(values.since) : null;

  const config = loadConfig();
  const db = await openDb(config.dbUrl);
  try {
    const labels = new Map<string, string>();
    // The .env token is the database's one Monobank connection.
    const connectionId = await ensureDefaultConnection(db, 'monobank', Math.floor(systemClock.nowMs() / 1000));
    const api = createMonoClient({
      connectionId,
      token: getToken(),
      db,
      fetch,
      clock: systemClock,
      rateLimitMode: 'wait',
      onWait: (ms) => log.info(`  жду ${formatDuration(ms / 1000)} (лимит Monobank: 1 запрос в минуту)`),
    });
    const ctx: SyncContext = {
      db,
      api,
      connectionId,
      clock: systemClock,
      onEvent: (e) => {
        const line = describeEvent(e, labels);
        if (line) log.info(line);
      },
      warn: (msg) => log.warn(msg),
    };

    log.info('Обновляю список счетов и банок…');
    await syncAccounts(ctx);

    const rs = await db.execute(`SELECT id, kind, type, currency_code FROM accounts`);
    const byLabel = accountLabels(
      rs.rows.map((r) => ({ id: String(r.id), kind: String(r.kind), type: r.type === null ? null : String(r.type), currencyCode: Number(r.currency_code) })),
    );
    for (const [id, label] of byLabel) labels.set(id, label);

    const all = await listAccountIds(db);
    const defaults = await defaultAccountSelection(db, connectionId);
    let accountIds = defaults.selected;
    if (values.account) {
      const unknown = values.account.filter((id) => !all.includes(id));
      if (unknown.length > 0) throw new Error(`Неизвестные счета: ${unknown.join(', ')}. ${USAGE}`);
      accountIds = values.account;
    } else if (defaults.skippedJars.length > 0) {
      log.info(`Пропущены банки с нулевым балансом, ещё не импортированные (${defaults.skippedJars.length}) — синк только через --account <id>:`);
      for (const j of defaults.skippedJars) log.info(`  ${labels.get(j.id) ?? 'банка'} — --account ${j.id}`);
    }

    const plan = await planHistory(ctx, { sinceSec, accountIds });
    const notImported = [...plan].filter(([, w]) => w.length === 0 && sinceSec === null).map(([id]) => id);
    const totalWindows = [...plan.values()].reduce((n, w) => n + w.length, 0);
    log.info(
      `Всего окон: ${totalWindows} → примерно ${formatDuration((totalWindows * RATE_LIMIT_MS) / 1000)} ` +
        '(1 запрос в минуту; больше, если в окне > 500 транзакций)',
    );
    if (sinceSec === null && notImported.length > 0) {
      log.warn(`Без --since новые счета не импортируются (${notImported.length} шт.). ${USAGE}`);
    }

    await runPlan(ctx, plan);
    log.info('Готово.');

    // The sync itself is committed; a failed export must not look like a failed sync.
    try {
      await refreshAnalysisCopy(db);
    } catch (err) {
      log.error(`Синк сохранён, но обезличенная копия не обновлена: ${err instanceof Error ? err.message : 'неизвестная ошибка'}`);
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
