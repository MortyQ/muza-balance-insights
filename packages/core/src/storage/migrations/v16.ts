import type { Migration } from '../db.ts';

export const v16: Migration = {
  version: 16,
  name: 'transaction_raw; transactions hot columns first, crossing_category, nullable mcc; derived_state',
  // Statistics scan transactions page by page (decrypting each page), so the row keeps only what they read, hot
  // columns first; the bank's item moves to transaction_raw (kept for re-processing, read by no statistic).
  // crossing_category: the category a row gets when it crosses to a disabled account (NULL = it does not); filled
  // by derived.ts. mcc loses NOT NULL: a bank without MCCs is not forced to invent one.
  // Order matters: the old indexes are dropped first (their names are reused), the old table is renamed away
  // before transaction_raw exists (dropping a parent cascades into its children), and nothing references it.
  // derived_state: core-only bookkeeping of derived values (the accounts fingerprint of derived.ts).
  compact: true,
  statements: [
    `DROP INDEX IF EXISTS idx_tx_account_time`,
    `DROP INDEX IF EXISTS idx_tx_time`,
    `DROP INDEX IF EXISTS idx_tx_category`,
    `DROP INDEX IF EXISTS idx_tx_description`,
    `DROP INDEX IF EXISTS idx_tx_local_date`,
    `DROP INDEX IF EXISTS idx_tx_transfer_pair`,
    `DROP INDEX IF EXISTS idx_tx_refund_pair`,
    `DROP INDEX IF EXISTS idx_tx_scope`,
    `ALTER TABLE transactions RENAME TO transactions_old`,
    `CREATE TABLE transactions (
        id                   TEXT PRIMARY KEY,
        account_id           TEXT NOT NULL REFERENCES accounts(id),
        time                 INTEGER NOT NULL,  -- unix seconds, UTC
        amount               INTEGER NOT NULL,  -- account currency, minor units; < 0 = debit; includes the commission
        commission_rate      INTEGER,           -- API name; actually a commission AMOUNT in minor units
        hold                 INTEGER NOT NULL CHECK (hold IN (0, 1)),
        is_cancelled         INTEGER NOT NULL DEFAULT 0 CHECK (is_cancelled IN (0, 1)),
        is_internal_transfer INTEGER NOT NULL DEFAULT 0 CHECK (is_internal_transfer IN (0, 1)),
        transfer_rule        TEXT CHECK (transfer_rule IN ('pair', 'pair_fx', 'pair_fee', 'jar_reversal', 'iban', 'text', 'family')),
        transfer_pair_id     TEXT,
        refund_pair_id       TEXT,
        category             TEXT NOT NULL DEFAULT 'другое',
        crossing_category    TEXT,              -- the category when the row crosses to a disabled account; NULL = it does not
        scope                TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'business')),
        mcc                  INTEGER,           -- NULL = the bank sends none
        currency_code        INTEGER NOT NULL,  -- operation currency (ISO 4217 numeric)
        operation_amount     INTEGER,           -- operation currency, minor units
        cashback_amount      INTEGER,
        balance              INTEGER,
        counter_iban         TEXT,
        counter_edrpou       TEXT,
        description          TEXT NOT NULL DEFAULT '',  -- '' if the bank sent none
        counter_name         TEXT,
        comment              TEXT,
        original_mcc         INTEGER,
        receipt_id           TEXT,
        local_date           TEXT NOT NULL,     -- YYYY-MM-DD in Europe/Kyiv, derived from time
        synced_at            INTEGER NOT NULL
      )`,
    `INSERT INTO transactions (
        id, account_id, time, amount, commission_rate, hold, is_cancelled, is_internal_transfer, transfer_rule,
        transfer_pair_id, refund_pair_id, category, scope, mcc, currency_code, operation_amount, cashback_amount,
        balance, counter_iban, counter_edrpou, description, counter_name, comment, original_mcc, receipt_id,
        local_date, synced_at)
      SELECT
        id, account_id, time, amount, commission_rate, hold, is_cancelled, is_internal_transfer, transfer_rule,
        transfer_pair_id, refund_pair_id, category, scope, mcc, currency_code, operation_amount, cashback_amount,
        balance, counter_iban, counter_edrpou, description, counter_name, comment, original_mcc, receipt_id,
        local_date, synced_at
      FROM transactions_old`,
    `CREATE TABLE transaction_raw (
        id       TEXT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
        raw_json TEXT NOT NULL  -- the bank's item as received
      )`,
    `INSERT INTO transaction_raw (id, raw_json) SELECT id, raw_json FROM transactions_old`,
    `DROP TABLE transactions_old`,
    `CREATE INDEX idx_tx_account_time ON transactions (account_id, time)`,
    `CREATE INDEX idx_tx_time ON transactions (time)`,
    `CREATE INDEX idx_tx_transfer_pair ON transactions (transfer_pair_id)`,
    `CREATE INDEX idx_tx_refund_pair ON transactions (refund_pair_id)`,
    `CREATE TABLE derived_state (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
  ],
};
