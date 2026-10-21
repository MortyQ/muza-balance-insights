/** What an account (bank) card shows. */
export interface CardFigures {
  title: string;
  caption: string;
  amount: string;
  /** Total cards: the amount in the other picked currencies («≈ 250 $ · 200 €»), under it; '' — none. */
  approx: string;
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

/**
 * The total of a view (the family, a person): each figure apart, so the card lays them out — the header band, the
 * amount with its conversion, the tiles.
 */
export interface SummaryCardProps {
  title: string;
  /** «Free · today», «Own funds · on 3 Oct». */
  caption: string;
  /** People and accounts: «3 people · 7 accounts · without 1 account». */
  count: string;
  amount: string;
  /** The amount in the other picked currencies («≈ 250 $ · 200 €»); '' — none. */
  approx: string;
  /** The amount is below zero: drawn in the soft red. */
  negative: boolean;
  /** With reserves set against the card: own funds («Actually») and the reserved amount; null — no reserve. */
  own: { amount: string; negative: boolean } | null;
  reserved: string | null;
  /** The month's net: «In October», «≈ +12 400 ₴»; `value` decides the arrow and the tint; null — none. */
  net: { label: string; amount: string; value: number } | null;
  /** Colours of the people the card adds up (CSS values): the header band and the dots. */
  accents: ReadonlyArray<string>;
  /** No data at that date: dimmed. */
  dim: boolean;
}

/** Banks with their own account card; a new bank needs a skin in BANK_CARDS. */
export type CardBank = 'monobank';

/** What a bank's skin takes. */
export type BankCardProps = CardFigures;

export interface AccountCardProps extends CardFigures {
  bank: CardBank;
}
