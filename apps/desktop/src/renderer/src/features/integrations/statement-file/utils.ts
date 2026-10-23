import { currencyAlpha } from '@mono/core/shared/currency';
import type { CommitStatementResult, OpenStatementResult, OpenedStatementView, StatementComparisonView } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
import { cardTypeName } from '@/entities/bank';
import { fullDate, t } from '@/shared/lib';
import { BLOCK_TEXT, DEFAULT_NEW_CARD_TYPE, PROBLEM_TEXT } from './constants.ts';
import type { OpenedStatement, TargetChoice } from './types.ts';

/** Why a file was not opened, or '' (opened or cancelled). */
export function openProblemText(r: Readonly<OpenStatementResult>): string {
  if (r.opened || r.reason === 'cancelled') return '';
  return t(PROBLEM_TEXT[r.problem], { row: r.row ?? 0 });
}

/**
 * An account of the file: «Black card · UAH · •• 1234». A type the bank's names do not know is not shown: it would be
 * the file's own word.
 */
export function statementLabel(s: Readonly<OpenedStatementView>, cardTypes: Readonly<Record<string, MessageKey>>): string {
  const type = s.type !== null && Object.hasOwn(cardTypes, s.type) ? s.type : null;
  return [cardTypeName(type, cardTypes), currencyAlpha(s.currencyCode), s.cardTail === null ? '' : `•• ${s.cardTail}`].filter((x) => x !== '').join(' · ');
}

/** A new card's type: the file's when the bank's names know it, else the default. */
export function newCardType(s: Readonly<OpenedStatementView>, cardTypes: Readonly<Record<string, MessageKey>>): string {
  return s.type !== null && Object.hasOwn(cardTypes, s.type) ? s.type : DEFAULT_NEW_CARD_TYPE;
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

/**
 * The accounts to offer first, one per account of the file: the one its IBAN or card number matched, else
 * defaultTarget among the cards no other account of the file took. Each card goes to one account at most.
 */
export function initialTargets(file: Readonly<OpenedStatement>, comparisons: ReadonlyArray<StatementComparisonView>, fileConnection: boolean): TargetChoice[] {
  const taken = new Set(comparisons.flatMap((c) => (c.match.kind === 'account' ? [c.match.accountId] : [])));
  return file.statements.map((s, i) => {
    const match = comparisons[i]?.match;
    if (match?.kind === 'account') return match.accountId;
    const choice = defaultTarget(s.accounts.filter((a) => !taken.has(a.id)), fileConnection);
    if (choice !== 'new') taken.add(choice);
    return choice;
  });
}

/** What the file would add now: every account compared, none blocked, something new. */
export function canWrite(comparisons: ReadonlyArray<StatementComparisonView>): boolean {
  return comparisons.every((c) => c.blocked === null) && comparisons.some((c) => c.added > 0);
}
