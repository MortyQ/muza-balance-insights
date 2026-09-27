import { currencyAlpha } from '@mono/core/currency';
import type { ColorKey, ConnectionAccountView, ConnectionView, ParticipantChoice, RemoveConnectionResult, SetAccountEnabledResult } from '@contract/api.ts';
import { IMPORT_RUNNING_ACCOUNTS_TEXT } from './constants.ts';
import type { PersonChoice } from './types.ts';

/**
 * Who the new connection is for, or null while a new person has neither a name nor «взять имя из банка». A new person
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
  return 'Сначала останови импорт: он сейчас записывает эти счета.';
}

/** An account in «Счета»: «Чёрная карта · UAH · •• 1234», «Банка «Отпуск» · UAH». `cardTypes` — the bank's names. */
export function accountLabel(a: Readonly<ConnectionAccountView>, cardTypes: Readonly<Record<string, string>>): string {
  const currency = currencyAlpha(a.currencyCode);
  if (a.kind === 'jar') return [a.jarTitle === null || a.jarTitle.trim() === '' ? 'Банка' : `Банка «${a.jarTitle.trim()}»`, currency].join(' · ');
  const name = a.type === null ? 'Карта' : ((Object.hasOwn(cardTypes, a.type) ? cardTypes[a.type] : undefined) ?? a.type);
  return [name, currency, a.maskedPanTail === null ? '' : `•• ${a.maskedPanTail}`].filter((s) => s !== '').join(' · ');
}

/** Why an account was not switched, or '' when it was. */
export function accountToggleText(r: Readonly<SetAccountEnabledResult>): string {
  return r.changed ? '' : IMPORT_RUNNING_ACCOUNTS_TEXT;
}

/** «Счета · 3», or «Счета · 1 из 3» while some are off. */
export function accountsButtonText(c: Readonly<Pick<ConnectionView, 'accounts' | 'enabledAccounts'>>): string {
  return c.enabledAccounts === c.accounts ? `Счета · ${c.accounts}` : `Счета · ${c.enabledAccounts} из ${c.accounts}`;
}

/**
 * A switch's @change in «Счета» (the browser has already flipped the input): the value to save and `done`, which puts
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
