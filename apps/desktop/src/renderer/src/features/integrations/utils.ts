import type { ProviderId } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
import { bankOf, isProviderId } from '@/entities/bank';
import { t } from '@/shared/lib';
import { PROVIDER_FORMS } from './constants.ts';
import type { ProviderForms } from './shared/types.ts';
import { FILE_ACCESS_NOTE, GENERIC_FILE_STEPS } from './statement-file/constants.ts';

/** A bank's own forms; none for a bank without its own (statement files only) or one this app does not know. */
export function formsOf(provider: string): ProviderForms | null {
  return isProviderId(provider) ? (PROVIDER_FORMS[provider] ?? null) : null;
}

/** How to get the bank's statement file: its own steps, else the generic ones; null — the bank takes no files. */
export function fileStepsOf(provider: string): ReadonlyArray<MessageKey> | null {
  if (!bankOf(provider).ways.includes('file')) return null;
  return formsOf(provider)?.fileSteps ?? GENERIC_FILE_STEPS;
}

/** The line under the bank's name on the first connect screen. */
export function accessNoteOf(provider: ProviderId): MessageKey {
  return formsOf(provider)?.accessNote ?? FILE_ACCESS_NOTE;
}

/** The title of the «Add connection» panel. */
export function newConnectionTitle(bankName: string): string {
  return t('integrations.connections.newTitle', { bank: bankName });
}
