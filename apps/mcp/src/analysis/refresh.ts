// Single entry point for rebuilding the analysis copy after anything that changes the data:
// sync, export:analysis and overrides:* call this (all run by the user; the report lists masked descriptions).
// recategorize prints counts only — see src/rederive.ts.
import type { Db } from '../db.ts';
import { log } from '../log.ts';
import { exportAnalysis, formatExportSummary, type ExportSummary } from './export.ts';

export async function refreshAnalysisCopy(db: Db): Promise<ExportSummary> {
  const summary = await exportAnalysis(db);
  for (const line of formatExportSummary(summary)) log.plain(line);
  return summary;
}
