import { currencyAlpha } from '@mono/core/currency';
import type { ColorKey, ConnectionAccountView, ParticipantChoice, RemoveConnectionResult, SetAccountEnabledResult } from '@contract/api.ts';
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
