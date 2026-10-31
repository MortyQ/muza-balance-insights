# Design

## Context

- Categories: `packages/core/src/derive/categories.ts`, `CATEGORY` (stored values in Russian), `OVERRIDE_CATEGORIES`
  (all but the derived-only ones). Order today: payee overrides (`category_overrides`, by `counter_name`, `exact` /
  `contains`, CLI only), the provider's hint, the MCC table.
- Operation ids are stable across imports: a statement row is `<account>:<time>:<amount>:<n>`
  (`statementRowIds`), an API row is the bank's id; `commit.ts` upserts on `id`. So a key by stored id survives a
  re-upload and an overlapping statement.
- The latest migration is v17.

## Decisions

1. **Table `manual_categories (transaction_id TEXT PRIMARY KEY, category TEXT NOT NULL, set_at INTEGER NOT NULL)`**
   (v18). No foreign key: a row never removed by an import keeps its pick; «Delete all data» clears it with the rest.
2. **Payee rules reuse `category_overrides`**, with a new column `field TEXT NOT NULL DEFAULT 'counter_name'`
   (`counter_name` | `description`). The app writes `exact` rules; the CLI keeps `contains`. One table, one order.
3. **Order in the derivation:** manual pick → payee rule → provider hint → MCC. The derived-only passes (own
   transfers, family) stay above all: a manual pick is not offered for them, and a stored pick on a row that later
   becomes an own transfer is ignored, not deleted.
4. **Commands (`commands/categories.ts`):** `setManualCategory(id, category | null)`, `setPayeeCategory(key,
   category | null) → { changed }`; both re-derive only the affected rows' categories and the aggregates' inputs.
   An unknown or derived-only category throws.
5. **New categories** are added to `CATEGORY` and `CategoryHint`-free (no provider may suggest them yet); their
   colours and icons in `entities/category`. «Путешествия» keeps its stored value; only dictionary names change.
6. **Desktop:** IPC `setOperationCategory`, `setPayeeCategory`; the read cache is cleared after either. Menu:
   a `VMenu` in `shared/ui` (muzakit first), opened at the pointer or anchored to «⋮». Picker: a `VPopover` with a
   search field and the list.
7. **Privacy:** the payee key travels from main to renderer only as an opaque row id; main resolves the key, so no
   new description leaves main. The manual tables never reach the analysis copy.

## Risks / Trade-offs

- A bank changing an operation's time or amount between exports gives it a new id; its pick would not follow. Seen
  nowhere so far; noted in `docs/backlog.md`.
- A description-based rule can catch a different payee with the same text. The answer's count lets the user see it,
  and undo is one step.
