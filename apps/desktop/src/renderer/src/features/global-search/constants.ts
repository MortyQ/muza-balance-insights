import type { CategoryId } from '@contract/categories.ts';
import { CATEGORY_IDS } from '@contract/categories.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
import type { SearchGroupId } from './types.ts';

/** The pause after the last keystroke before the search asks main. */
export const SEARCH_DEBOUNCE_MS = 200;

/** At most this many categories by name. */
export const CATEGORIES_MAX = 5;

/** The categories a search finds by name: those with a category screen of spending (not income or own transfers). */
export const SEARCHABLE_CATEGORIES: ReadonlyArray<CategoryId> = CATEGORY_IDS.filter((id) => id !== 'income' && id !== 'ownTransfers');

/** The groups in the order they are listed, with their headings. */
export const GROUPS: ReadonlyArray<{ id: SearchGroupId; title: MessageKey }> = [
  { id: 'transactions', title: 'search.group.transactions' },
  { id: 'payees', title: 'search.group.payees' },
  { id: 'categories', title: 'search.group.categories' },
  { id: 'recurring', title: 'search.group.recurring' },
];
