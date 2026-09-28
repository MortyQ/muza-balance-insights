import type { MessageKey } from '@contract/i18n/index.ts';

// Dictionary keys: the texts are translated where they are shown.

/** Shown wherever a token of another person may be added. */
export const CONSENT_TEXT: MessageKey = 'integrations.monobank.consent';

export const DUPLICATE_TOKEN_TEXT: MessageKey = 'integrations.monobank.duplicate';

/** How to get the token, step by step. Plain text: the app opens no external links. */
export const TOKEN_STEPS = ['integrations.monobank.step1', 'integrations.monobank.step2'] as const satisfies ReadonlyArray<MessageKey>;

export const TOKEN_PLACEHOLDER: MessageKey = 'integrations.monobank.placeholder';

/** Under the bank's name on the first connect screen. */
export const ACCESS_NOTE: MessageKey = 'integrations.monobank.accessNote';

/** Monobank's card types → names for «Accounts»; a type not listed shows as the bank sent it. */
export const CARD_TYPE_NAMES: Readonly<Record<string, MessageKey>> = {
  black: 'integrations.monobank.card.black',
  white: 'integrations.monobank.card.white',
  platinum: 'integrations.monobank.card.platinum',
  iron: 'integrations.monobank.card.iron',
  fop: 'integrations.monobank.card.fop',
  yellow: 'integrations.monobank.card.yellow',
  eAid: 'integrations.monobank.card.eAid',
  madeInUkraine: 'integrations.monobank.card.madeInUkraine',
  rebuilding: 'integrations.monobank.card.rebuilding',
};
