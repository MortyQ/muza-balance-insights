# Tasks

## 1. Bank filter as one popover — `feat(desktop): bank filter in a popover`

- [x] 1.1 Add an optional `trigger` slot to `shared/ui` `VPopover` (before the text; existing callers unchanged), with its
  styles in `vpopover.scss` and a note in `shared/ui/README.md`; verify a test mounts it with and without the slot
- [x] 1.2 Add `bankFilterText(shown, offered)` to `widgets/global-filters/utils.ts` («All banks» / «N of M») with keys
  in `uk.json`, `en.json`, `ru.json`; verify unit tests for all on, some on and one on
- [x] 1.3 Rewrite `BankFilter.vue` as a `VPopover`: overlapping marks of the banks on (at most four, then «+N») and the
  text in the trigger, a row per offered bank (mark, name as label, `VSwitch`), the last bank refusing with the locked
  hint; verify `tests/renderer/bank-filter.test.ts` covers hidden with one bank, «All banks», «2 of 4», switching off,
  the last bank, keyboard open and the switches' names
- [x] 1.4 Update the `GlobalFilters` / `BankFilter` lines in the root `CLAUDE.md` and the bank filter entry in
  `CHANGELOG.md` («Home», `0.1.13 — unreleased`); verify the text names the control by its English UI text

## 2. «Month pace» by banks — `feat(desktop): month pace split by bank`

- [ ] 2.1 Extend `paceView` with each bank's running sum from `spendingByBank` (same days and last day as `spent`) and
  `paceChartOption` / `paceTooltip` with an optional bank list (stacked areas in the banks' colours, total line and
  usual kept, a tooltip line per bank); verify `tests/renderer/month-pace.test.ts`: parts add up to the total each day,
  `null` draws exactly today's option, tooltip lines per bank
- [ ] 2.2 Add `composables/usePaceSplit.ts` (`localStorage` `home.pace.split`, default together, storage errors kept in
  memory) and `components/PaceSettings.vue` (`VPopover` with «Together / By banks»), shown in `PacePanel`'s header
  only while two or more banks are on; new keys in the three dictionaries; verify a renderer test: menu hidden with one
  bank, choice remembered, one bank on draws together
- [ ] 2.3 Update the month pace paragraph of `.agents/project/desktop-renderer.md` and add the «Month pace» by banks
  entry to `CHANGELOG.md`; verify by reading the diff

## 3. Bank card looks — `feat(desktop): account cards in their bank's look`

- [ ] 3.1 Move the shared card body (button, motion, dim, dots, figures, chip, contactless mark, sheen, `tone`) into
  `entities/account/components/bank/CardShell.vue`; `MonobankCard` and `NeutralCard` use it; add `variant` to
  `BankCardProps` and pass `a.name.type` from `slidesOf`; verify `tests/renderer/balances.test.ts` still passes and an
  account slide carries its type
- [ ] 3.2 Monobank variants (black default, white, iron, platinum, yellow) and the `PrivatBankCard`, `ABankCard`,
  `SlspCard` skins in `BANK_CARDS`, CSS art only, no image files; verify a renderer test mounts each bank and each
  Monobank variant, checks the wordmark text, the light tone on white / platinum / yellow, and an unknown bank falls back
  to the neutral card
- [ ] 3.3 Update the `entities/account` part of `.agents/project/desktop-renderer.md` and add the card looks entry to
  `CHANGELOG.md`; add «check the card looks and the pace by banks on live data, both themes» to `docs/backlog.md`;
  verify by reading the diff

## 4. Checks

- [ ] 4.1 Run `pnpm test` and `pnpm typecheck` at the root; verify both pass

## Workflow follow-up

- The user checks the cards, the filter and the pace on live data (backlog item from 3.3).
- Sync the delta specs and archive the change once it is committed.
