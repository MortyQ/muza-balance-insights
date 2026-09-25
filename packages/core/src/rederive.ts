// Re-derives everything computed from the stored rows: internal transfers, refunds, categories, scope.
// Its report goes to the agent via recategorize (apps/mcp/src/cli/recategorize.ts, run OUTSIDE the OS sandbox):
// aggregates and diagnostics only — no descriptions, counterparties, comments, IBANs or card numbers
// (apps/mcp/tests/recategorize-safety.test.ts). Change what it prints only after the user's ok.
import { recategorize } from './categories.ts';
import type { Db } from './db.ts';
import { categoryCounts, transferDiagnostics } from './queries.ts';
import { markRefunds } from './refunds.ts';
import { rescope, scopeCounts } from './scope.ts';
import { markInternalTransfers } from './transfers.ts';

export async function rederiveCore(db: Db): Promise<string[]> {
  await markInternalTransfers(db);
  await markRefunds(db);
  const changed = await recategorize(db);
  await rescope(db);

  const d = await transferDiagnostics(db);
  const report = [
    `Категории пересчитаны, изменено строк: ${changed}`,
    `Переводы по правилам: ${Object.entries(d.byRule).map(([k, n]) => `${k} ${n}`).join(', ')}`,
    `Служебных 4829 без пары: ${d.unpairedService4829}`,
    `Возвратов, спаренных с покупкой (refund_pair): ${d.refundPairs}`,
    `Scope (строк): ${Object.entries(await scopeCounts(db)).map(([k, n]) => `${k} ${n}`).join(', ')}`,
    'Категории (строк):',
  ];
  for (const c of await categoryCounts(db)) report.push(`  ${String(c.n).padStart(6)}  ${c.category}`);
  return report;
}
