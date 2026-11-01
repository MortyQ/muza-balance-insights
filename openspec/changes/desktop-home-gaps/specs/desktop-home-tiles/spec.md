## MODIFIED Requirements

### Requirement: What's unusual tile

The «What's unusual» lines SHALL be shown as a slide of the carousel tile in the second row (`desktop-home-highlights`),
and SHALL NOT be repeated inside «Spending by category». The lines SHALL be the view's: picking a person inside
«Spending by category» SHALL NOT change or hide them.

#### Scenario: Insights present
- **WHEN** the month has categories above or below usual
- **THEN** they are listed in the carousel tile's «What's unusual» slide only

#### Scenario: A person picked inside the block
- **WHEN** the user picks a person in «Who spent what»
- **THEN** the «What's unusual» slide keeps the view's lines

### Requirement: Who spent what tile

In the family view, the people list of «Spending by category» SHALL be its own tile next to it, each person with amount,
share and bar, and «Whole family» first. Picking a row SHALL pick the person for «Spending by category» as before. With
one person shown the tile SHALL NOT be shown. When neither this tile nor the regular payments teaser is shown,
«Spending by category» SHALL take the whole width of its rows.

#### Scenario: One person in the global filter
- **WHEN** the global filter shows one person
- **THEN** «Who spent what» is not shown and the regular payments teaser takes its place

#### Scenario: Nothing beside the spending tile
- **WHEN** one person is shown and there are no regular payments
- **THEN** «Spending by category» spans the whole row and no columns stay empty
