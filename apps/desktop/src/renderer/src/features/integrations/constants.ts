import type { ProviderId } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
import type { BankAuth } from '@/entities/bank';
import MonobankConnectFeature from './monobank/MonobankConnectFeature.vue';
import MonobankTokenField from './monobank/components/MonobankTokenField.vue';
import { ACCESS_NOTE as MONOBANK_ACCESS_NOTE, FILE_STEPS as MONOBANK_FILE_STEPS } from './monobank/constants.ts';
import type { ProviderForms } from './shared/types.ts';

/**
 * The forms and texts of the banks that need their own, from their folders: `connect` — the add form around the owner
 * fields (its default slot); `tokenField` — the token field of «Enter token again» in a connection row; `accessNote` —
 * the first screen's line; `fileSteps` — how to get a statement file. Every token bank has an entry; a bank with
 * statement files only may have none and gets the generic file flow (statement-file/).
 */
export const PROVIDER_FORMS: Partial<Record<ProviderId, ProviderForms>> = {
  monobank: {
    connect: MonobankConnectFeature,
    tokenField: MonobankTokenField,
    accessNote: MONOBANK_ACCESS_NOTE,
    fileSteps: MONOBANK_FILE_STEPS,
  },
};

/** The ways the add form can show (an OAuth sign-in is not built yet). */
export type ConnectWay = Extract<BankAuth, 'token' | 'file'>;

/** A way of connecting in the add form: its name and what it means for the user. */
export const WAY_TEXT: Readonly<Record<ConnectWay, { label: MessageKey; hint: MessageKey }>> = {
  token: { label: 'integrations.way.token', hint: 'integrations.way.tokenHint' },
  file: { label: 'integrations.way.file', hint: 'integrations.way.fileHint' },
};
