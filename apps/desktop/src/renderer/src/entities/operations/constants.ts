/** A bar with a value is at least this tall (% of the largest), so it stays visible. */
export const MIN_BAR = 4;

/** The list's order. */
export const SORTS = ['date', 'amount'] as const;

/** The list's columns: when, the text, who, marks, amount (header and rows alike). */
export const OPERATION_COLS = 'grid grid-cols-[7.5rem_minmax(0,1fr)_10rem_11rem_8rem] gap-3';
