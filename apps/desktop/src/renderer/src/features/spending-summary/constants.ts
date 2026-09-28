import type { Scope } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

/** The scope switch; labels are dictionary keys, the feature translates them. */
export const SCOPES: ReadonlyArray<{ label: MessageKey; value: Scope }> = [
  { label: 'home.spending.scope.personal', value: 'personal' },
  { label: 'home.spending.scope.business', value: 'business' },
];
