# Proposal

## Why

The category ring in the home «Spending» block is a CSS gradient. It shows the split, but it looks dated: the segments
have square ends and a hair-thin 1.4° gap, and pointing at a segment tells nothing: to see what a colour is, the user
has to find it in the list beside the ring.

## What Changes

- The ring is drawn by ECharts, as the other charts are, with:
  - rounded segment ends;
  - a clear gap between segments (a single segment is a whole ring, with no gap);
  - the same track, thickness, colours and order as today, and the total inside, unchanged.
- Pointing at a segment widens it a little and shows a tooltip in the shared chart style: the category's name, its
  amount and its share of the spending, as the list writes them.
- No spending: a plain track ring, as now, with no tooltip.
- `CHANGELOG.md`, next unreleased version (0.1.12): «The «Spending» ring has rounded, spaced segments; point at one to
  see the category, its amount and share».

Out of scope:
- the list of categories, the bars and every figure of the block;
- clicking a segment (no navigation from the ring);
- the ring's size and layout in the block.

Affected: `apps/desktop` renderer (`shared/ui` chart setup, `features/spending-summary`, tests). Not affected:
`packages/core`, `apps/mcp`, main, IPC, dictionaries (the tooltip reuses the list's texts). No trust anchor changes.
User-visible: yes (the CHANGELOG entry above).

## Capabilities

### New Capabilities
- `desktop-spending-ring`: the category ring of the home «Spending» block: what it shows and how it reacts to the pointer.

### Modified Capabilities

## Impact

- `shared/ui/components/charts/echarts.ts`: registers the pie chart.
- `features/spending-summary`: `utils/ring.ts` returns ring parts instead of gradient stops, plus the chart option;
  `components/summary/CategoryRing.vue` draws `VChart` under the centre text; `types.ts`.
- Tests: the ring's option, the parts (including «Other» taking the rest), the ECharts bundle test.
