import type { ColorKey } from '@contract/colors.ts';

/** The switch value of «Вся семья» (participant ids are positive). */
export const FAMILY = 0;

/** Remembered switch position: a convenience of this computer only, never data. */
export const SELECTED_KEY = 'balance.participant';

/** Names of the palette's colours: the swatch's accessible name. */
export const COLOR_NAMES = {
  blue: 'Синий',
  orange: 'Оранжевый',
  aqua: 'Бирюзовый',
  yellow: 'Жёлтый',
  magenta: 'Розовый',
  green: 'Зелёный',
  violet: 'Фиолетовый',
  red: 'Красный',
} as const satisfies Record<ColorKey, string>;

/** A colour another person or connection took meanwhile. */
export const COLOR_TAKEN_TEXT = 'Этот цвет уже занят — выбери другой.';
