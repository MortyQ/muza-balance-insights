// Constants with no dependency on .env or the token (config.ts re-exports them).

export const TIMEZONE = 'Europe/Kyiv';

/** Monobank personal endpoints: at most one request per 60 s. */
export const RATE_LIMIT_MS = 60_000;

/** Max statement window: 31 days + 1 hour (per api.monobank.ua docs). */
export const MAX_STATEMENT_WINDOW_SEC = 2_682_000;

/** If a statement response has this many items, it may be truncated → paginate. */
export const STATEMENT_PAGE_LIMIT = 500;

/** Incremental sync always re-fetches this many days to catch changed holds. */
export const RESYNC_OVERLAP_SEC = 3 * 24 * 3600;
