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
2. **Payee choices get their own table `payee_categories (field, key, category, set_at, PRIMARY KEY (field, key))`**
   (`field`: `counter_name` | `description`; `key` trimmed and lower-cased). `category_overrides` keeps its
   `UNIQUE (pattern, match_type)` and stays the CLI's: changing that constraint would need a table rebuild, and the two
   kinds differ (the CLI's apply to credits too, by `contains`). The app's choice comes first.
3. **Order in the derivation:** internal → family → the operation's choice → the payee's choice → CLI override →
   provider hint → MCC. The user's choices apply to **debits only**: a payee's incoming money stays income, and a
   credit never takes a spending category by a rule. A stored pick on a row that later becomes an own transfer is
   ignored, not deleted.
4. **Commands (`commands/categories.ts`):** `setOperationCategory(db, id, category | null, atSec)` and
   `setPayeeCategory(db, id, category | null, atSec)` (the payee of that debit) → `{ changed }`; then a full
   recategorize, rescope and crossing (as the CLI's overrides do). `categorySources(db, ids)` tells a row's source
   (`operation` | `payee` | `auto`). `CHOOSABLE_CATEGORIES` = every category but income, «семье» and the
   derived-only ones; anything else, a credit, an own or family transfer throws `CategoryChoiceError`.
5. **New categories** are added to `CATEGORY` and to `CATEGORY_HINTS` (the compile-time check keeps the two lists
   equal; no provider suggests them yet); their colours and icons in `entities/category`. «Путешествия» keeps its
   stored value; only dictionary names change.
6. **Desktop:** IPC `setOperationCategory`, `setPayeeCategory`; the read cache is cleared after either. The menu
   is on the debit rows of the category screen (the income screen lists credits, which take no choice). Menu:
   a `VMenu` in `shared/ui` (muzakit first), opened at the pointer or anchored to «⋮». Picker: a `VPopover` with a
   search field and the list.
7. **Privacy:** the payee key travels from main to renderer only as an opaque row id; main resolves the key, so no
   new description leaves main. The manual tables never reach the analysis copy.

## Risks / Trade-offs

- A bank changing an operation's time or amount between exports gives it a new id; its pick would not follow. Seen
  nowhere so far; noted in `docs/backlog.md`.
- A description-based rule can catch a different payee with the same text. The answer's count lets the user see it,
  and undo is one step.
