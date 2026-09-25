// Monobank personal API limits (api.monobank.ua docs).

/** Personal endpoints: at most one request per 60 s. */
export const RATE_LIMIT_MS = 60_000;

/** Max statement window: 31 days + 1 hour. */
export const MAX_STATEMENT_WINDOW_SEC = 2_682_000;

/** If a statement response has this many items, it may be truncated → paginate. */
export const STATEMENT_PAGE_LIMIT = 500;
