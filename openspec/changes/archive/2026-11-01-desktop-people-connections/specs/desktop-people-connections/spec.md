# Spec Delta

## Purpose

One settings section for the people in the app and their bank connections, where a connection is added to a chosen
person or together with a new person, and the history download is started.

## ADDED Requirements

### Requirement: One section for people and their connections
The settings screen SHALL have one section «People and banks» in the «Users» group in place of «People» and
«Connections». It SHALL list every person with their name, colour, «Rename» and «Change colour», and under each person
that person's connections.

#### Scenario: The menu
- **WHEN** the user opens «Settings»
- **THEN** the «Users» group has one item «People and banks» and no separate «Connections» item

#### Scenario: A person with two banks
- **WHEN** a person has a Monobank token connection and a PrivatBank file connection
- **THEN** that person's block shows both, each under its bank's heading, with the existing connection actions

### Requirement: Connections are grouped by bank
Within a person, connections SHALL be grouped by bank, one heading per bank, banks in the app's bank order.

#### Scenario: Two connections of one bank
- **WHEN** a person has two connections of the same bank
- **THEN** both are listed under one heading of that bank

### Requirement: Adding a connection to an existing person
Each person's block SHALL offer «Add connection». The added connection SHALL belong to that person, and the form SHALL
NOT ask whose it is.

#### Scenario: A second bank for a person
- **WHEN** the user presses «Add connection» on a person's block, picks a bank and completes its form
- **THEN** the connection is added to that person, no new person appears, and the success notice is shown in that block

#### Scenario: The same owner again
- **WHEN** the added token belongs to an owner already connected
- **THEN** the form shows the existing duplicate error and nothing is added

### Requirement: Adding a new person
The section SHALL offer «Add person», which adds a first connection together with a new person (a typed name or the
name from the bank, and a colour). A person SHALL NOT be created without a connection.

#### Scenario: A new person
- **WHEN** the user presses «Add person», picks a bank, types a name and completes the form
- **THEN** a new person with that connection appears in the list

#### Scenario: No people yet
- **WHEN** there are no people
- **THEN** the section shows its empty text and «Add person»

### Requirement: The history download stays in the section
The history download SHALL be shown below the people in the same section, and a link to it SHALL open this section,
scroll to it and take its date. A link naming the former «Connections» section SHALL open this section.

#### Scenario: «Download history» from home
- **WHEN** the user presses «Download history» on home
- **THEN** «Settings» opens on «People and banks» scrolled to the history download

#### Scenario: An old link
- **WHEN** a link opens settings with `section=connections`
- **THEN** «People and banks» is shown
