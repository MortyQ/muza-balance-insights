# Design

## Context

See `proposal.md`, «Why», for the measurements. The current state that shapes the approach:

- **The `transactions` row.** It carries the bank item as `raw_json` (column 22 of 28). The hot derived columns
  (`transfer_pair_id`, `transfer_rule`, `refund_pair_id`, `scope`) were appended after it by the v8 rebuild. The
  desktop file is AES-256 encrypted page by page (`packages/db-libsql`), so every page a scan touches is decrypted.
- **Derived values.** Transfer marks, refund pairs, category and scope are already stored columns (`transfers.ts`,
  `refunds.ts`, `categories.ts`, `scope.ts`). They are derived per committed window in `commitRows` (`sync.ts`), and
  in full by `rederiveCore` (`rederive.ts`) at the end of every desktop import (`worker/run-import.ts`), after
  `deleteConnection`, and by `recategorize`.
- **Two write paths share `commitRows`.** It is the write half of `commitWindow` (the API import, in the worker) and
  of `commitStatement` (`statement-import.ts`, a statement file uploaded in desktop main, `main/statements.ts`). A
  statement upload has no end-of-import pass. A new account it creates is a card without an IBAN.
- **Crossing.** «Crosses to a disabled account» is evaluated per query: `crossingCategories` (`accounts.ts`) builds a
  JSON map, and `summaries.ts` and `search.ts` join it as `CROSSING_CTE`. `fx.ts` uses `crossesDisabledSql` inline.
  The enabled state itself (`accountEnabledSql`) is cheap: `accounts` holds a few rows.
- **Bucketing.** Day and month buckets come from a JSON CTE (`periods.ts`). Each row then finds its bucket with a
  correlated subquery (`bucketKeySql`).
- **Desktop data service.** `apps/desktop/src/main/data.ts` composes core statistics in loops (`spendingUsual`,
  `cardTotal` per person, `nowOverview`), and `balancesAt` (`status.ts`) runs up to two queries per account.

This change follows:

- `.agents/project/domain-rules.md` (disabled accounts, transfers, refunds, periods, aggregates);
- `.agents/project/core-people.md` (account toggles, connections);
- `.agents/project/core-providers.md` (the domain reaches providers only through rules);
- `.agents/project/desktop-import.md` (worker phases);
- `.agents/project/mcp-server.md` (tool outputs unchanged).

It updates `domain-rules.md` (crossing is stored; when re-derivation is full or incremental), `core-people.md` (a
toggle refreshes crossing) and `desktop-import.md` (what the `rederive` phase does).

## Goals / Non-Goals

**Goals:**

- No statistic recomputes a derived value, and none reads the bank payload.
- Screen cost does not grow with months of history, people or accounts.
- The figures stay byte-for-byte the same. The existing tests are the oracle, plus an equivalence test between
  incremental and full derivation.
- A harness that keeps it that way when a second provider lands.

**Non-Goals:**

- Moving the database off the Electron main thread, and any caching (change 2). This change makes each query cheap.
  Change 2 makes them not block the UI and not repeat.
- Pre-aggregated tables (daily totals per category). Rejected for now, see D6.
- Any change to the analysis copy's whitelist, MCP tool schemas or the recategorize report.

## Decisions

### D1. The bank payload goes to `transaction_raw`

Migration 16 rebuilds `transactions` with the usual 12-step pattern:

- hot columns first;
- no `raw_json`;
- a new `crossing_category TEXT` (see D3).

It creates `transaction_raw (id TEXT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE, raw_json TEXT NOT NULL)`
and copies the payload. The upsert in `commitRows` writes both rows in the same `batch`, so the API import and a
statement upload store the payload the same way. The cascade keeps
`deleteConnection` correct without touching its statements.

Alternatives:

- `ALTER TABLE … DROP COLUMN raw_json`. Rejected: it cannot move the hot columns forward, and it still rewrites every
  row.
- Keep the payload in the row and only reorder the columns. Rejected: the pages stay ~5× larger, and the measured cost
  is per decrypted page.
- Drop the payload entirely. Rejected: its documented purpose is re-processing without a re-import, which a second
  provider's rules will need.

### D2. One-time compaction after migration 16

A rebuild leaves the file at its old size. `MIGRATIONS` entries get an optional `compact: true`. `migrate()` then runs
`VACUUM` after the migration's transaction, outside it. Compaction is best-effort: a failure (another connection busy)
is reported to the caller and does not fail the migration, because the data is already correct. The next launch does
not retry it. The cost is a one-time wait on first launch, proportional to the file size.

