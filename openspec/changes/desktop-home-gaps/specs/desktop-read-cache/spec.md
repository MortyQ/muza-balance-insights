## ADDED Requirements

### Requirement: One request for the same read at once
Two reads with the same method and arguments asked while the first is still on its way SHALL share one request to
main and get the same answer. A read asked after a data change SHALL NOT share a request that started before it.

#### Scenario: Home's spending block and its unusual slide
- **WHEN** home opens and both the spending block and the «What's unusual» slide ask for the month's spending
- **THEN** main receives one request, and both show its answer
