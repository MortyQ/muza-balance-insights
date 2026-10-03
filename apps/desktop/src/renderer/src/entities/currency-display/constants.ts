import type { SpendingFx } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

/** The «≈» currencies and their switch labels, in menu order. */
export const FX_CURRENCIES: ReadonlyArray<{ currency: SpendingFx['currency']; key: 'usd' | 'eur'; label: MessageKey }> = [
  { currency: 840, key: 'usd', label: 'entities.currencyDisplay.usd' },
  { currency: 978, key: 'eur', label: 'entities.currencyDisplay.eur' },
];

/** localStorage key of the choice (a convenience: defaults when storage is unavailable). */
export const STORAGE_KEY = 'home.currencies';

/** Where the spending block kept the choice before it became home-wide: read once, then STORAGE_KEY. */
export const LEGACY_KEY = 'spending.view';
