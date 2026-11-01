# desktop-home-tiles Specification

## Purpose
Defines the home screen as a grid of separate tiles on the window's background: which tiles there are, how they
sit in rows at each width, and what each one shows.

## Requirements

### Requirement: Home is a grid of tiles

Home SHALL show its content as separate tiles on the window's background, in this order: «Balance», «Month pace»,
«Month»; «Today», «This week», the «What's unusual» / «Recent operations» tile; «Spending by category» over the whole
width. Tiles SHALL NOT sit inside another tile. Tiles of one row SHALL have the same height. «Who spent what» and the
regular payments teaser SHALL NOT be shown on home.

#### Scenario: Wide window
- **WHEN** home is open on a window wide enough for three tiles in a row
- **THEN** the first row shows «Balance», «Month pace» and «Month» side by side, and the card stack is the first tile

#### Scenario: Medium window
- **WHEN** the window is too narrow for three tiles in a row but wide enough for the card stack and «Month» side by side
- **THEN** the first row shows «Balance» and «Month», and «Month pace» takes the whole next row

#### Scenario: Balance never stands alone in a wide row
- **WHEN** «Balance» is folded
- **THEN** it never takes a whole row while another tile could sit beside it; below the width where the stack and
  «Month» fit side by side, «Balance», «Month pace» and «Month» each take a whole row

#### Scenario: Narrow window
- **WHEN** the window is narrowed until three tiles no longer fit
- **THEN** the tiles reflow into fewer columns in the same order, and no tile is cut or overlaps another

#### Scenario: Spending over the whole width
- **WHEN** home is open in the family view with regular payments found
- **THEN** «Spending by category» spans the whole row, with neither «Who spent what» nor the teaser beside it

### Requirement: Balance tile

The «Balance» tile SHALL show the card stack and, under it, the free amount of the card in front (accented), the
reserved amount and a bar splitting the two. It SHALL NOT show a separate total above the stack.

#### Scenario: Account card in front
- **WHEN** an account card is in front of the stack
- **THEN** the line under the stack shows that account's free and reserved amounts

### Requirement: Opening the card row widens the balance tile

Opening the card row SHALL widen «Balance» to the whole first row and hide «Month pace» and «Month». The hidden tiles
SHALL stay loaded, SHALL take no keyboard focus while hidden, and SHALL come back without reloading their data when the
row folds.

#### Scenario: Open and fold
- **WHEN** the user opens the card row and then folds it
- **THEN** the row spans the whole width while open, and the pace chart and the month figures reappear at once, the
  chart fitting its tile

### Requirement: Today and week tiles

«Today» and «This week» SHALL each show the period's amount, its change chip and at most 3 categories (icon, name, bar,
amount), the bars relative to the period's biggest category. Each tile SHALL offer a button that opens the period's
details; on «This week» the button SHALL name how many categories and how much are not listed. With no spending today
the «Today» tile SHALL say so instead of categories.

#### Scenario: A week with many categories
- **WHEN** the week has 12 categories with spending
- **THEN** the tile lists the 3 biggest and its button reads that 9 more categories are hidden, with their total

### Requirement: Period details

Opening a period's details SHALL replace the «Today», «This week» and «What's unusual» tiles with one wide tile that
shows a «Today / This week» switch set to the chosen period, the period's total and every category of the period. The
switch SHALL change the period in place; closing SHALL bring the three tiles back.

#### Scenario: Switch while viewing
- **WHEN** the user opens the week's details and picks «Today» in the switch
- **THEN** the tile shows today's categories without closing

### Requirement: What's unusual tile

The «What's unusual» lines SHALL be shown as a slide of the carousel tile in the second row (`desktop-home-highlights`),
and SHALL NOT be repeated inside «Spending by category». The lines SHALL be the view's (the global filter's person).

#### Scenario: Insights present
- **WHEN** the month has categories above or below usual
- **THEN** they are listed in the carousel tile's «What's unusual» slide only

### Requirement: Spending by category summary

«Spending by category» SHALL show on its left the ring with the month's total and per-day amount inside, the change
against the compared period, the number of operations with its change, and last month's total.

#### Scenario: Month compared
- **WHEN** the shown month has a compared period
- **THEN** the change, the operations and last month's total sit under the ring

### Requirement: Spending by category rows

On its right «Spending by category» SHALL list category rows, each with icon, name, share, operations, change chip,
amount and a bar; the bar SHALL carry last month's mark and the people split when those options are on. It SHALL list
4 categories and unfold the rest in place. The block's own person pick and options SHALL work as before.

#### Scenario: Many categories
- **WHEN** the month has 15 categories with spending
- **THEN** 4 rows are listed and a button unfolds the other 11 inside the tile
