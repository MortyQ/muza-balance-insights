import type { Migration } from '../db.ts';

export const v03: Migration = {
  version: 3,
  name: 'transactions: optional API fields become nullable (NULL = the API did not send it)',
  // SQLite can't drop NOT NULL via ALTER — rebuild the table (standard 12-step pattern, data preserved).
  statements: [
    `CREATE TABLE transactions_v3 (
        id                   TEXT PRIMARY KEY,
        account_id           TEXT NOT NULL REFERENCES accounts(id),
        time                 INTEGER NOT NULL,  -- unix seconds, UTC
        local_date           TEXT NOT NULL,     -- YYYY-MM-DD in Europe/Kyiv, derived from time
        description          TEXT NOT NULL DEFAULT '',  -- '' if the API sent none
        mcc                  INTEGER NOT NULL,
        original_mcc         INTEGER,
        hold                 INTEGER NOT NULL CHECK (hold IN (0, 1)),
        amount               INTEGER NOT NULL,  -- account currency, minor units; < 0 = debit
        operation_amount     INTEGER,           -- operation currency, minor units
        currency_code        INTEGER NOT NULL,  -- operation currency (ISO 4217 numeric)
        commission_rate      INTEGER,           -- API name; actually a commission AMOUNT in minor units
        cashback_amount      INTEGER,
        balance              INTEGER,
        comment              TEXT,
        counter_name         TEXT,
        counter_iban         TEXT,
        counter_edrpou       TEXT,
        receipt_id           TEXT,
        category             TEXT NOT NULL DEFAULT 'другое',
        is_internal_transfer INTEGER NOT NULL DEFAULT 0 CHECK (is_internal_transfer IN (0, 1)),
        raw_json             TEXT NOT NULL,
        synced_at            INTEGER NOT NULL,
        is_cancelled         INTEGER NOT NULL DEFAULT 0 CHECK (is_cancelled IN (0, 1))
      )`,
    `INSERT INTO transactions_v3 (
        id, account_id, time, local_date, description, mcc, original_mcc, hold, amount, operation_amount,
        currency_code, commission_rate, cashback_amount, balance, comment, counter_name, counter_iban,
        counter_edrpou, receipt_id, category, is_internal_transfer, raw_json, synced_at, is_cancelled)
      SELECT
        id, account_id, time, local_date, description, COALESCE(mcc, 0), original_mcc, hold, amount, operation_amount,
        currency_code, commission_rate, cashback_amount, balance, comment, counter_name, counter_iban,
        counter_edrpou, receipt_id, category, is_internal_transfer, raw_json, synced_at, is_cancelled
      FROM transactions`,
    `DROP TABLE transactions`,
    `ALTER TABLE transactions_v3 RENAME TO transactions`,
    `CREATE INDEX IF NOT EXISTS idx_tx_account_time ON transactions (account_id, time)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_time ON transactions (time)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions (category)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_description ON transactions (description)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_local_date ON transactions (local_date)`,
  ],
};
