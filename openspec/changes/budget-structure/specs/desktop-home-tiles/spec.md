## MODIFIED Requirements

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
- **THEN** the «Budget» row sits between the first row and «Today», «This week»

## ADDED Requirements

### Requirement: Budget row
The «Budget» row SHALL show, in one line on a wide window: the month's total with «Edit»; the fixed costs paid of the
amount set aside, with each fixed row paid or not; the flexible part spent of its amount with the bar, the pace marker,
the state, the expected amount by today and the forecast; and «per day by the budget» with the days left. Its parts
SHALL wrap to two columns and then one on narrower windows. Clicking it SHALL open «Limits and goals». A past month
SHALL show the result instead of the pace: within the budget or over it, and what was left or how much over. It
follows the person filter like the budget's owner rules; amounts are in the main currency.

#### Scenario: A running month
- **WHEN** the current month is shown with a 2 000 € budget, 1 282 € of 1 410 € fixed paid and 230 € of 590 € flexible spent on day 10
- **THEN** the row shows those figures, «A bit ahead of pace», 197 € expected by today, a 690 € forecast and 17 € per day by the budget for 21 days

#### Scenario: A past month
- **WHEN** a past month with a budget is shown
- **THEN** the row says whether the month stayed within the budget and how much was left or over

### Requirement: No budget yet
Without a monthly budget, home SHALL show in the same place a thin line inviting to set one, with «Create budget» and a
close button; once closed it SHALL not be shown again on this computer. In a past month without a budget nothing SHALL
be shown.

#### Scenario: Closing the invitation
- **WHEN** the user closes the invitation
- **THEN** it is not shown again, and the budget can still be created in «Limits and goals»
