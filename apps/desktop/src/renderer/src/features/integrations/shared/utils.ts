import { currencyAlpha } from '@mono/core/currency';
import type { ColorKey, ConnectionAccountView, ConnectionView, ParticipantChoice, RemoveConnectionResult, SetAccountEnabledResult } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
import { t } from '@/shared/lib';
import { IMPORT_RUNNING_ACCOUNTS_TEXT } from './constants.ts';
import type { PersonChoice } from './types.ts';

/**
 * Who the new connection is for, or null while a new person has neither a name nor «Use the name from the bank». A new person
 * carries its colour (none left → main leaves it without one).
 */
export function participantChoice(person: PersonChoice, newLabel: string, fromBank: boolean, color: ColorKey | null = null): ParticipantChoice | null {
  if (person !== 'new') return { id: person };
  const withColor = color === null ? {} : { color };
  if (fromBank) return { fromBank: true, ...withColor };
  const label = newLabel.trim();
  return label === '' ? null : { label, ...withColor };
}

/** Why a connection was not removed, or '' when there is nothing to say. */
export function removeText(r: Readonly<RemoveConnectionResult>): string {
  if (r.removed || r.reason === 'cancelled') return '';
  return t('integrations.removeImportRunning');
}

/** An account in «Accounts»: «Black card · UAH · •• 1234», «Jar «Holiday» · UAH». `cardTypes` — keys of the bank's names. */
export function accountLabel(a: Readonly<ConnectionAccountView>, cardTypes: Readonly<Record<string, MessageKey>>): string {
  const currency = currencyAlpha(a.currencyCode);
  if (a.kind === 'jar') {
    const title = a.jarTitle?.trim() ?? '';
    return [title === '' ? t('integrations.accounts.jar') : t('integrations.accounts.jarNamed', { title }), currency].join(' · ');
  }
  const key = a.type !== null && Object.hasOwn(cardTypes, a.type) ? cardTypes[a.type] : undefined;
  const name = a.type === null ? t('integrations.accounts.card') : key === undefined ? a.type : t(key);
  return [name, currency, a.maskedPanTail === null ? '' : `•• ${a.maskedPanTail}`].filter((s) => s !== '').join(' · ');
}

/** Why an account was not switched, or '' when it was. */
export function accountToggleText(r: Readonly<SetAccountEnabledResult>): string {
  return r.changed ? '' : t(IMPORT_RUNNING_ACCOUNTS_TEXT);
}

/** «Accounts · 3», or «Accounts · 1 of 3» while some are off. */
export function accountsButtonText(c: Readonly<Pick<ConnectionView, 'accounts' | 'enabledAccounts'>>): string {
  return c.enabledAccounts === c.accounts
    ? t('integrations.accounts.button', { count: c.accounts })
    : t('integrations.accounts.buttonPart', { enabled: c.enabledAccounts, total: c.accounts });
}

/**
 * A switch's @change in «Accounts» (the browser has already flipped the input): the value to save and `done`, which puts
 * the input back to `enabled` unless it changed; null while another account saves — the input goes back at once.
 * The switches are not disabled while saving, so keyboard focus stays where it is.
 */
export function accountSwitchChange(
  input: { checked: boolean },
  enabled: boolean,
  busy: boolean,
): { enabled: boolean; done: (changed: boolean) => void } | null {
  if (busy) {
    input.checked = enabled;
    return null;
  }
  return {
    enabled: input.checked,
    done: (changed) => {
      if (!changed) input.checked = enabled;
    },
  };
}
