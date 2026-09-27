// The colour of a participant: a key of one fixed palette (the desktop app maps each key to its shade in the light and
// the dark theme). Unique among participants; NULL = none (the palette ran out, or a row from before it existed and
// past its length). connections.color (migration v10) stays in the schema but is no longer read or written: new
// connections get NULL.
import type { Db } from './db.ts';

/** Categorical order; a new row takes the first free one. No ninth colour is generated. */
export const COLOR_KEYS = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];

export type ColorTable = 'participants';

export class ColorTakenError extends Error {
  override name = 'ColorTakenError';
  constructor() {
    super('Этот цвет уже занят');
  }
}

export function parseColor(value: unknown): ColorKey | null {
  return COLOR_KEYS.find((k) => k === value) ?? null;
}

export async function takenColors(db: Db, table: ColorTable, exceptId?: number): Promise<Set<ColorKey>> {
  const rs = await db.execute({ sql: `SELECT color FROM ${table} WHERE color IS NOT NULL AND id <> ?`, args: [exceptId ?? -1] });
  return new Set(rs.rows.map((r) => parseColor(r.color)).filter((c) => c !== null));
}

export async function firstFreeColor(db: Db, table: ColorTable): Promise<ColorKey | null> {
  const taken = await takenColors(db, table);
  return COLOR_KEYS.find((k) => !taken.has(k)) ?? null;
}

/** The colour a new row gets: the one asked for (if free), or the first free one. */
export async function colorForNew(db: Db, table: ColorTable, asked: ColorKey | undefined): Promise<ColorKey | null> {
  if (asked === undefined) return firstFreeColor(db, table);
  if ((await takenColors(db, table)).has(asked)) throw new ColorTakenError();
  return asked;
}
