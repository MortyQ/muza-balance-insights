import type { MessageKey } from '@contract/i18n/index.ts';
import { MONOBANK_CARD_TYPES } from '@/entities/bank';

// Dictionary keys: the texts are translated where they are shown.

/** Shown wherever a token of another person may be added. */
export const CONSENT_TEXT: MessageKey = 'integrations.monobank.consent';

export const DUPLICATE_TOKEN_TEXT: MessageKey = 'integrations.monobank.duplicate';

/** How to get the token, step by step. Plain text: the app opens no external links. */
export const TOKEN_STEPS = ['integrations.monobank.step1', 'integrations.monobank.step2'] as const satisfies ReadonlyArray<MessageKey>;

export const TOKEN_PLACEHOLDER: MessageKey = 'integrations.monobank.placeholder';

/** Under the bank's name on the first connect screen. */
export const ACCESS_NOTE: MessageKey = 'integrations.monobank.accessNote';

/** Monobank's card types → names for «Accounts» (the bank entity's table: balance cards use it too). */
export const CARD_TYPE_NAMES = MONOBANK_CARD_TYPES;
