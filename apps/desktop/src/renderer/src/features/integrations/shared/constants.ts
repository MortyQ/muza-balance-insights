import type { MessageKey } from '@contract/i18n/index.ts';

// Dictionary keys: the texts are translated where they are shown.

export const TOKEN_ERROR_TEXT: MessageKey = 'integrations.tokenError';

/** Under a disabled account in «Accounts». */
export const DISABLED_ACCOUNT_HINT: MessageKey = 'integrations.accounts.disabledHint';

/** While an import runs the switches in «Accounts» are off. */
export const IMPORT_RUNNING_ACCOUNTS_TEXT: MessageKey = 'integrations.accounts.importRunning';

/** An action in a connection's menu of rare actions. */
export const MENU_ITEM_CLASS =
  'flex h-(--control-h-md) cursor-pointer items-center rounded-md px-(--control-px) text-left font-medium transition-colors duration-120 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none';
