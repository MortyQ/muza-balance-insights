# Design

## Context

Follows `.agents/project/desktop-renderer.md` (FSD, the balance block paragraph, styles and tokens, «Interface texts»)
and updates its balance block paragraph. Nothing in `desktop-app.md`, `desktop-security.md` or `desktop-import.md` is
touched: no IPC, storage, network or main-process data.

Today:

- `entities/account/types.ts`: one `CardFigures` (title, caption, amount, approx, others, actual, bottom, net,
  netText, accents, dim) serves both `SummaryCardProps` and `BankCardProps`.
- `features/balances/utils.ts` `slidesOf` → `totalSlide` fills it with ready strings: `actual` is one sentence
  («Actually X · reserved Y»), `netText` is the signed net glued to «in October», `others` is `othersNote` (the rate
  line). Account slides set `others` and `actual` to `''`; `MonobankCard` still renders both.
- `SummaryCard.vue`: header row, then caption / amount / approx / others / actual as equal grey lines, then a footer
  with `bottom` and the net.
- `theme.css` holds the app's own tokens beside muzakit's (`--series-*`, `--category-*`, `--heat-*`), both themes.

## Goals / Non-Goals

**Goals:**

- Variant B of the design canvas, built only from theme tokens, readable in both themes.
- Summary props that carry each figure separately, so the card lays them out instead of parsing sentences.

**Non-Goals:**

- No change to the account cards' look, the month panel, the row or the stack.
- No new data from main: every figure already exists in `MonthOverview`.

## Decisions

### 1. `SummaryCardProps` gets its own shape; `CardFigures` stays for bank cards

```ts
interface SummaryCardProps {
  title: string;
  caption: string;           // «Free · today» / «Own funds · on 3 Oct»
  count: string;             // «3 people · 7 accounts · without 1 account»
  amount: string;
  fx: ReadonlyArray<{ symbol: string; code: string; amount: string }>;  // the conversions column (§7); empty — none
  negative: boolean;         // the amount is below zero
  own: { amount: string; negative: boolean } | null;   // «Actually», with reserves only
  reserved: string | null;                             // «Reserved», with reserves only
  net: { label: string; amount: string; value: number } | null;  // «In October», «+12 400 ₴» (no «≈»: the month panel says what was converted)
  people: {                  // §8
    items: ReadonlyArray<{ name: string; color: string; amount: string; negative: boolean }>;  // named, at most three
    more: string;            // «+2»; '' — none
    all: string;             // everyone, the tooltip
    parts: ReadonlyArray<{ color: string; value: number }>;  // the bar; empty — none
  } | null;
  freeShare: number | null;  // §9: whole percent free, 0–100; null — no meter
  accents: ReadonlyArray<string>;
  dim: boolean;
}
```

(`approx` was replaced by `fx`, `people` and `freeShare` were added in the follow-up of §7–9.)

`CardFigures` loses `others` (no account ever set it); `BankCardProps = CardFigures` and `MonobankCard` keep the rest.
`features/balances` `Slide` already nests the card's props by `kind`, so only `slidesOf` changes.

Alternative: keep one shared `CardFigures` and split the sentences in the card (rejected: a template that parses
dictionary output breaks per language; the props would still carry the rate line).

### 2. Header band from the accents

The band is a `linear-gradient(90deg, …)` of `color-mix(in oklch, <accent> var(--card-band-tint), var(--surface))`, one
stop per accent, spread evenly (CSS custom property built in the component from `accents`). One accent: from that mix
to `color-mix(… var(--card-band-fade) …)` so a person's band fades out. `--card-band-tint` (16% light, 24% dark) and
`--card-band-fade` (6% / 8%) are new tokens in `theme.css`: the dark surface needs more of the colour to show it.
Text on the band stays `--foreground`; the «Total» label sits on a translucent `--surface`.

Alternative: a solid strip in the first person's colour (rejected: the family has several people, and a full-colour
strip is a bank card's move).

### 3. Tiles

A CSS grid with one column per tile shown (`repeat(n, minmax(0, 1fr))`): with reserves — «Actually», «Reserved», the
month; without — the month alone, full width. Neutral tiles are `--surface-sunken`. The month tile is
`--success-subtle` with `--success` text above zero, `--negative-soft-bg` with `--negative-soft` text below zero, and
neutral (`--surface-sunken`, no arrow, «0 ₴» without a sign) at exactly zero (canvas X2); the arrow follows the sign. The month label is a new key `home.balances.inMonthTitle`
(«In {month}{year}», capitalised, same placeholders as `inMonth`), the «Actually» tile `home.balances.actualTile`.

### 4. Soft red

