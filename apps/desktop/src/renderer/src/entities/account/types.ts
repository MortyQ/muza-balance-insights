/** What every balance card shows, the summary and an account alike. */
export interface CardFigures {
  title: string;
  caption: string;
  amount: string;
  /** Total cards: the amount in the other picked currencies («≈ 250 $ · 200 €»), under it; '' — none. */
  approx: string;
  /** Other currencies, one line under the amount; '' — none. */
  others: string;
  /** With reserves set against it: «Actually 3 000 € · reserved 1 500 €» under a free amount; '' — none. */
  actual: string;
  bottom: string;
  /** Net of the month: sign decides the arrow; null — no arrow and no text. */
  net: number | null;
  netText: string;
  /** Colours of the people the card is about (CSS values): the family — every person, one person or account — theirs. */
  accents: ReadonlyArray<string>;
  /** No data at that date: dimmed. */
  dim: boolean;
}

/** The total of a view: the family, a person. */
export type SummaryCardProps = CardFigures;

/** Banks with their own account card; a new bank needs a skin in BANK_CARDS. */
export type CardBank = 'monobank';

/** What a bank's skin takes. */
export type BankCardProps = CardFigures;

export interface AccountCardProps extends CardFigures {
  bank: CardBank;
}
