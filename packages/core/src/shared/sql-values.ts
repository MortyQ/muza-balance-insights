// Reading nullable SQL values: NULL stays null, never 0 or the string 'null'.

export const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export const textOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
