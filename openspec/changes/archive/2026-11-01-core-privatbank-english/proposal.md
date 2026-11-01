# Proposal

## Why

Privat24 exports the card statement in only two languages, Ukrainian and English. The app reads only the Ukrainian
one (change `core-privatbank-statements`). An English file is refused as an unknown format, so a user who exported in
English must export again. A masked English statement shows the same layout as the Ukrainian one. Only the title, the
headers, the bank's category names and the service texts are English, so the app can read it with the same rules.

## What Changes

- A second PrivatBank reader, `privatbank-card-en`, takes the English Privat24 card statement (`.xlsx`). It has:
  - the title row «Transaction history for the period dd.mm.yyyy - dd.mm.yyyy»;
  - the ten English headers, «Date» … «Rest currency».

  It reads the file exactly as the Ukrainian reader does: the same columns in the same order, the same values, one
  statement per masked card, the same fee rule. Each reader claims only its own language, so a file is never ambiguous.
- PrivatBank's category table gains the English category names. They map to the same common categories as their
  Ukrainian pairs, and the English transfer categories join the transfer set. The bank's category is still stored as
  the file states it.
- PrivatBank's service texts gain their English forms:
  - «To my card *NNNN» / «From my card *NNNN» (own card);
  - «Moneybox» (the savings jar);
  - «ATM cash withdrawal»;
  - «from <sender>» (named incoming transfer).

  Rules and masking use them like the Ukrainian ones.
- **Analysis copy (needs the user's ok, root `CLAUDE.md`):** masking keeps four new service templates verbatim:
  «To my card *9999», «From my card *9999», «Moneybox» and «ATM cash withdrawal». «from <sender>» is masked to
  `[other]` with the `from_prefix` class, as its Ukrainian form is.
- `CHANGELOG.md`, 0.1.10 (unreleased): the PrivatBank entry says the statement may be in Ukrainian or English. The line
  about Russian goes, since Privat24 has no Russian export.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `core-privatbank-provider` (introduced by the unarchived change `core-privatbank-statements`): adds a requirement
  that the English statement is recognised and read like the Ukrainian one, and that its categories and service texts
  are understood the same way. Written as ADDED requirements, because that capability is not yet synced to
  `openspec/specs/`.

## Impact

- `packages/core`: `providers/privatbank/{statement,categories,descriptions,rules}.ts` and their tests, plus an English
  conformance fixture (fictional data). No migration, no new column, no change outside the PrivatBank folder.
- `apps/desktop`: no code change. The open dialog's `xlsx` filter already comes from the readers.
- `apps/mcp`: none. The analysis masking runs through the provider's `maskDescription`.
- Trust anchors: none change.
- User-visible: yes, the `CHANGELOG.md` line above.

## Out of scope

- PDF statements and FOP / business accounts.
- English names of categories this file did not show (for example the English forms of «Платежі за реквізитами» and
  «Платежі до бюджету»). Until they are added from a masked file, such rows get the default category, and the
  re-derivation report lists the names.
- Rewriting stored Ukrainian or English bank categories into one language.
