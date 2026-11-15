import type { StateLookName } from './constants.ts';

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
  /** Spent, % of the amount, clamped to 0–100 for the bar; past the limit — the limit's share of what was spent. */
  fill: number;
  /** Past the limit: the share of the bar above the limit (hatched); 0 while not exceeded. */
  over: number;
  /** Where the pace allows by today, % of the bar (on the scale of what was spent past the limit); null — a day limit or a past month. */
  pace: number | null;
  /** The state's look: `ahead` for an on-track limit ahead of its plan, `strong` for an attention far ahead. */
  state: StateLookName;
  stateText: string;
  stateIcon: string;
  spentOf: string;
  /** «197 € planned by today · forecast 690 €» (the forecast from the fifth day); '' for a day limit or a past month. */
  paceText: string;
  perDay: string;
  /** «+ 2 pending, 650 ₴» and its hint: holds left out of the figures; null — none. */
  pending: { text: string; hint: string } | null;
  help: { perDay: GoalHelp; expected: GoalHelp | null; forecast: GoalHelp | null };
}
