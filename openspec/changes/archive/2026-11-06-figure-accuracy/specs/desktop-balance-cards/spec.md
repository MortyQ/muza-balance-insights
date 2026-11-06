## ADDED Requirements

### Requirement: Withdrawn in cash
While cash withdrawals do not count as spending, the month pace figures SHALL add «Withdrawn in cash» — the shown
month's withdrawn total for the view (the whole month for a past month), in the home's currency choice — with a
tooltip saying it is left out of spending and how to change that. With the switch on, or nothing withdrawn, it SHALL
NOT be shown.

#### Scenario: A month with withdrawals
- **WHEN** cash does not count as spending and the month has 2 500 ₴ withdrawn
- **THEN** the pace figures show «Withdrawn in cash 2 500 ₴» beside the spending so far

#### Scenario: Switch on
- **WHEN** cash counts as spending
- **THEN** no «Withdrawn in cash» figure is shown
