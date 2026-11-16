# Spec Delta

## Purpose

Describes imports from bank APIs that run on the server while no device is open: the queue, one run per household,
retries and restarts, scheduled refreshes, bank webhooks as hints, and the progress clients see.

## ADDED Requirements

### Requirement: An import runs on the server and survives closed devices

A member SHALL be able to start an import for a chosen start date within the import range. The run SHALL continue
when every client is closed and SHALL be visible, with its progress, to any member who opens the household.

#### Scenario: The browser is closed mid-import

- **WHEN** a member starts an import and closes every device
- **THEN** the import goes on, and opening the household later shows it running or finished with its result

### Requirement: One import per household at a time

The server SHALL run at most one import per household. A second start while one runs SHALL be refused with
«import running», a manual start SHALL replace a scheduled refresh in progress, and statement uploads and
connection removals SHALL be refused while an import runs.

#### Scenario: Two members start at once

- **WHEN** two members start an import within the same second
- **THEN** one run starts and the other request answers «import running»

#### Scenario: An upload during an import

- **WHEN** a member commits a statement upload while an import runs
- **THEN** the upload is refused with «import running» and nothing is written

### Requirement: The bank's request limit holds per connection

The import SHALL respect each bank's request interval per connection across every process and restart, and
connections of one household SHALL take turns so that the newest data of each arrives first.

#### Scenario: A restart between two requests

- **WHEN** the worker restarts right after a request for a connection
- **THEN** its next request for that connection waits out the rest of the bank's interval

### Requirement: A run continues after a failure

A temporary failure — network, timeout, a bank error, a worker restart — SHALL pause the run and retry it — after
a minute, then every 15 minutes, for up to 4 hours of failures in a row. A retried run SHALL fetch only the windows not committed yet.

#### Scenario: The worker is redeployed

- **WHEN** the worker is replaced by a new version in the middle of a run
- **THEN** the run resumes by itself and fetches no window twice

#### Scenario: Failures for too long

- **WHEN** temporary failures last longer than the retry limit
- **THEN** the run ends with an error code, what was committed stays, and a new start continues from there

### Requirement: One connection's failure does not stop the others

A token the bank rejects, a holder mismatch or a missing token SHALL switch off only that connection for the run;
the run SHALL finish the others and report the failed ones by code.

#### Scenario: One rejected token of three

- **WHEN** an import of three connections runs and the bank rejects one token
- **THEN** the other two are imported, the result lists the rejected connection, and its status becomes «token
  needed»

### Requirement: A member can cancel a run

A member SHALL be able to cancel a running import. Cancelling SHALL stop requests to the bank within seconds and
keep everything committed so far.

#### Scenario: Cancel

- **WHEN** a member cancels a run that committed 10 of 40 windows
- **THEN** the run ends as cancelled, the 10 windows stay, and the figures are derived for them

### Requirement: Data is refreshed on a schedule

For a household with stored tokens and imported data, the server SHALL refresh the current month on a schedule and
re-read the recent window so that completed holds settle. A household SHALL be able to switch scheduled refreshes
off. A refresh SHALL NOT start while an import runs, and SHALL skip connections without a stored token silently.

#### Scenario: A hold completes days later

- **WHEN** a card hold from five days ago is settled by the bank and the next scheduled refresh runs
- **THEN** the operation is no longer shown as a hold

#### Scenario: Refreshes switched off

- **WHEN** a household switched scheduled refreshes off
- **THEN** no request goes to the bank until a member starts an import

### Requirement: A bank webhook is only a hint

Where a bank can call a webhook, a member SHALL be able to switch it on per connection. A webhook call SHALL only
queue a short re-read of that connection; its content SHALL never be written or shown. Calls SHALL be limited, and
an unknown address SHALL answer like a known one.

#### Scenario: A forged webhook call

- **WHEN** someone who learnt a webhook address posts an invented operation to it
- **THEN** nothing of the posted content is stored; at most one re-read of the real data is queued

#### Scenario: A burst of calls

- **WHEN** a webhook address is called fifty times in a minute
- **THEN** a single re-read is queued

### Requirement: Progress and results carry phases and counts only

What clients receive about a run SHALL be its phase, counts, dates and error codes. It SHALL carry no token, bank
text, amount, name or account number.

#### Scenario: Watching an import

- **WHEN** a member watches a run from start to end
- **THEN** every event holds only phases, counts, dates and codes, and the screens reload their figures as windows
  are committed

### Requirement: The worker reaches bank hosts only

The import worker SHALL send a bank's credential only to that bank's own host over TLS without redirects, and SHALL
have no outgoing network access beyond the banks' hosts.

#### Scenario: A redirect from the bank's host

- **WHEN** a bank host answers with a redirect to another host
- **THEN** the request fails with a code and the credential is sent nowhere else
