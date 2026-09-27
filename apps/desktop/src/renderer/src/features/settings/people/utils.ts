import type { ParticipantChoice, RemoveConnectionResult } from '@contract/api.ts';
import type { PersonChoice } from './types.ts';

/** Who the new connection is for, or null while a new person has neither a name nor «взять имя из банка». */
export function participantChoice(person: PersonChoice, newLabel: string, fromBank: boolean): ParticipantChoice | null {
  if (person !== 'new') return { id: person };
  if (fromBank) return { fromBank: true };
  const label = newLabel.trim();
  return label === '' ? null : { label };
}

/** Why a connection was not removed, or '' when there is nothing to say. */
export function removeText(r: Readonly<RemoveConnectionResult>): string {
  if (r.removed || r.reason === 'cancelled') return '';
  return 'Сначала останови импорт: он сейчас записывает эти счета.';
}
