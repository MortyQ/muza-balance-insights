## MODIFIED Requirements

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

### Requirement: What's unusual tile

The «What's unusual» lines SHALL be shown as a slide of the carousel tile in the second row (`desktop-home-highlights`),
and SHALL NOT be repeated inside «Spending by category». The lines SHALL be the view's (the global filter's person).

#### Scenario: Insights present
- **WHEN** the month has categories above or below usual
- **THEN** they are listed in the carousel tile's «What's unusual» slide only

## REMOVED Requirements

### Requirement: Who spent what tile

**Reason**: The user took it off home on 01.11; its place is decided later.

**Migration**: The global filter picks a person; the people list component stays in its slice for the later place.
