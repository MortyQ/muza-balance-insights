import type { ColorKey, ParticipantChoice, RemoveConnectionResult } from '@contract/api.ts';
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
