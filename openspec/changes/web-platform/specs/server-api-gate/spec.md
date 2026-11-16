# Spec Delta

## Purpose

Describes the one path every client call takes on the server: a closed list of methods, a fixed order of checks,
answers as fixed codes, request limits, and the rule for which answers may carry text that came from a bank.

## ADDED Requirements

### Requirement: Only listed methods exist

The server SHALL answer only the methods of the shared contract's list. Each method SHALL have a declared kind
(read or write), a least role, a sensitivity mark, a request limit and an argument schema; a method missing any of
them SHALL NOT be buildable or SHALL fail a test.

#### Scenario: An unknown method

- **WHEN** a signed-in member calls a method name that is not in the list
- **THEN** the answer is `invalid`, the same as for bad arguments of a known method

#### Scenario: A new method without a policy

- **WHEN** a method is added to the list without a role or a schema
- **THEN** the build or the policy test fails

### Requirement: Checks run in a fixed order and stop at the first refusal

For a household call the server SHALL check, in this order: the transport, the session, the lock and freshness, the
membership and role, the household's state, the arguments. The handler SHALL run only after all of them passed, and
a refused call SHALL have read nothing from the household.

#### Scenario: Bad arguments from a non-member

- **WHEN** a user who is not in the household sends a call with invalid arguments
- **THEN** the answer is `forbidden`, not `invalid`

#### Scenario: A valid call from a locked session

- **WHEN** a locked session sends a well-formed read
- **THEN** the answer is `locked` and nothing of the household is read

### Requirement: Refusals are fixed codes

A refused or failed call SHALL answer with one of the codes `unauthenticated`, `forbidden`, `stale-auth`, `locked`,
`invalid`, `unavailable`, `limited`, `failed`, and nothing else: no message, no stack, no name of a table, file or
library. A domain refusal that the screens word themselves SHALL stay a value in a successful answer.

#### Scenario: A handler throws

- **WHEN** a handler fails unexpectedly
- **THEN** the client gets `failed`, and the log gets the error's name and the method, without arguments

#### Scenario: A colour already taken

- **WHEN** a member picks a colour another person has
- **THEN** the call succeeds with the «taken» value, and the client words it

### Requirement: A household the user is not in is indistinguishable from one that does not exist

Calls naming an unknown household and calls naming a household the user does not belong to SHALL get the same
answer in the same way.

#### Scenario: Guessing household ids

- **WHEN** a user calls a method with a random household id and with a real one they are not in
- **THEN** both answer `forbidden` with the same body

### Requirement: Calls come only from the app's own pages

The server SHALL refuse a call whose origin is not the app's own, that is not JSON, or that lacks the client's
header, and SHALL accept no credential other than the session cookie. It SHALL send no header that lets another
site read its answers.

#### Scenario: A form on another site

- **WHEN** a page on another site makes the signed-in user's browser post to a method
- **THEN** the call is refused and nothing changes

### Requirement: Data answers are never cached and never in a URL

Every data call SHALL carry its arguments in the body, and every answer SHALL forbid storing. No amount, name, date
filter, search text or id of household data SHALL appear in a URL.

#### Scenario: A search

- **WHEN** a member searches for a payee
- **THEN** the search text is in the request body, the URL names only the household and the method, and the answer
  says it must not be stored

### Requirement: Requests are limited

The server SHALL limit requests per session and per source address, with tighter limits for sign-in, email codes,
invites, token entry and search. A call over a limit SHALL answer `limited` and say when to retry.

#### Scenario: Hammering the email code

- **WHEN** codes for one email are requested faster than the limit
- **THEN** further requests answer `limited` and no more mail is sent

### Requirement: Arguments and answers match the contract on both sides

The server SHALL check every call's arguments against the method's schema before the handler runs, with the
contract's schema — the one the web client is typed with —, and SHALL bound every text, list and number an argument can carry.

#### Scenario: An oversized argument

- **WHEN** a goal's name longer than the contract allows is sent
- **THEN** the call answers `invalid` and nothing is written

### Requirement: Only named methods may carry bank text

Only the methods the contract marks as carrying bank text SHALL return an operation's description or comment, with a
card number cut to its last four digits and a jar's title hidden. No method SHALL return a counterparty's stored name, an IBAN, a full card number or a
jar's title.

#### Scenario: A marker in every field

- **WHEN** a test household holds marker values in the counterparty name, IBAN, card number and jar title, and every
  method is called
- **THEN** no answer contains a marker

### Requirement: A write is announced to the household's other clients

A successful write SHALL raise the household's data version and SHALL be announced on the household's event stream,
so that other devices and members refresh. The announcement SHALL carry the version only.

#### Scenario: Two members on one household

- **WHEN** one member changes a category while another has the home screen open
- **THEN** the other's figures refresh without a reload, and the event they received held no data
