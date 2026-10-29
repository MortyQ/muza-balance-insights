# Design

## Context

Follows `.agents/project/desktop-renderer.md` (FSD, "`shared/ui` first", interface texts) and the settings-ui block of
the root `CLAUDE.md` (`GlobalFilters`, `BankFilter`). Updates the `GlobalFilters` / `BankFilter` lines of the root
`CLAUDE.md` and, in `desktop-renderer.md`, the month pace paragraph and the `entities/account` card skins.

Today: `BankFilter` (`widgets/global-filters/components`) is a `VToggleGroup` with a toggle per bank. The pace
(`features/balances`: `useMonthPace` → `paceView` → `paceChartOption`) asks `getAnalyticsOverview` for one month, whose
answer already carries `spendingByBank` (one series per bank, day buckets, registry order). Account cards are
`AccountCard` → `BANK_CARDS[bank]` (`entities/account/constants.ts`: Monobank only) else `NeutralCard`; each skin takes
`BankCardProps` and has no idea of the card type, though the slide's account has `name.type`.

No security-relevant part: no network, IPC, storage beyond one more `localStorage` key, tokens, CSP or lock. Card art
is CSS only (gradients, shapes): no image file, so `assetsInlineLimit` / CSP `data:` do not come into it.

## Goals / Non-Goals

**Goals:** one header control for banks; a pace split built from the data already loaded; a card look per bank and per
Monobank card type behind the existing `BANK_CARDS` seam.

**Non-Goals:** a generic multi-select in `shared/ui`; bank logos as files; animating between «Together» and «By banks».

## Decisions

### Bank filter: `VPopover` with a trigger slot, switches inside

The control is a `VPopover` like `CurrencyToggle`: the panel lists a row per offered bank (`BankMark` sm, name as the
`<label>`, `VSwitch` with `role="switch"`). The trigger needs the banks' marks, which `VPopover` cannot show today (icon +
text only), so `VPopover` gets an optional `trigger` slot rendered before the text (marks overlap with a negative
margin and a ring in `--surface`, at most four, then «+N»). The «last bank» switch stays enabled for focus but refuses
(`aria-disabled`, hint `home.filters.banksLocked` as its description), as `VToggleGroup`'s locked option does now.

Alternatives: keeping `VToggleGroup` with marks only — still a row per bank and names only in tooltips (rejected by the
user); a reka `DropdownMenu` with checkbox items — a menu closes on every pick and is less consistent with the currency
control. Verdict: popover + switches.

Placement stays `widgets/global-filters/components/BankFilter.vue` (it reads `entities/bank` and `entities/participant`,
which cannot import each other). Text helpers (`bankFilterText(shown, offered)` → «All banks» / «2 of 4») go into the
widget's `utils.ts`, tested.

### Pace split: from `spendingByBank`, stacked like the analytics chart

`useMonthPace` keeps one request. `paceView` gains `banks: Array<{ provider, values }>`: each bank's running sum over the
same days as `spent` (cut at the same last day). `paceChartOption(view, money, banks)` takes `null` (together, as today)
or the banks' `{ provider, name, color }` (from `bankOf`), and then draws one stacked line series per bank with
`areaStyle` (`stack: 'banks'`, opacity like the analytics chart's 0.35), drops the single filled line, keeps the dashed
usual and today's pill on the total. The tooltip (`paceTooltip`) adds a line per bank after «Spent».

The choice is a new `composables/usePaceSplit.ts` in `features/balances` (`localStorage` `home.pace.split`,
`'together' | 'banks'`, default `together`, read and written in try/catch) — the same shape as analytics'
`useFlowSplit`. Not shared between the two features: slices of one layer cannot import each other, and the two choices
are meant to be apart (spec). The menu is `components/PaceSettings.vue`: `VPopover` `lucide:settings` with a
`VSegmentedControl` «Together / By banks», shown only while `participant.shown.length > 1`.

Alternative: a new IPC for the pace by bank — not needed, the answer already has the series. Rejected.

### Card skins: one component per bank, Monobank variants by type

`BankCardProps` gains `variant: string | null` (the account's card type; null for a jar or none); `slidesOf` passes
`a.name.type`. `BANK_CARDS` gets `privatbank`, `abank`, `slsp` skins next to `MonobankCard`. The shared parts — the
400 × 252 button, hover / active motion, dimming, people dots, the figures' layout, chip, contactless mark and sheen —
move into one `components/bank/CardShell.vue` with slots for the background art and the wordmark, and a `tone`
(`light | dark`) that picks the text colours. Each bank skin is then only its art: CSS gradients and absolutely placed
shapes in Tailwind arbitrary values, colours as card-local custom properties defined in the skin (they are fixed brand
colours, the same in both themes, so they do not belong in `theme.css`).

- Monobank: `black` (default, near-black with a faint diagonal sheen), `white` (pearl, `tone: light`), `iron` (graphite),
  `platinum` (silver, `tone: light`), `yellow` (children's, `tone: light`); wordmark «monobank» lower-case, bold.
- PrivatBank: deep blue with a fine texture gradient, a green tag top left with «ПриватБанк» set in our font.
- A-Bank: bright green gradient, a white stylised apple shape (two circles and a leaf, drawn in CSS).
- Slovenská sporiteľňa: Erste blue, a large white arc ring off the right edge, «SLOVENSKÁ sporiteľňa» two-line wordmark.

Alternatives: logo files in `entities/bank/assets` — trademark files we would ship; images also need a CSP check
(`data:` is refused). Rejected. A single card with per-bank colour tokens only — cannot draw the PrivatBank tag, the
apple or the arc. Rejected.

## Risks / Trade-offs

- [Brand colours picked from public photos, not brand guides] → kept in one place per skin, easy to tune after the user
  looks at them; a live look goes to `docs/backlog.md`.
- [Text contrast on light cards (white, platinum, yellow)] → `tone: light` switches the shell to dark text and dark
  people-dot rings; the net arrow colours `--card-up` / `--card-down` are checked on both tones.
- [Stacked areas hide a bank with a tiny share] → the tooltip lists every bank's amount; the list for screen readers
  (`role="img"` label) stays the total.
- [`VPopover` trigger slot changes a shared component] → optional slot, existing callers unchanged; its test covers both.
