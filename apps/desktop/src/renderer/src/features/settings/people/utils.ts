import type { ParticipantChoice, RemoveConnectionResult } from '@contract/api.ts';
import type { PersonChoice } from './types.ts';

/** Who the new connection is for, or null while a new person has neither a name nor «взять имя из банка». */
export function participantChoice(person: PersonChoice, newLabel: string, fromBank: boolean): ParticipantChoice | null {
  if (person !== 'new') return { id: person };
  if (fromBank) return { fromBank: true };
  const label = newLabel.trim();
  return label === '' ? null : { label };
}

/** «1 подключение», «2 подключения», «5 подключений». */
export function connectionsCount(n: number): string {
  const tens = n % 100;
  const ones = n % 10;
  const word = tens >= 11 && tens <= 14 ? 'подключений' : ones === 1 ? 'подключение' : ones >= 2 && ones <= 4 ? 'подключения' : 'подключений';
  return `${n} ${word}`;
}

/** Why a connection was not removed, or '' when there is nothing to say. */
export function removeText(r: Readonly<RemoveConnectionResult>): string {
  if (r.removed || r.reason === 'cancelled') return '';
  return 'Сначала останови импорт: он сейчас записывает эти счета.';
}
