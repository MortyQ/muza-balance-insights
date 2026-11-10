import type { ComputedRef, Ref } from 'vue';
import type { FopTaxOverview, Quarter } from '@contract/api.ts';
import type { Loadable } from '@/shared/lib';

/** The rate: a preset (per cent) or the user's own. */
export type RateChoice = number | 'custom';
/** What the tax is counted from: the income on the FOP accounts, or an amount the user types. */
export type BaseChoice = 'income' | 'custom';

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
  /** The quarter is running: a note. */
  running: boolean;
  /** Currencies without a rate, left out; '' — none. */
  leftOut: string;
}

export interface UseFopTaxReturn {
  state: Readonly<Ref<Loadable<FopTaxOverview>>>;
  year: Ref<number>;
  quarter: Ref<Quarter>;
  rate: Ref<RateChoice>;
  percentText: Ref<string>;
  base: Ref<BaseChoice>;
  amountText: Ref<string>;
  /** The years offered, newest first. */
  years: ComputedRef<number[]>;
  /** Quarters after today's are not offered. */
  quarterAllowed: (q: Quarter) => boolean;
  /** A custom percent is typed and is not a valid one. */
  percentError: ComputedRef<boolean>;
  /** A custom amount is typed and is not a valid one. */
  amountError: ComputedRef<boolean>;
  view: ComputedRef<FopTaxView | null>;
}
