## ADDED Requirements

### Requirement: Back to the list
A category opened from «All categories» SHALL carry that origin in its link, and the category screen's back link SHALL
go back to «All categories», labelled «All categories». A category opened from anywhere else SHALL go back as before.
The origin SHALL survive a reload, and an unknown origin SHALL be ignored.

#### Scenario: Opened from «All categories»
- **WHEN** the user opens a category from «All categories» and presses the back link
- **THEN** «All categories» opens, and the link was labelled «All categories»

#### Scenario: Opened from home
- **WHEN** the user opens a category from home's «Spending» and presses the back link
- **THEN** home opens, as before

#### Scenario: After a reload
- **WHEN** a category opened from «All categories» is reloaded
- **THEN** its back link still goes to «All categories»
