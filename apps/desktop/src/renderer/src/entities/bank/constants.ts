// The look of a bank without its own (looks/<id>.ts) and the «Other banks» tile of the bank picker. Which banks exist
// comes from the registry (utils.ts), never from a list here.
import type { ProviderId } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
import type { BankLook } from './types.ts';

export const NEUTRAL_MONOGRAM_CLASS = 'bg-surface-sunken text-foreground-muted';

/** Not a bank: the picker's disabled tile for banks the app cannot connect yet. */
export const OTHER_BANKS = {
  id: 'other',
  name: 'entities.bank.other',
  monogram: '+',
  monogramClass: NEUTRAL_MONOGRAM_CLASS,
} as const satisfies BankLook & { id: string; name: MessageKey };

/** Where each file bank's statement is downloaded: one line under the upload sheet's title. A new file bank adds its own. */
export const STATEMENT_HINTS: Readonly<Partial<Record<ProviderId, MessageKey>>> = {
  monobank: 'entities.bank.statementHint.monobank',
  privatbank: 'entities.bank.statementHint.privatbank',
};
