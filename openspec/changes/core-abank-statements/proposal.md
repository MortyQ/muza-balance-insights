# Proposal

## Why

Users with an A-Bank card do not see that money in the app: spending, income and transfers to and from it are
incomplete. The provider modules (`2026-10-23-provider-modules`) and the PrivatBank change made a new bank a contained
task. A-Bank's card statement comes as a spreadsheet (`.xlsx`) and as a PDF. A-Bank has no API for a personal card,
so the app adds this bank by file only.

## What Changes

- A new provider `abank` (brand name «A-Bank»):
  - files only (`access.token: null`);
  - prefixed ids;
  - one neutral card type.
- Two statement readers for A-Bank's card statement in Ukrainian («Виписка по картці»), one for `.xlsx` and one for
  `.pdf`. Both read the same eleven columns:
  - time to the minute;
  - masked card;
  - details;
  - MCC;
  - amount in the card currency;
  - amount and currency of the operation;
  - rate;
  - fee;
  - cashback;
  - balance after the operation.

  One file is one account: its IBAN when the file states it, and the masked numbers of every card on it. A PDF row
  spans several text lines (the date above, the time below); the reader joins them by position.
- A statement may state the account's **credit limit**. A-Bank's balance column includes the credit limit, so the
  reader passes the limit on, and the import stores it the way a Monobank account stores its own. Own funds then come
  out right.
- A-Bank's rules. Rows carry an MCC, and the MCC decides as for Monobank:
  - MCC 4829 is a transfer;
  - MCC 6012 is a financial institution;
  - the category comes from the common MCC table.

  The cashback credit is income and not a transfer. «Скасування. …» rows and other positive rows with a merchant MCC
  are refunds. `MONO*<name>` is a named sender, and the cross-bank pairing already matches it with the Monobank debit.
- New masking templates for A-Bank's service texts:
  - the cashback credit and cash withdrawal kept as is;
  - «Скасування. » kept with the merchant replaced;
  - `MONO*` kept with the name replaced.

  **They need the user's ok in the review of this proposal** (root `CLAUDE.md`: a new template in masking only after
  the user's ok).
- `providers/statement-kit.ts` gains the helpers that read a PDF table:
  - text lines grouped by position;
  - the column bands of a multi-line header;
  - a row's cells across lines;
  - numbers written as `1 234,56`.

  A-Bank's PDF reader is built on them; the existing readers are not touched.
- Desktop:
  - the bank's look (monogram);
  - its card type name in `uk.json` / `en.json` / `ru.json`;
  - the generic file connection flow as is (no `PROVIDER_FORMS` entry).
- `CHANGELOG.md`, 0.1.12 — unreleased: «A-Bank: add an A-Bank card from its statement (.xlsx or .pdf)».

Out of scope:
- A-Bank's API or any network access;
- Apple Numbers files (`.numbers`) and CSV;
- the statement in English or Russian (refused as an unknown format);
- deposit, FOP and other A-Bank products;
- changes to the common MCC table (codes it does not map stay «другое» as for every bank);
- changes to the decoder or to the cross-bank pairing.

Affected: `packages/core` (providers, statement import, tests) and `apps/desktop` (renderer bank look, i18n,
CHANGELOG). Not affected: `packages/db-libsql` (the `credit_limit` column exists) and `apps/mcp`. No trust anchor
changes. User-visible: yes (the CHANGELOG entry above).

## Capabilities

### New Capabilities
- `core-abank-provider`: what the app reads from an A-Bank card statement (`.xlsx`, `.pdf`) and how A-Bank operations
  are understood (transfers, cashback, refunds, fees, named senders).

### Modified Capabilities
- `core-statement-readers`: a statement may state its account's credit limit, and the import keeps it like the
  balance.

## Impact

- `packages/core/src/providers/abank/`:
  - `info.ts`, `categories.ts` (empty), `descriptions.ts`, `rules.ts`, `statement.ts`;
  - one line each in `PROVIDER_IDS`, `PROVIDERS`, `PROVIDER_RULES` and `STATEMENT_READERS`.
- Fictional conformance fixtures under `tests/providers/abank/`. The layouts come from a masked analysis; no real
  value is used.
- `packages/core/src/providers/statement-kit.ts`: PDF table and localized number helpers.
- `providers/types.ts`: optional `creditLimit` on `ParsedStatement`. `ingest/statement-import.ts` writes it.
- `apps/desktop`: `entities/bank/looks/abank.ts`, `entities.bank.cardType.abank.card`.
- No new dependency, no network host, no IPC change, no migration.
