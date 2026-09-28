import type { ColorKey } from '@contract/colors.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

/** The switch value of «Whole family» (participant ids are positive). */
export const FAMILY = 0;

/** Remembered switch position: a convenience of this computer only, never data. */
export const SELECTED_KEY = 'balance.participant';

/** Dictionary keys of the palette's colour names: the swatch's accessible name. */
export const COLOR_NAMES = {
  blue: 'entities.color.blue',
  orange: 'entities.color.orange',
  aqua: 'entities.color.aqua',
  yellow: 'entities.color.yellow',
  magenta: 'entities.color.magenta',
  green: 'entities.color.green',
  violet: 'entities.color.violet',
  red: 'entities.color.red',
} as const satisfies Record<ColorKey, MessageKey>;
