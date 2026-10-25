import type { Migration } from '../db.ts';

export const v14: Migration = {
  version: 14,
  name: 'reserve_owner',
  // Whose reserve it is: counted for that person and the family; null — common, counted for the family only. A
  // removed person's reserves become common. With one person only, the reserves so far are theirs.
  statements: [
    `ALTER TABLE reserves ADD COLUMN participant_id INTEGER REFERENCES participants(id) ON DELETE SET NULL`,
    `UPDATE reserves SET participant_id = (SELECT id FROM participants)
       WHERE participant_id IS NULL AND (SELECT COUNT(*) FROM participants) = 1`,
  ],
};
