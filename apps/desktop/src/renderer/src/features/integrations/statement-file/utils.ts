import type { CommitStatementResult, OpenStatementResult, StatementComparisonView } from '@contract/api.ts';
import { fullDate, t } from '@/shared/lib';
import { BLOCK_TEXT, PROBLEM_TEXT } from './constants.ts';
import type { TargetChoice } from './types.ts';

/** Why a file was not opened, or '' (opened or cancelled). */
export function openProblemText(r: Readonly<OpenStatementResult>): string {
  if (r.opened || r.reason === 'cancelled') return '';
  return t(PROBLEM_TEXT[r.problem], { row: r.row ?? 0 });
}

/** «Operations in the file: 5 · 03.10.2026 – 07.10.2026». */
export function summaryText(file: Readonly<{ rows: number; from: string; to: string }>): string {
  return t('integrations.statement.summary', { rows: file.rows, from: fullDate(file.from), to: fullDate(file.to) });
}

/** The comparison as lines: the counts, then what differs, then what blocks the write. */
export function comparisonLines(c: Readonly<StatementComparisonView>): string[] {
  const lines = [t('integrations.statement.counts', { matched: c.matched, added: c.added })];
  if (c.amountDiffers > 0) lines.push(t('integrations.statement.amountDiffers', { count: c.amountDiffers }));
  if (c.missingInFile > 0) lines.push(t('integrations.statement.missingInFile', { count: c.missingInFile }));
  if (c.blocked) {
    lines.push(t(BLOCK_TEXT[c.blocked], c.gap ? { from: fullDate(c.gap.from), to: fullDate(c.gap.to) } : {}));
  } else if (c.added === 0) {
    lines.push(t('integrations.statement.nothingNew'));
  }
  return lines;
}

/** The line after «Add». */
export function commitText(r: Readonly<CommitStatementResult>): string {
  if (r.written) return t('integrations.statement.added', { count: r.added });
  if (r.reason === 'expired') return t('integrations.statement.expired');
  if (r.reason === 'import-running') return t('integrations.statement.importRunning');
  // A block the comparison did not show (the data changed in between): compare again.
  return t('integrations.statement.compareFailed');
}

/** The first account to offer: the only card of the file's currency, else a new card (a file connection), else the first card. */
export function defaultTarget(accounts: ReadonlyArray<{ id: string }>, fileConnection: boolean): TargetChoice {
  if (accounts.length === 1 || (!fileConnection && accounts.length > 0)) return accounts[0]?.id ?? 'new';
  return 'new';
}