Alternative: leave the file large and rely on page reuse. Rejected: scans would still walk sparse pages until enough
new rows arrived.

### D3. Crossing is a stored column, refreshed by a fingerprint

`crossing_category` is NULL when the row does not cross, otherwise the category it gets as an ordinary operation. The
read expressions keep their meaning:

- `COALESCE(x.value, t.category)` becomes `COALESCE(t.crossing_category, t.category)`;
- `x.key IS NULL` becomes `t.crossing_category IS NULL`.

`CROSSING_CTE` and `crossingCategories` are removed from the read path. `fx.ts` uses the column instead of
`crossesDisabledSql`.

The derivation (a new `derived.ts` module, pure SQL plus the provider rule for `text` rows, moved from `accounts.ts`)
runs in two modes:

- **range mode** in the per-window pass and in incremental re-derivation;
- **full mode** when the fingerprint changes.

The fingerprint is a hash of every account's id, connection, kind, type, currency, title, IBAN and effective enabled
flag. It is stored in a new core-only table `derived_state(key, value)`.

`refreshCrossing(db)` compares the fingerprints and does nothing when they are equal. It is called by:

- `setAccountEnabled`;
- `syncAccounts`;
- `commitRows`, for the API import and statement uploads alike (a first `sync_state` row can flip a jar's auto rule,
  and a statement can create a card, whose type the `text` rule reads);
- `deleteConnection`;
- every opener right after `migrate()` (desktop main, worker, MCP).

Writers call it; readers never write.

Alternatives:

- An in-memory cache of `crossingCategories` keyed by the enabled set. Rejected:
  - it is per process (main, worker, MCP);
  - the first statistic of every period still pays the full scan;
  - invalidation is the same problem without durability.
- Three derived columns (effective category, effective internal flag, effective rule). Rejected: one nullable column
  carries the same information. The existing expressions map onto it one to one.
- Materialising `accounts.enabled`. Rejected: `accounts` is tiny, and the subquery is planned once per statement.

### D4. Bucketing as a range join

`BUCKETS_CTE` stays: zone-aware, right across DST. Rows are matched by a join,
`buckets b CROSS JOIN transactions t ON t.time >= b.s AND t.time < b.e`. The `CROSS JOIN` makes the buckets the outer
loop, so each bucket is an index range on `time`. `bucketKeySql` is removed.

Alternative: integer arithmetic on a fixed offset. Rejected: it is wrong across DST, which the domain rules require
to be right.

### D5. Indexes by measured plans

The plan below will be checked with `EXPLAIN QUERY PLAN` tests (D8), which assert the index used for the main
statistics:

- keep `idx_tx_time` (period queries) and `idx_tx_account_time` (window commit, `balancesAt`);
- keep the pair indexes;
- drop `idx_tx_description`, `idx_tx_local_date`, `idx_tx_category` and `idx_tx_scope` unless a plan test shows a
  statement that needs one. They are low-selectivity or unused, and each one costs a write per upsert and file pages.

Alternative: a covering index over the statistic columns. Rejected: after D1 the rows are already slim, so a covering
index would roughly double the write cost of every upsert for a small read gain.

### D6. Grouped core queries for the desktop

New internal variants, not in `SPENDING_GROUP_BY` / `INCOME_GROUP_BY`, so MCP tools do not offer them:

- **Multi-month and multi-day results.** These come from the existing `spendingGrid` (category × month or day) and
  `incomeSummary` grouped by `month` / `day`:
  - `spendingUsual` asks once for the whole span of the usual months;
  - `nowOverview` asks once for the widest span (the 30 days before today, last week, the month) by day × category and
    folds today, the week, last week and the month in JS. The per-period `PeriodInfo` values are computed from one
    `periodInfo` call each, which costs no row scans.
- **People.** A participant grouping with the participant-view rules (family transfers count, only own accounts) and
  `participant_id` as a key, so `monthOverview` gets every person's spending and income in one query each. The family
  total keeps its own query: the family view excludes family transfers, so it is not the sum of the people.
- **Balances.** `balancesAt` answers all accounts in one statement: the last non-cancelled row before `endSec` per
  account via `ROW_NUMBER()`, the same-second tie check, and the reverse sum. The current semantics are kept,
  including the `updated_at` bound.

Alternative: a daily aggregate table maintained on write. Rejected for now:
- it needs per-view variants (family / person, scope, crossing) and its own invalidation;
- the measured target is met without it.

### D7. Incremental re-derivation after an import

