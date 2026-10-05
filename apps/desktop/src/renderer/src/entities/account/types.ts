export interface BalanceCardProps {
  title: string;
  caption: string;
  amount: string;
  /** Total cards: the amount in the other picked currencies («≈ 250 $ · 200 €»), under it; '' — none. */
  approx: string;
  /** Other currencies, one line under the amount; '' — none. */
  others: string;
  bottom: string;
  /** Net of the month: sign decides the arrow; null — no arrow and no text. */
  net: number | null;
  netText: string;
  /** Colours of the corner circles (CSS values): the family — every person, one person or account — theirs. */
  accents: ReadonlyArray<string>;
  /** No data at that date: dimmed. */
  dim: boolean;
}
