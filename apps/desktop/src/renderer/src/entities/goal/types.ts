import type { LimitStateName } from '@contract/api.ts';

/** Amounts go through a structural money format (MoneyFormat fits; entities do not import each other). */
export interface Money {
  money(kopecks: number): string;
}

/** A «?» explanation: what it means, the formula with the user's numbers, the guide. */
export interface GoalHelp {
  title: string;
  lines: string[];
}

/** A limit's bar and words: spent of the amount, the pace marker, the state in words and an icon. */
export interface LimitLook {
  /** Spent, % of the amount, clamped to 0–100 for the bar. */
  fill: number;
  /** Where the pace allows by today, % of the bar; null — a day limit or a past month. */
  pace: number | null;
  state: LimitStateName;
  stateText: string;
  stateIcon: string;
  spentOf: string;
  /** «197 € planned by today · forecast 690 €»; '' for a day limit or a past month. */
  paceText: string;
  perDay: string;
  /** «+ 2 pending, 650 ₴» and its hint: holds left out of the figures; null — none. */
  pending: { text: string; hint: string } | null;
  help: { perDay: GoalHelp; expected: GoalHelp | null; forecast: GoalHelp | null };
}
