# Tasks

## 1. Core: the latest lines (core)

- [x] 1.1 `latestLines` in `read/category-lines.ts`, sharing the row mapping (design 1). Verify in
  `tests/read` with fictional rows: every category, newest first, the limit, body lines only, a refund, the bank view
  and scope filters.

## 2. Desktop: the read (desktop)

- [x] 2.1 `getRecentOperations`: `shared/api.ts` (with the descriptions comment), `ipc-args`, channels, main, the data
  process, the read cache (design 2). Verify in `tests/data.test.ts` and `tests/ipc.test.ts`.

## 3. Renderer: carousel pieces (desktop)

- [x] 3.1 Move `useDragScroll` (and `DRAG_THRESHOLD`) to `shared/lib`, no code change; the card stack imports it from
  there. Its own commit.
- [x] 3.2 `shared/ui` `VCarousel` with dots, keyboard and reduced motion (design 3); README entry; renderer tests.

## 4. Renderer: the tile (desktop)

- [ ] 4.1 `SpendingInsightsFeature` out of `SpendingFeature` (`update:available`);
  `features/recent-operations`; `widgets/home-highlights`; the page wiring with «Now» details; keys in `uk.json`,
  `en.json`, `ru.json`. Renderer tests: the order, one slide, no content, details open, one spending request.
- [ ] 4.2 «Who spent what» and the teaser off home, the in-block pick removed, the spending tile over 12 columns
  (design 4); renderer tests updated.
- [ ] 4.3 `CHANGELOG.md` entry under `0.1.13 — unreleased`.

## 5. Docs and checks

- [ ] 5.1 `.agents/project/desktop-renderer.md`, `.agents/project/desktop-import.md`, `docs/backlog.md` (swipe on a
  trackpad, equal row height, the tile at 1, 2 and 12 columns, a place for «Who spent what» and the teaser).
- [ ] 5.2 `pnpm test` and `pnpm typecheck` at the root (by the user where the sandbox blocks pnpm).
