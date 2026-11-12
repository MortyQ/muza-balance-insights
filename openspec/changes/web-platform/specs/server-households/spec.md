# Spec Delta

## Purpose

Describes the shared space of the web edition: a household, its members and their roles, invitations, the link
between a member and a person of the household, and what happens when someone leaves or is removed.

## ADDED Requirements

### Requirement: Every user has a household and may belong to several

The server SHALL create a personal household for a new user, with that user as its owner. A user SHALL be able to
belong to several households and to create more. The client SHALL name the household it works in on every call; the
server SHALL never infer it.

#### Scenario: A user in two households

- **WHEN** a user who belongs to a personal and a family household opens each in its own tab
- **THEN** each tab shows only its household's data, and switching in one does not change the other

### Requirement: A role decides what a member may do

A membership SHALL carry one role. `viewer` reads. `member` also edits data, uploads statements, starts imports and
manages the bank connections of the household. `owner` also manages members and invites, renames, exports and
deletes the household. A method SHALL be refused with `forbidden` when the role does not cover it.

#### Scenario: A viewer tries to edit

- **WHEN** a viewer calls a method that writes
- **THEN** the call answers `forbidden` and nothing changes

#### Scenario: A member tries to invite

- **WHEN** a member who is not an owner asks to create an invite
- **THEN** the call answers `forbidden`

### Requirement: A household always has an owner

The server SHALL refuse a role change, a removal or a leave that would leave a household without an owner.

#### Scenario: The only owner leaves

- **WHEN** the only owner of a household with other members asks to leave
- **THEN** the request is refused with a reason that names the missing owner, and the membership stays

### Requirement: Invites are single-use links with a fixed role

An owner SHALL be able to create an invite that names a role and, optionally, an email. An invite SHALL work once,
expire after 7 days, be revocable, and be stored so that a copy of the database cannot be used to accept it.
Accepting SHALL need a signed-in user, and the bound email when one was named.

#### Scenario: An invite is accepted

- **WHEN** a signed-in user opens a valid invite and confirms
- **THEN** they become a member with the invite's role and the invite stops working

#### Scenario: An invite bound to another email

- **WHEN** a user whose email differs from the invite's bound email opens it
- **THEN** it is refused and stays valid for the named email

#### Scenario: A revoked or expired invite

- **WHEN** an invite that was revoked or is older than 7 days is opened
- **THEN** it is refused with the same answer as an unknown invite

### Requirement: The invite screen says what a member will see

Before a person accepts an invite, the client SHALL state that every member of the household sees all of its
accounts, operations and plans.

#### Scenario: Reading before joining

- **WHEN** an invite is opened
- **THEN** the screen shows the household's name, the offered role and the visibility notice before the confirm
  button

### Requirement: A member can be linked to a person of the household

A membership SHALL be linkable to one person of the household, and a person to at most one membership. A linked
member's default view SHALL be that person. People without a membership SHALL stay usable as before.

#### Scenario: A linked member opens the app

- **WHEN** a member linked to a person opens the household for the first time on a device
- **THEN** the person filter starts on that person, and the family view is one choice away

#### Scenario: A person already linked

- **WHEN** an owner tries to link a second member to a person who already has one
- **THEN** the request is refused and both links stay as they were

### Requirement: Removal takes effect at once

When a membership ends — by leaving or by an owner's removal — the next request of that user for the household
SHALL be refused, their open event streams for it SHALL close, and every bank token that user entered there SHALL be
deleted.

#### Scenario: A removed member's open tab

- **WHEN** an owner removes a member who has the household open
- **THEN** the member's client leaves the household's screens, and its next call answers `forbidden`

#### Scenario: Tokens of a removed member

- **WHEN** a member who entered two bank tokens is removed
- **THEN** both stored tokens are gone before the removal is reported done, and their connections show «token
  needed»

### Requirement: Leaving offers to take one's bank data along

When a member leaves, the client SHALL ask whether the connections they added, with their imported data, are
removed or stay. Removing a connection SHALL remove its accounts and operations and re-derive the household's
figures.

#### Scenario: Leaving and removing data

- **WHEN** a leaving member chooses to remove their connections
- **THEN** those connections, their accounts and operations are gone from the household, and the figures of the
  remaining members are re-derived

### Requirement: Deleting a household removes its tokens and data

An owner SHALL be able to delete a household after a fresh passkey confirmation and typing its name. Deletion SHALL
close the household to every call at once, then remove the stored bank tokens, its data, its memberships and
invites, in that order, and SHALL end with no row of it on the server.

#### Scenario: Deletion is interrupted

- **WHEN** deletion stops after the tokens were removed and before the data was
- **THEN** the household is offered to no user, every call for it answers `forbidden`, and the deletion finishes on
  the next clean-up run
