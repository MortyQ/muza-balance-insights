import type { StatementBlock, StatementProblemCode } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

// Dictionary keys: the texts are translated where they are shown.

/** Why main did not take a file. `bad-row` carries the row in its text. */
export const PROBLEM_TEXT: Readonly<Record<StatementProblemCode, MessageKey>> = {
  'unknown-format': 'integrations.statement.problem.unknownFormat',
  ambiguous: 'integrations.statement.problem.ambiguous',
  'other-bank': 'integrations.statement.problem.otherBank',
  language: 'integrations.statement.problem.language',
  'unsupported-kind': 'integrations.statement.problem.unsupportedKind',
  empty: 'integrations.statement.problem.empty',
  'bad-row': 'integrations.statement.problem.badRow',
  'too-large': 'integrations.statement.problem.tooLarge',
  'no-format': 'integrations.statement.problem.noFormat',
  unreadable: 'integrations.statement.problem.unreadable',
  encrypted: 'integrations.statement.problem.encrypted',
  'over-limits': 'integrations.statement.problem.overLimits',
  timeout: 'integrations.statement.problem.timeout',
};

/** Why the file is compared but not written. `gap` carries its dates. */
export const BLOCK_TEXT: Readonly<Record<StatementBlock, MessageKey>> = {
  token: 'integrations.statement.blockedToken',
  currency: 'integrations.statement.blockedCurrency',
  gap: 'integrations.statement.blockedGap',
};

/** How to get a statement file from a bank without its own steps. */
export const GENERIC_FILE_STEPS = ['integrations.statement.genericStep1', 'integrations.statement.genericStep2'] as const satisfies ReadonlyArray<MessageKey>;

/** The first connect screen's line for a bank connected by files only. */
export const FILE_ACCESS_NOTE: MessageKey = 'integrations.statement.fileAccessNote';