`--negative-soft` (light `oklch(55% 0.13 25)`, dark `oklch(74% 0.12 25)`) and `--negative-soft-bg` (light
`--danger-subtle`'s value, dark `oklch(24% 0.06 25)`) in `theme.css`, with `--color-*` aliases so Tailwind classes
reach them. Used for the amount when `negative`, for «Actually» when `own.negative`, and for the month tile below
zero. Captions and conversions stay grey.

Alternative: `--danger` itself (rejected by the user: too loud for a figure that is often just a used credit limit).

### 5. Rate line removed from the card only

`othersNote` goes with `others`. The dictionary keys `home.balances.fxRate` / `fxNoRate` stay: the month panel's
`fxNote` and `daily-allowance` use them.

### 6. Every balance card grows to 400 × 252

Added after review: the cards were cramped. Both sides grow (+60 / +38 px) so the bank card's proportion stays.
Derived: `CARD_WIDTH` 400 (row step 416), `STACK_WIDTH` 466, the month panel beside the stack from `left: 490px` and
`@[47rem]` (490 + 260 = 750 px), the row 308 px high, the panel 304 px; the panel keeps its 340 px. The summary card
uses the room for a 44 px band, a 32 px amount and 14 px tile figures. Alternative: width only (rejected: a strip, not
a card; the Monobank skin would stretch).

### 7. The conversions column (canvas variant C)

`MoneyFormat` gets `alsoParts(kopecks): Array<{ currency: number; minor: number }>` — the same picked «also»
currencies with a rate that `approx` / `approxInline` use, as numbers; those two keep their other callers.
`shared/lib/money` gets `formatAmount(minor, currency, opts)` — `formatMoney` without the symbol — and `formatMoney`
is built on it. `totalSlide` maps the parts to `{ symbol: currencySymbol, code: currencyAlpha, amount: formatAmount }`.
The card lays the body out as two columns: on the left the caption, the amount and the count under it; on the right,
behind a `--border` divider, «≈ at the rate» (`home.balances.atRate`) and a row per currency: a round
`--surface-sunken` badge with the symbol, the amount (15 px, bold) and the code (11 px, muted). With `fx` empty the
column is not rendered. At most two rows: three currencies exist and one is the main.

Alternative: chips under the amount (D) or a full-width row (G) (rejected by the user on the canvas).

### 8. The people's shares (canvas variant E)

Only the family's front card, with two or more people. `slidesOf` builds an item per person: `name` — the first word
of their label (the first name, no surname; «pending» while the label is), `amount` / `value` — that person's free
amount, their own card's big figure (`ownFunds - reserved`), converted and formatted in whole units (`fmt.money`, no
decimals); `color` — their accent. The bar (canvas X5) is a flex row of parts with 2 px gaps, 6 px high: one per person whose
amount is not zero — also those not named in the line — with `flex-grow: |value|` and at least 4 px. Above zero the
part is the person's colour; below zero it is hatched in it (`repeating-linear-gradient(135deg, color-mix(in oklch,
<accent> 55%, var(--surface)) 0 3px, var(--surface) 3px 5px)`), so a debt shows its size without passing for money.
Nobody above zero (everyone at zero, or everyone below — canvas X1, X2) — no bar, the line only. An amount below
zero is `text-negative-soft` in the line. The line names at most
three people, the largest `value` first, then `more` — «+{n}» (`home.balances.morePeople`) for the rest, '' with
three or fewer; names truncate, amounts never; `all` — every «name amount» joined by « · », the line's `title`. The
header shows at most five dots, then «+{n}» (the same key) for the rest; the band's gradient keeps every person's
colour.

Alternative for the bar: parts for those above zero only (canvas X3; rejected: one person in the plus fills the
whole bar beside a family in the minus), or no bar as soon as anyone is below zero (X4; rejected: loses the picture).

Alternative: two rows of three, up to six named (canvas M2), or a summary line / initials (M3, M4) (rejected by the
user: three names stay readable beside the conversions column).

### 9. The reserve meter (canvas variant H)

A person's summary card (picked, or each person's card in the family row) with reserves and `ownFunds > 0`:
`freeShare = clamp(round(shown / ownFunds * 100), 0, 100)`; reserved is `100 - freeShare`, so the two always add up
to 100. The track is `--surface-sunken`; the free part is `--foreground` at 80 %. Labels under it: «{pct}% free»
(`home.balances.freeShare`), «{pct}% reserved» (`home.balances.reservedShare`). No reserves, or own funds at zero or
below — `null`, nothing in the middle. The family card never gets the meter: its middle is the shares.

## Risks / Trade-offs

- [More than eight people] → the palette has eight colours; a ninth person repeats one or is grey, so the bar and
  the dots can no longer tell everyone apart. A limit of the palette, not of the card.
- [The shares do not add up to the family's free amount] → each person's figure deducts only their own reserves, the
  family's deducts the common ones too. Accepted: every person's figure matches their own card in the row.
- [The left column narrows with the conversions column] → about 260 px stay for a 32 px amount; a longer amount
  truncates with its full text in `title`, like the tiles. Checked by hand (backlog).

- [Long amounts and three tiles in 400 px] → tiles use 14 px figures with `tabular-nums` and `min-w-0`; a figure that
  does not fit truncates with its full text in `title`. Checked by hand (backlog).
- [Contrast of the soft red on the dark surface] → 74% lightness on a 20% surface clears 4.5:1; checked by hand in both
  themes (backlog).
- [The band's colours with many people] → stops spread evenly; with more than 4 people the band reads as a soft
  rainbow, acceptable.

## Migration Plan

Renderer only. Rollback is a revert of the change's commits.
