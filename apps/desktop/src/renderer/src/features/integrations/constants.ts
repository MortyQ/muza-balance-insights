import type { ProviderKey } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
import type { BankAuth } from '@/entities/bank';
import MonobankConnectFeature from './monobank/MonobankConnectFeature.vue';
import MonobankTokenField from './monobank/components/MonobankTokenField.vue';
import { ACCESS_NOTE as MONOBANK_ACCESS_NOTE, CARD_TYPE_NAMES as MONOBANK_CARD_TYPES, FILE_STEPS as MONOBANK_FILE_STEPS } from './monobank/constants.ts';
import type { ProviderForms } from './shared/types.ts';

/**
 * Each bank's forms and texts, from its folder: `connect` — the add form around the owner fields (its default slot);
 * `tokenField` — the token field of «Enter token again» in a connection row; `accessNote` — the first screen's line;
 * `cardTypes` — the bank's card types for «Accounts»; `fileSteps` — how to get a statement file (null: no file format).
 */
export const PROVIDER_FORMS: Record<ProviderKey, ProviderForms> = {
  monobank: {
    connect: MonobankConnectFeature,
    tokenField: MonobankTokenField,
    accessNote: MONOBANK_ACCESS_NOTE,
    cardTypes: MONOBANK_CARD_TYPES,
    fileSteps: MONOBANK_FILE_STEPS,
  },
};

/** The bank «Add connection» adds (the only one available), and the forms of a provider this app does not know. */
export const DEFAULT_PROVIDER: ProviderKey = 'monobank';

/** The ways the add form can show (an OAuth sign-in is not built yet). */
export type ConnectWay = Extract<BankAuth, 'token' | 'file'>;

/** A way of connecting in the add form: its name and what it means for the user. */
export const WAY_TEXT: Readonly<Record<ConnectWay, { label: MessageKey; hint: MessageKey }>> = {
  token: { label: 'integrations.way.token', hint: 'integrations.way.tokenHint' },
  file: { label: 'integrations.way.file', hint: 'integrations.way.fileHint' },
};
