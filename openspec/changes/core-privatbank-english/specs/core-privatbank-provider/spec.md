# Spec Delta

## ADDED Requirements

### Requirement: The English Privat24 card statement is recognised
The app SHALL claim a spreadsheet as an English Privat24 card statement by its content only: the first sheet has the
«Transaction history for the period» title row and the ten English column headers. The file SHALL then be read exactly
as the Ukrainian statement is: the same fields, the same grouping by card, the same fee rule, the same row ids. A
Ukrainian file and an English file SHALL each be claimed by one reader only, never both.

#### Scenario: An English Privat24 statement
- **WHEN** a Privat24 card statement in English is uploaded into a PrivatBank connection
- **THEN** it is recognised as a PrivatBank statement and the comparison is shown

#### Scenario: English headers without the title row
- **WHEN** a sheet has the ten English headers on its first row and no title row
- **THEN** it is still read as an English Privat24 statement

#### Scenario: The same operations in both languages
- **WHEN** a card's statement is uploaded in Ukrainian and then the overlapping period in English
- **THEN** the second upload adds only the operations the first did not hold

#### Scenario: An English PrivatBank statement into a Monobank connection
- **WHEN** an English Privat24 statement is uploaded into a Monobank file connection
- **THEN** it is refused as another bank's statement and nothing is written

### Requirement: English categories and service texts are understood
English bank categories SHALL map to the same common categories as their Ukrainian pairs, and the English transfer
categories SHALL be transfer-like. The English service texts for the owner's own card, the savings jar, a cash
withdrawal and a named incoming transfer SHALL be treated like their Ukrainian forms in categories, own transfers,
income sources and the anonymised copy.

#### Scenario: An English grocery purchase
- **WHEN** a row's bank category is «Supermarkets and groceries»
- **THEN** it counts under groceries, as «Супермаркети та продукти» does

#### Scenario: To the owner's own card, in English
- **WHEN** a row of the «Transfer to my card» category says «To my card» and the card's last four digits
- **THEN** it is an own transfer, not spending

#### Scenario: A named incoming transfer, in English
- **WHEN** a credit's description is «from» followed by the sender
- **THEN** its income source is a named sender, and the anonymised copy keeps neither the sender nor the text

#### Scenario: An English category the table does not know
- **WHEN** a row's English bank category is not in the table
- **THEN** the row imports with the default category, and the re-derivation report lists that category
