# Proposal

## Why

Users with a Slovenská sporiteľňa (SLSP) account in Slovakia do not see that money in the app. Its spending, income
and transfers are missing. SLSP gives a monthly account statement as a PDF in Slovak. The provider modules made a new
bank a contained task. This is the first bank whose rows carry neither an MCC nor a bank category.

## What Changes

- **A new provider `slsp`** (brand name «Slovenská sporiteľňa»):
  - files only (`access.token: null`);
  - prefixed ids;
  - one neutral card type `card`.
- **One PDF reader `slsp-account-pdf`** for the account statement in Slovak («Výpis z Účtu»). It reads six columns:
  value date, booking date, description, amount, fee and balance after the operation. A row spans several text lines:
  the operation type sits on the first line, the details below it. Rules for the file:
  - one file is one account: the IBAN and currency from its heading, and the masked number of every card its rows name;
  - the closing balance is taken from the heading;
  - the «Nezrealizované transakcie» section (operations not carried out) is skipped;
  - the reader checks the file against itself: the running balance row by row, the heading's totals and the opening
    and closing balances. A file that does not add up is refused as `bad-row`.
- **Times.** A card operation takes the date and time to the second that its details state. A transfer has the booking
  date only. Both are read in the bank's zone, Europe/Bratislava.
- **Foreign currency.** A card operation in another currency stores that amount and currency as the operation amount.
- **Fees.** The fee column becomes the row's commission, and the stored amount includes it, as Monobank's does.
- **The operation type is stored as the bank category**, as PrivatBank's category is. These types are known:
  - transfers: «Prijatá Okamžitá platba», «Okamžitá platba (elektronicky)», «SEPA platba (elektronicky)» and «Prijatá
    SEPA platba». An incoming one is income, an outgoing one is a payment to a person;
  - cash: «Výber kartou» is cash, «Vklad cez ATM» is income;
  - refunds: «Návrat tovaru»;
  - card payments: «Platba kartou», categorised by merchant keywords (below).

  An unknown type is reported by the re-derivation report, as an unknown bank category is today.
- **Merchant keyword hints (new kind of rule, needs the user's ok in this review).** A row of a bank with no MCC and
  no category hint from its type gets a category hint from keywords in the merchant text:
  - whole words only;
  - more specific keywords before general ones;
  - unknown → «other»;
  - a user override still wins.

  The list holds chains and brands only, never a small local place. It is proposed from SLSP's real statements, so it
  is reviewed here:

  | Keyword(s) | Hint |
  |---|---|
  | `TABAK PRESS`, `GECO TABAK`, `TRAFIKA` | none (known; listed before `BILLA`) |
  | `BILLA`, `LIDL`, `TESCO`, `TERNO` | groceries |
  | `MCDONALD S`, `KFC` | cafes |
  | `WOLT` | delivery |
  | `BOLT`, `IDS BK`, `REKOLA`, `NEXTBIKE`, `OMV` | transport |
  | `ORANGE` | telecom |
  | `ALZA`, `ALLEGRO` | marketplaces |
  | `DM` (first word only) | beauty |
  | `DR MAX`, `LEKAREN`, `APTEKA` | health |
  | `RESERVED` | clothing |
  | `CINEMA CITY`, `CINEMACITY`, `YOUTUBEPREMIUM` | entertainment |
  | `IKEA` | home |
  | `BIOTECH USA`, `PLAVAREN` | sport |

- **Masking.** No new templates. Descriptions are a merchant or a person's name, so they reach the analysis copy as
  `[other]` with their shape class. The operation type is the bank category, which never reaches the copy.
- **Statement kit.** `pdfTable` gains three options; the existing readers do not change:
  - a row that starts at its anchor line and runs down to the next one;
  - lines that end a page's table or the whole document's table;
  - each cell's separate lines.
- **Desktop:**
  - the bank's look (a monogram);
  - its card type name in `uk.json` / `en.json` / `ru.json`;
  - the generic file connection flow as is (no `PROVIDER_FORMS` entry).
- **`CHANGELOG.md`**, under `0.1.13 — unreleased`: «Slovenská sporiteľňa: add an account from its monthly PDF
  statement».

## Capabilities

### New Capabilities
- `core-slsp-provider`: reading the SLSP account statement, and how SLSP operations are understood (types, keyword
  categories, transfers, cash, refunds).

### Modified Capabilities
- None. The `pdfTable` options are internal to the reader kit and leave the A-Bank reader's behaviour as it is.

## Impact

- `packages/core`:
  - `providers/types.ts` (the id);
  - a new `providers/slsp/` folder: `info`, `rules`, `descriptions`, `categories`, `merchants`, `statement`;
  - the three registries;
  - `providers/statement-kit.ts`;
  - tests and conformance fixtures, fictional data only.
- `apps/desktop`: the bank look and three dictionaries. No IPC, network or storage change.
- `apps/mcp`: nothing. The recategorize output keeps its form; an unknown SLSP type shows up in the existing list of
  unknown bank categories.
- **Trust anchors:** none change.
- **User-visible:** yes, through the `CHANGELOG.md` entry above.

## Out of scope

- An SLSP API (George / PSD2) and any network access.
- SLSP exports other than the Slovak PDF: CSV, XLSX, MT940, an English statement.
- A shared keyword dictionary across banks. It stays in `providers/slsp/` until a second bank needs it.
- Pairing SLSP transfers with another bank by time: they have no time. Own transfers are still found by the
  counterparty IBAN when the user's other account's IBAN is known.
- A keyword-coverage line in the recategorize report: it would change that report's output, so it is a later change
  that needs its own ok.
- The account holder's name and address in the heading: never read.
