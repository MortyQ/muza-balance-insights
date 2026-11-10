import type { ComputedRef, Ref } from 'vue';
import type { FopTaxOverview, Quarter } from '@contract/api.ts';
import type { Loadable } from '@/shared/lib';
import type { FOP_RATES, PERIOD_KINDS } from './constants.ts';

/** A rate preset (per cent). */
export type RatePreset = (typeof FOP_RATES)[number];
/** What the tax is counted from: the FOP accounts' income, all income of the view, or an amount the user types. */
export type BaseChoice = 'business' | 'all' | 'custom';
export type PeriodKind = (typeof PERIOD_KINDS)[number];

/** The picked period, every kind's own fields kept so switching back restores them. */
export interface PeriodPick {
  kind: PeriodKind;
  /** YYYY-MM. */
  month: string;
  year: number;
  quarter: Quarter;
  /** YYYY-MM-DD, from ≤ to. */
  from: string;
  to: string;
}

/** One result row: what was counted from, and the tax. */
export interface TaxRowView {
  /** «Income, Q4 2026» / «Income since 1 January» / «Your amount». */
  label: string;
  base: string;
  baseAlso: string[];
  tax: string;
  taxAlso: string[];
}

export interface FopTaxView {
  /** «5% from income»; '' — no valid percent yet. */
  rateText: string;
  /** The rows; empty while the percent or the typed amount is not valid. */
  rows: TaxRowView[];
  /** The period is not over: a note. */
  running: boolean;
  /** Currencies without a rate, left out; '' — none. */
  leftOut: string;
}

export interface UseFopTaxReturn {
  state: Readonly<Ref<Loadable<FopTaxOverview>>>;
  period: Ref<PeriodPick>;
  /** The preset picked; shown unmarked while a typed percent is valid. */
  rate: Ref<RatePreset>;
  percentText: Ref<string>;
  /** The base the screen counts from (the user's pick, or the default for the view). */
  base: Ref<BaseChoice>;
  /** «FOP accounts income» is offered: the view has a business account. */
  businessOffered: ComputedRef<boolean>;
  amountText: Ref<string>;
  today: string;
  /** The years offered, newest first. */
  years: ComputedRef<number[]>;
  /** Quarters after today's are not offered. */
  quarterAllowed: (q: Quarter) => boolean;
  /** The preset marked: null while a typed percent counts instead. */
  presetShown: ComputedRef<RatePreset | null>;
  /** A custom percent is typed and is not a valid one. */
  percentError: ComputedRef<boolean>;
  /** A custom amount is typed and is not a valid one. */
  amountError: ComputedRef<boolean>;
  view: ComputedRef<FopTaxView>;
}
