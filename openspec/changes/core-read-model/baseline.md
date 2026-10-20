# Baseline

Measured with `pnpm --filter @mono/core bench`.

- **Dataset:** `bench/generate.ts` `DEFAULT_BENCH`. Fictional data: 40 001 operations over 1 095 days, a 1 000-byte
  payload per operation, two participants, a jar disabled by the auto rule.
- **Machine:** the author's Mac, Node 22.14.
- **Timing:** the best of several runs of each case. Three encrypted runs differed by under 4%.

## Before the change (encrypted file, 63.1 MB)

| case                     |      ms | temporary budget |
|--------------------------|--------:|-----------------:|
| month by category        |   178.6 |              220 |
| month income by source   |   177.4 |              215 |
| 12 months by month       |   627.4 |              755 |
| 12 months by day         |   703.8 |              870 |
| spending block set       |  9 444  |           11 250 |
| balances at two instants |     1.2 |                5 |
| full re-derivation       |  3 071  |            3 700 |

The same dataset in a plain file, for comparison:

| case                     | ms     |
|--------------------------|-------:|
| month by category        |   12.9 |
| month income by source   |   12.2 |
| 12 months by month       |   54.2 |
| 12 months by day         |  131.1 |
| spending block set       |  586.5 |
| balances at two instants |    1.2 |
| full re-derivation       |  1 163 |

Notes:

- The «spending block set» replays the 19 statistics that the desktop's «Spending» block asks of the core today.
- Every generated row has a stored balance, so `balancesAt` never takes the reverse-sum path here. That path is
  covered by `balances-at.test.ts`, not timed.

## After the change

Filled in by task 7.1.
