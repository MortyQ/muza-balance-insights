## MODIFIED Requirements

### Requirement: Home is a grid of tiles

Home SHALL show its content as separate tiles on the window's background, in this order: «Balance», «Month pace»,
«Month»; «Today», «This week», the «What's unusual» / «Recent operations» tile; «Spending by category», with the «Insights»
block beside it when that block has content, else over the whole width. Tiles SHALL NOT sit inside another tile. Tiles of one row SHALL have the same height. «Who spent what» and the
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
- **WHEN** home is open in the family view with regular payments found and the «Insights» block has nothing to show
- **THEN** «Spending by category» spans the whole row, with neither «Who spent what» nor the teaser beside it

#### Scenario: Spending shares its row
- **WHEN** the «Insights» block has content on a home wide enough for twelve columns
- **THEN** «Spending by category» and the block share the row, seven columns and five
