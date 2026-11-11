import type { MessageKey } from '@contract/i18n/index.ts';
import { APP_CURRENCIES, type AppCurrency, type AppCurrencyKey } from '@contract/currencies.ts';

/** The currencies of the switch, in menu order: the app's one list (core's `APP_CURRENCIES`). */
export const CURRENCIES: ReadonlyArray<{ currency: AppCurrency; key: AppCurrencyKey; label: MessageKey }> = APP_CURRENCIES.map((c) => ({
  currency: c.code,
  key: c.key,
  label: `entities.currencyDisplay.${c.key}` as const,
}));

/** localStorage key of the choice (a convenience: defaults when storage is unavailable). */
export const STORAGE_KEY = 'home.currencies';

/** Where the spending block kept the choice before it became home-wide: read once, then STORAGE_KEY. */
export const LEGACY_KEY = 'spending.view';
