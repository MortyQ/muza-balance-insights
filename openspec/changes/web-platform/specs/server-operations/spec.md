# Spec Delta

## Purpose

Describes how the service is run so that its guarantees hold in practice: what is reachable from the network, what
logs and the audit trail may contain, backups and restore, closed or open sign-up, and what development, CI and the
agent can reach.

## ADDED Requirements

### Requirement: Only the app's port is reachable

From the internet the deployment SHALL answer on the HTTPS port only. The database,
the import worker and every administrative interface SHALL be unreachable from outside the host.

#### Scenario: A port scan

- **WHEN** the host is scanned from the internet
- **THEN** only the HTTPS port answers

### Requirement: Each process reaches only what it needs

The public-facing process SHALL have no outgoing network access except the mail service. The import worker SHALL
have none except the banks' hosts. The import worker's key SHALL be readable by the import worker only.

#### Scenario: The public-facing process tries to call out

- **WHEN** code in the public-facing process opens a connection to an arbitrary host
- **THEN** the connection is refused by the deployment, not by the code

### Requirement: Transport is TLS with strict browser rules

Every answer SHALL be served over TLS with strict transport security, and the app's pages SHALL be served with a
content security policy that allows scripts, styles, connections and workers from the app's own origin only and
forbids framing.

#### Scenario: Plain HTTP

- **WHEN** the site is requested over plain HTTP
- **THEN** it redirects to HTTPS and no session cookie is ever sent over HTTP

### Requirement: Logs carry codes and counts only

Logs SHALL contain no amount, bank description, comment, counterparty, person's name, email, IBAN, card number,
token, session id, request body or search text. A log line SHALL identify a user or a household by its internal id
only.

#### Scenario: A marker run through the system

- **WHEN** a test signs up, enters a token, uploads a statement, searches and imports with marker values in every
  personal field
- **THEN** no log line contains a marker

### Requirement: Security-relevant actions leave an audit trail

The server SHALL record sign-ins and failures, session ends, passkey and recovery events, membership and role
changes, invites, token entry and deletion, exports and household deletions — with the time, the acting user, the
household, the action and the outcome, and nothing of the data itself. A member SHALL be able to see their own
recent security events.

#### Scenario: A token is replaced

- **WHEN** a member replaces a bank token
- **THEN** the audit trail gains a row naming the member, the household, the connection id and the time, and no
  part of the token

### Requirement: Backups are encrypted before they leave and the host can be rebuilt

The database SHALL be backed up daily, encrypted on the host before it is sent to storage at another provider, and
kept for a fixed time. Rebuilding the service on a new host from the latest backup SHALL be rehearsed before the
service opens and before public sign-up, and the steps SHALL be written down.

#### Scenario: The backup storage is read by someone else

- **WHEN** a third party reads the backup bucket
- **THEN** it finds only data it cannot decrypt

#### Scenario: The host is lost

- **WHEN** the host is gone and a new one is built from the latest backup following the written steps
- **THEN** the service answers again, and a fictional household's figures equal those before the loss

### Requirement: Sign-up is closed unless the operator opens it

The deployment SHALL start with sign-up by invite only. Opening public sign-up SHALL be an explicit operator
setting and SHALL be allowed only once the stage B gates are recorded as passed.

#### Scenario: A fresh deployment

- **WHEN** the service is deployed with default settings
- **THEN** a person without an invite cannot create a user

### Requirement: No third party sees user data in the browser or on the server

The pages SHALL load no script, font, style or image from another origin and SHALL send no analytics or error
reports elsewhere. The server SHALL send user data to no service except the bank a member connected, and email
addresses and codes to the mail service.

#### Scenario: Watching the page's network traffic

- **WHEN** every screen of the web client is opened with the network panel on
- **THEN** every request goes to the app's own origin

### Requirement: Development and the agent never touch production data

Development, tests and CI SHALL run on fictional data with keys made for the run. Production secrets and
data SHALL exist on the production host only — not in the repository, an image, CI or the agent's reach — and a
release SHALL deploy only after a manual approval.

#### Scenario: A clone of the repository

- **WHEN** the repository and the published images are searched
- **THEN** they contain no key, token, password, host address or user data

#### Scenario: A deploy

- **WHEN** a release is ready
- **THEN** it waits for the operator's approval before anything on the host changes

### Requirement: The operator is told when something needs them

The deployment SHALL report, without user data, when the service is down, a backup fails, the disk fills, the import
queue stops moving or a household becomes unavailable.

#### Scenario: A failed backup

- **WHEN** the nightly backup fails
- **THEN** the operator gets a notice naming the step that failed, and the previous backups stay
