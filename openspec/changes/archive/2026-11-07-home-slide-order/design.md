## Context

`widgets/home-highlights/HomeHighlights.vue` builds the carousel's `slides` list: «Limits» goes first when
`anyExceeded`, otherwise last, after «What's unusual» and «Recent operations».

## Goals / Non-Goals

**Goals:** one fixed order — unusual, limits, recent.

**Non-Goals:** changing slide content, the limits filter (attention or exceeded, current month only) or the carousel.

## Decisions

- Build `slides` as one ordered list of three conditional entries; drop the `anyExceeded` branching. `anyExceeded` stays
  in `useHomeBudget` if anything else reads it; otherwise the widget simply stops destructuring it.
- The opening slide is the first one in the list, as now (`current` starts empty, so the carousel opens on the first).

## Risks / Trade-offs

- An exceeded limit is no longer the first thing seen when the month has unusual lines → it is one swipe away and the
  dots show it; «What's unusual» itself is about the same spending.
