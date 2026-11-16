# Spec Delta

## Purpose

Says who a user of the web edition is and how a device stays signed in: passkeys, one-time email codes, sessions kept
on the server, the device list, and the fresh confirmation that sensitive actions need.

## ADDED Requirements

### Requirement: Sign-up proves the email and registers a passkey

The server SHALL create a usable user only after the email was proven with a one-time code and a passkey was
registered. While sign-up is closed, it SHALL create a user only for an email that holds a valid invite or is on the
operator's list.

#### Scenario: A new user signs up by invite

- **WHEN** a person opens a valid invite, proves their email with the code and registers a passkey
- **THEN** the user exists, is signed in with a passkey-strength session, and owns a personal household

#### Scenario: Sign-up is closed

- **WHEN** sign-up is closed and an email without an invite asks for a code
- **THEN** the answer is the same as for any other email, no user is created and no code is sent

### Requirement: Email codes are short-lived, single-use and do not reveal who has a user

A one-time email code SHALL expire after 10 minutes, work once, and be refused after 5 wrong tries. A request for a
code SHALL get the same answer whether the email has a user or not. Requests SHALL be limited per email and per
source address.

#### Scenario: A code is used twice

- **WHEN** a code that already signed someone in is sent again
- **THEN** it is refused

#### Scenario: Too many wrong tries

- **WHEN** five wrong codes were entered for a pending code
- **THEN** that code no longer works, including the right value

#### Scenario: Probing for users

- **WHEN** a code is requested for an email with a user and for one without
- **THEN** both requests get the same status and body

### Requirement: A passkey is the full sign-in; an email code gives a restricted session

Signing in with a passkey SHALL give a full session. Signing in with an email code SHALL give a restricted session:
it reads and makes ordinary edits, and every sensitive method is refused until a passkey is used.

#### Scenario: A restricted session tries a sensitive action

- **WHEN** a session started with an email code calls a method marked sensitive
- **THEN** the call is refused with the code `stale-auth` and nothing changes

### Requirement: Sessions live on the server and the cookie is out of script's reach

A session SHALL be an opaque random id stored only as a hash, sent as a host-bound cookie that scripts cannot read,
that is sent over TLS only and never on a cross-site request. A session SHALL end after its idle time or its
absolute lifetime, whichever comes first. No credential SHALL be placed where page scripts can read it.

#### Scenario: A session idles out

- **WHEN** a session was not used for longer than its idle time
- **THEN** the next call answers `unauthenticated` and the client shows sign-in

#### Scenario: A database copy holds no usable session

- **WHEN** the session table is read from a copy of the control database
- **THEN** it contains no value that can be sent as a session cookie

### Requirement: A user sees and ends their sessions

A user SHALL be able to list their sessions (device label, first and last use, sign-in strength), end any one of
them, and end all others. An ended session SHALL stop working on its next request.

#### Scenario: Signing a lost phone out

- **WHEN** the user ends the phone's session from another device
- **THEN** the phone's next call answers `unauthenticated`, and its open event stream closes

### Requirement: Sensitive actions need a fresh passkey confirmation

A method marked sensitive SHALL run only if the session's last passkey confirmation is at most 10 minutes old.
Sensitive methods are: entering or replacing a bank token, removing a connection, inviting, changing a role,
removing a member, exporting or deleting a household, adding or removing a passkey, and ending all other sessions.

#### Scenario: The confirmation is old

- **WHEN** a full session whose last passkey confirmation is 11 minutes old asks to replace a bank token
- **THEN** the call answers `stale-auth`, the client asks for the passkey, and the retry after it succeeds

### Requirement: Auto-lock is enforced by the server

A user SHALL be able to choose an idle time after which their sessions lock. A locked session SHALL be refused every
household method with the code `locked` until a passkey confirmation, whatever the client page does.

#### Scenario: A locked session calls the data directly

- **WHEN** a session idled past the user's auto-lock time and a data method is called without the client's lock
  screen
- **THEN** the call answers `locked` and returns no data

### Requirement: Recovery without a passkey waits and is announced

A user with no usable passkey SHALL be able to start recovery with an email code. Recovery SHALL wait 24 hours
before a new passkey can be added, SHALL notify the user's email and live sessions at once, and SHALL be cancellable
from any live session during the wait.

#### Scenario: Someone else has the mailbox

- **WHEN** recovery is started with an email code while the real user still has a signed-in device
- **THEN** that device shows the recovery notice, and cancelling it there ends the recovery with no passkey added

#### Scenario: The wait has passed

- **WHEN** 24 hours passed without a cancel and the person proves the email again
- **THEN** they can register a new passkey, and every older session of that user is ended
