// recategorize = rederiveCore (packages/core/src/rederive.ts) + a rebuild of the analysis copy.
// The agent runs it itself OUTSIDE the OS sandbox — so this module and everything it imports must not touch
// .env or the token (tests/recategorize-safety.test.ts), and the report holds aggregates and diagnostics only:
// no descriptions, counterparties, comments, IBANs or card numbers. Change what it prints only after the user's ok.
import type { Db } from '@mono/core/db';
import { rederiveCore } from '@mono/core/rederive';
import { exportAnalysis, formatExportSummary } from './analysis/export.ts';
import { ANALYSIS_DB_PATH } from './analysis/schema.ts';

export type RederiveResult = { report: string[]; exportError: string | null };

export async function rederiveAll(db: Db, analysisPath: string = ANALYSIS_DB_PATH): Promise<RederiveResult> {
  const report = await rederiveCore(db);

  // Derived data is committed; a failed export must not look like a failed recategorize.
  try {
    report.push(...formatExportSummary(await exportAnalysis(db, analysisPath), { descriptions: false }));
    return { report, exportError: null };
  } catch (err) {
    return { report, exportError: err instanceof Error ? err.message : 'неизвестная ошибка' };
  }
}
