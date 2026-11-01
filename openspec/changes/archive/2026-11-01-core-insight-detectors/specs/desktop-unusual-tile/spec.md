## ADDED Requirements

### Requirement: Lines from the detectors
The «What's unusual» tile SHALL show the first five insights the data process returns from `detectInsights`, in their
order, worded from i18n keys in the current language. The renderer SHALL NOT filter or rank them again.

#### Scenario: Seven insights
- **WHEN** the detectors return seven insights
- **THEN** the tile shows the first five

### Requirement: Share beside the amount
Every line that has a share SHALL show the difference in money and the share together; a `category-rare` line SHALL
show the money only.

#### Scenario: Running month over a whole month
- **WHEN** a category is already over a whole usual month
- **THEN** its line states the money and the share against that whole month

### Requirement: Row opens its category
A category line SHALL open the category screen for the shown month and the block's scope, by mouse and by keyboard.
Income lines SHALL NOT be links.

#### Scenario: Click a category line
- **WHEN** the user clicks the «Кафе» line
- **THEN** the category screen for «Кафе» and the shown month opens

### Requirement: No line for usual income
The tile SHALL NOT add a line saying income is at its usual level.

#### Scenario: Income as usual
- **WHEN** income is within the thresholds
- **THEN** no income line is shown
