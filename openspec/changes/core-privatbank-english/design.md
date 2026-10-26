# Design

## Context

`providers/privatbank/statement.ts` holds one reader, `privatbank-card-uk`. It has a column list of ten Ukrainian
headers and a title pattern on top of `statement-kit.ts`. `categories.ts` maps Ukrainian bank categories, and
`descriptions.ts` holds the Ukrainian service texts that `rules.ts` uses for transfers, income sources and masking.

The user ran a masking script over a real English statement. Nothing personal was kept: digits and letters were masked,
and only the headers, bank categories and currency codes were printed. Across 179 rows it showed:

| | Observed |
|---|---|
| Sheet | one sheet, `Statement` |
| Row 1 | «Transaction history for the period 99.99.9999 - 99.99.9999» in the first cell |
| Row 2 | `Date`, `Category`, `Card`, `Description`, `Amount in card currency`, `Card currency`, `Amount in transaction currency`, `Transaction currency`, `Rest at the end of the period`, `Rest currency` |
| Date | text `99.99.9999 99:99:99` |
| Amounts | numbers: the card amount signed, the operation amount unsigned |
| Card | `9999 **** **** 9999` |
| Currencies | card and rest `UAH`; transaction `UAH`, `USD`, `EUR` |
| Trailing rows | empty formatted rows after the operations (181 non-empty of 972) |
| Fees | debits over their operation amount and credits under it, in the same currency, as in Ukrainian |

The 27 categories seen, each with its Ukrainian pair or a new entry:

| English | Ukrainian pair | Hint |
|---|---|---|
| Supermarkets and groceries | Супермаркети та продукти | groceries |
| Restaurants, cafes, bars | Ресторани, кафе, бари | cafes |
| Transport | Транспорт | transport |
| Taxi | Таксі | transport |
| Pharmacies | Аптеки | health |
| Beauty | Краса | beauty |
| Clothes and shoes | Одяг та взуття | clothing |
| Home and repair | Дім та ремонт | home |
| Household appliances | Побутова техніка | home |
| Mobile top-up | Поповнення мобільного | telecom |
| Utilities and Internet | Комуналка та Інтернет | utilities |
| Entertainment | Розваги | entertainment |
| Digital goods | Цифрові товари | entertainment |
| Cinema | none seen yet | entertainment |
| Online stores | Інтернет-магазини | marketplaces |
| Cash withdrawal | Зняття готівки | cash |
| Education | Освіта | education |
| Flowers | Квіти | gifts |
| Foundations and organizations | Фонди та організації | charity |
| Enrollment | Зарахування | income |
| Services | Послуги | null |
| Other | Інше | null |
| Transfers | Перекази | transfer set |
| Transfer crediting | Зарахування переказу | transfer set |
| Transfer to my card | Переказ на свою картку | transfer set |
| Transfer from my card | Зарахування зі своєї картки | transfer set |
| Savings | Заощадження | transfer set |

The service texts, as masked shapes with the service words kept:
- «To my card *9999» and «From my card *9999»;
- «Moneybox»;
- «ATM cash withdrawal»;
- «from <name>».

**Follows:**
- `.agents/project/core-providers.md`: provider halves, readers, conformance. It is updated: the PrivatBank section
  names both readers and both languages.
- `.agents/project/domain-rules.md`: the bank's category is stored as stated, and masking is the provider's.

## Goals / Non-Goals

**Goals:**
- Read the English card statement with the same results as the Ukrainian one.
- Understand its categories and service texts the same way.

**Non-Goals:**
- PDF, FOP.
- English names not seen yet.
- Normalising stored categories to one language.

## Decisions

### 1. Two readers over one layout, one per language
`statement.ts` gets a per-language table (title pattern, column regexes) and builds two `StatementReader`s from the
same `layoutOf` / `readRow` / `read` code: `privatbank-card-uk` (unchanged id) and `privatbank-card-en`. Each `detect`
matches only its own language: 2 with the title row, 1 with the headers alone. So `pickReader` never sees a tie.

Alternatives:
- **One reader that accepts either set of headers.** Rejected. One id would hide which language a file was in, and
  the Monobank precedent (`monobank-card-uk`) names the language in the id.
- **Translate the English file into Ukrainian at read time.** Rejected. It would invent bank text the file does not
  hold, against «stored as the bank states it».

### 2. English categories stored as stated, added to the same table
`BANK_CATEGORIES` and `TRANSFER_CATEGORIES` gain the English names next to the Ukrainian ones, with the hints in the
table above. `bank_category` keeps what the file says, so a later mapping fix applies at the next re-derivation, as
today.

Alternative: map English names to the Ukrainian ones before storing. Rejected for the same reason as 1. Only the
diagnostics report would gain from one name per category.

**Verdict:** one table, both languages.

### 3. English service texts beside the Ukrainian ones
`descriptions.ts` gains:
- `OWN_CARD_TO_EN_RE = /^To my card \*\d{4}$/`;
- `OWN_CARD_FROM_EN_RE = /^From my card \*\d{4}$/`;
- `JAR_TEXT_EN = 'Moneybox'`;
- `CASH_TEXT_EN = 'ATM cash withdrawal'`;
- `FROM_PREFIX_EN_RE = /^from\s+(\S.*)$/`.

`isOwnCardText`, the jar check, `namedSender` and `classifyShape` test both languages.
- `namedSender` returns the label the text uses (`від` or `from`).
- Matching is case-sensitive, as the shapes showed the case.
- The bank's English cash row with an ATM id and place (`ATM <name> 99999-999, <city>`) stays free text: `[other]`.

### 4. Masking keeps four more templates (the user's ok, at review)
`maskDescription` keeps, verbatim, «Moneybox», «ATM cash withdrawal» and the own-card texts with the digits as `9999`.
«from <sender>» stays `[other]` with the `from_prefix` class. Nothing else changes in the analysis whitelist. The
proposal names this for the user's ok, as the root `CLAUDE.md` requires.

## Risks / Trade-offs

- **Unseen English categories** (the English forms of «Платежі за реквізитами» and «Платежі до бюджету», «Cinema»'s
  Ukrainian pair). They get the default category and are listed by the re-derivation report until added from a masked
  file. → `docs/backlog.md`.
- **Treasury payments in English.** `TREASURY_RE` matches Cyrillic payee names. Whether the English export
  transliterates them is not known from this file. → `docs/backlog.md`.
- **Mixed languages for one card** store some rows under Ukrainian category names and some under English. Both map to
  the same hint, so figures agree. The diagnostics may show both names.
