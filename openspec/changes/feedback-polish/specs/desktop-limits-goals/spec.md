## ADDED Requirements

### Requirement: Bar levels
A limit's or the budget's bar and chip SHALL have a fourth look, «well ahead», between «attention» and «exceeded». It
SHALL apply to an attention state when spending by pace is at least twice what the plan expects by today, or when the
shown forecast is at least one and a half times the amount. It SHALL be orange-red, keep the icon of «attention», and
keep the same words as «attention», so the level never rests on colour alone.

#### Scenario: Spending at twice the plan
- **WHEN** a 300 € monthly limit expects 100 € by today, 220 € is spent and the reason is pace
- **THEN** the bar and chip take the «well ahead» look and the chip still reads «Faster than plan by 120 € (×2.2)»

#### Scenario: Forecast at one and a half limits
- **WHEN** a 300 € limit is in attention with a shown forecast of 480 €
- **THEN** the bar and chip take the «well ahead» look

#### Scenario: Below both thresholds
- **WHEN** 150 € is spent against 100 € expected and the forecast is 400 € of a 300 € limit
- **THEN** the look stays «attention»

### Requirement: The bar past the limit
An exceeded limit's bar SHALL be drawn to the scale of what was spent: the part up to the limit solid, the part above it
hatched, a tick at the limit, and the pace marker on the same scale. A bar that is not exceeded SHALL be unchanged.

#### Scenario: Spent at 1.6 times the limit
- **WHEN** 480 € is spent against a 300 € limit
- **THEN** the solid part covers 62.5% of the bar, the hatched part the other 37.5%, and a tick sits at 62.5%

#### Scenario: Spent exactly at the limit
- **WHEN** 300 € is spent against a 300 € limit
- **THEN** the bar is full and solid with no hatched part

#### Scenario: A limit still held
- **WHEN** 100 € is spent against a 300 € limit
- **THEN** the bar looks as before, with no tick and no hatching
