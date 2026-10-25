import type { Migration } from '../db.ts';

export const v08: Migration = {
  version: 8,
  name: 'participants, connections; accounts.connection_id, api_calls.connection_id; transfer_rule += family',
  // accounts gets a NOT NULL foreign key, which ADD COLUMN can't do → rebuild. foreign_keys is ON and a PRAGMA can't
  // change inside the migration's transaction, so the parent is renamed away first (its children's references follow
  // it), the children are rebuilt against the new accounts, and only then the old parent is dropped.
  // Existing data → one participant «Я» + one Monobank connection; an empty database gets none (ensureDefaultConnection).
  // No clock: created_at comes from the accounts' own updated_at.
  statements: [
    `CREATE TABLE participants (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        label      TEXT NOT NULL,              -- the user's own name for the person; never leaves the database
        sort       INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
    `CREATE TABLE connections (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id     INTEGER NOT NULL REFERENCES participants(id),
        provider           TEXT NOT NULL,      -- providers/types.ts PROVIDER_IDS; checked in code (a new bank = no rebuild)
        external_client_id TEXT,               -- the bank's id of the account holder (Monobank clientId); NULL until known
        created_at         INTEGER NOT NULL,
        UNIQUE (provider, external_client_id)
      )`,
    `INSERT INTO participants (id, label, sort, created_at)
        SELECT 1, 'Я', 0, (SELECT MAX(updated_at) FROM accounts) WHERE EXISTS (SELECT 1 FROM accounts)`,
    `INSERT INTO connections (id, participant_id, provider, external_client_id, created_at)
        SELECT 1, 1, 'monobank', NULL, created_at FROM participants WHERE id = 1`,

    `ALTER TABLE accounts RENAME TO accounts_old`,
    `CREATE TABLE accounts (
        id            TEXT PRIMARY KEY,
        connection_id INTEGER NOT NULL REFERENCES connections(id),
        kind          TEXT NOT NULL CHECK (kind IN ('card', 'jar')),
        type          TEXT,               -- the provider's account type (Monobank: black/white/fop …); NULL for jars
        currency_code INTEGER NOT NULL,   -- ISO 4217 numeric
        iban          TEXT,               -- NULL for jars
        masked_pan    TEXT,               -- JSON array of strings; NULL for jars
        title         TEXT,               -- jar title; NULL for cards
        goal          INTEGER,            -- jar goal, minor units; NULL for cards
        balance       INTEGER NOT NULL,   -- minor units
        credit_limit  INTEGER,            -- minor units; NULL for jars
        updated_at    INTEGER NOT NULL    -- unix seconds
      )`,
    `INSERT INTO accounts (id, connection_id, kind, type, currency_code, iban, masked_pan, title, goal, balance, credit_limit, updated_at)
        SELECT id, 1, kind, type, currency_code, iban, masked_pan, title, goal, balance, credit_limit, updated_at FROM accounts_old`,
    `CREATE INDEX IF NOT EXISTS idx_accounts_connection ON accounts (connection_id)`,

    `CREATE TABLE transactions_v8 (
        id                   TEXT PRIMARY KEY,
        account_id           TEXT NOT NULL REFERENCES accounts(id),
        time                 INTEGER NOT NULL,  -- unix seconds, UTC
        local_date           TEXT NOT NULL,     -- YYYY-MM-DD in Europe/Kyiv, derived from time
        description          TEXT NOT NULL DEFAULT '',  -- '' if the API sent none
        mcc                  INTEGER NOT NULL,
        original_mcc         INTEGER,
        hold                 INTEGER NOT NULL CHECK (hold IN (0, 1)),
        amount               INTEGER NOT NULL,  -- account currency, minor units; < 0 = debit; includes the commission
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
        is_cancelled         INTEGER NOT NULL DEFAULT 0 CHECK (is_cancelled IN (0, 1)),
        transfer_pair_id     TEXT,
        transfer_rule        TEXT CHECK (transfer_rule IN ('pair', 'pair_fx', 'pair_fee', 'jar_reversal', 'iban', 'text', 'family')),
        refund_pair_id       TEXT,
        scope                TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'business'))
      )`,
    `INSERT INTO transactions_v8 (
        id, account_id, time, local_date, description, mcc, original_mcc, hold, amount, operation_amount,
        currency_code, commission_rate, cashback_amount, balance, comment, counter_name, counter_iban,
        counter_edrpou, receipt_id, category, is_internal_transfer, raw_json, synced_at, is_cancelled,
        transfer_pair_id, transfer_rule, refund_pair_id, scope)
      SELECT
        id, account_id, time, local_date, description, mcc, original_mcc, hold, amount, operation_amount,
        currency_code, commission_rate, cashback_amount, balance, comment, counter_name, counter_iban,
        counter_edrpou, receipt_id, category, is_internal_transfer, raw_json, synced_at, is_cancelled,
        transfer_pair_id, transfer_rule, refund_pair_id, scope
      FROM transactions`,
    `DROP TABLE transactions`,
    `ALTER TABLE transactions_v8 RENAME TO transactions`,
    `CREATE INDEX IF NOT EXISTS idx_tx_account_time ON transactions (account_id, time)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_time ON transactions (time)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions (category)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_description ON transactions (description)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_local_date ON transactions (local_date)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_transfer_pair ON transactions (transfer_pair_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_refund_pair ON transactions (refund_pair_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_scope ON transactions (scope)`,

    `CREATE TABLE sync_state_v8 (
        account_id         TEXT PRIMARY KEY REFERENCES accounts(id),
        oldest_synced_time INTEGER,  -- unix seconds: [oldest, newest] is fully covered
        newest_synced_time INTEGER,
        last_sync_at       INTEGER   -- unix seconds, wall clock of the last successful window
      )`,
    `INSERT INTO sync_state_v8 (account_id, oldest_synced_time, newest_synced_time, last_sync_at)
        SELECT account_id, oldest_synced_time, newest_synced_time, last_sync_at FROM sync_state`,
    `DROP TABLE sync_state`,
    `ALTER TABLE sync_state_v8 RENAME TO sync_state`,

    `DROP TABLE accounts_old`,

    // The request slot is per connection (a bank's limit is per credential). NULL = calls made without one (tests).
    `ALTER TABLE api_calls ADD COLUMN connection_id INTEGER REFERENCES connections(id)`,
    `UPDATE api_calls SET connection_id = 1 WHERE EXISTS (SELECT 1 FROM connections WHERE id = 1)`,
  ],
};
