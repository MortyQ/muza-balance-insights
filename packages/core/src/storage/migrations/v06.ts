import type { Migration } from '../db.ts';

export const v06: Migration = {
  version: 6,
  name: 'transactions.refund_pair_id (a purchase and its refund that came with a different MCC)',
  statements: [
    // Set on both rows by src/derive/refunds.ts; the refund takes the purchase's category. Not a transfer.
    `ALTER TABLE transactions ADD COLUMN refund_pair_id TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_tx_refund_pair ON transactions (refund_pair_id)`,
  ],
};
