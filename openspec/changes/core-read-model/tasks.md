# Tasks

## 1. Performance harness and baseline — `feat(core): performance harness`

- [x] 1.1 Add `packages/core/bench/generate.ts`: a seeded generator of fictional data.
  - It covers two participants, cards in two currencies, a jar disabled by the auto rule, and transfers (pair,
    pair_fx, pair_fee, iban, text, family).
  - It also covers refunds, holds, commissions, and a payload of about 1 KB per operation.
  - Verify: a unit test asserts the same seed gives the same rows, and that the rows contain no real-looking IBAN or
    name.
- [x] 1.2 Add `packages/core/bench/run.ts` and `bench/budgets.ts`, plus a `bench` script in
  `packages/core/package.json` (`node --import tsx bench/run.ts`).
  - The script measures one month by category, income by source, 12 months by month, 12 months by day, the
    «Spending»-equivalent set, the full re-derivation and `balancesAt`.
  - It runs on an encrypted temp file, prints a table, and exits non-zero when a case exceeds its budget.
  - Verify: `pnpm --filter @mono/core bench` runs and prints the baseline.
- [x] 1.3 Record the baseline table in the change folder (`openspec/changes/core-read-model/baseline.md`). Set the
  temporary budgets at baseline + 20%.
  - Verify: the bench passes against them.

## 2. Bank payload out of the scanned table — `feat(core): transaction payload table`

- [x] 2.1 Add migration 16 (design D1, D5):
  - rebuild `transactions` with hot columns first, no `raw_json`, the new `crossing_category`, and `mcc` without
    `NOT NULL`;
  - create `transaction_raw` with `ON DELETE CASCADE` and copy the payload;
  - create `derived_state`;
  - keep `idx_tx_time`, `idx_tx_account_time` and the pair indexes, and drop the others.
  - Verify: a migration test on a fictional v15 database checks row counts, payload equality, `PRAGMA
    foreign_key_check` and `integrity_check`, and that a row with a NULL `mcc` is accepted.
- [x] 2.2 Add an optional `compact` flag to `MIGRATIONS` entries. `migrate()` runs `VACUUM` after such a migration,
  outside its transaction, best-effort, and reports the result to the caller (an optional `onCompaction` callback;
  desktop main logs it).
  - Verify: tests cover a successful compaction (the file shrinks), and a failing one where the migration stays
    applied and the failure is reported.
- [x] 2.3 Make `commitRows`' upsert write `transaction_raw` in the same `batch` (the API import and statement uploads).
  - Verify: `sync.test.ts` and `statement-import.test.ts` assert the payload is stored, and that a failed batch leaves
    neither row.
- [x] 2.4 Check that `deleteConnection` removes the payload by cascade, that `export:analysis` still copies exactly
  its whitelisted columns, and that the desktop's database encryption (`encrypt.ts`) copies the new tables.
  - Verify: `participants.test.ts`, the `apps/mcp` analysis tests and the desktop encryption test pass with their
    assertions extended.
- [x] 2.5 Add to `docs/backlog.md` the things to check on a live system:
  - the first-launch migration and compaction time on a real database;
  - the real payload size compared with the 1 KB assumption.
  - Verify: the backlog lists them.

## 3. Stored crossing — `feat(core): stored crossing category`

- [x] 3.1 Move the crossing rules from `accounts.ts` into a new `derived.ts`:
  - the paired and IBAN cases in SQL;
  - the `text` case through the provider rule `ownTransferCounterpart`.
  - It computes `crossing_category` in range mode and in full mode (design D3).
  - Verify: the existing `account-toggles.test.ts` scenarios are rewritten to read the stored column, and they keep
    their expected values.
- [x] 3.2 Add the account fingerprint and `refreshCrossing(db)`. It is a no-op when the fingerprint is unchanged, and
  a full refresh otherwise. Call it from `setAccountEnabled`, `syncAccounts`, `commitRows`, `deleteConnection` and
  every opener after `migrate()` (desktop `DataService.conn`, the worker, `apps/mcp` openers).
  - Verify: tests cover the toggle, the auto rule flipping after an import, a statement upload that creates a card,
    connection removal, the first open after the migration, and «nothing changed → zero row writes».
  - Verify: a test lists the core functions that write `accounts` or `sync_state` and asserts each one refreshes.
- [x] 3.3 Switch `summaries.ts`, `search.ts`, `income-lines.ts`, `category-lines.ts`, `recurring.ts` and `fx.ts` to
  `COALESCE(t.crossing_category, t.category)` / `t.crossing_category IS NULL`. Remove `CROSSING_CTE`,
  `CROSSING_JOIN` and `crossingCategories` from the read path.
  - Verify: `summaries.test.ts`, `fx.test.ts`, `recurring.test.ts`, the search tests and the MCP tool tests pass
    unchanged.
- [x] 3.4 Add the crossing step at the end of `rederiveCore`, printing nothing.
  - Verify: `apps/mcp/tests/recategorize-safety.test.ts` passes unchanged and the report lines are identical.
