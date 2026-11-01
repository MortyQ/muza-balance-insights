# Proposal

## Why

The app knows one bank. Many users also hold a PrivatBank card, and their spending there is invisible: totals, months
and cross-bank transfers are incomplete. The provider modules (`2026-10-23-provider-modules`) made a second bank a
contained task; PrivatBank's Privat24 card statement (`.xlsx`, «Історія операцій за період») is the first one to add,
by file only — PrivatBank's API is for business accounts and is out of reach for a personal card.

## What Changes

- A new provider `privatbank`: files only (`access.token: null`), prefixed ids, its card types.
- A statement reader for the Privat24 card statement in Ukrainian (`.xlsx`): a title row with the period, one header
  row of ten columns, one row per operation, times to the second, no MCC, the bank's own category per row, the masked
  card number per row. Rows of several cards in one file become one statement per card.
- PrivatBank rules: transfers and own transfers by the bank's category and its service texts; category hints from the
  bank's categories; named senders («від …»); the treasury; the bank's fee on a transfer kept as the row's commission.
- New masking templates for PrivatBank's service texts (own-card transfers, the savings jar, cash withdrawal) — approved by the
  user in chat on 2026-10-25 (root `CLAUDE.md`: a new template in masking only after the user's ok).
- One place per bank where its own categories meet the app's common ones: a declarative table
  `providers/<id>/categories.ts` (bank category → common category hint), read by the bank's rules. The common list stays
  `CATEGORY` / `CATEGORY_HINTS`; no bank adds a category of its own.
- Unknown bank categories are counted: the re-derivation report (recategorize) gets one line per provider and bank
  category that its table does not know, with its row count (the bank's category name only, never a description) —
  **a change to what recategorize prints, approved by the user in chat on 2026-10-25**.
- Shared reader helpers in one module `providers/statement-kit.ts` (find a header row in a grid, time as text or Excel serial in Kyiv time,
  money to minor units, empty rows): the Monobank reader moves onto them unchanged in behaviour, the PrivatBank reader
  is built on them; the next bank's reader is mostly its column list.
- Desktop: the bank's look (monogram), card type names in `uk.json` / `en.json` / `ru.json`; the existing generic file
  connection flow is used as is (no `PROVIDER_FORMS` entry).
- `CHANGELOG.md`, next unreleased version: «PrivatBank: add a PrivatBank card from its Privat24 statement (.xlsx)».

Out of scope: PrivatBank's API or any network access; the Privat24 statement in English or Russian (recognised only if
its signature is known, see design); PDF and CSV statements of PrivatBank; FOP / business accounts; A-Bank and other
banks; changes to the decoder process.

Affected: `packages/core` (providers, tests), `apps/desktop` (renderer bank look, i18n, CHANGELOG); `apps/mcp` only through the recategorize report. Not affected: `packages/db-libsql`. No trust anchor changes. User-visible: yes (CHANGELOG entry above).

## Capabilities

### New Capabilities
- `core-privatbank-provider`: what the app reads from a PrivatBank card statement and how PrivatBank operations are
  understood (transfers, own transfers, fees, categories, named senders).

### Modified Capabilities
- `core-provider-modules`: adds that a bank's own categories map to the common ones through one table per bank, and
  that bank categories the table does not know are counted.

## Impact

- `packages/core/src/providers/privatbank/` (info, rules, statement, descriptions), one line each in `PROVIDER_IDS`,
  `PROVIDERS`, `PROVIDER_RULES`, `STATEMENT_READERS`; conformance fixtures under `tests/providers/privatbank/`.
- `packages/core/src/providers/statement-kit.ts` (new), `providers/monobank/statement.ts` (moved onto the helpers),
  `derive/rederive.ts` (the unknown-category lines).
- `packages/core/src/providers/*/maskDescription`: new PrivatBank templates in the analysis copy (user's ok).
- `apps/desktop`: `entities/bank/looks/privatbank.ts`, `entities.bank.cardType.privatbank.*` keys.
- No new dependency, no network host, no IPC change.
