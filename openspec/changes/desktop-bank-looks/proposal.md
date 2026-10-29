# Proposal

## Why

The bank view landed with a row of one toggle per bank in the header: with four banks it takes most of the row, does
not fit next to the other filters and looks unlike the other header controls. The «Month pace» chart cannot show which
bank the month's spending went through, though «Spending» and «Analytics» already can. And the account cards of the
open balance row are one dark card for every bank, so the row does not tell the banks apart at a glance.

## What Changes

- The bank filter becomes one compact header control, built like the currency choice: a button with the marks of the
  banks that are on and a short text («All banks», «2 of 4»), opening a panel with a row per bank — its mark, its name
  and a switch. The rules stay: two or more banks to show it, all on by default, the last bank never turns off, the
  choice remembered.
- «Month pace» gets a settings menu like the «Spending» block's, with «Split»: «Together» (default) or «By banks»,
  offered only while two or more banks are on, remembered on this computer. By banks, the month's running spending is
  drawn as stacked areas, one per bank in its colour, whose top edge is the total; the dashed usual month stays; the
  tooltip names each bank's part.
- Account cards are drawn as the bank's own physical card: Monobank by card type (black, white, iron, platinum,
  children's yellow), PrivatBank's blue «Universal» card with its green brand tag, A-Bank's green card, Slovenská
  sporiteľňa's blue card with a large arc; each with a chip, a contactless mark and a soft sheen. Wordmarks are set in the
  app's font and shapes are drawn by us: no bank logo file is copied. The card keeps its content, people dots and dimmed
  state.

Out of scope: the total (summary) cards, the bank colours used in charts, the «By bank» card of the category and income
screens, real logo files for `entities/bank/assets`, any change to main, IPC or core (the pace takes `spendingByBank`
the analytics answer already carries).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `desktop-bank-filter`: the filter is one control with a panel of per-bank switches instead of a toggle per bank in the
  header; its keyboard and screen reader behaviour follows the new control.
- `desktop-spending-split`: «Month pace» joins the charts that split spending by banks.
- `desktop-balance-cards`: account cards take their bank's physical card look, Monobank's by card type; the rule
  «every account in the Monobank look until accounts carry their bank» is gone (they do).

## Impact

- Affected: `apps/desktop` renderer only — `widgets/global-filters` (`BankFilter`), `shared/ui` (`VPopover` gets a
  trigger slot), `features/balances` (pace menu, pace option by banks), `entities/account` (card skins), `entities/bank`
  (card looks), dictionaries `uk.json` / `en.json` / `ru.json`, renderer tests.
- No trust anchor changes.
- User-visible: yes. `CHANGELOG.md`, «Home» of `0.1.13 — unreleased`: the bank filter entry is reworded for the new
  control, and two entries are added — «Month pace» by banks, and account cards in their bank's look.
