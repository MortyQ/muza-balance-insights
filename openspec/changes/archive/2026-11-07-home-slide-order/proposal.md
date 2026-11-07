# Proposal

## Why

The home highlights tile moves «Limits» between first and last place depending on whether a limit is exceeded, so the
order of its slides changes from day to day. A fixed order — what is unusual, then what needs attention, then the latest
operations — reads more naturally and is easier to learn.

## What Changes

- The slides of the home highlights tile always go in one order: «What's unusual» → «Limits» → «Recent transactions».
  Each is still shown only when it has content.
- The rule «Limits is the first slide when one of its limits is exceeded» is removed.
- With nothing unusual and no limit needing attention, the tile shows «Recent transactions» (unchanged).
- Past months are unchanged: «What's unusual» alone over the whole row, or no tile.

Affected: `apps/desktop` (renderer widget `home-highlights` and its test). No core, MCP or main-process change.

Out of scope: what each slide shows, which limits reach the «Limits» slide, the carousel control, the «Budget» screen.

No trust anchor changes.

User-visible: yes. `CHANGELOG.md`, 0.1.15: «The home tile with «What's unusual», «Limits» and «Recent transactions»
always shows them in this order.»

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `desktop-home-highlights`: the slide order becomes fixed; «Limits» no longer moves first when a limit is exceeded.

## Impact

`apps/desktop/src/renderer/src/widgets/home-highlights/HomeHighlights.vue`,
`apps/desktop/tests/renderer/home-highlights.test.ts`, `.agents/project/desktop-renderer.md` (two mentions of the
order), `CHANGELOG.md`.
