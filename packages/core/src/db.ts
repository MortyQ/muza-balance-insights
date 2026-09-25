// Platform-neutral database contract. Adapters (Node: @mono/db-libsql) implement Db;
// the core only knows this interface and the migrations.

export type SqlValue = null | string | number | bigint | ArrayBuffer | Uint8Array;
export type SqlArg = SqlValue | boolean;
export type Stmt = string | { sql: string; args?: readonly SqlArg[] };
export type Row = Record<string, SqlValue>;
export type ResultSet = { rows: Row[]; rowsAffected: number };

export interface Db {
  execute(stmt: Stmt): Promise<ResultSet>;
  /** One transaction: every statement applies, or none does. */
  batch(stmts: readonly Stmt[]): Promise<void>;
  close(): void;
}

/**
 * Migrations are append-only: never edit an applied entry, add a new one.
 * Each entry runs once, atomically, and is recorded in schema_migrations.
 */
const MIGRATIONS: ReadonlyArray<{ version: number; name: string; statements: string[] }> = [
  {
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
  },
  {
    version: 2,
    name: 'transactions.is_cancelled (soft-delete for holds that disappeared from the API)',
    statements: [
      // 1 = was hold=1 and the API stopped returning it on a re-fetch of the same window.
      // Every query must filter is_cancelled = 0. A later re-appearance resets it to 0 (upsert).
      `ALTER TABLE transactions ADD COLUMN is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK (is_cancelled IN (0, 1))`,
    ],
  },
  {
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
  },
  {
    version: 4,
    name: 'transactions: transfer_pair_id / transfer_rule (internal transfer detection, phase 3)',
    statements: [
      // Set by the post-sync pass in src/transfers.ts, never by the upsert.
      // transfer_pair_id: the other half of a pair; NULL for single-row rules (iban, text).
      `ALTER TABLE transactions ADD COLUMN transfer_pair_id TEXT`,
      `ALTER TABLE transactions ADD COLUMN transfer_rule TEXT
        CHECK (transfer_rule IN ('pair', 'pair_fx', 'jar_reversal', 'iban', 'text'))`,
      `CREATE INDEX IF NOT EXISTS idx_tx_transfer_pair ON transactions (transfer_pair_id)`,
    ],
  },
  {
    version: 5,
    name: "transactions.transfer_rule: allow 'pair_fee' (transfers with a commission)",
    // SQLite can't alter a CHECK constraint — rebuild the table (same pattern as v3, data preserved).
    statements: [
      `CREATE TABLE transactions_v5 (
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
        transfer_rule        TEXT CHECK (transfer_rule IN ('pair', 'pair_fx', 'pair_fee', 'jar_reversal', 'iban', 'text'))
      )`,
      `INSERT INTO transactions_v5 (
        id, account_id, time, local_date, description, mcc, original_mcc, hold, amount, operation_amount,
        currency_code, commission_rate, cashback_amount, balance, comment, counter_name, counter_iban,
        counter_edrpou, receipt_id, category, is_internal_transfer, raw_json, synced_at, is_cancelled,
        transfer_pair_id, transfer_rule)
      SELECT
        id, account_id, time, local_date, description, mcc, original_mcc, hold, amount, operation_amount,
        currency_code, commission_rate, cashback_amount, balance, comment, counter_name, counter_iban,
        counter_edrpou, receipt_id, category, is_internal_transfer, raw_json, synced_at, is_cancelled,
        transfer_pair_id, transfer_rule
      FROM transactions`,
      `DROP TABLE transactions`,
      `ALTER TABLE transactions_v5 RENAME TO transactions`,
      `CREATE INDEX IF NOT EXISTS idx_tx_account_time ON transactions (account_id, time)`,
      `CREATE INDEX IF NOT EXISTS idx_tx_time ON transactions (time)`,
      `CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions (category)`,
      `CREATE INDEX IF NOT EXISTS idx_tx_description ON transactions (description)`,
      `CREATE INDEX IF NOT EXISTS idx_tx_local_date ON transactions (local_date)`,
      `CREATE INDEX IF NOT EXISTS idx_tx_transfer_pair ON transactions (transfer_pair_id)`,
    ],
  },
  {
    version: 6,
    name: 'transactions.refund_pair_id (a purchase and its refund that came with a different MCC)',
    statements: [
      // Set on both rows by src/refunds.ts; the refund takes the purchase's category. Not a transfer.
      `ALTER TABLE transactions ADD COLUMN refund_pair_id TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_tx_refund_pair ON transactions (refund_pair_id)`,
    ],
  },
  {
    version: 7,
    name: 'transactions.scope (personal | business), scope_overrides, settings',
    statements: [
      // Computed by src/scope.ts after categories; 'personal' until the first pass.
      `ALTER TABLE transactions ADD COLUMN scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'business'))`,
      `CREATE INDEX IF NOT EXISTS idx_tx_scope ON transactions (scope)`,
      `CREATE TABLE IF NOT EXISTS scope_overrides (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern    TEXT NOT NULL,   -- matched against counter_name, like category_overrides
        match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'contains')),
        scope      TEXT NOT NULL CHECK (scope IN ('personal', 'business')),
        UNIQUE (pattern, match_type)
      )`,
      // Only non-default values are stored; defaults live in src/settings.ts.
      `CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    ],
  },
];

export const SCHEMA_VERSION = MIGRATIONS.at(-1)?.version ?? 0;

/** Applies pending migrations; `nowSec` is recorded as applied_at (the core never reads the clock itself). */
export async function migrate(db: Db, nowSec: number): Promise<number[]> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )`,
  );
  const applied = new Set(
    (await db.execute('SELECT version FROM schema_migrations')).rows.map((r) => Number(r.version)),
  );
  const newlyApplied: number[] = [];
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    // batch() is a single transaction: a migration applies fully or not at all.
    await db.batch(
      [
        ...m.statements.map((sql) => ({ sql, args: [] })),
        {
          sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
          args: [m.version, m.name, nowSec],
        },
      ],
    );
    newlyApplied.push(m.version);
  }
  return newlyApplied;
}
