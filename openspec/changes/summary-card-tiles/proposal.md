# Proposal

## Why

The summary card (the total of the family or of a person) stacks four grey lines of equal weight under its amount,
including a long «incl. … at the rate …» line, so it reads as cluttered. The user reviewed eight layouts on a design
canvas and chose variant B: the same figures, laid out by importance, with the people's colours in a header band.

## What Changes

- The summary card gets a header band tinted with the colours of the people it adds up (one person: their colour
  fading out), holding the summary icon, the title, the «Total» label and the people's dots.
- Under the band: the caption («Free · today»), the amount and the account count under it. The conversions to the
  other picked currencies get a column on the right (variant C of the canvas): «≈ at the rate», then one row per
  currency — a symbol badge, the amount, the ISO code. No other currency picked — no column.
- The middle of the card, empty since the cards grew, shows (variant E) the people's shares on the family card: a thin
  bar in their colours and a line with each person's free amount; (variant H) on one person's card with reserves, a
  meter of what is free against what is reserved.
- At the bottom, tiles: «Actually» (own funds) and «Reserved» when reserves are set against the card, and the month's
  net («In October» with the arrow), tinted green when positive and soft red when negative.
- The foreign-currency rate line («incl. 1 200,00 $ at the rate 41,20») is no longer shown on the summary card. The
  month panel keeps its own rate note.
- Negative figures on the summary card (the amount, «Actually», the month net) are drawn in a soft red, a muted shade
  of the theme's danger colour, in both themes.
- Account (bank) cards are unchanged, except that their never-used «other currencies» line goes away.

Out of scope: the account cards' look (a soft red on the dark Monobank card is its own step), the month panel, the
row's scrolling and the stack animation, the data the main process sends.

Affected: `apps/desktop` renderer only (`entities/account`, `features/balances`, `app/styles/theme.css`, the UI
dictionaries). No trust anchor changes. User-visible: a `CHANGELOG.md` entry under `## 0.1.10 — unreleased`,
«Home screen»: «A clearer total card».

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `desktop-balance-cards`: the requirement «Total card looks like a summary, not a bank card» changes what the card
  shows (no rate line; a conversions column; the people's shares or the reserve meter) and how (header band, tiles,
  soft red for negatives).

## Impact

- `entities/account`: `SummaryCard.vue` rewritten; `SummaryCardProps` gets its own shape (the figures split into
  separate values for the tiles); `CardFigures` / `BankCardProps` lose `others`; `MonobankCard.vue` drops that line.
- `features/balances`: `slidesOf` builds the new summary props; `othersNote` goes.
- `theme.css`: soft negative and header-band tint tokens for both themes.
- `shared/lib/money`: `formatAmount` (an amount without the symbol); `entities/currency-display` `MoneyFormat`:
  `alsoParts` (the conversions as numbers).
- Dictionaries: new keys — the «Actually» tile, the capitalised month tile label, the column's «≈ at the rate», the
  meter's two shares and the legend's «+N» — in uk / en / ru.
- Tests: `balances.test.ts`, `balances-block.test.ts`.
