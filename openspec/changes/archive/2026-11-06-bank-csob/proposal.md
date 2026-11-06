# Proposal

## Why

Users with a ČSOB account in the Czech Republic do not see that money in the app. ČSOB internet banking exports the
account's movements as a CSV file in English. The provider modules make a new bank a contained task. ČSOB is the first
bank whose file is a CSV with both an operation type and the bank's own category on every row.

## What Changes

- **A new provider `csob`** (brand name «ČSOB»):
  - files only (`access.token: null`);
  - prefixed ids;
  - one neutral card type `card`.
- **One CSV reader `csob-account-csv-en`** for the English «Payment history» export. The file layout:
  - a title line `Payment history <account>/<bank code> on <date time>.`, an empty line, then a header of 24 columns;
  - one row per operation, newest first, a date without a time;
  - trailing rows that hold only a balance, which are skipped.

  Rules for the file:
  - **One file is one account.** Its IBAN is computed from the Czech account number and bank code (`CZ`, the check
    digits, the bank code, the prefix and the number). It matches an existing account like the IBAN of any other bank.
  - **The currency is the account currency.** It is the `currency` column, which must be the same on every row.
  - **The closing balance** is the `balance` of the newest row.
  - **Direction.**
    - A signed amount keeps its sign.
    - An unsigned amount takes its direction from the `transaction type`.
    - A row whose type is unknown and whose amount has no sign is refused as `bad-row`.
    - Amounts are read with or without decimals, with a decimal comma or dot.
- **Times.** The `due date` is read at midnight in the bank's zone, Europe/Prague. A transfer between the user's own
  accounts is still found by IBAN, not by time.
- **Foreign currency.** An `original transaction` in another currency than the account's is stored as the operation
  amount and currency.
- **Counterparties.** A `counter account` with a 4-digit Czech bank code becomes the counterparty's IBAN, so the
  domain's IBAN rule finds own transfers. Its name is the `counter account name`. The description is the merchant from
  the `note`'s `Place:` part, or else the counterparty's name.
- **The bank category.** The rules see one bank category per row.
  - The reader stores the `category` column as the bank category.
  - For transfer types (incoming / outgoing payments, instant payments, standing orders, the payment button), when
    that category is a generic one («Income», «Outgoing unclassified», «Bank transactions», or empty), it stores the
    type instead. Those rows are then transfers: income or a payment to a person, by sign.
  - The bank's 20 categories map to the common hints (design 5). An unknown one is reported by the re-derivation
    report, as today.
- **No merchant keywords.** The bank states a category on every row, so `merchants.ts` is not needed.
- **Masking.** No new templates. Every description reaches the analysis copy as `[other]` with its shape class.
- **No self-check of balances.** Unlike SLSP, the reader does not refuse a file whose running balance breaks. The only
  sample has edited amounts, so the real file's arithmetic cannot be confirmed yet (backlog: a live check on the first
  real upload).
- **Desktop:**
  - the bank's look (monogram `Č`);
  - its card type name in `uk.json` / `en.json` / `ru.json`;
  - the generic file connection flow as is (no `PROVIDER_FORMS` entry).
- **`CHANGELOG.md`**, under `0.1.14 — unreleased`: «ČSOB: add an account from its CSV payment history».

## Capabilities

### New Capabilities
- `core-csob-provider`: reading the ČSOB CSV payment history, and how ČSOB operations are understood (direction,
  types, categories, transfers, IBAN from the Czech account number).

### Modified Capabilities
- None.

## Impact

- `packages/core`:
  - `providers/types.ts` (the id);
  - a new `providers/csob/` folder: `info`, `rules`, `descriptions`, `categories`, `iban`, `statement`;
  - the three registries;
  - tests and conformance fixtures, fictional data only.
- `apps/desktop`: the bank look and three dictionaries. No IPC, network or storage change.
- `apps/mcp`: nothing. An unknown ČSOB category shows up in the existing list of unknown bank categories.
- **Trust anchors:** none change.
- **User-visible:** yes, through the `CHANGELOG.md` entry above.

## Out of scope

- A ČSOB API (PSD2 / open banking) and any network access.
- Other ČSOB exports: the Czech-language CSV, PDF statements, XLSX, ABO / GPC, MT940.
- Czech koruna as a display currency: a separate change (`currency-czk`).
- Refusing a file whose running balance does not add up: later, after a real file confirms the arithmetic.
- The `Foreign payment - fee` row as the commission of the payment it belongs to: it stays a row of its own.
- The holder's name and address, the payer reference and the symbols: never read.
