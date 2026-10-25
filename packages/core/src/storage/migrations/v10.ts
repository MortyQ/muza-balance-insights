import type { Migration } from '../db.ts';

export const v10: Migration = {
  version: 10,
  name: 'connection holder_name; participant and connection color',
  // holder_name: the last holder's name the bank sent (personal data, this database only) — «взять имя из банка»
  // applies it at once. color: a key of colors.ts COLOR_KEYS (spelled out here: a migration never changes), unique per table, NULL = none.
  // Existing rows get the palette in id order; past its length — NULL.
  statements: [
    `ALTER TABLE connections ADD COLUMN holder_name TEXT`,
    `ALTER TABLE participants ADD COLUMN color TEXT CHECK (color IN ('blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'))`,
    `CREATE UNIQUE INDEX uq_participants_color ON participants (color)`,
    `UPDATE participants SET color = (
        WITH palette(i, k) AS (VALUES (0, 'blue'), (1, 'orange'), (2, 'aqua'), (3, 'yellow'), (4, 'magenta'), (5, 'green'), (6, 'violet'), (7, 'red'))
        SELECT k FROM palette WHERE i = (SELECT COUNT(*) FROM participants o WHERE o.id < participants.id))`,
    `ALTER TABLE connections ADD COLUMN color TEXT CHECK (color IN ('blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'))`,
    `CREATE UNIQUE INDEX uq_connections_color ON connections (color)`,
    `UPDATE connections SET color = (
        WITH palette(i, k) AS (VALUES (0, 'blue'), (1, 'orange'), (2, 'aqua'), (3, 'yellow'), (4, 'magenta'), (5, 'green'), (6, 'violet'), (7, 'red'))
        SELECT k FROM palette WHERE i = (SELECT COUNT(*) FROM connections o WHERE o.id < connections.id))`,
  ],
};
