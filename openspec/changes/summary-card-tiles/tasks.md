# Tasks

## 1. Tokens and the summary card (one commit: `feat(desktop): a clearer total card — people-colour header, tiles, a soft red for a minus`)

- [x] 1.1 `theme.css`: `--card-band-tint`, `--card-band-fade`, `--negative-soft`, `--negative-soft-bg` for the light and
  the dark theme, plus `--color-negative-soft` / `--color-negative-soft-bg` aliases; verified by the card tests of 1.3
  asserting the classes that use them
- [x] 1.2 `entities/account/types.ts`: `SummaryCardProps` as in design §1; `CardFigures` without `others`;
  `MonobankCard.vue` drops the `others` line; verified by `vue-tsc`
- [x] 1.3 `SummaryCard.vue` rewritten as variant B: header band from `accents` (one accent fades out), caption with
  the count, amount (soft red when `negative`) with `approx`, tiles (`own` / `reserved` only when set, the month tile
  green or soft red by sign); verified by component tests in `tests/renderer/balances.test.ts` (band stops per accent,
  tiles shown or hidden, soft red classes on negatives, no rate text)
- [x] 1.4 `features/balances/utils.ts` `slidesOf`: builds the new summary props (`count`, `negative`, `own`,
  `reserved`, `net` with `home.balances.inMonthTitle`); `othersNote` removed; verified by `slidesOf` tests updated and
  extended (reserves vs none, a negative total, foreign currency gives no rate line)
- [x] 1.5 Dictionaries: `home.balances.actualTile` and `home.balances.inMonthTitle` in uk, en and ru; verified by
  `tests/i18n.test.ts`
- [x] 1.6 `tests/renderer/balances-block.test.ts` fixture moved to the new summary props; the block tests pass
- [x] 1.7 `.agents/project/desktop-renderer.md` balance block paragraph: the summary card's layout, props and tokens;
  `CHANGELOG.md` `## 0.1.10 — unreleased` «Home screen»: «A clearer total card»; `docs/backlog.md`: live checks (both
  themes, long amounts in the tiles, a negative person, many people in the band)
- [x] 1.8 `pnpm test` and `pnpm typecheck` at the root pass

## Workflow follow-up

- After the user's live check: sync the delta into `openspec/specs/desktop-balance-cards/spec.md` and archive.
