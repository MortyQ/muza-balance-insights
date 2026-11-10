/** The rate presets, per cent of income, in the order offered: the 3rd group's 5%, its 1% (VAT payers), 6%. */
export const FOP_RATES = [5, 1, 6] as const;
/** A custom percent: above 0, at most this. */
export const PERCENT_MAX = 100;
/** A typed amount, hryvnias: at most this (keeps kopecks a safe integer). */
export const AMOUNT_MAX = 1_000_000_000_000;
/** How many years back the year picker goes (the import reaches 36 months back). */
export const YEARS_BACK = 3;
