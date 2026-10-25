import type { StatementProblemCode } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

// Dictionary keys: the texts are translated where they are shown.

export const TOKEN_ERROR_TEXT: MessageKey = 'integrations.tokenError';

/** Under a disabled account in «Accounts». */
export const DISABLED_ACCOUNT_HINT: MessageKey = 'integrations.accounts.disabledHint';

/** While an import runs the switches in «Accounts» are off. */
export const IMPORT_RUNNING_ACCOUNTS_TEXT: MessageKey = 'integrations.accounts.importRunning';

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
