## ADDED Requirements

### Requirement: Row menu
Operation rows on the category and income screens SHALL open one menu by right click and by their «⋮» button, with
«Change category…» and, when the row has a manual category, «Return the automatic category». Rows in derived-only
categories SHALL have no menu. The menu SHALL work from the keyboard (arrows, Enter, Esc).

#### Scenario: Right click and «⋮» open the same menu
- **WHEN** the user right-clicks a row, or presses its «⋮»
- **THEN** the same menu opens next to the row

### Requirement: Category picker
«Change category…» SHALL open a searchable list of assignable categories by their dictionary names, with a «For all
operations from this payee» switch. After a choice the screens SHALL show the new answer, and a payee rule SHALL
show how many operations changed.

#### Scenario: One operation
- **WHEN** the user picks «Подписки» with the switch off
- **THEN** only that operation moves to «Подписки» and the screen re-reads its data

#### Scenario: All from the payee
- **WHEN** the user picks «Инвестиции» with the switch on
- **THEN** a notice states the number of changed operations
