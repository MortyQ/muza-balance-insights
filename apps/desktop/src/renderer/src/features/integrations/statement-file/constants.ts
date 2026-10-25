import type { StatementBlock } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

// Dictionary keys: the texts are translated where they are shown.

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