- [x] 3.5 Update `.agents/project/domain-rules.md` (crossing is stored, how it is refreshed) and
  `.agents/project/core-people.md` (a toggle refreshes crossing).
  - Verify: both files name `derived.ts` and `refreshCrossing`, and no longer describe `crossingCategories` as a query
    step.

## 4. Query shape and plans — `feat(core): range-join buckets and query plans`

- [x] 4.1 Replace `bucketKeySql` with the bucket range join (design D4) in `spendingLinesSql`, `spendingGrid` and
  `incomeSummary` grouped by day or month.
  - Verify: `periods-zones.test.ts` (DST) and `summaries.test.ts` pass unchanged.
- [x] 4.2 Add `tests/query-plans.test.ts`. It runs `EXPLAIN QUERY PLAN` for one month of spending, income, search,
  12 months by day and `balancesAt`, and asserts there is no `SCAN t`/`SCAN transactions`. Use it to confirm which
  dropped index (task 2.1) no statement needs; restore any that a plan needs, in a new migration.
  - Verify: the test passes.
- [x] 4.3 Run the bench and tighten the budgets for the cases this group improves.
  - Verify: `pnpm --filter @mono/core bench` passes.

## 5. Grouped queries for the desktop screens — `feat(desktop): grouped overview queries`

- [x] 5.1 Core: give `balancesAt` one statement for all accounts (design D6), with the same semantics.
  - Verify: `balances-at.test.ts` passes unchanged, and a new test asserts one statement for any number of accounts.
- [x] 5.2 Core: add the internal participant grouping for spending and income with the participant-view rules (not
  in `SPENDING_GROUP_BY` / `INCOME_GROUP_BY`).
  - Verify: `family.test.ts`-style fixtures show each participant's group equals the single-participant call.
- [x] 5.3 Desktop `data.ts`:
  - `spendingUsual` uses one `spendingGrid` by month and one `incomeSummary` by month;
  - `monthOverview` uses the participant grouping for people;
  - `nowOverview` uses one day × category query and folds in JS.
  - Verify: `apps/desktop/tests/data.test.ts` passes with unchanged expected values.
- [x] 5.4 Add `apps/desktop/tests/data-queries.test.ts`, with a `Db` wrapper that counts statements.
  - Each overview's count must be the same for 1 and 3 people, for 2 and 8 accounts, and for 3 and 36 months of
    history.
  - Verify: the test passes.
- [x] 5.5 Update `.agents/project/desktop-import.md` where it describes how `usual`, `monthOverview` and
  `getNowOverview` are computed. Add to `CHANGELOG.md` a new `## 0.1.10 — unreleased` section with the «Faster
  screens» entry (user terms only, no internal names).
  - Verify: `apps/desktop/tests/release-notes.test.ts` passes.

## 6. Incremental re-derivation after an import — `feat(core): incremental re-derivation`

- [ ] 6.1 Core:
  - `commitRows` returns its derived span and a `derivationFailed` flag;
  - `commitStatement` runs `rederiveCore` only when its window's derivation failed;
  - add `rederiveSpans(db, spans)`, which merges overlapping spans and runs transfers → refunds → categories → scope →
    crossing in range mode.
  - Verify: unit tests for span merging, for a failed window, and for a statement upload (no extra pass on success, a
    full pass on failure).
- [ ] 6.2 Worker `run-import.ts`: collect spans, compare the IBANs and jar titles at the start and the end, and call
  `rederiveSpans` or `rederiveCore` (design D7). The `rederive` progress phase and the log line stay.
  - Verify: the worker tests cover the routine case (spans only), a new account without a new IBAN (spans only), a
    new IBAN or jar title (full pass) and a failed window (full pass).
- [ ] 6.3 Add `packages/core/tests/derived-equivalence.test.ts`.
  - Run a fictional multi-window, two-connection import with a toggle in the middle, and a statement upload to a file
    connection.
  - Then run a full `rederiveCore` on a copy.
  - Every derived column must be equal.
  - Verify: the test passes.
- [ ] 6.4 Update `.agents/project/desktop-import.md` (what the `rederive` phase does), and extend the CHANGELOG entry:
  an update finishes sooner after the data is downloaded.
  - Verify: the release-notes test passes.

## 7. Final budgets and checks — `chore(core): final budgets`

- [ ] 7.1 Set `bench/budgets.ts` to the targets in design D8, or tighter when measured lower. Record before and after
  in `baseline.md`.
  - Verify: `pnpm --filter @mono/core bench` passes.
- [ ] 7.2 Add to `docs/backlog.md` the things to check on a live system: the speed of home, a category, analytics
  and the end of an auto-sync on a real database, before and after.
  - Verify: the backlog lists them.
- [ ] 7.3 Run `pnpm test` and `pnpm typecheck` at the root.
  - Verify: both pass.

## Workflow follow-up

- The user reviews the proposal before apply starts.
- Sync the specs into `openspec/specs/` and archive the change once it is committed.
- Next: change 2 (database work off the main thread, renderer cache), then change 3 (provider modules).