`commitRows` returns the time span it derived and whether derivation failed.

The worker's run collects the spans and compares two things at the start and at the end: the IBANs of all accounts
and the jar titles. These are the inputs of the `iban` and `text` rules, which can re-mark old rows outside any window.
A new account alone does not count: its rows pair with others only inside the windows that wrote them.

- unchanged and no failure: `rederiveSpans(db, merged spans)` (transfers → refunds → categories → scope → crossing,
  each in range mode);
- otherwise: `rederiveCore` as today.

A statement upload (`commitStatement`) is one window. Its pass inside `commitRows` is already the incremental step. It
runs `rederiveCore` only when that pass failed: a statement brings no IBAN and no jar.

`rederiveCore` keeps its signature and its printed report. It gains the crossing step at its end, and that step prints
nothing. The `rederive` progress phase stays, so the renderer is unchanged.

Alternative: drop the end-of-import pass entirely and rely on the per-window passes. Rejected: a pair whose halves
arrive in windows of different connections may be derived before its partner exists. The span pass over merged spans
is cheap and covers that case.

### D8. Harness: deterministic checks in `pnpm test`, timings in a bench script

- `packages/core/bench/generate.ts` produces fictional accounts, people and operations: transfers, refunds, holds,
  commissions, a disabled jar, two participants, a foreign-currency card and a payload of realistic size. It uses a
  seed, so the data is reproducible.
- `packages/core/bench/run.ts` measures the main statistics on an encrypted temp file and compares them with
  `bench/budgets.ts`. It runs with `pnpm --filter @mono/core bench` (a package script, not a root proxy, not a trust
  anchor), through `node --import tsx`.
- **Query-plan tests** (`tests/query-plans.test.ts`) assert that the main statistics have no full scan of
  `transactions`.
- **Query-count tests** in the desktop (`tests/data-queries.test.ts`) wrap `Db` and assert that each overview's
  number of statements does not grow with months, people or accounts.
- **Equivalence test** (`tests/derived-equivalence.test.ts`): a fictional import in several windows and connections,
  then a full `rederiveCore` on a copy, then a comparison of every derived column.

Budgets are set from the post-change measurement on the reference dataset, with headroom for machine noise. Targets
for the encrypted profile with a disabled jar, against the spike baseline:

- one month summary ≤ 20 ms (from 178);
- the «Spending» overview's core calls ≤ 300 ms in total (from ~4 s);
- 12 months by day ≤ 150 ms (from 541);
- the end-of-import pass of a routine auto-sync ≤ 300 ms (from 5.1 s).

Alternative: timing assertions inside `pnpm test`. Rejected: they are flaky on shared CI runners (Windows especially).
Plans and query counts are deterministic and catch the same regressions earlier.

## Risks / Trade-offs

- **[Risk] Stale crossing if a write path forgets `refreshCrossing`.**
  → The fingerprint makes the call cheap enough to place in every writer. The equivalence test covers import, toggle
  and removal. A test also lists the core functions that change accounts and asserts each one refreshes.
- **[Risk] The rebuild migration and `VACUUM` on a large encrypted file take noticeable time at first launch.**
  → It is one time, and the spike's 48 MB file is copied in seconds. A compaction failure is non-fatal (D2). The
  migration is atomic, so a crash leaves v15 intact.
- **[Risk] Grouped queries drift from the single-period figures** (for example, `PeriodInfo` per sub-period in
  `nowOverview`).
  → The existing `data.test.ts` and `summaries.test.ts` values must pass unchanged. New tests compare grouped results
  against single-period calls on the same fixtures.
- **[Trade-off] An older app version cannot write a v16 database** (its upsert names `raw_json`).
  → Auto-update never offers a lower version (signed manifest, strictly higher). A manual downgrade is not supported,
  as with every earlier migration.
- **[Risk] `recategorize-safety.test.ts` follows the import graph of `rederive.ts`, and the new `derived.ts` joins it.**
  → `derived.ts` imports only core modules and provider rules: no `config.ts`, no `.env`, no output.

## Migration Plan

1. Migration 16 (one transaction):
   - rebuild `transactions` without `raw_json` and with `crossing_category`;
   - create `transaction_raw` and copy the payload;
   - recreate the kept indexes and drop the rest;
   - create `derived_state`.
2. `migrate()` runs `VACUUM` once (best-effort).
3. Every opener calls `refreshCrossing`. The fingerprint is absent, so the first open fills `crossing_category` in
   full mode.
4. Rollback is a code revert before release. After release there is no downgrade (see Risks).
