# desktop-home-tiles Specification

## Purpose
Defines the home screen as a grid of separate tiles on the window's background: which tiles there are, how they
sit in rows at each width, and what each one shows.

## Requirements

### Requirement: Home is a grid of tiles

Home SHALL show its content as separate tiles on the window's background, in this order: «Balance», «Month pace»,
«Month»; the «Budget» row over the whole width; «Today», «This week», the «What's unusual» / «Recent operations» tile;
«Spending by category», with the «Insights» block beside it when that block has content, else over the whole width.
Tiles SHALL NOT sit inside another tile. Tiles of one row SHALL have the same height. «Who spent what» and the regular
payments teaser SHALL NOT be shown on home.

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
- **WHEN** home is open in the family view with regular payments found and the «Insights» block has nothing to show
- **THEN** «Spending by category» spans the whole row, with neither «Who spent what» nor the teaser beside it

#### Scenario: Spending shares its row
- **WHEN** the «Insights» block has content on a home wide enough for twelve columns
- **THEN** «Spending by category» and the block share the row, seven columns and five

#### Scenario: The budget row
- **WHEN** a monthly budget is set and the current month is shown
- **THEN** the «Budget» row sits between the first row and «Today», «This week»; without a budget the same place holds the empty row

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

«Today» and «This week» SHALL each show the period's amount, its change chip and at most 5 categories (icon, name, bar,
amount), the bars relative to the period's biggest category. Each tile SHALL offer a button that opens the period's
details; on «This week» the button SHALL name how many categories and how much are not listed. With no spending today
the «Today» tile SHALL say so instead of categories.

#### Scenario: A week with many categories
- **WHEN** the week has 12 categories with spending
- **THEN** the tile lists the 5 biggest and its button reads that 7 more categories are hidden, with their total

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

### Requirement: Budget row
The «Budget» row SHALL show, in one line on a wide window: the month's total with «Edit»; the fixed costs paid of the
amount set aside, with each fixed row paid or not; the flexible part spent of its amount with the bar, the pace marker,
the state, the expected amount by today and the forecast; and «per day by the budget» with the days left. Its parts
SHALL wrap to two columns and then one on narrower windows. Clicking it SHALL open the «Budget» screen. A past month
SHALL show the result instead of the pace: within the budget or over it, and what was left or how much over. It
follows the person filter like the budget's owner rules; amounts are in the main currency.

#### Scenario: A running month
- **WHEN** the current month is shown with a 2 000 € budget, 1 282 € of 1 410 € fixed paid and 230 € of 590 € flexible spent on day 10
- **THEN** the row shows those figures, «A bit ahead of pace», 197 € expected by today, a 690 € forecast and 17 € per day by the budget for 21 days

#### Scenario: A past month
- **WHEN** a past month with a budget is shown
- **THEN** the row says whether the month stayed within the budget and how much was left or over

### Requirement: No budget yet
Without a monthly budget, home SHALL keep the «Budget» row's place in the current month as a light empty row that says
a monthly budget can be set right here, in one sentence with what it gives (fixed costs set aside, per day for the
rest), and a «Set a budget» action that opens the budget sheet on the «Budget» screen. It SHALL have no close button
and SHALL stay until a budget exists. In a past month without a budget nothing SHALL be shown.

#### Scenario: Starting a budget from home
- **WHEN** the user has no budget and presses «Set a budget» on home
- **THEN** the «Budget» screen opens with the budget sheet open

#### Scenario: A past month without a budget
- **WHEN** a past month is shown and no budget existed
- **THEN** home shows no «Budget» row
