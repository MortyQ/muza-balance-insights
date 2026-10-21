// Constants with no dependency on .env or the token (apps/mcp config.ts re-exports them).
// A bank's own limits live with its provider (providers/<id>/constants.ts).

export const TIMEZONE = 'Europe/Kyiv';

/** Incremental sync always re-fetches this many days to catch changed holds. */
export const RESYNC_OVERLAP_SEC = 3 * 24 * 3600;
