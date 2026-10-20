# Proposal

## Why

Screens load slowly even with one bank. A second, fully separate bank (PrivatBank) will be added after this refactor and
will roughly double the rows. A spike on synthetic data (40 000 fictional operations over 3 years, an encrypted file as
the desktop has it, one disabled jar) found three causes in the core's read path. Each one multiplies the others:

| Measured on the spike (ms)                         | plain, slim rows | encrypted, ~1 KB `raw_json` per row, a disabled account |
|----------------------------------------------------|-----------------:|--------------------------------------------------------:|
| one month `spendingSummary` by category            |              2.1 |                                                     178 |
| 21 month summaries (what «Spending» asks for)      |               48 |                                                   3 965 |
| 12 months `spendingGrid` by day                    |              125 |                                                     541 |
| full scan of `transactions`                        |              2.9 |                                                     168 |
| full re-derivation after an import                 |            1 657 |                                                   5 123 |

1. **Fat rows × encryption.** The bank's original JSON (`raw_json`) sits in every `transactions` row, in front of hot
   columns (`transfer_rule`, `refund_pair_id`, `scope`). Every scan reads and decrypts it. That makes the file about
   5× larger and range scans about 10× slower.
2. **Derived values recomputed per query.** A transfer to a disabled account (an auto-disabled empty jar is enough)
   makes every statistic run `crossingCategories` first, and that is a full scan of `transactions`. A screen asks for
   up to ~21 such statistics.
3. **Loops instead of one grouped query.** The desktop's overviews loop over months, people and accounts, calling a
   whole statistic each time (`spendingUsual`, `cardTotal`, `nowOverview`, `balancesAt`). After every import, including
   the 4-hourly auto-sync, the whole database is re-derived even though each window was already derived.

The size of real `raw_json` was assumed (~1 KB) and not measured: the agent has no access to the database. The plain
column above is the lower bound.

## What Changes

- **Storage.** The bank's original item moves to a side table (`transaction_raw`), and `transactions` keeps only
  columns the domain reads. One migration rebuilds the table, and the file is compacted once afterwards.
- **MCC becomes optional in storage.** The same rebuild drops `NOT NULL` from `mcc`. Some banks do not send one:
  PrivatBank statements have the bank's own category instead. Removing `NOT NULL` later would need a second rebuild of
  the largest table. Every writer keeps sending an MCC until change 3 teaches the domain rules to work without one.
- **Stored crossing.** Whether a row crosses to a disabled account, and the category it then gets, becomes a stored
  derived column (`crossing_category`). It is refreshed whenever the set of enabled accounts or anything it depends on
  changes: toggle, import, statement upload, re-derivation, connection removal, migration. Statistics read the column. No statistic runs
  `crossingCategories` any more. Results stay exactly as they are now.
- **Query shape.** Day and month bucketing becomes a range join instead of a correlated subquery per row.
  `balancesAt` answers every account in one query. Indexes are set by measured query plans.
- **Fewer statistics per screen.** The desktop's overviews ask the core for grouped results once (months, days, people)
  instead of looping. The core gains the grouped variants they need (internal, not offered to MCP tools).
- **Incremental re-derivation.** At the end of an import only the touched time spans are re-derived. A full pass runs
  only when it is needed: IBANs, jar titles or card types changed, or a window's derivation failed. A statement upload keeps its
  window pass and runs a full pass only when that pass failed. `recategorize` and
  connection removal keep the full pass.
- **Performance harness.** A synthetic, fictional dataset generator and a bench script in `packages/core` with
  budgets, plus deterministic query-plan tests in `pnpm test`.

## Capabilities

### New Capabilities

- `core-derived-data`: which derived values the core stores per row (transfer marks, refunds, category, scope, crossing
  to a disabled account), when each is refreshed, and the guarantee that stored values equal their definition.
- `core-query-performance`: the read-path guarantees. The bank payload is kept out of the rows that statistics scan,
  period queries do not fully scan `transactions`, multi-period and multi-person results come from grouped queries, and
  the budgets the synthetic harness enforces.

### Modified Capabilities

None. `openspec/specs/` is empty: the domain rules live in `.agents/project/domain-rules.md` and are updated there.

## Impact

- **Affected:**
  - `packages/core`: `db.ts` (migration 16), `accounts.ts`, `summaries.ts`, `periods.ts`, `status.ts`, `fx.ts`,
    `search.ts`, `sync.ts`, `rederive.ts`, `categories.ts`, `participants.ts`, a new derived-data module, a new `bench/`
    folder, tests.
  - `packages/core/src/statement-import.ts`: a statement upload writes the payload apart and refreshes crossing. It
    gets no full re-derivation, because its window pass is already incremental.
  - `apps/desktop`: `src/main/data.ts` and its helpers (fewer, grouped calls); `src/worker/run-import.ts` (incremental
    pass); `src/main/integrations.ts` (toggle refreshes crossing); `src/main/statements.ts` (through core only, no
    change of its own).
  - `apps/mcp`: compiles against the new core. Tool outputs are unchanged, and `export:analysis` still copies the same
    whitelisted columns.
  - `packages/db-libsql`: unchanged.
- **Trust anchors:**
  - None change. `apps/mcp/package.json` scripts and `recategorize-safety.test.ts` are untouched. The recategorize
    report prints the same lines.
  - New modules that `rederive.ts` imports must keep that test green: no `.env`, no `config.ts`, no bank text in the
    output.
- **Analysis copy:** no new column or table is whitelisted. `transaction_raw` and `crossing_category` stay in the main
  database only.
- **User-visible:** yes, as speed only, with no change to any figure. `CHANGELOG.md` gets a new
  `## 0.1.10 — unreleased` section with a «Faster screens» entry: screens open and switch months faster, and an
  update finishes sooner after the data is downloaded. The first launch after the update compacts the database once.
- **Out of scope:**
  - Moving database work off the Electron main thread, and renderer-side caching and invalidation (change 2).
  - The provider module contract, namespaced bank ids (statement row ids too: account, second, amount and order among
    equal rows today), removing Monobank-specific names (`monobank.db`, rates source, UI fallbacks) and provider
    conformance tests (change 3).
  - Statement readers for binary files (PrivatBank `.xlsx`, A-Bank `.pdf`) and picking the reader from the file
    itself; several accounts in one file; operations without an MCC in the domain rules (category from the bank's own
    category); own transfers between accounts in different banks (time and fee tolerance). These belong to change 3,
    `openspec/changes/provider-modules` (its proposal records the agreed decisions).
  - The architecture rules and skills that follow all three changes.
  - Pre-computed aggregate tables (per-day totals). They will be reconsidered only if the harness shows the need after
    this change.
