# Spec Delta

## Purpose

Keeps the desktop renderer's shared marks drawn one way across every screen, and shows changing values and loading
data with calm, consistent motion that respects the user's reduced-motion setting.

## ADDED Requirements

### Requirement: One look per shared mark

Every icon disc, status pill, headline figure, block title and list row on a data screen SHALL be drawn by its shared
part, so the same mark has the same size, weight, padding and colours on every screen and in both themes.

#### Scenario: Category icons match across blocks

- **WHEN** a category's icon is shown in «Spending», the «Now» tiles and «What's unusual»
- **THEN** each disc has the same size for the same density and the same tint of the category's colour

#### Scenario: A pill keeps its geometry

- **WHEN** a limit state, an insight severity, a connection status and a category kind are shown as pills
- **THEN** they share one height, padding, radius and type style, and differ only in tone

### Requirement: Status pills are readable in both themes

A status pill SHALL keep its text readable against its fill in the light and the dark theme for every tone, without
the screen choosing colours for the dark theme itself.

#### Scenario: A warning pill in the dark theme

- **WHEN** a pill with the warning tone is shown in the dark theme
- **THEN** its text uses the theme's warning colour on the dark warning fill, never dark text on a dark fill

### Requirement: One headline figure per block

A data block SHALL show at most one figure at the headline size; its other figures use the body sizes. Headline
figures use tabular digits and one weight.

#### Scenario: The budget block

- **WHEN** the home budget block shows what is left, what is spent and the plan
- **THEN** only one of them is at the headline size and the others are at a body size

### Requirement: Figures roll to a new value

When a shown figure changes while it is on screen, the system SHALL move only the digits that changed, settling on
the new value within about half a second; a figure shown for the first time appears without motion.

#### Scenario: Switching the month

- **WHEN** the user picks another month and a block's total changes from one value to another
- **THEN** the changed digits roll to the new value, the unchanged digits stay still, and the figure keeps its width
  slot so its neighbours do not jump mid-roll

#### Scenario: First paint

- **WHEN** a block shows its figure for the first time after the screen opens
- **THEN** the figure is drawn at its value with no rolling

### Requirement: Loading shows the content's outline

While a data block waits for its first answer and has no cached one, the system SHALL show placeholder lines at the
size and place of the content it will show, and SHALL announce the loading to screen readers once.

#### Scenario: Home opens without a cached answer

- **WHEN** a home block has no answer yet
- **THEN** it shows placeholder lines where its title, figure and rows will be, and the page does not move when the
  answer replaces them

#### Scenario: A cached answer exists

- **WHEN** the read cache holds an answer for the block
- **THEN** the answer is shown at once and no placeholder appears

### Requirement: Empty blocks say so in one line

A data block with nothing to show SHALL show one short line in the muted text style, and at most one action, in the
same place and style on every screen.

#### Scenario: No recurring payments

- **WHEN** the regular payments screen finds none
- **THEN** it shows its existing «none» text as one line in the shared empty style, with no extra frame or icon

### Requirement: Motion respects reduced motion

Every animation this capability adds (rolling figures, placeholder shimmer, rows opening) SHALL stand still when the
system asks for reduced motion: values change at once and placeholders do not pulse.

#### Scenario: Reduced motion is on

- **WHEN** `prefers-reduced-motion: reduce` is set and the user switches the month
- **THEN** figures change to their new values without rolling and placeholders are static

### Requirement: Texts and test hooks unchanged

Moving a screen onto the shared parts SHALL NOT change any shown text, dictionary key, accessible name or `data-test`
hook.

#### Scenario: Renderer tests after the move

- **WHEN** a screen is moved onto the shared parts
- **THEN** its existing renderer tests pass without changes to their expected texts or selectors
