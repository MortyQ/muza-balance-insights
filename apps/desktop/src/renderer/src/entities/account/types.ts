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
  /** The amount in the other picked currencies, one row each of the column on the right; empty — no column. */
  fx: ReadonlyArray<{ symbol: string; code: string; amount: string }>;
  /** The amount is below zero: drawn in the soft red. */
  negative: boolean;
  /** With reserves set against the card: own funds («Actually») and the reserved amount; null — no reserve. */
  own: { amount: string; negative: boolean } | null;
  reserved: string | null;
  /**
   * The month's net: «In October», «+12 400 ₴» (no «≈»: the month panel says what was converted); `value` decides the
   * arrow and the tint; null — none.
   */
  net: { label: string; amount: string; value: number } | null;
  /**
   * The family card with two or more people: `items` — at most three, the largest first (first name, free amount in
   * whole units); `more` — «+2» for the rest, '' — none; `all` — everyone, the line's tooltip; `parts` — the bar, a
   * part per person whose amount is not zero, empty when nobody is above zero. null — no shares.
   */
  people: {
    items: ReadonlyArray<{ name: string; color: string; amount: string; negative: boolean }>;
    more: string;
    all: string;
    parts: ReadonlyArray<{ color: string; value: number }>;
  } | null;
  /** A person's card with reserves and own funds above zero: whole percent free, 0–100; null — no meter. */
  freeShare: number | null;
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
