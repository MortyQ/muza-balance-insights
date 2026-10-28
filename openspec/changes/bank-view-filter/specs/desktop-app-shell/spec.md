# Spec Delta

## MODIFIED Requirements

### Requirement: Header with title and global filters

Every data screen SHALL show a header above the content with the current menu entry's name as the screen title,
followed by the global filters (the screen's period filter, the currency, the people, the banks) and the sync status,
with the same behaviour as before this change. The header SHALL stay in place while the content scrolls.

#### Scenario: Header on home
- **WHEN** the user opens home
- **THEN** the header shows «General», the month, the currency, the people and the sync status, and stays visible while
  home scrolls

#### Scenario: Header with two banks
- **WHEN** accounts of Monobank and PrivatBank are imported and the user opens analytics
- **THEN** the header shows the bank filter with both banks among its filters
