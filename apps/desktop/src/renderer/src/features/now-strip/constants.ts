/** A day with spending is at least this tall (% of the week's largest day), so it stays visible. */
export const MIN_BAR = 6;

/** localStorage key of the category panel's choices (a convenience: defaults when storage is unavailable). */
export const PREFS_KEY = 'now.categories';

/** How many categories the «Today» and «This week» tiles list; the rest are in the details. */
export const SHOWN_CATEGORIES = 5;

/**
 * The smallest base, in hryvnia kopecks, whose change the «Today» / «This week» chips say in per cent too: below it a
 * single purchase swings the percent wildly, so the chip says the money alone.
 */
export const PERCENT_MIN_BASE = { usual: 100_000, week: 500_000 } as const;
