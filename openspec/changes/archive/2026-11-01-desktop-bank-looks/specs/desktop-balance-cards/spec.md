# Spec Delta

## MODIFIED Requirements

### Requirement: Account cards take their bank's look

An account card SHALL be drawn as the account's bank's physical card: its colours, its wordmark set in the app's font,
a chip, a contactless mark and a soft sheen; a Monobank card SHALL follow its card type (black, white, iron, platinum,
children's yellow; other types black). A bank without a look SHALL get a neutral card. No bank logo file SHALL be
copied. The card SHALL keep today's content, people dots and dimmed state, readable on its own colours in both themes.

#### Scenario: Monobank account

- **WHEN** a person's row lists their Monobank black card
- **THEN** it is shown as a matte black card with the «monobank» wordmark

#### Scenario: Monobank white card

- **WHEN** a person's row lists their Monobank white card
- **THEN** it is shown as a light card with dark text

#### Scenario: Other banks

- **WHEN** a person's row lists a PrivatBank, an A-Bank and a Slovenská sporiteľňa account
- **THEN** they are shown as a blue card with a green brand tag, a green card and a blue card with a large arc

#### Scenario: Without data on the date

- **WHEN** an account has no data on the shown date
- **THEN** its card keeps its bank's look and is dimmed
