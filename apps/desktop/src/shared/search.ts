// Shared by main and the renderer: the limits of the global search (IPC searchOverview, spec desktop-global-search).

/** The longest text a search sends; zod refuses more. */
export const SEARCH_QUERY_MAX = 100;
/** At most this many transactions in an answer, newest first. */
export const SEARCH_TRANSACTIONS_MAX = 50;
/** At most this many payees and regular payments in an answer. */
export const SEARCH_PAYEES_MAX = 10;
export const SEARCH_RECURRING_MAX = 10;
/** Without dates the search looks this many whole months back (the import's reach) plus the current one. */
export const SEARCH_MONTHS = 36;
