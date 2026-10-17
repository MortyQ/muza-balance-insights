import type { StatementBlock, StatementProblemCode } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

// Dictionary keys: the texts are translated where they are shown.

/** Why main did not take a file. `bad-row` carries the row in its text. */
export const PROBLEM_TEXT: Readonly<Record<StatementProblemCode, MessageKey>> = {
  'unknown-format': 'integrations.statement.problem.unknownFormat',
  english: 'integrations.statement.problem.english',
  'unsupported-kind': 'integrations.statement.problem.unsupportedKind',
  empty: 'integrations.statement.problem.empty',
  'bad-row': 'integrations.statement.problem.badRow',
  'too-large': 'integrations.statement.problem.tooLarge',
  'no-format': 'integrations.statement.problem.noFormat',
};

/** Why the file is compared but not written. `gap` carries its dates. */
export const BLOCK_TEXT: Readonly<Record<StatementBlock, MessageKey>> = {
  token: 'integrations.statement.blockedToken',
  currency: 'integrations.statement.blockedCurrency',
  gap: 'integrations.statement.blockedGap',
};

/** The card type a new card from a file starts with. */
export const DEFAULT_NEW_CARD_TYPE = 'black';
