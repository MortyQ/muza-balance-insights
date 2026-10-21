# Proposal

## Why

The home screen's balance block breaks when the window is narrower than intended: the collapsed card stack and the
month panel are both absolutely positioned, so the cards slide over the «In» / «Out» bars. The total card (the family's
or a person's) looks exactly like a Monobank card, so it reads as one more card instead of a summary. More banks are
coming, and every account card will need the look of its bank. The open row can only be paged by the arrows in the
header; a trackpad swipe, a touch swipe or Tab to a card further along does nothing.

## What Changes

- The balance block lays out the stack and the month panel side by side while they fit, and puts the panel under the
  stack when they do not. Nothing overlaps at any width.
- A new summary card, built from scratch, for the total of the view: the family, a person, and each person in the
  family view. It does not look like a bank card (light surface, a summary icon, a «Total» label, people as dots).
- The account card becomes a per-bank skin. Today's dark card with the «m» mark becomes the Monobank skin. One entry
  point picks the skin by bank, so a new bank adds a skin and an entry in a table. Every account is Monobank today; the
  bank does not travel in the data yet.
- The open row scrolls natively: trackpad and touch swipes, Shift + wheel, mouse drag, snapping to whole cards. The
  scroll bar is hidden on every OS. The header arrows stay as the fallback and scroll by one card. Edge fades and a row
  of dots under the row show where you are and that there is more; a dot scrolls to its card.
- Folding the row back scrolls it to its start first, then stacks the cards.
- `CHANGELOG.md`, under `## 0.1.10 — unreleased`: the narrow-window fix, the new look of the total card, swiping
  through the open row.

## Capabilities

### New Capabilities

- `desktop-balance-cards`: the home screen's balance block: the stack and the open row, the total and account cards,
  how the row is scrolled and paged, and how it adapts to the block's width.

### Modified Capabilities

None: `openspec/specs/` has no capability yet.

## Impact

- Affected: `apps/desktop` renderer only: `entities/account` (cards), `features/balances` (layout, row, scrolling,
  dots), the dictionaries (`uk.json`, `en.json`, `ru.json`: the «Total» label and the dots' accessible names),
  `tests/renderer/balances.test.ts`, `tests/renderer/card-stack.test.ts`, `.agents/project/desktop-renderer.md` (the
  balance block paragraph), `CHANGELOG.md`.
- Not affected: `packages/core`, main, IPC and `apps/desktop/src/shared/api.ts` (`OverviewAccount` gets no `bank`
  field), `apps/mcp`.
- Trust anchors: none change.
- User-visible: yes (see the CHANGELOG entry above).

### Out of scope

- A `bank` field on accounts in core, IPC and `OverviewAccount`: it comes with the second bank.
- Skins for other banks and a generic fallback skin.
- Turning a vertical mouse wheel into horizontal scrolling of the row: it would take over page scrolling under the
  cursor.
- The analytics chart that does not redraw after a period change: a separate fix, once its symptom is pinned down.
- «All accounts» (stays a stub).
