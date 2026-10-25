import type { Migration } from '../db.ts';

export const v04: Migration = {
  version: 4,
  name: 'transactions: transfer_pair_id / transfer_rule (internal transfer detection, phase 3)',
  statements: [
    // Set by the post-sync pass in src/derive/transfers.ts, never by the upsert.
    // transfer_pair_id: the other half of a pair; NULL for single-row rules (iban, text).
    `ALTER TABLE transactions ADD COLUMN transfer_pair_id TEXT`,
    `ALTER TABLE transactions ADD COLUMN transfer_rule TEXT
        CHECK (transfer_rule IN ('pair', 'pair_fx', 'jar_reversal', 'iban', 'text'))`,
    `CREATE INDEX IF NOT EXISTS idx_tx_transfer_pair ON transactions (transfer_pair_id)`,
  ],
};
