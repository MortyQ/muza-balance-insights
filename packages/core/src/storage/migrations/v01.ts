import type { Migration } from '../db.ts';

export const v01: Migration = {
  version: 1,
  name: 'initial schema',
  statements: [
    `CREATE TABLE IF NOT EXISTS accounts (
        id            TEXT PRIMARY KEY,
        kind          TEXT NOT NULL CHECK (kind IN ('card', 'jar')),
        type          TEXT,               -- black/white/platinum/iron/fop/yellow/eAid; NULL for jars
        currency_code INTEGER NOT NULL,   -- ISO 4217 numeric
        iban          TEXT,               -- NULL for jars
        masked_pan    TEXT,               -- JSON array of strings; NULL for jars
        title         TEXT,               -- jar title; NULL for cards
        goal          INTEGER,            -- jar goal, minor units; NULL for cards
        balance       INTEGER NOT NULL,   -- minor units
        credit_limit  INTEGER,            -- minor units; NULL for jars
        updated_at    INTEGER NOT NULL    -- unix seconds
      )`,
    `CREATE TABLE IF NOT EXISTS transactions (
        id                   TEXT PRIMARY KEY,
        account_id           TEXT NOT NULL REFERENCES accounts(id),
        time                 INTEGER NOT NULL,  -- unix seconds, UTC
        local_date           TEXT NOT NULL,     -- YYYY-MM-DD in Europe/Kyiv, derived from time
        description          TEXT NOT NULL DEFAULT '',
        mcc                  INTEGER,
        original_mcc         INTEGER,
        hold                 INTEGER NOT NULL DEFAULT 0 CHECK (hold IN (0, 1)),
        amount               INTEGER NOT NULL,  -- account currency, minor units; < 0 = debit
        operation_amount     INTEGER NOT NULL,  -- operation currency, minor units
        currency_code        INTEGER NOT NULL,  -- operation currency (ISO 4217 numeric)
        commission_rate      INTEGER NOT NULL DEFAULT 0,  -- API name; actually a commission AMOUNT in minor units
        cashback_amount      INTEGER NOT NULL DEFAULT 0,
        balance              INTEGER NOT NULL,
        comment              TEXT,
        counter_name         TEXT,
        counter_iban         TEXT,
        counter_edrpou       TEXT,
        receipt_id           TEXT,
        category             TEXT NOT NULL DEFAULT 'другое',  -- computed on write
        is_internal_transfer INTEGER NOT NULL DEFAULT 0 CHECK (is_internal_transfer IN (0, 1)),  -- computed
        raw_json             TEXT NOT NULL,     -- original API item, for re-processing
        synced_at            INTEGER NOT NULL   -- unix seconds
      )`,
    `CREATE INDEX IF NOT EXISTS idx_tx_account_time ON transactions (account_id, time)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_time ON transactions (time)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions (category)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_description ON transactions (description)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_local_date ON transactions (local_date)`,
    `CREATE TABLE IF NOT EXISTS sync_state (
        account_id         TEXT PRIMARY KEY REFERENCES accounts(id),
        oldest_synced_time INTEGER,  -- unix seconds: [oldest, newest] is fully covered
        newest_synced_time INTEGER,
        last_sync_at       INTEGER   -- unix seconds, wall clock of the last successful window
      )`,
    `CREATE TABLE IF NOT EXISTS api_calls (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint  TEXT NOT NULL,
        called_at INTEGER NOT NULL  -- unix MILLISECONDS; shared rate-limit slot across processes
      )`,
    `CREATE INDEX IF NOT EXISTS idx_api_calls_called_at ON api_calls (called_at)`,
    `CREATE TABLE IF NOT EXISTS category_overrides (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern    TEXT NOT NULL,
        match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'contains')),
        category   TEXT NOT NULL,
        UNIQUE (pattern, match_type)
      )`,
  ],
};
