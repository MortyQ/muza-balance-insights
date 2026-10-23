## ADDED Requirements

### Requirement: Home is a grid of tiles

Home SHALL show its content as separate tiles on the window's background, in this order: «Balance», «Month pace»,
«Month»; «Today», «This week», «What's unusual»; «Spending by category» with «Who spent what» and the regular payments
teaser beside it. Tiles SHALL NOT sit inside another tile. Tiles of one row SHALL have the same height.

#### Scenario: Wide window
- **WHEN** home is open on a window wide enough for three tiles in a row
- **THEN** the first row shows «Balance», «Month pace» and «Month» side by side, and the card stack is the first tile

#### Scenario: Narrow window
- **WHEN** the window is narrowed until three tiles no longer fit
- **THEN** the tiles reflow into fewer columns in the same order, and no tile is cut or overlaps another

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

The «What's unusual» lines SHALL be shown in their own tile in the second row, and SHALL NOT be repeated inside
«Spending by category».

#### Scenario: Insights present
- **WHEN** the month has categories above or below usual
- **THEN** they are listed in the «What's unusual» tile only

### Requirement: Spending by category tile

«Spending by category» SHALL show on its left the ring with the month's total and per-day amount inside, the change
against the compared period, the number of operations with its change, and last month's total; on its right the
category rows, each with its icon, name, share, operations, change chip, amount and a bar with last month's mark and
the people split when those options are on. It SHALL list 4 categories and unfold the rest in place. The block's own
person pick and options SHALL work as before.

#### Scenario: Many categories
- **WHEN** the month has 15 categories with spending
- **THEN** 4 rows are listed and a button unfolds the other 11 inside the tile

### Requirement: Who spent what tile

In the family view, the people list of «Spending by category» SHALL be its own tile next to it, each person with amount,
share and bar, and «Whole family» first. Picking a row SHALL pick the person for «Spending by category» as before. With
one person shown the tile SHALL NOT be shown.

#### Scenario: One person in the global filter
- **WHEN** the global filter shows one person
- **THEN** «Who spent what» is not shown and the regular payments teaser takes its place
