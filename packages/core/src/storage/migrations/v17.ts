import type { Migration } from '../db.ts';

export const v17: Migration = {
  version: 17,
  name: 'bank_category, transfer_fee',
  // bank_category: the bank's own category of an operation, as the bank states it (a provider maps it in its rules;
  // NULL = the bank states none). Bank text: this database only, never the analysis copy.
  // transfer_fee: the implicit fee of a transfer between two banks, on the sending row (derived, transfers.ts;
  // NULL = none). Added columns, no rebuild: migration 16 rebuilt the table already, and nothing here needs a CHECK.
  statements: [`ALTER TABLE transactions ADD COLUMN bank_category TEXT`, `ALTER TABLE transactions ADD COLUMN transfer_fee INTEGER`],
};
