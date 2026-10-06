import type { MessageKey } from '@contract/i18n/index.ts';
import type { CurrencyKey, MainCurrency } from './types.ts';

/** The currencies of the switch, in menu order. */
export const CURRENCIES: ReadonlyArray<{ currency: MainCurrency; key: CurrencyKey; label: MessageKey }> = [
  { currency: 980, key: 'uah', label: 'entities.currencyDisplay.uah' },
  { currency: 840, key: 'usd', label: 'entities.currencyDisplay.usd' },
  { currency: 978, key: 'eur', label: 'entities.currencyDisplay.eur' },
];

/** localStorage key of the choice (a convenience: defaults when storage is unavailable). */
export const STORAGE_KEY = 'home.currencies';

/** Where the spending block kept the choice before it became home-wide: read once, then STORAGE_KEY. */
export const LEGACY_KEY = 'spending.view';
